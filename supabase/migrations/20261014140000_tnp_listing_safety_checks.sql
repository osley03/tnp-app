BEGIN;
CREATE TABLE IF NOT EXISTS public.land_scam_checks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),property_id uuid REFERENCES public.properties(id),risk_score integer,risk_level text,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.land_scam_check_findings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),check_id uuid REFERENCES public.land_scam_checks(id) ON DELETE CASCADE,category text,title text,description text,severity text,passed boolean,points integer,created_at timestamptz DEFAULT now());
ALTER TABLE public.land_scam_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_scam_check_findings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.land_scam_checks,public.land_scam_check_findings TO authenticated;
DROP POLICY IF EXISTS tnp_check_read ON public.land_scam_checks;
CREATE POLICY tnp_check_read ON public.land_scam_checks FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS tnp_finding_read ON public.land_scam_check_findings;
CREATE POLICY tnp_finding_read ON public.land_scam_check_findings FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.land_scam_checks c WHERE c.id=check_id AND (c.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE OR REPLACE FUNCTION public.run_land_scam_check(p_property_id uuid,p_check_type text,p_property_reference text,p_property_name text,p_location text,p_address text,p_seller_name text,p_seller_phone text,p_seller_email text,p_asking_price_usd numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prop public.properties; owner public.profiles; result_id uuid; score integer; level text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
 SELECT * INTO prop FROM public.properties WHERE id=p_property_id;
 IF prop.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
 SELECT * INTO owner FROM public.profiles WHERE id=prop.owner_id;
 score:=(CASE WHEN prop.verified THEN 0 ELSE 25 END)+(CASE WHEN cardinality(prop.fraud_flags)>0 THEN 40 ELSE 0 END)+(CASE WHEN owner.verification IS NULL OR owner.verification='Email only' THEN 20 ELSE 0 END)+(CASE WHEN nullif(trim(prop.title_status),'') IS NULL THEN 15 ELSE 0 END);
 level:=CASE WHEN score>=60 THEN 'high' WHEN score>=30 THEN 'medium' ELSE 'low' END;
 INSERT INTO public.land_scam_checks(user_id,property_id,risk_score,risk_level) VALUES(auth.uid(),prop.id,score,level) RETURNING id INTO result_id;
 INSERT INTO public.land_scam_check_findings(check_id,category,title,description,severity,passed,points) VALUES
 (result_id,'verification','Listing verification',CASE WHEN prop.verified THEN 'TNP has marked this listing verified.' ELSE 'TNP has not verified this listing.' END,CASE WHEN prop.verified THEN 'info' ELSE 'warning' END,prop.verified,CASE WHEN prop.verified THEN 0 ELSE 25 END),
 (result_id,'fraud','Recorded flags',CASE WHEN cardinality(prop.fraud_flags)>0 THEN array_to_string(prop.fraud_flags,', ') ELSE 'No flags are recorded in TNP; this does not establish that a property is safe.' END,CASE WHEN cardinality(prop.fraud_flags)>0 THEN 'danger' ELSE 'info' END,cardinality(prop.fraud_flags)=0,CASE WHEN cardinality(prop.fraud_flags)>0 THEN 40 ELSE 0 END),
 (result_id,'identity','Owner verification',coalesce(owner.verification,'Owner profile unavailable'),'info',coalesce(owner.verification<>'Email only',false),CASE WHEN owner.verification IS NULL OR owner.verification='Email only' THEN 20 ELSE 0 END),
 (result_id,'title','Title information',CASE WHEN nullif(trim(prop.title_status),'') IS NULL THEN 'No title information was supplied. Independently verify ownership.' ELSE 'Title information was supplied by the listing owner; no land registry lookup has been performed.' END,'warning',nullif(trim(prop.title_status),'') IS NOT NULL,CASE WHEN nullif(trim(prop.title_status),'') IS NULL THEN 15 ELSE 0 END);
 RETURN jsonb_build_object('id',result_id,'check_id',result_id,'success',true,'property_found',true,'owner_found',owner.id IS NOT NULL,'risk_score',score,'risk_level',level,'summary','A rules-based assessment of TNP records only. This does not verify legal title or guarantee safety.');
END $$;
REVOKE ALL ON FUNCTION public.run_land_scam_check(uuid,text,text,text,text,text,text,text,text,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_land_scam_check(uuid,text,text,text,text,text,text,text,text,numeric) TO authenticated;
COMMIT;
