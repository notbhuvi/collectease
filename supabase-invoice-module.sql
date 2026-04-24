-- ============================================================
-- CollectEase Invoice / Accounts Module
-- Safe to run on existing Supabase project
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- BUSINESSES
-- ============================================================
create table if not exists public.businesses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  name text not null,
  gstin text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  pincode text,
  logo_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.businesses enable row level security;

drop policy if exists "Users can manage their own business" on public.businesses;
create policy "Users can manage their own business"
  on public.businesses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_businesses_user_id on public.businesses(user_id);

-- ============================================================
-- CLIENTS
-- ============================================================
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  name text not null,
  email text,
  phone text,
  gstin text,
  address text,
  city text,
  state text,
  contact_person text,
  risk_label text default 'good' check (risk_label in ('good', 'moderate', 'risky')),
  avg_delay_days numeric default 0,
  total_invoices integer default 0,
  delayed_invoices integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.clients enable row level security;

drop policy if exists "Users can manage their business clients" on public.clients;
create policy "Users can manage their business clients"
  on public.clients for all
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );

create index if not exists idx_clients_business_id on public.clients(business_id);

-- ============================================================
-- INVOICES
-- ============================================================
create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete set null,
  invoice_number text not null,
  amount numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) default 0,
  total_amount numeric(12, 2) not null default 0,
  due_date date not null,
  issue_date date default current_date not null,
  status text default 'sent' check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  description text,
  notes text,
  reminder_count integer default 0,
  last_reminder_at timestamptz,
  reminder_initial_delay integer default 0,
  reminder_interval_days integer default 7,
  paid_at timestamptz,
  paid_amount numeric(12, 2),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(business_id, invoice_number)
);

alter table public.invoices enable row level security;

drop policy if exists "Users can manage their business invoices" on public.invoices;
create policy "Users can manage their business invoices"
  on public.invoices for all
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );

create index if not exists idx_invoices_business_id on public.invoices(business_id);
create index if not exists idx_invoices_client_id on public.invoices(client_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_due_date on public.invoices(due_date);

-- ============================================================
-- REMINDERS
-- ============================================================
create table if not exists public.reminders (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  business_id uuid references public.businesses(id) on delete cascade not null,
  type text not null check (type in ('friendly', 'firm', 'final_warning', 'legal')),
  channel text not null check (channel in ('email', 'whatsapp', 'both')),
  message text not null,
  sent_at timestamptz default now(),
  status text default 'sent' check (status in ('sent', 'failed', 'pending')),
  error text,
  created_at timestamptz default now() not null
);

alter table public.reminders enable row level security;

drop policy if exists "Users can view their business reminders" on public.reminders;
create policy "Users can view their business reminders"
  on public.reminders for all
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );

create index if not exists idx_reminders_invoice_id on public.reminders(invoice_id);
create index if not exists idx_reminders_business_id on public.reminders(business_id);

-- ============================================================
-- PAYMENTS
-- ============================================================
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  business_id uuid references public.businesses(id) on delete cascade not null,
  amount numeric(12, 2) not null,
  payment_date date default current_date not null,
  payment_method text,
  reference text,
  notes text,
  created_at timestamptz default now() not null
);

alter table public.payments enable row level security;

drop policy if exists "Users can manage their business payments" on public.payments;
create policy "Users can manage their business payments"
  on public.payments for all
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );

create index if not exists idx_payments_invoice_id on public.payments(invoice_id);
create index if not exists idx_payments_business_id on public.payments(business_id);

-- ============================================================
-- ESCALATION LOGS
-- ============================================================
create table if not exists public.escalation_logs (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  business_id uuid references public.businesses(id) on delete cascade not null,
  type text not null check (type in ('formal_reminder', 'legal_notice', 'msme_complaint')),
  document_url text,
  created_at timestamptz default now() not null
);

alter table public.escalation_logs enable row level security;

drop policy if exists "Users can manage their escalation logs" on public.escalation_logs;
create policy "Users can manage their escalation logs"
  on public.escalation_logs for all
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );

