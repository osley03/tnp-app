BEGIN;
CREATE TABLE public.tnp_payment_destinations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision bigint GENERATED ALWAYS AS IDENTITY UNIQUE, landlord_id uuid NOT NULL REFERENCES auth.users(id),
 method text NOT NULL CHECK(method IN ('ecocash','onemoney','innbucks','bank')), account_name text NOT NULL CHECK(length(account_name) BETWEEN 2 AND 120),
 account_number text NOT NULL CHECK(length(account_number) BETWEEN 3 AND 120), institution text NOT NULL DEFAULT '' CHECK(length(institution)<=120),
 instructions text NOT NULL DEFAULT '' CHECK(length(instructions)<=500), currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'), enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.tnp_payment_destinations(landlord_id,method,created_at DESC);
CREATE TABLE public.tnp_manual_payment_submissions (
 id uuid PRIMARY KEY, payment_id uuid NOT NULL REFERENCES public.lease_payments(id), lease_id uuid NOT NULL REFERENCES public.leases(id),
 tenant_id uuid NOT NULL REFERENCES auth.users(id), landlord_id uuid NOT NULL REFERENCES auth.users(id), destination_id uuid NOT NULL REFERENCES public.tnp_payment_destinations(id),
 tnp_reference text NOT NULL, destination_snapshot jsonb NOT NULL, expected_amount_usd numeric(12,2) NOT NULL, amount_usd numeric(12,2) NOT NULL CHECK(amount_usd>0),
 paid_on date NOT NULL, transaction_reference text NOT NULL CHECK(length(transaction_reference) BETWEEN 3 AND 120), receipt_path text NOT NULL UNIQUE, receipt_sha256 text NOT NULL CHECK(receipt_sha256 ~ '^[a-f0-9]{64}$'),
 flags text[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.tnp_manual_payment_submissions(payment_id);
CREATE TABLE public.tnp_manual_payment_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL UNIQUE REFERENCES public.tnp_manual_payment_submissions(id),
 landlord_id uuid NOT NULL REFERENCES auth.users(id), decision text NOT NULL CHECK(decision IN ('confirmed','disputed')), note text NOT NULL DEFAULT '' CHECK(length(note)<=2000), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tnp_manual_payment_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, lease_id uuid NOT NULL REFERENCES public.leases(id), payload jsonb NOT NULL,
 previous_hash text NOT NULL, entry_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.tnp_manual_append(p_lease uuid,p_payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_lease::text,0));
 SELECT entry_hash INTO previous FROM public.tnp_manual_payment_events WHERE lease_id=p_lease ORDER BY id DESC LIMIT 1;
 previous:=coalesce(previous,repeat('0',64));
 p_payload:=p_payload||jsonb_build_object('lease_id',p_lease,'actor_id',auth.uid(),'recorded_at',clock_timestamp(),'event_id',gen_random_uuid());
 INSERT INTO public.tnp_manual_payment_events(lease_id,payload,previous_hash,entry_hash) VALUES(p_lease,p_payload,previous,encode(extensions.digest(convert_to(previous||p_payload::text,'UTF8'),'sha256'),'hex'));
END $$;
REVOKE ALL ON FUNCTION public.tnp_manual_append(uuid,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.tnp_manual_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Payment evidence is append-only; create a new record instead'; END $$;
CREATE TRIGGER tnp_destination_immutable BEFORE UPDATE OR DELETE ON public.tnp_payment_destinations FOR EACH ROW EXECUTE FUNCTION public.tnp_manual_immutable();
CREATE TRIGGER tnp_submission_immutable BEFORE UPDATE OR DELETE ON public.tnp_manual_payment_submissions FOR EACH ROW EXECUTE FUNCTION public.tnp_manual_immutable();
CREATE TRIGGER tnp_decision_immutable BEFORE UPDATE OR DELETE ON public.tnp_manual_payment_decisions FOR EACH ROW EXECUTE FUNCTION public.tnp_manual_immutable();
CREATE TRIGGER tnp_manual_event_immutable BEFORE UPDATE OR DELETE ON public.tnp_manual_payment_events FOR EACH ROW EXECUTE FUNCTION public.tnp_manual_immutable();
ALTER TABLE public.tnp_payment_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tnp_manual_payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tnp_manual_payment_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tnp_manual_payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tnp_payment_destinations,public.tnp_manual_payment_submissions,public.tnp_manual_payment_decisions,public.tnp_manual_payment_events FROM anon,authenticated;
GRANT SELECT ON public.tnp_payment_destinations,public.tnp_manual_payment_submissions,public.tnp_manual_payment_decisions,public.tnp_manual_payment_events TO authenticated;
CREATE POLICY destination_history_read ON public.tnp_payment_destinations FOR SELECT TO authenticated USING(landlord_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY manual_submission_read ON public.tnp_manual_payment_submissions FOR SELECT TO authenticated USING(tenant_id=auth.uid() OR landlord_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY manual_decision_read ON public.tnp_manual_payment_decisions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.tnp_manual_payment_submissions s WHERE s.id=submission_id));
CREATE POLICY manual_event_read ON public.tnp_manual_payment_events FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.leases l WHERE l.id=lease_id AND auth.uid() IN(l.tenant_id,l.landlord_id)));
CREATE FUNCTION public.tnp_save_payment_destination(p_method text,p_account_name text,p_account_number text,p_institution text,p_instructions text,p_enabled boolean) RETURNS public.tnp_payment_destinations LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result public.tnp_payment_destinations; l record;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'landlord') THEN RAISE EXCEPTION 'Landlord access required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 INSERT INTO public.tnp_payment_destinations(landlord_id,method,account_name,account_number,institution,instructions,enabled) VALUES(auth.uid(),p_method,trim(p_account_name),trim(p_account_number),trim(p_institution),trim(p_instructions),p_enabled) RETURNING * INTO result;
 FOR l IN SELECT id FROM public.leases WHERE landlord_id=auth.uid() AND status IN('pending_approval','approved','active','signed','running','pending_start','upcoming') ORDER BY id LOOP
  PERFORM public.tnp_manual_append(l.id,jsonb_build_object('event','destination_changed','destination',to_jsonb(result)));
 END LOOP;
 RETURN result;
