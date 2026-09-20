-- Durable paper accounts. Browser users can read only their own account; writes go through authenticated API/worker.
CREATE TABLE IF NOT EXISTS public.paper_accounts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id), enabled boolean NOT NULL DEFAULT false,
 revision bigint NOT NULL DEFAULT 0, state jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.paper_events (
 user_id uuid NOT NULL REFERENCES public.paper_accounts(user_id), sequence bigint NOT NULL,
 at timestamptz NOT NULL, event jsonb NOT NULL, PRIMARY KEY(user_id,sequence)
);
ALTER TABLE public.paper_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY paper_account_owner ON public.paper_accounts FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY paper_event_owner ON public.paper_events FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.paper_accounts,public.paper_events FROM anon,authenticated;
GRANT SELECT ON public.paper_accounts,public.paper_events TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.paper_accounts TO service_role;
GRANT SELECT,INSERT ON public.paper_events TO service_role;
CREATE OR REPLACE FUNCTION public.commit_paper_cycle(p_user uuid,p_revision bigint,p_state jsonb,p_events jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE paper_accounts SET state=p_state, revision=revision+1, updated_at=now() WHERE user_id=p_user AND revision=p_revision;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO paper_events(user_id,sequence,at,event)
 SELECT p_user,(e->>'id')::bigint,(e->>'at')::timestamptz,e FROM jsonb_array_elements(p_events) e;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.commit_paper_cycle(uuid,bigint,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_paper_cycle(uuid,bigint,jsonb,jsonb) TO service_role;
-- No automatic deletion: all ledger events are retained, including at least 30 days.