create index if not exists idx_escalation_logs_invoice_id on public.escalation_logs(invoice_id);

-- ============================================================
-- FUNCTIONS / TRIGGERS
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_businesses_updated_at on public.businesses;
create trigger update_businesses_updated_at
  before update on public.businesses
  for each row execute function public.update_updated_at();

drop trigger if exists update_clients_updated_at on public.clients;
create trigger update_clients_updated_at
  before update on public.clients
  for each row execute function public.update_updated_at();

drop trigger if exists update_invoices_updated_at on public.invoices;
create trigger update_invoices_updated_at
  before update on public.invoices
  for each row execute function public.update_updated_at();

create or replace function public.mark_overdue_invoices()
returns void as $$
begin
  update public.invoices
  set status = 'overdue'
  where status = 'sent'
    and due_date < current_date;
end;
$$ language plpgsql;

create or replace function public.recompute_client_risk(p_client_id uuid)
returns void as $$
declare
  v_total integer;
  v_delayed integer;
  v_avg_delay numeric;
  v_risk text;
  v_delay_pct numeric;
begin
  select
    count(*),
    count(*) filter (
      where status in ('overdue', 'paid')
      and (
        (status = 'paid' and paid_at::date > due_date) or
        status = 'overdue'
      )
    ),
    coalesce(avg(
      case
        when status = 'paid' and paid_at::date > due_date
          then extract(day from paid_at - due_date::timestamptz)
        when status = 'overdue'
          then extract(day from now() - due_date::timestamptz)
        else 0
      end
    ), 0)
  into v_total, v_delayed, v_avg_delay
  from public.invoices
  where client_id = p_client_id and status != 'cancelled';

  v_delay_pct := case when v_total > 0 then (v_delayed::numeric / v_total) * 100 else 0 end;

  v_risk := case
    when v_avg_delay <= 7 and v_delay_pct <= 20 then 'good'
    when v_avg_delay <= 30 and v_delay_pct <= 50 then 'moderate'
    else 'risky'
  end;

  update public.clients
  set
    total_invoices = v_total,
    delayed_invoices = v_delayed,
    avg_delay_days = round(v_avg_delay, 1),
    risk_label = v_risk
  where id = p_client_id;
end;
$$ language plpgsql;

create or replace function public.handle_invoice_client_risk()
returns trigger as $$
begin
  if new.client_id is not null then
    perform public.recompute_client_risk(new.client_id);
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.client_id is not null and old.client_id != new.client_id then
    perform public.recompute_client_risk(old.client_id);
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists invoice_client_risk_after_insert on public.invoices;
create trigger invoice_client_risk_after_insert
  after insert on public.invoices
  for each row execute function public.handle_invoice_client_risk();

drop trigger if exists invoice_client_risk_after_update on public.invoices;
create trigger invoice_client_risk_after_update
  after update on public.invoices
  for each row execute function public.handle_invoice_client_risk();

drop trigger if exists invoice_client_risk_after_delete on public.invoices;
create trigger invoice_client_risk_after_delete
  after delete on public.invoices
  for each row execute function public.handle_invoice_client_risk();

-- ============================================================
-- OPTIONAL BOOTSTRAP BUSINESS
-- Creates one invoice business for the first admin/accounts user
-- so the dashboard can start working immediately.
-- ============================================================
insert into public.businesses (
  user_id, name, gstin, phone, email, address, city, state, pincode
)
select
  p.id,
  'Samwha India Refractories Pvt. Ltd.',
  '21AAFCS4820R1ZD',
  '+91 00000 00000',
  p.email,
  'Corporate Office',
  'Bhubaneswar',
  'Odisha',
  '751024'
from public.profiles p
where p.role in ('admin', 'accounts')
  and not exists (select 1 from public.businesses b where b.user_id = p.id)
order by case when p.role = 'admin' then 0 else 1 end, p.created_at
limit 1;
