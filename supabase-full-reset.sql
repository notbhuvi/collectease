-- ============================================================
-- SIRPL COMPLETE DATABASE RESET + SETUP
-- Run this in Supabase → SQL Editor → New Query
-- This replaces ALL previous migration files
-- ============================================================

-- ============================================================
-- STEP 1: DROP EVERYTHING (clean slate)
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS invoice_risk_recompute ON invoices;
DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;

DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS mark_overdue_invoices() CASCADE;
DROP FUNCTION IF EXISTS recompute_client_risk(uuid) CASCADE;
DROP FUNCTION IF EXISTS trigger_recompute_client_risk() CASCADE;
DROP FUNCTION IF EXISTS get_lowest_bids(uuid[]) CASCADE;

DROP VIEW IF EXISTS transport_loads_with_stats;

DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS escalation_logs CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS awarded_loads CASCADE;
DROP TABLE IF EXISTS transport_bids CASCADE;
DROP TABLE IF EXISTS transport_loads CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================
-- STEP 2: EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- STEP 3: PROFILES
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'accounts'
    CHECK (role IN ('admin', 'accounts', 'transport_team', 'transporter')),
  company_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile_select" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "own_profile_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "own_profile_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin & transport_team can read ALL profiles (needed for leaderboard names etc.)
CREATE POLICY "team_admin_read_profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'transport_team'))
  );

-- ============================================================
-- STEP 4: BUSINESSES (invoice module — accounts/admin only)
-- ============================================================

CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gstin TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_business" ON businesses
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- STEP 5: CLIENTS
-- ============================================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gstin TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  contact_person TEXT,
  risk_label TEXT DEFAULT 'good' CHECK (risk_label IN ('good', 'moderate', 'risky')),
  avg_delay_days NUMERIC DEFAULT 0,
  total_invoices INTEGER DEFAULT 0,
  delayed_invoices INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_clients" ON clients
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE INDEX idx_clients_business_id ON clients(business_id);

-- ============================================================
-- STEP 6: INVOICES
-- ============================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  description TEXT,
  notes TEXT,
  reminder_count INTEGER DEFAULT 0,
  reminder_initial_delay INTEGER DEFAULT 0,
  reminder_interval_days INTEGER DEFAULT 7,
  last_reminder_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  paid_amount NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, invoice_number)
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_invoices" ON invoices
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE INDEX idx_invoices_business_id ON invoices(business_id);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- ============================================================
-- STEP 7: REMINDERS
-- ============================================================

CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('friendly', 'firm', 'final_warning', 'legal')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'both')),
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_reminders" ON reminders
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE INDEX idx_reminders_invoice_id ON reminders(invoice_id);
CREATE INDEX idx_reminders_business_id ON reminders(business_id);

-- ============================================================
-- STEP 8: PAYMENTS
-- ============================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_payments" ON payments
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_business_id ON payments(business_id);

-- ============================================================
-- STEP 9: ESCALATION LOGS
-- ============================================================

CREATE TABLE escalation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('formal_reminder', 'legal_notice', 'msme_complaint')),
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE escalation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_escalations" ON escalation_logs
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE INDEX idx_escalation_logs_invoice_id ON escalation_logs(invoice_id);
CREATE INDEX idx_escalation_logs_business_id ON escalation_logs(business_id);

-- ============================================================
-- STEP 10: EMAIL LOGS
-- ============================================================

CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  type TEXT NOT NULL,
  reference_id UUID,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_email_logs" ON email_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- STEP 11: TRANSPORT LOADS
-- ============================================================

CREATE TABLE transport_loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id),
  pickup_location TEXT NOT NULL,
  drop_location TEXT NOT NULL,
  material TEXT NOT NULL,
  weight TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  pickup_date DATE NOT NULL,
  bidding_deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'awarded', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transport_loads ENABLE ROW LEVEL SECURITY;

-- Admin & transport_team: full access
CREATE POLICY "team_admin_all_loads" ON transport_loads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'transport_team'))
  );

-- Transporters: can only see open loads
CREATE POLICY "transporter_view_open_loads" ON transport_loads
  FOR SELECT USING (
    status = 'open' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'transporter')
  );

