create or replace function public.normalize_fg_sku(p_product_name text, p_sku text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(btrim(p_sku), ''),
    case
      when nullif(btrim(p_product_name), '') is null then null
      else 'FG-' || left(
        trim(both '-' from regexp_replace(upper(btrim(p_product_name)), '[^A-Z0-9]+', '-', 'g')),
        48
      )
    end
  )
$$;

update public.plant_production_logs
set sku = public.normalize_fg_sku(product_name, sku)
where nullif(btrim(coalesce(sku, '')), '') is null
  and nullif(btrim(coalesce(product_name, '')), '') is not null;

update public.fg_dispatches
set sku = public.normalize_fg_sku(product_name, sku)
where nullif(btrim(coalesce(sku, '')), '') is null
  and nullif(btrim(coalesce(product_name, '')), '') is not null;

create or replace function public.refresh_finished_goods_for_sku(p_sku text, p_product_name text)
returns void
language plpgsql
as $$
declare
  effective_sku text;
  effective_name text;
  produced_qty numeric(14, 3);
  dispatched_qty numeric(14, 3);
begin
  effective_sku := public.normalize_fg_sku(p_product_name, p_sku);
  effective_name := coalesce(nullif(btrim(p_product_name), ''), effective_sku, 'Unknown');

  if effective_sku is null and effective_name is null then
    return;
  end if;

  select coalesce(sum(qty), 0)
    into produced_qty
  from public.plant_production_logs
  where public.normalize_fg_sku(product_name, sku) = effective_sku;

  select coalesce(sum(qty), 0)
    into dispatched_qty
  from public.fg_dispatches
  where status = 'completed'
    and public.normalize_fg_sku(product_name, sku) = effective_sku;

  insert into public.finished_goods_stock (product_name, sku, qty, updated_at)
  values (effective_name, effective_sku, produced_qty - dispatched_qty, now())
  on conflict (sku) do update
    set product_name = excluded.product_name,
        qty = excluded.qty,
        updated_at = now();
end $$;

create or replace function public.refresh_finished_goods_trigger()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_finished_goods_for_sku(coalesce(new.sku, old.sku), coalesce(new.product_name, old.product_name));

  if tg_op <> 'INSERT' then
    perform public.refresh_finished_goods_for_sku(old.sku, old.product_name);
  end if;

  return coalesce(new, old);
end $$;

delete from public.finished_goods_stock;

insert into public.finished_goods_stock (product_name, sku, qty, updated_at)
select
  source.product_name,
  source.sku,
  coalesce(prod.produced_qty, 0) - coalesce(disp.dispatched_qty, 0) as qty,
  now()
from (
  select distinct
    coalesce(nullif(btrim(product_name), ''), public.normalize_fg_sku(product_name, sku), 'Unknown') as product_name,
    public.normalize_fg_sku(product_name, sku) as sku
  from public.plant_production_logs
  where public.normalize_fg_sku(product_name, sku) is not null

  union

  select distinct
    coalesce(nullif(btrim(product_name), ''), public.normalize_fg_sku(product_name, sku), 'Unknown') as product_name,
    public.normalize_fg_sku(product_name, sku) as sku
  from public.fg_dispatches
  where public.normalize_fg_sku(product_name, sku) is not null
) source
left join (
  select
    public.normalize_fg_sku(product_name, sku) as sku,
    sum(qty) as produced_qty
  from public.plant_production_logs
  group by 1
) prod on prod.sku = source.sku
left join (
  select
    public.normalize_fg_sku(product_name, sku) as sku,
    sum(qty) as dispatched_qty
  from public.fg_dispatches
  where status = 'completed'
  group by 1
) disp on disp.sku = source.sku
on conflict (sku) do update
  set product_name = excluded.product_name,
      qty = excluded.qty,
      updated_at = now();
