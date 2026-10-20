BEGIN;
ALTER TABLE public.scam_cases ADD COLUMN IF NOT EXISTS reporter_name text;
ALTER TABLE public.scam_cases ADD COLUMN IF NOT EXISTS reporter_email text;
ALTER TABLE public.scam_cases ADD COLUMN IF NOT EXISTS reporter_phone text;
ALTER TABLE public.scam_cases ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'account';
CREATE TABLE public.tnp_public_report_access (
 case_id uuid PRIMARY KEY REFERENCES public.scam_cases(id) ON DELETE CASCADE,
 token_hash text NOT NULL, fingerprint text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tnp_public_report_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tnp_public_report_access FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.tnp_public_report_access TO service_role;
CREATE INDEX tnp_public_report_rate_idx ON public.tnp_public_report_access(fingerprint,created_at);
CREATE OR REPLACE FUNCTION public.tnp_submit_public_report(p_report jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE c public.scam_cases; token text; v_fingerprint text; evidence text[]; email text;
BEGIN
 IF jsonb_typeof(p_report)<>'object' OR octet_length(p_report::text)>30000 THEN RAISE EXCEPTION 'Invalid report'; END IF;
 IF length(coalesce(p_report->>'website',''))>0 THEN RAISE EXCEPTION 'Report could not be accepted'; END IF;
 email:=lower(trim(coalesce(p_report->>'email','')));
 IF length(trim(coalesce(p_report->>'title',''))) NOT BETWEEN 5 AND 300
 OR length(trim(coalesce(p_report->>'description',''))) NOT BETWEEN 30 AND 20000
 OR length(trim(coalesce(p_report->>'name',''))) NOT BETWEEN 2 AND 150
 OR length(email)>254 OR email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 OR coalesce(p_report->>'case_type','') NOT IN('property_scam','land_scam','payment_scam','identity_fraud','fake_listing','impersonation','other')
 OR length(coalesce(p_report->>'phone',''))>50 OR length(coalesce(p_report->>'location',''))>300
 OR length(coalesce(p_report->>'scammer_name',''))>200 OR length(coalesce(p_report->>'payment_reference',''))>300
 THEN RAISE EXCEPTION 'Check your contact details, report category and incident description'; END IF;
 IF coalesce(p_report->>'amount','0') !~ '^[0-9]{1,7}(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'Enter a valid USD amount'; END IF;
 IF jsonb_typeof(coalesce(p_report->'evidence','[]'::jsonb))<>'array' THEN RAISE EXCEPTION 'Evidence must be a list of links'; END IF;
 SELECT coalesce(array_agg(value),ARRAY[]::text[]) INTO evidence FROM jsonb_array_elements_text(coalesce(p_report->'evidence','[]'::jsonb));
 IF cardinality(evidence)>10 OR EXISTS(SELECT 1 FROM unnest(evidence) u WHERE u !~ '^https://[^[:space:]]+$' OR length(u)>2000) THEN RAISE EXCEPTION 'Use up to ten secure evidence links'; END IF;
 v_fingerprint:=encode(extensions.digest(email,'sha256'),'hex');
 PERFORM pg_advisory_xact_lock(hashtext('tnp-public-report-limit'));
 IF (SELECT count(*) FROM public.tnp_public_report_access WHERE fingerprint=v_fingerprint AND created_at>now()-interval '1 hour')>=3
 OR (SELECT count(*) FROM public.tnp_public_report_access WHERE created_at>now()-interval '1 hour')>=100 THEN RAISE EXCEPTION 'Reporting limit reached. Please try again later'; END IF;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO public.scam_cases(reporter_id,reference,case_type,title,description,priority,status,location,scammer_name,amount_lost_usd,payment_reference,evidence,reporter_name,reporter_email,reporter_phone,source)
 VALUES(auth.uid(),'TNP-SC-'||gen_random_uuid()::text,p_report->>'case_type',trim(p_report->>'title'),trim(p_report->>'description'),'medium','submitted',nullif(trim(p_report->>'location'),''),nullif(trim(p_report->>'scammer_name'),''),(coalesce(p_report->>'amount','0'))::numeric,nullif(trim(p_report->>'payment_reference'),''),evidence,trim(p_report->>'name'),email,nullif(trim(p_report->>'phone'),''),'public') RETURNING * INTO c;
 INSERT INTO public.tnp_public_report_access(case_id,token_hash,fingerprint) VALUES(c.id,encode(extensions.digest(token,'sha256'),'hex'),v_fingerprint);
 RETURN jsonb_build_object('reference',c.reference,'tracking_code',token,'status',c.status);
END $$;
REVOKE ALL ON FUNCTION public.tnp_submit_public_report(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tnp_submit_public_report(jsonb) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.tnp_track_public_report(p_reference text,p_tracking_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE result jsonb;
BEGIN
 IF length(coalesce(p_reference,''))>100 OR coalesce(p_tracking_code,'') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Check the case reference and private tracking code'; END IF;
 SELECT jsonb_build_object('reference',c.reference,'status',c.status,'resolution',c.resolution,'updated_at',c.updated_at,'resolved_at',c.resolved_at)
 INTO result FROM public.scam_cases c JOIN public.tnp_public_report_access a ON a.case_id=c.id
 WHERE c.reference=p_reference AND a.token_hash=encode(extensions.digest(p_tracking_code,'sha256'),'hex');
 IF result IS NULL THEN RAISE EXCEPTION 'Case not found. Check the reference and tracking code'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.tnp_track_public_report(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tnp_track_public_report(text,text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.tnp_admin_case_action(p_case_id uuid,p_action text,p_value text,p_reason text DEFAULT NULL)
RETURNS public.scam_cases LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.scam_cases; old_status text; action_reason text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 SELECT * INTO c FROM public.scam_cases WHERE id=p_case_id FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Case not found'; END IF;
 old_status:=c.status;
 IF length(coalesce(p_value,''))>20000 OR length(coalesce(p_reason,''))>10000 THEN RAISE EXCEPTION 'Case note is too long'; END IF;
 IF p_action='status_changed' THEN
  IF p_value IS NULL OR p_value NOT IN('submitted','open','under_review','evidence_requested','escalated','resolved','closed','dismissed') THEN RAISE EXCEPTION 'Invalid case status'; END IF;
  IF p_value IN('resolved','closed','dismissed') AND length(trim(coalesce(c.resolution,'')))<10 THEN RAISE EXCEPTION 'Save a resolution of at least ten characters before closing a case'; END IF;
  c.status:=p_value;
 ELSIF p_action='priority_changed' THEN
  IF p_value IS NULL OR p_value NOT IN('low','medium','high','critical') THEN RAISE EXCEPTION 'Invalid priority'; END IF;
  c.priority:=p_value;
 ELSIF p_action='note_added' THEN c.admin_notes:=nullif(trim(p_value),'');
 ELSIF p_action='resolved' THEN
  IF length(trim(coalesce(p_value,'')))<10 THEN RAISE EXCEPTION 'Describe the resolution in at least ten characters'; END IF;
  c.resolution:=trim(p_value);c.status:='resolved';
 ELSE RAISE EXCEPTION 'Invalid case action'; END IF;
 c.resolved_by:=CASE WHEN c.status IN('resolved','closed','dismissed') THEN auth.uid() ELSE NULL END;
 c.resolved_at:=CASE WHEN c.status IN('resolved','closed','dismissed') THEN coalesce(c.resolved_at,now()) ELSE NULL END;
 UPDATE public.scam_cases SET status=c.status,priority=c.priority,admin_notes=c.admin_notes,resolution=c.resolution,resolved_by=c.resolved_by,resolved_at=c.resolved_at,updated_at=now() WHERE id=c.id RETURNING * INTO c;
 action_reason:=CASE WHEN p_action='resolved' THEN c.resolution WHEN p_action='note_added' THEN c.admin_notes ELSE coalesce(nullif(trim(p_reason),''),p_value) END;
 INSERT INTO public.scam_case_admin_actions(case_id,admin_id,action,from_status,to_status,reason) VALUES(c.id,auth.uid(),p_action,old_status,c.status,action_reason);
 RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.tnp_admin_case_action(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tnp_admin_case_action(uuid,text,text,text) TO authenticated;
COMMIT;
