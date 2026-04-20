-- ============================================================
-- SIRPL Transport Bidding Module — Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'accounts'
    CHECK (role IN ('admin', 'accounts', 'sales', 'transport_team', 'transporter')),
  company_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TRANSPORT LOADS
CREATE TABLE IF NOT EXISTS transport_loads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- 3. TRANSPORT BIDS
CREATE TABLE IF NOT EXISTS transport_bids (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  load_id UUID REFERENCES transport_loads(id) ON DELETE CASCADE NOT NULL,
  transporter_id UUID REFERENCES auth.users(id) NOT NULL,
  bid_amount NUMERIC NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(load_id, transporter_id)
);

-- 4. AWARDED LOADS
CREATE TABLE IF NOT EXISTS awarded_loads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  load_id UUID REFERENCES transport_loads(id) ON DELETE CASCADE NOT NULL UNIQUE,
  transporter_id UUID REFERENCES auth.users(id) NOT NULL,
  final_amount NUMERIC NOT NULL,
  awarded_by UUID REFERENCES auth.users(id),
  awarded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE awarded_loads ENABLE ROW LEVEL SECURITY;

-- ── Profiles ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "own_profile_select" ON profiles;
DROP POLICY IF EXISTS "own_profile_insert" ON profiles;
DROP POLICY IF EXISTS "own_profile_update" ON profiles;
DROP POLICY IF EXISTS "service_all_profiles" ON profiles;

CREATE POLICY "own_profile_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own_profile_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own_profile_update" ON profiles FOR UPDATE USING (auth.uid() = id);
-- Service role (admin API) bypasses RLS automatically

-- ── Transport Loads ────────────────────────────────────────────
DROP POLICY IF EXISTS "team_admin_all_loads" ON transport_loads;
DROP POLICY IF EXISTS "transporter_open_loads" ON transport_loads;

CREATE POLICY "team_admin_all_loads" ON transport_loads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'transport_team'))
  );

CREATE POLICY "transporter_open_loads" ON transport_loads
  FOR SELECT USING (
    status = 'open' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'transporter')
  );

-- ── Transport Bids ─────────────────────────────────────────────
DROP POLICY IF EXISTS "transporter_own_bids" ON transport_bids;
DROP POLICY IF EXISTS "team_admin_all_bids" ON transport_bids;

CREATE POLICY "transporter_own_bids" ON transport_bids
  FOR ALL USING (auth.uid() = transporter_id);

CREATE POLICY "team_admin_all_bids" ON transport_bids
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'transport_team'))
  );

-- ── Awarded Loads ──────────────────────────────────────────────
DROP POLICY IF EXISTS "team_admin_awards" ON awarded_loads;
DROP POLICY IF EXISTS "transporter_own_award" ON awarded_loads;

CREATE POLICY "team_admin_awards" ON awarded_loads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'transport_team'))
  );

CREATE POLICY "transporter_own_award" ON awarded_loads
  FOR SELECT USING (auth.uid() = transporter_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

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

-- ============================================================
-- BACKFILL: create profiles for existing users (accounts role)
-- ============================================================

INSERT INTO profiles (id, email, role)
SELECT id, email, 'accounts'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- DONE ✅
-- After running: go to Admin → Users to assign correct roles