-- ============================================================
-- STEP 12: TRANSPORT BIDS
-- ============================================================

CREATE TABLE transport_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES transport_loads(id) ON DELETE CASCADE,
  transporter_id UUID NOT NULL REFERENCES auth.users(id),
  bid_amount NUMERIC NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(load_id, transporter_id)
);

ALTER TABLE transport_bids ENABLE ROW LEVEL SECURITY;

-- Transporters: full access to their own bids
CREATE POLICY "transporter_own_bids" ON transport_bids
  FOR ALL USING (auth.uid() = transporter_id);

-- Transporters: can read ALL bid amounts on open loads (for lowest bid display — amount only, not identity)
CREATE POLICY "transporter_view_open_load_bids" ON transport_bids
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'transporter')
    AND EXISTS (SELECT 1 FROM transport_loads WHERE id = load_id AND status = 'open')
  );

-- Admin & transport_team: full access to all bids
CREATE POLICY "team_admin_all_bids" ON transport_bids
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'transport_team'))
  );

-- ============================================================
-- STEP 13: AWARDED LOADS
-- ============================================================

CREATE TABLE awarded_loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL UNIQUE REFERENCES transport_loads(id) ON DELETE CASCADE,
  transporter_id UUID NOT NULL REFERENCES auth.users(id),
  final_amount NUMERIC NOT NULL,
  awarded_by UUID REFERENCES auth.users(id),
  awarded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE awarded_loads ENABLE ROW LEVEL SECURITY;

-- Admin & transport_team: full access
CREATE POLICY "team_admin_all_awards" ON awarded_loads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'transport_team'))
  );

-- Transporters: can see their own award
CREATE POLICY "transporter_own_award" ON awarded_loads
  FOR SELECT USING (auth.uid() = transporter_id);

-- ============================================================
-- STEP 14: FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile when a new user is created in Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'role', 'accounts'),
    COALESCE(NEW.raw_user_meta_data->>'company_name', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Mark overdue invoices (called by cron job)
CREATE OR REPLACE FUNCTION mark_overdue_invoices()
RETURNS VOID AS $$
BEGIN
  UPDATE invoices
  SET status = 'overdue'
  WHERE status = 'sent' AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Recompute client risk score after invoice changes
CREATE OR REPLACE FUNCTION recompute_client_risk(p_client_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total INTEGER;
  v_delayed INTEGER;
  v_avg_delay NUMERIC;
  v_risk TEXT;
  v_delay_pct NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE
      (status = 'paid' AND paid_at::date > due_date) OR
      status = 'overdue'
    ),
    COALESCE(AVG(
      CASE
        WHEN status = 'paid' AND paid_at::date > due_date
          THEN EXTRACT(DAY FROM paid_at - due_date::TIMESTAMPTZ)
        WHEN status = 'overdue'
          THEN EXTRACT(DAY FROM NOW() - due_date::TIMESTAMPTZ)
        ELSE 0
      END
    ), 0)
  INTO v_total, v_delayed, v_avg_delay
  FROM invoices
  WHERE client_id = p_client_id AND status != 'cancelled';

  v_delay_pct := CASE WHEN v_total > 0 THEN (v_delayed::NUMERIC / v_total) * 100 ELSE 0 END;

  v_risk := CASE
    WHEN v_avg_delay <= 7  AND v_delay_pct <= 20 THEN 'good'
    WHEN v_avg_delay <= 30 AND v_delay_pct <= 50 THEN 'moderate'
    ELSE 'risky'
  END;

  UPDATE clients SET
    total_invoices   = v_total,
    delayed_invoices = v_delayed,
    avg_delay_days   = ROUND(v_avg_delay),
    risk_label       = v_risk,
    updated_at       = NOW()
  WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_recompute_client_risk()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    PERFORM recompute_client_risk(NEW.client_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_risk_recompute
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION trigger_recompute_client_risk();

-- ============================================================
-- STEP 15: BACKFILL — create profiles for any existing users
-- ============================================================

INSERT INTO profiles (id, email, role)
SELECT id, email, 'accounts'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DONE ✅
-- Next steps:
-- 1. Go to Admin → Users and set correct roles for each user
-- 2. The accounts user will auto-get a business profile on first login
-- ============================================================
