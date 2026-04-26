alter table if exists public.bill_approvals
  add column if not exists downloaded_at timestamptz,
  add column if not exists delete_after_at timestamptz;

create index if not exists idx_bill_approvals_delete_after_at
  on public.bill_approvals(delete_after_at)
  where status = 'approved';