END $$;
CREATE FUNCTION public.tnp_payment_destinations_for(p_payment_id uuid) RETURNS SETOF public.tnp_payment_destinations LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.lease_payments;
BEGIN
 SELECT * INTO p FROM public.lease_payments WHERE id=p_payment_id;
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'tenant') OR p.id IS NULL OR p.payer_id<>auth.uid() OR NOT EXISTS(SELECT 1 FROM public.leases l WHERE l.id=p.lease_id AND l.tenant_id=auth.uid() AND l.landlord_id=p.payee_id AND l.status IN('pending_approval','approved','active','signed','running','pending_start','upcoming')) THEN RAISE EXCEPTION 'An approved rental is required to see payment details'; END IF;
 RETURN QUERY SELECT d.* FROM (SELECT DISTINCT ON(method) * FROM public.tnp_payment_destinations WHERE landlord_id=p.payee_id ORDER BY method,revision DESC) d WHERE d.enabled;
END $$;
CREATE FUNCTION public.tnp_submit_manual_payment(p_id uuid,p_payment_id uuid,p_destination_id uuid,p_amount numeric,p_paid_on date,p_reference text,p_receipt_path text,p_receipt_sha256 text) RETURNS public.tnp_manual_payment_submissions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.lease_payments; d public.tnp_payment_destinations; result public.tnp_manual_payment_submissions; flags text[]:='{}'; latest uuid;
BEGIN
 SELECT * INTO p FROM public.lease_payments WHERE id=p_payment_id FOR UPDATE;
 IF auth.uid() IS NULL OR p.id IS NULL OR p.payer_id<>auth.uid() OR p.payment_type='admin_fee' OR p.status NOT IN('pending','disputed') THEN RAISE EXCEPTION 'Select your unpaid approved rental charge'; END IF;
 SELECT * INTO result FROM public.tnp_manual_payment_submissions WHERE id=p_id;
 IF result.id IS NOT NULL THEN IF result.tenant_id=auth.uid() AND result.payment_id=p.id THEN RETURN result; ELSE RAISE EXCEPTION 'Submission identifier already used'; END IF; END IF;
 IF EXISTS(SELECT 1 FROM public.tnp_gateway_attempts WHERE payment_id=p.id) THEN RAISE EXCEPTION 'A provider checkout exists; verify it before using another method'; END IF;
 IF EXISTS(SELECT 1 FROM public.tnp_manual_payment_submissions s WHERE s.payment_id=p.id AND NOT EXISTS(SELECT 1 FROM public.tnp_manual_payment_decisions v WHERE v.submission_id=s.id)) THEN RAISE EXCEPTION 'A submission is already awaiting landlord review'; END IF;
 PERFORM * FROM public.tnp_payment_destinations_for(p.id);
 SELECT * INTO d FROM public.tnp_payment_destinations WHERE id=p_destination_id AND landlord_id=p.payee_id AND enabled;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Select this landlord’s payment details'; END IF;
 SELECT id INTO latest FROM public.tnp_payment_destinations WHERE landlord_id=p.payee_id AND method=d.method ORDER BY revision DESC LIMIT 1;
 IF latest<>d.id THEN flags:=array_append(flags,'destination_changed'); END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>1000000 OR round(p_amount,2)<>p_amount OR p_paid_on IS NULL OR p_paid_on>CURRENT_DATE OR length(trim(p_reference)) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Enter a valid amount, payment date and transaction reference'; END IF;
 IF EXISTS(SELECT 1 FROM public.tnp_manual_payment_submissions WHERE landlord_id=p.payee_id AND lower(transaction_reference)=lower(trim(p_reference)) AND payment_id<>p.id) THEN RAISE EXCEPTION 'This transaction reference is already attached to another payment'; END IF;
 IF p_receipt_path<>auth.uid()::text||'/'||p.id::text||'/'||p_id::text||'.jpg' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='tnp-manual-receipts' AND name=p_receipt_path) THEN RAISE EXCEPTION 'Upload this payment receipt first'; END IF;
 IF p_amount<>p.amount_usd THEN flags:=array_append(flags,'amount_mismatch'); END IF;
 IF p_paid_on<p.created_at::date THEN flags:=array_append(flags,'before_request_date'); END IF;
 INSERT INTO public.tnp_manual_payment_submissions(id,payment_id,lease_id,tenant_id,landlord_id,destination_id,tnp_reference,destination_snapshot,expected_amount_usd,amount_usd,paid_on,transaction_reference,receipt_path,receipt_sha256,flags) VALUES(p_id,p.id,p.lease_id,auth.uid(),p.payee_id,d.id,coalesce(p.reference,p.id::text),to_jsonb(d),p.amount_usd,p_amount,p_paid_on,trim(p_reference),p_receipt_path,p_receipt_sha256,flags) RETURNING * INTO result;
 PERFORM public.tnp_manual_append(p.lease_id,jsonb_build_object('event','tenant_submitted','submission',to_jsonb(result),'tnp_reference',coalesce(p.reference,p.id::text)));
 RETURN result;
