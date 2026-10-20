-- Authenticated workflows. Payment requests record intent; no funds are collected here.
BEGIN;
CREATE OR REPLACE FUNCTION public.create_lease_payment(p_lease_id uuid,p_payment_type text,p_amount_usd numeric,p_idempotency_key text)
RETURNS public.lease_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leases; payment public.lease_payments;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'tenant') THEN RAISE EXCEPTION 'Tenant sign-in required'; END IF;
 SELECT * INTO l FROM public.leases WHERE id=p_lease_id AND tenant_id=auth.uid() FOR UPDATE;
 IF l.id IS NULL OR lower(l.status)<>'active' THEN RAISE EXCEPTION 'An active lease is required'; END IF;
 IF p_amount_usd IS NULL OR p_amount_usd<=0 OR p_amount_usd::text IN('NaN','Infinity','-Infinity') OR p_amount_usd>1000000 OR p_payment_type IS NULL OR p_payment_type NOT IN('rent','deposit','utility','late_fee','other') OR length(coalesce(p_idempotency_key,'')) NOT BETWEEN 8 AND 200 THEN RAISE EXCEPTION 'Invalid payment request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text),hashtext(p_idempotency_key));
 SELECT * INTO payment FROM public.lease_payments WHERE payer_id=auth.uid() AND idempotency_key=p_idempotency_key;
 IF payment.id IS NOT NULL THEN
  IF payment.lease_id<>p_lease_id OR payment.amount_usd<>p_amount_usd OR payment.payment_type<>p_payment_type THEN RAISE EXCEPTION 'Payment key already used for another request'; END IF;
  RETURN payment;
 END IF;
 INSERT INTO public.lease_payments(lease_id,payer_id,payee_id,payment_type,amount_usd,status,reference,idempotency_key)
 VALUES(l.id,auth.uid(),l.landlord_id,p_payment_type,p_amount_usd,'pending','TNP-PAY-'||gen_random_uuid()::text,p_idempotency_key) RETURNING * INTO payment;
 INSERT INTO public.payment_audit_logs(payment_id,lease_id,event_type,new_status,amount_usd,actor_id,actor_type,reference)
 VALUES(payment.id,l.id,'request_created','pending',p_amount_usd,auth.uid(),'tenant',payment.reference);
 RETURN payment;
