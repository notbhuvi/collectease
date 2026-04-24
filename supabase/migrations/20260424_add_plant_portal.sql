create extension if not exists "uuid-ossp";

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%';

  if constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end if;
exception
  when undefined_table then
    null;
end $$;

alter table if exists public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'accounts', 'transport_team', 'transporter', 'plant_ops'));

create table if not exists public.plant_production_logs (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  shift text not null default 'General' check (shift in ('A', 'B', 'C', 'General')),
  product_name text not null,
  sku text,
  qty numeric(14, 3) not null default 0,
  unit text not null default 'Nos',
  machine text,
  operator text,
  remarks text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.raw_materials (
  id uuid primary key default uuid_generate_v4(),
  material_name text not null unique,
  unit text not null default 'kg',
  min_level numeric(14, 3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.raw_material_transactions (
  id uuid primary key default uuid_generate_v4(),
  material_id uuid not null references public.raw_materials(id) on delete cascade,
  date date not null default current_date,
  type text not null check (type in ('opening', 'inward', 'consumed', 'adjustment')),
  qty numeric(14, 3) not null default 0,
  rate numeric(14, 2),
  remarks text,
  created_at timestamptz not null default now()
);

create table if not exists public.finished_goods_stock (
  id uuid primary key default uuid_generate_v4(),
  product_name text not null,
  sku text unique,
  qty numeric(14, 3) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.fg_dispatches (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  customer_name text not null,
  invoice_no text,
  truck_no text,
  destination text,
  product_name text not null,
  sku text,
  qty numeric(14, 3) not null default 0,
  remarks text,
  status text not null default 'completed' check (status in ('pending', 'completed', 'cancelled'))
);

create table if not exists public.warehouse_items (
  id uuid primary key default uuid_generate_v4(),
  item_name text not null,
  sku text unique,
  category text,
  unit text not null default 'Nos',
  opening_stock numeric(14, 3) not null default 0,
  current_stock numeric(14, 3) not null default 0,
  reserved_stock numeric(14, 3) not null default 0,
  min_level numeric(14, 3) not null default 0,
  unit_rate numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.warehouse_movements (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references public.warehouse_items(id) on delete cascade,
  date date not null default current_date,
  type text not null check (type in ('inward', 'outward', 'adjustment')),
  qty numeric(14, 3) not null default 0,
  reference_no text,
  remarks text
);

create index if not exists idx_plant_production_logs_date on public.plant_production_logs(date);
create index if not exists idx_plant_production_logs_sku on public.plant_production_logs(sku);
create index if not exists idx_raw_material_transactions_material_date on public.raw_material_transactions(material_id, date);
create index if not exists idx_fg_dispatches_date on public.fg_dispatches(date);
create index if not exists idx_warehouse_items_category on public.warehouse_items(category);
create index if not exists idx_warehouse_movements_item_date on public.warehouse_movements(item_id, date);

create or replace function public.refresh_finished_goods_for_sku(p_sku text, p_product_name text)
returns void
language plpgsql
as $$
declare
  produced_qty numeric(14, 3);
  dispatched_qty numeric(14, 3);
begin
  if p_sku is null and p_product_name is null then
    return;
  end if;

  select coalesce(sum(qty), 0)
    into produced_qty
  from public.plant_production_logs
  where coalesce(sku, '') = coalesce(p_sku, '')
    and coalesce(product_name, '') = coalesce(p_product_name, '');

  select coalesce(sum(qty), 0)
    into dispatched_qty
  from public.fg_dispatches
  where status = 'completed'
    and coalesce(sku, '') = coalesce(p_sku, '')
    and coalesce(product_name, '') = coalesce(p_product_name, '');

  insert into public.finished_goods_stock (product_name, sku, qty, updated_at)
  values (coalesce(p_product_name, p_sku, 'Unknown'), p_sku, produced_qty - dispatched_qty, now())
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
  perform public.refresh_finished_goods_for_sku(new.sku, new.product_name);
  if tg_op <> 'INSERT' then
    perform public.refresh_finished_goods_for_sku(old.sku, old.product_name);
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_refresh_finished_goods_from_production on public.plant_production_logs;
create trigger trg_refresh_finished_goods_from_production
after insert or update or delete on public.plant_production_logs
for each row execute function public.refresh_finished_goods_trigger();

drop trigger if exists trg_refresh_finished_goods_from_dispatch on public.fg_dispatches;
create trigger trg_refresh_finished_goods_from_dispatch
after insert or update or delete on public.fg_dispatches
for each row execute function public.refresh_finished_goods_trigger();

create or replace function public.refresh_warehouse_item_stock(p_item_id uuid)
returns void
language plpgsql
as $$
declare
  opening_qty numeric(14, 3);
  movement_delta numeric(14, 3);
begin
  select coalesce(opening_stock, 0) into opening_qty
  from public.warehouse_items
  where id = p_item_id;

  select coalesce(sum(
    case
      when type = 'inward' then qty
      when type = 'outward' then -qty
      else qty
    end
  ), 0)
  into movement_delta
  from public.warehouse_movements
  where item_id = p_item_id;

  update public.warehouse_items
  set current_stock = opening_qty + movement_delta,
      updated_at = now()
  where id = p_item_id;
end $$;

create or replace function public.refresh_warehouse_item_stock_trigger()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_warehouse_item_stock(coalesce(new.item_id, old.item_id));
  return coalesce(new, old);
end $$;

drop trigger if exists trg_refresh_warehouse_stock on public.warehouse_movements;
create trigger trg_refresh_warehouse_stock
after insert or update or delete on public.warehouse_movements
for each row execute function public.refresh_warehouse_item_stock_trigger();

alter table public.plant_production_logs enable row level security;
alter table public.raw_materials enable row level security;
alter table public.raw_material_transactions enable row level security;
alter table public.finished_goods_stock enable row level security;
alter table public.fg_dispatches enable row level security;
alter table public.warehouse_items enable row level security;
alter table public.warehouse_movements enable row level security;

drop policy if exists plant_production_access on public.plant_production_logs;
drop policy if exists raw_materials_access on public.raw_materials;
drop policy if exists raw_material_transactions_access on public.raw_material_transactions;
drop policy if exists finished_goods_stock_access on public.finished_goods_stock;
drop policy if exists fg_dispatches_access on public.fg_dispatches;
drop policy if exists warehouse_items_access on public.warehouse_items;
drop policy if exists warehouse_movements_access on public.warehouse_movements;

create policy plant_production_access
  on public.plant_production_logs
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'plant_ops')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'plant_ops')
    )
  );

create policy raw_materials_access
  on public.raw_materials
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'plant_ops')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'plant_ops')
    )
  );

create policy raw_material_transactions_access
  on public.raw_material_transactions
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'plant_ops')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'plant_ops')
    )
  );

create policy finished_goods_stock_access
  on public.finished_goods_stock
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'plant_ops')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'plant_ops')
    )
  );

create policy fg_dispatches_access
  on public.fg_dispatches
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'plant_ops')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'plant_ops')
    )
  );

create policy warehouse_items_access
  on public.warehouse_items
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'plant_ops')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'plant_ops')
    )
  );

create policy warehouse_movements_access
  on public.warehouse_movements
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'plant_ops')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'plant_ops')
    )
  );