END $$;
CREATE FUNCTION public.tnp_decide_manual_payment(p_submission_id uuid,p_decision text,p_note text) RETURNS public.tnp_manual_payment_decisions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.tnp_manual_payment_submissions; p public.lease_payments; result public.tnp_manual_payment_decisions;
BEGIN
 SELECT * INTO s FROM public.tnp_manual_payment_submissions WHERE id=p_submission_id;
 SELECT * INTO p FROM public.lease_payments WHERE id=s.payment_id FOR UPDATE;
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'landlord') OR s.id IS NULL OR s.landlord_id<>auth.uid() THEN RAISE EXCEPTION 'Only the receiving landlord can confirm or dispute'; END IF;
 IF p_decision NOT IN('confirmed','disputed') OR length(p_note)>2000 OR (p_decision='disputed' AND length(trim(p_note))<10) THEN RAISE EXCEPTION 'Describe the dispute in at least ten characters'; END IF;
 SELECT * INTO result FROM public.tnp_manual_payment_decisions WHERE submission_id=s.id;
 IF result.id IS NOT NULL THEN IF result.decision=p_decision THEN RETURN result; ELSE RAISE EXCEPTION 'This decision is locked'; END IF; END IF;
 IF p.status NOT IN('pending','disputed') THEN RAISE EXCEPTION 'This charge cannot be confirmed twice'; END IF;
 IF p_decision='confirmed' AND (s.amount_usd<>p.amount_usd OR s.expected_amount_usd<>p.amount_usd) THEN RAISE EXCEPTION 'Amount mismatch: dispute this submission and agree the correct charge before resubmission'; END IF;
 INSERT INTO public.tnp_manual_payment_decisions(submission_id,landlord_id,decision,note) VALUES(s.id,auth.uid(),p_decision,trim(p_note)) RETURNING * INTO result;
 PERFORM public.tnp_manual_append(s.lease_id,jsonb_build_object('event','landlord_'||p_decision,'decision',to_jsonb(result),'submission_id',s.id));
 IF p_decision='confirmed' THEN UPDATE public.lease_payments SET status='paid',paid_at=s.paid_on::timestamptz,updated_at=now() WHERE id=p.id; END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.tnp_guard_manual_ledger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.tnp_manual_payment_submissions WHERE payment_id=OLD.id) THEN
  IF TG_OP='DELETE' OR OLD.status='paid' THEN RAISE EXCEPTION 'Manual payment records are locked'; END IF;
  IF to_jsonb(NEW)-ARRAY['status','paid_at','updated_at']<>to_jsonb(OLD)-ARRAY['status','paid_at','updated_at'] OR NEW.status<>'paid' OR NOT EXISTS(SELECT 1 FROM public.tnp_manual_payment_submissions s JOIN public.tnp_manual_payment_decisions d ON d.submission_id=s.id WHERE s.payment_id=OLD.id AND d.decision='confirmed') THEN RAISE EXCEPTION 'Only a matching landlord confirmation can settle a manual payment'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER tnp_guard_manual_ledger BEFORE UPDATE OR DELETE ON public.lease_payments FOR EACH ROW EXECUTE FUNCTION public.tnp_guard_manual_ledger();
