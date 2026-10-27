BEGIN;
CREATE TABLE public.tnp_deleted_accounts (
 account_id uuid PRIMARY KEY REFERENCES auth.users(id), account_role public.app_role NOT NULL CHECK(account_role IN ('tenant','landlord')),
 legal_name text NOT NULL, account_created_at timestamptz NOT NULL, deleted_at timestamptz NOT NULL DEFAULT now(), auth_cleanup_pending boolean NOT NULL DEFAULT true
);
ALTER TABLE public.tnp_deleted_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.tnp_deleted_accounts TO authenticated;
GRANT ALL ON public.tnp_deleted_accounts TO service_role;
CREATE POLICY deleted_accounts_admin ON public.tnp_deleted_accounts FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.tnp_account_active(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.tnp_deleted_accounts WHERE account_id=p_id)
$$;
REVOKE ALL ON FUNCTION public.tnp_account_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tnp_account_active(uuid) TO anon,authenticated,service_role;
-- Restrictive policies also reject an outstanding JWT after account closure.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity LOOP
 EXECUTE format('CREATE POLICY tnp_active_account ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING(public.tnp_account_active(auth.uid())) WITH CHECK(public.tnp_account_active(auth.uid()))',t.tablename);
 END LOOP;
END $$;
CREATE POLICY tnp_active_account ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING(public.tnp_account_active(auth.uid())) WITH CHECK(public.tnp_account_active(auth.uid()));
-- Applies to RPC calls too, including existing SECURITY DEFINER workflows.
CREATE FUNCTION public.tnp_require_active_account() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.tnp_account_active(auth.uid()) THEN RAISE EXCEPTION 'This TNP account has been deleted' USING ERRCODE='42501'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.tnp_require_active_account() TO anon,authenticated,service_role;
-- Preserve an existing PostgREST hook rather than silently overriding it.
DO $$ DECLARE previous text; BEGIN
 SELECT split_part(setting,'=',2) INTO previous FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole, unnest(s.setconfig) setting WHERE r.rolname='authenticator' AND setting LIKE 'pgrst.db_pre_request=%' LIMIT 1;
 IF previous IS NOT NULL AND previous<>'' AND previous<>'public.tnp_require_active_account' THEN RAISE EXCEPTION 'Existing PostgREST pre-request hook % must be combined with the TNP account guard before deployment',previous; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN EXECUTE 'ALTER ROLE authenticator SET pgrst.db_pre_request = ''public.tnp_require_active_account'''; END IF;
END $$;
CREATE FUNCTION public.tnp_archive_account(p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.app_role; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 IF EXISTS(SELECT 1 FROM public.tnp_deleted_accounts WHERE account_id=p_user) THEN RETURN; END IF;
 IF public.has_role(p_user,'admin') THEN RAISE EXCEPTION 'Administrator accounts cannot use self-service deletion'; END IF;
 SELECT role INTO r FROM public.user_roles WHERE user_id=p_user AND role IN ('tenant','landlord') LIMIT 1;
 IF r IS NULL THEN RAISE EXCEPTION 'No eligible account found'; END IF;
 INSERT INTO public.tnp_deleted_accounts(account_id,account_role,legal_name,account_created_at)
 SELECT id,r,full_name,created_at FROM public.profiles WHERE id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account profile missing'; END IF;
 -- No leases, applications, receipts, payment ledger or dispute evidence are deleted.
 UPDATE public.properties SET available=false,tour_url=NULL WHERE owner_id=p_user;
 UPDATE public.tnp_tours SET is_published=false WHERE owner_id=p_user;
 DELETE FROM public.property_favorites WHERE tenant_id=p_user;
 UPDATE public.profiles SET full_name='Deleted account',phone=NULL,bio=NULL WHERE id=p_user;
 DELETE FROM public.user_roles WHERE user_id=p_user;
END $$;
REVOKE ALL ON FUNCTION public.tnp_archive_account(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tnp_archive_account(uuid) TO service_role;
NOTIFY pgrst,'reload config';
NOTIFY pgrst,'reload schema';
COMMIT;
