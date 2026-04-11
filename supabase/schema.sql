-- CollectEase Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- BUSINESSES
-- ============================================================
create table if not exists businesses (
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

alter table businesses enable row level security;

create policy "Users can manage their own business"
  on businesses for all
  using (auth.uid() = user_id);

-- ============================================================
-- CLIENTS
-- ============================================================
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade not null,
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

alter table clients enable row level security;

create policy "Users can manage their business clients"
  on clients for all
  using (
    business_id in (
      select id from businesses where user_id = auth.uid()
    )
  );

create index idx_clients_business_id on clients(business_id);

-- ============================================================
-- INVOICES
-- ============================================================
create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade not null,
  client_id uuid references clients(id) on delete set null,
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
  paid_at timestamptz,
  paid_amount numeric(12, 2),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(business_id, invoice_number)
);

alter table invoices enable row level security;

create policy "Users can manage their business invoices"
  on invoices for all
  using (
    business_id in (
      select id from businesses where user_id = auth.uid()
    )
  );

create index idx_invoices_business_id on invoices(business_id);
create index idx_invoices_client_id on invoices(client_id);
create index idx_invoices_status on invoices(status);
create index idx_invoices_due_date on invoices(due_date);

-- ============================================================
-- REMINDERS
-- ============================================================
create table if not exists reminders (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references invoices(id) on delete cascade not null,
  business_id uuid references businesses(id) on delete cascade not null,
  type text not null check (type in ('friendly', 'firm', 'final_warning', 'legal')),
  channel text not null check (channel in ('email', 'whatsapp', 'both')),
  message text not null,
  sent_at timestamptz default now(),
  status text default 'sent' check (status in ('sent', 'failed', 'pending')),
  error text,
  created_at timestamptz default now() not null
);

alter table reminders enable row level security;

create policy "Users can view their business reminders"
  on reminders for all
  using (
    business_id in (
      select id from businesses where user_id = auth.uid()
    )
  );

create index idx_reminders_invoice_id on reminders(invoice_id);
create index idx_reminders_business_id on reminders(business_id);

-- ============================================================
-- PAYMENTS
-- ============================================================
create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references invoices(id) on delete cascade not null,
  business_id uuid references businesses(id) on delete cascade not null,
  amount numeric(12, 2) not null,
  payment_date date default current_date not null,
  payment_method text,
  reference text,
  notes text,
  created_at timestamptz default now() not null
);

alter table payments enable row level security;

create policy "Users can manage their business payments"
  on payments for all
  using (
    business_id in (
      select id from businesses where user_id = auth.uid()
    )
  );

create index idx_payments_invoice_id on payments(invoice_id);
create index idx_payments_business_id on payments(business_id);

-- ============================================================
-- ESCALATION LOGS
-- ============================================================
create table if not exists escalation_logs (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references invoices(id) on delete cascade not null,
  business_id uuid references businesses(id) on delete cascade not null,
  type text not null check (type in ('formal_reminder', 'legal_notice', 'msme_complaint')),
  document_url text,
  created_at timestamptz default now() not null
);

alter table escalation_logs enable row level security;

create policy "Users can manage their escalation logs"
  on escalation_logs for all
  using (
    business_id in (
      select id from businesses where user_id = auth.uid()
    )
  );

create index idx_escalation_logs_invoice_id on escalation_logs(invoice_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_businesses_updated_at
  before update on businesses
  for each row execute function update_updated_at();

create trigger update_clients_updated_at
  before update on clients
  for each row execute function update_updated_at();

create trigger update_invoices_updated_at
  before update on invoices
  for each row execute function update_updated_at();

-- Auto-mark invoices as overdue
create or replace function mark_overdue_invoices()
returns void as $$
begin
  update invoices
  set status = 'overdue'
  where status = 'sent'
    and due_date < current_date;
end;
$$ language plpgsql;

-- Recompute client risk score after invoice changes
create or replace function recompute_client_risk(p_client_id uuid)
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
    count(*) filter (where status in ('overdue', 'paid') and (
      (status = 'paid' and paid_at::date > due_date) or
      (status = 'overdue')
    )),
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
  from invoices
  where client_id = p_client_id and status != 'cancelled';

  v_delay_pct := case when v_total > 0 then (v_delayed::numeric / v_total) * 100 else 0 end;

  v_risk := case
    when v_avg_delay <= 7 and v_delay_pct <= 20 then 'good'
    when v_avg_delay <= 30 and v_delay_pct <= 50 then 'moderate'
    else 'risky'
  end;

  update clients set
    total_invoices = v_total,
    delayed_invoices = v_delayed,
    avg_delay_days = round(v_avg_delay),
    risk_label = v_risk,
    updated_at = now()
  where id = p_client_id;
end;
$$ language plpgsql;

-- Trigger to recompute risk on invoice changes
create or replace function trigger_recompute_client_risk()
returns trigger as $$
begin
  if new.client_id is not null then
    perform recompute_client_risk(new.client_id);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger invoice_risk_recompute
  after insert or update on invoices
  for each row execute function trigger_recompute_client_risk();