CREATE FUNCTION public.tnp_block_gateway_after_manual() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.tnp_manual_payment_submissions WHERE payment_id=NEW.payment_id) THEN RAISE EXCEPTION 'This charge uses the manual evidence workflow'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER tnp_block_gateway_after_manual BEFORE INSERT ON public.tnp_gateway_attempts FOR EACH ROW EXECUTE FUNCTION public.tnp_block_gateway_after_manual();
CREATE FUNCTION public.tnp_verify_manual_chain(p_lease_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; previous text:=repeat('0',64); count integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT(public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.leases WHERE id=p_lease_id AND auth.uid() IN(tenant_id,landlord_id))) THEN RAISE EXCEPTION 'Lease access denied'; END IF;
 FOR r IN SELECT * FROM public.tnp_manual_payment_events WHERE lease_id=p_lease_id ORDER BY id LOOP
  IF r.previous_hash<>previous OR r.entry_hash<>encode(extensions.digest(convert_to(previous||r.payload::text,'UTF8'),'sha256'),'hex') THEN RETURN jsonb_build_object('valid',false,'entries',count); END IF;
  previous:=r.entry_hash;count:=count+1;
 END LOOP;
 RETURN jsonb_build_object('valid',true,'entries',count,'head',previous);
END $$;
REVOKE ALL ON FUNCTION public.tnp_save_payment_destination(text,text,text,text,text,boolean),public.tnp_payment_destinations_for(uuid),public.tnp_submit_manual_payment(uuid,uuid,uuid,numeric,date,text,text,text),public.tnp_decide_manual_payment(uuid,text,text),public.tnp_verify_manual_chain(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tnp_save_payment_destination(text,text,text,text,text,boolean),public.tnp_payment_destinations_for(uuid),public.tnp_submit_manual_payment(uuid,uuid,uuid,numeric,date,text,text,text),public.tnp_decide_manual_payment(uuid,text,text),public.tnp_verify_manual_chain(uuid) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('tnp-manual-receipts','tnp-manual-receipts',false,5242880,ARRAY['image/jpeg']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY manual_receipt_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='tnp-manual-receipts' AND split_part(name,'/',1)=auth.uid()::text AND EXISTS(SELECT 1 FROM public.lease_payments p JOIN public.leases l ON l.id=p.lease_id WHERE p.id::text=split_part(name,'/',2) AND p.payer_id=auth.uid() AND p.status IN('pending','disputed') AND l.status IN('pending_approval','approved','active','signed','running','pending_start','upcoming')));
CREATE POLICY manual_receipt_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='tnp-manual-receipts' AND (split_part(name,'/',1)=auth.uid()::text OR EXISTS(SELECT 1 FROM public.tnp_manual_payment_submissions s WHERE s.receipt_path=name AND (s.landlord_id=auth.uid() OR public.has_role(auth.uid(),'admin')))));
CREATE POLICY manual_receipt_cleanup ON storage.objects FOR DELETE TO authenticated USING(bucket_id='tnp-manual-receipts' AND split_part(name,'/',1)=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM public.tnp_manual_payment_submissions s WHERE s.receipt_path=name));
CREATE POLICY manual_receipt_no_replacement ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'tnp-manual-receipts') WITH CHECK(bucket_id<>'tnp-manual-receipts');
CREATE POLICY manual_receipt_locked_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'tnp-manual-receipts' OR (split_part(name,'/',1)=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM public.tnp_manual_payment_submissions s WHERE s.receipt_path=name)));
COMMIT;