END $$;
REVOKE ALL ON FUNCTION public.create_lease_payment(uuid,text,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_lease_payment(uuid,text,numeric,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.request_lease_renewal(p_lease_id uuid)
RETURNS public.leases LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leases;
BEGIN
 SELECT * INTO l FROM public.leases WHERE id=p_lease_id AND tenant_id=auth.uid() FOR UPDATE;
 IF auth.uid() IS NULL OR l.id IS NULL OR lower(l.status)<>'active' THEN RAISE EXCEPTION 'An active lease belonging to you is required'; END IF;
 IF l.renewal_status='requested' THEN RETURN l; END IF;
 UPDATE public.leases SET renewal_status='requested',renewal_requested_at=now(),updated_at=now() WHERE id=l.id RETURNING * INTO l;
 INSERT INTO public.lease_events(lease_id,actor_id,event_type,detail) VALUES(l.id,auth.uid(),'renewal_requested','Tenant requested renewal; existing lease terms remain in force.');
 RETURN l;
END $$;
REVOKE ALL ON FUNCTION public.request_lease_renewal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_lease_renewal(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.submit_scam_case(p_case_type text,p_title text,p_description text,p_priority text,p_location text,p_address text,p_scammer_name text,p_scammer_phone text,p_scammer_email text,p_identification_number text,p_amount_lost_usd numeric,p_payment_method text,p_payment_reference text,p_property_id uuid,p_scammer_id uuid,p_evidence text[])
RETURNS public.scam_cases LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.scam_cases;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
 IF length(trim(coalesce(p_title,''))) NOT BETWEEN 5 AND 300 OR length(trim(coalesce(p_description,''))) NOT BETWEEN 30 AND 20000 OR p_priority IS NULL OR p_priority NOT IN('low','medium','high','critical') OR p_amount_lost_usd IS NULL OR p_amount_lost_usd<0 OR p_amount_lost_usd::text IN('NaN','Infinity','-Infinity') OR coalesce(cardinality(p_evidence),0)>30 THEN RAISE EXCEPTION 'Invalid report'; END IF;
 INSERT INTO public.scam_cases(reporter_id,reference,case_type,title,description,priority,status,location,address,scammer_name,scammer_phone,scammer_email,identification_number,amount_lost_usd,payment_method,payment_reference,property_id,scammer_id,evidence)
 VALUES(auth.uid(),'TNP-SC-'||gen_random_uuid()::text,p_case_type,trim(p_title),trim(p_description),p_priority,'submitted',p_location,p_address,p_scammer_name,p_scammer_phone,p_scammer_email,p_identification_number,p_amount_lost_usd,p_payment_method,p_payment_reference,p_property_id,p_scammer_id,coalesce(p_evidence,ARRAY[]::text[])) RETURNING * INTO c;
 RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.submit_scam_case(text,text,text,text,text,text,text,text,text,text,numeric,text,text,uuid,uuid,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_scam_case(text,text,text,text,text,text,text,text,text,text,numeric,text,text,uuid,uuid,text[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.submit_tenant_review(p_property_id uuid,p_landlord_id uuid,p_rating integer,p_body text)
RETURNS public.reviews LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.reviews;
BEGIN
 IF auth.uid() IS NULL OR p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 OR length(trim(coalesce(p_body,''))) NOT BETWEEN 10 AND 10000 THEN RAISE EXCEPTION 'Invalid review'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.leases WHERE property_id=p_property_id AND landlord_id=p_landlord_id AND tenant_id=auth.uid() AND status IN('active','completed','terminated')) THEN RAISE EXCEPTION 'A qualifying lease is required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text),hashtext(p_property_id::text));
 IF EXISTS(SELECT 1 FROM public.reviews WHERE author_id=auth.uid() AND property_id=p_property_id AND subject_id=p_landlord_id) THEN RAISE EXCEPTION 'You have already reviewed this property'; END IF;
 INSERT INTO public.reviews(author_id,subject_id,property_id,rating,body,lease_confirmed,moderation_status) VALUES(auth.uid(),p_landlord_id,p_property_id,p_rating,trim(p_body),true,'pending') RETURNING * INTO r;
 INSERT INTO public.review_events(review_id,actor_id,event_type,new_status,note) VALUES(r.id,auth.uid(),'submitted','pending','Awaiting moderation');
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.submit_tenant_review(uuid,uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_tenant_review(uuid,uuid,integer,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.update_tenant_review(p_review_id uuid,p_rating integer,p_body text)
RETURNS public.reviews LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.reviews;
BEGIN
 IF auth.uid() IS NULL OR p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 OR length(trim(coalesce(p_body,''))) NOT BETWEEN 10 AND 10000 THEN RAISE EXCEPTION 'Invalid review'; END IF;
 UPDATE public.reviews SET rating=p_rating,body=trim(p_body),moderation_status='pending',reviewed_at=NULL,admin_note=NULL WHERE id=p_review_id AND author_id=auth.uid() RETURNING * INTO r;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Review not found'; END IF;
 INSERT INTO public.review_events(review_id,actor_id,event_type,new_status) VALUES(r.id,auth.uid(),'edited','pending'); RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.update_tenant_review(uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tenant_review(uuid,integer,text) TO authenticated;
CREATE TABLE IF NOT EXISTS public.review_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid REFERENCES public.reviews(id) ON DELETE CASCADE,reporter_id uuid REFERENCES auth.users(id),reason text,details text,created_at timestamptz DEFAULT now());
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.review_reports TO authenticated;
DROP POLICY IF EXISTS tnp_review_reports_read ON public.review_reports;
CREATE POLICY tnp_review_reports_read ON public.review_reports FOR SELECT TO authenticated USING(reporter_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.report_review(p_review_id uuid,p_reason text,p_details text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL OR length(coalesce(p_reason,'')) NOT BETWEEN 1 AND 100 OR length(coalesce(p_details,''))>10000 OR NOT EXISTS(SELECT 1 FROM public.reviews WHERE id=p_review_id AND (moderation_status='approved' OR author_id=auth.uid() OR subject_id=auth.uid())) THEN RAISE EXCEPTION 'Invalid review report'; END IF;
 INSERT INTO public.review_reports(review_id,reporter_id,reason,details) VALUES(p_review_id,auth.uid(),p_reason,p_details) RETURNING id INTO result; RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.report_review(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_review(uuid,text,text) TO authenticated;
COMMIT;
