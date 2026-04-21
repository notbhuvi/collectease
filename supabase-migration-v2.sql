-- ============================================================
-- SIRPL Transport Bidding Module — Migration V2
-- Run AFTER supabase-migration.sql
-- ============================================================

-- 1. Allow transport_team to view ALL bids (not just their own)
DROP POLICY IF EXISTS "team_admin_all_bids" ON transport_bids;
CREATE POLICY "team_admin_all_bids" ON transport_bids
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'transport_team'))
  );

-- 2. Allow transporter to see aggregate lowest bid (read-only, no names)
--    Handled server-side via serviceClient — no policy change needed.

-- 3. Email logs table for tracking sent notifications
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'new_load', 'bid_winner', 'credentials', etc.
  reference_id UUID,            -- load_id or user_id this email relates to
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_email_logs" ON email_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Add bid_count to transport_loads (computed view, not a column)
--    We use a view instead to keep it computed.
CREATE OR REPLACE VIEW transport_loads_with_stats AS
SELECT
  tl.*,
  COUNT(tb.id) AS bid_count,
  MIN(tb.bid_amount) AS lowest_bid
FROM transport_loads tl
LEFT JOIN transport_bids tb ON tb.load_id = tl.id
GROUP BY tl.id;

-- 5. Ensure updated_at exists on transport_bids (already created in V1)
-- ALTER TABLE transport_bids ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- DONE ✅
