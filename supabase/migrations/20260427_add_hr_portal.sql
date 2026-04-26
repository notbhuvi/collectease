create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

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
  check (role in ('admin', 'accounts', 'transport_team', 'transporter', 'plant_ops', 'hr'));

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  department text,
  designation text,
  joining_date date,
  salary numeric(12, 2),
  status text not null default 'active' check (status in ('active', 'inactive', 'on_leave')),
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status text not null check (status in ('present', 'absent', 'half_day', 'leave', 'remote')),
  biometric_ref text,
  created_at timestamptz not null default now(),
  unique (employee_id, date)
);

create table if not exists public.leaves (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  type text not null,
  from_date date not null,
  to_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  doc_type text not null,
  file_url text not null,
  expires_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_policy_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_url text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_employees_department on public.employees(department);
create index if not exists idx_employees_status on public.employees(status);
create index if not exists idx_attendance_employee_date on public.attendance(employee_id, date desc);
create index if not exists idx_attendance_date on public.attendance(date desc);
create index if not exists idx_leaves_employee_dates on public.leaves(employee_id, from_date desc, to_date desc);
create index if not exists idx_leaves_status on public.leaves(status);
create index if not exists idx_employee_documents_employee_id on public.employee_documents(employee_id);
create index if not exists idx_employee_documents_expires_on on public.employee_documents(expires_on);

alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.leaves enable row level security;
alter table public.employee_documents enable row level security;
alter table public.hr_policy_documents enable row level security;

drop policy if exists employees_hr_access on public.employees;
drop policy if exists attendance_hr_access on public.attendance;
drop policy if exists leaves_hr_access on public.leaves;
drop policy if exists employee_documents_hr_access on public.employee_documents;
drop policy if exists hr_policy_documents_access on public.hr_policy_documents;

create policy employees_hr_access
  on public.employees
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  );

create policy attendance_hr_access
  on public.attendance
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  );

create policy leaves_hr_access
  on public.leaves
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  );

create policy employee_documents_hr_access
  on public.employee_documents
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  );

create policy hr_policy_documents_access
  on public.hr_policy_documents
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  );

insert into storage.buckets (id, name, public)
values ('hr-documents', 'hr-documents', false)
on conflict (id) do nothing;

drop policy if exists "HR docs read" on storage.objects;
drop policy if exists "HR docs write" on storage.objects;
drop policy if exists "HR docs update" on storage.objects;
drop policy if exists "HR docs delete" on storage.objects;

create policy "HR docs read"
  on storage.objects
  for select
  using (
    bucket_id = 'hr-documents'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  );

create policy "HR docs write"
  on storage.objects
  for insert
  with check (
    bucket_id = 'hr-documents'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  );

create policy "HR docs update"
  on storage.objects
  for update
  using (
    bucket_id = 'hr-documents'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  )
  with check (
    bucket_id = 'hr-documents'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  );

create policy "HR docs delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'hr-documents'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'hr')
    )
  );

update public.profiles
set role = 'hr',
    full_name = coalesce(full_name, 'HR Manager')
where email = 'hr.samwha@sirpl.in';

comment on table public.employees is 'HR master employee directory';
comment on table public.attendance is 'HR daily attendance ledger';
comment on table public.leaves is 'HR leave applications and approvals';
comment on table public.employee_documents is 'HR employee document registry. file_url stores storage path in hr-documents.';
comment on table public.hr_policy_documents is 'HR company policy uploads stored in hr-documents bucket.';
