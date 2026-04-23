-- ============================================================
-- SIRPL Transport Module - Quantity Unit + Bid Total Support
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================

alter table public.transport_loads
  add column if not exists quantity_value numeric,
  add column if not exists quantity_unit text;

alter table public.transport_bids
  add column if not exists total_amount numeric;

update public.transport_loads
set quantity_unit = coalesce(quantity_unit, 'MT')
where quantity_unit is null;

alter table public.transport_loads
  alter column quantity_unit set default 'MT';

alter table public.transport_loads
  drop constraint if exists transport_loads_quantity_unit_check;

alter table public.transport_loads
  add constraint transport_loads_quantity_unit_check
  check (quantity_unit in ('MT', 'Package', 'PCS', 'KG'));

update public.transport_bids tb
set total_amount = case
  when tl.quantity_value is not null then tb.bid_amount * tl.quantity_value
  else tb.total_amount
end
from public.transport_loads tl
where tl.id = tb.load_id
  and tb.total_amount is null;
