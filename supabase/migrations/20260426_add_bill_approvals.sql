create extension if not exists pgcrypto;

create table if not exists public.bill_approvals (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references auth.users(id) on delete set null,
  file_url text,
  file_type text,
  original_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  admin_id uuid references auth.users(id) on delete set null,
  admin_remark text,
  stamped_file_url text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.bill_logs (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid,
  uploaded_by uuid references auth.users(id) on delete set null,
  status text,
  remark text,
  action_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_bill_approvals_uploaded_by on public.bill_approvals(uploaded_by);
create index if not exists idx_bill_approvals_status on public.bill_approvals(status);
create index if not exists idx_bill_approvals_created_at on public.bill_approvals(created_at desc);
create index if not exists idx_bill_logs_bill_id on public.bill_logs(bill_id);
create index if not exists idx_bill_logs_uploaded_by on public.bill_logs(uploaded_by);

alter table public.bill_approvals enable row level security;
alter table public.bill_logs enable row level security;

drop policy if exists bill_approvals_select_own_or_admin on public.bill_approvals;
drop policy if exists bill_approvals_insert_accounts on public.bill_approvals;
drop policy if exists bill_approvals_update_admin on public.bill_approvals;
drop policy if exists bill_approvals_delete_admin on public.bill_approvals;
drop policy if exists bill_logs_select_own_or_admin on public.bill_logs;
drop policy if exists bill_logs_insert_admin on public.bill_logs;

create policy bill_approvals_select_own_or_admin
  on public.bill_approvals
  for select
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'admin'
    )
  );

create policy bill_approvals_insert_accounts
  on public.bill_approvals
  for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('accounts', 'admin')
    )
  );

create policy bill_approvals_update_admin
  on public.bill_approvals
  for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'admin'
    )
  );

create policy bill_approvals_delete_admin
  on public.bill_approvals
  for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'admin'
    )
  );

create policy bill_logs_select_own_or_admin
  on public.bill_logs
  for select
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'admin'
    )
  );

create policy bill_logs_insert_admin
  on public.bill_logs
  for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'admin'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bill-uploads',
  'bill-uploads',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists bill_uploads_insert_own on storage.objects;
drop policy if exists bill_uploads_select_own on storage.objects;
drop policy if exists bill_uploads_select_admin on storage.objects;

create policy bill_uploads_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'bill-uploads'
    and (storage.foldername(name))[1] = 'bills'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('accounts', 'admin')
    )
  );

create policy bill_uploads_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'bill-uploads'
    and (storage.foldername(name))[1] = 'bills'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (
        select 1 from public.profiles
        where id = auth.uid()
          and role = 'admin'
      )
    )
  );

create policy bill_uploads_select_admin
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'bill-uploads'
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'admin'
    )
  );
