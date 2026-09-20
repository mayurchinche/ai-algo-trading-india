-- Apply with the database owner after reviewing existing policies. No data is deleted.
CREATE TABLE IF NOT EXISTS public.app_data (
  id TEXT PRIMARY KEY,
  device_id TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON public.app_data;
DROP POLICY IF EXISTS public_ipo_cache_read ON public.app_data;
CREATE POLICY public_ipo_cache_read ON public.app_data FOR SELECT TO anon, authenticated USING (id = 'ipo_live_data');
REVOKE INSERT, UPDATE, DELETE ON public.app_data FROM anon, authenticated;
GRANT SELECT ON public.app_data TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_data TO service_role;
-- Only the server service role refreshes the public IPO cache.
-- Private account data must move to an authenticated per-user schema before sync is enabled.
