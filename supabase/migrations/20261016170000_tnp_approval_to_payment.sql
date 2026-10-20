BEGIN;
ALTER TABLE public.lease_payments ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.lease_payments ADD COLUMN IF NOT EXISTS period_start date;
ALTER TABLE public.lease_payments ADD COLUMN IF NOT EXISTS period_end date;
CREATE UNIQUE INDEX tnp_one_rent_period ON public.lease_payments(lease_id,period_start) WHERE payment_type='rent' AND period_start IS NOT NULL;
CREATE OR REPLACE FUNCTION public.tnp_lease_payable(p_lease_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.leases l WHERE l.id=p_lease_id AND (l.status='active' OR (l.status='pending_approval' AND EXISTS(SELECT 1 FROM public.lease_requests r WHERE r.id=l.lease_request_id AND r.tenant_id=l.tenant_id AND r.property_id=l.property_id AND lower(r.status) IN('approved','accepted')))));
$$;
REVOKE ALL ON FUNCTION public.tnp_lease_payable(uuid) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.tnp_scheduled_payment(p_lease_id uuid,p_kind text,p_month date DEFAULT NULL)
RETURNS public.lease_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leases; payment public.lease_payments; amount numeric; month_start date; due date;
BEGIN
 SELECT * INTO l FROM public.leases WHERE id=p_lease_id FOR UPDATE;
 IF l.id IS NULL OR p_kind IS NULL OR p_kind NOT IN('rent','deposit') THEN RAISE EXCEPTION 'Rental payment could not be prepared'; END IF;
 month_start:=date_trunc('month',coalesce(p_month,l.start_date,CURRENT_DATE))::date;
 amount:=CASE WHEN p_kind='rent' THEN l.rent_usd ELSE l.deposit_usd END;
 IF amount IS NULL OR amount<=0 OR amount>1000000 OR amount<>round(amount,2) THEN RAISE EXCEPTION 'The saved rental amount is invalid'; END IF;
 SELECT * INTO payment FROM public.lease_payments WHERE lease_id=l.id AND payment_type=p_kind AND
  (p_kind='deposit' OR period_start=month_start OR (period_start IS NULL AND date_trunc('month',coalesce(paid_at,created_at))::date=month_start)) ORDER BY created_at LIMIT 1;
 IF payment.id IS NOT NULL THEN RETURN payment; END IF;
 due:=CASE WHEN p_kind='deposit' THEN CURRENT_DATE WHEN l.start_date IS NOT NULL AND date_trunc('month',l.start_date)::date=month_start THEN l.start_date ELSE month_start+(least(greatest(coalesce(l.payment_due_day,1),1),28)-1) END;
 INSERT INTO public.lease_payments(lease_id,payer_id,payee_id,payment_type,amount_usd,status,reference,idempotency_key,due_date,period_start,period_end)
 VALUES(l.id,l.tenant_id,l.landlord_id,p_kind,amount,'pending','TNP-PAY-'||gen_random_uuid()::text,'scheduled:'||l.id::text||':'||p_kind||':'||CASE WHEN p_kind='rent' THEN month_start::text ELSE 'once' END,due,CASE WHEN p_kind='rent' THEN month_start ELSE NULL END,CASE WHEN p_kind='rent' THEN (month_start+interval '1 month - 1 day')::date ELSE NULL END) RETURNING * INTO payment;
 INSERT INTO public.payment_audit_logs(payment_id,lease_id,event_type,new_status,amount_usd,actor_id,actor_type,reference,metadata)
 VALUES(payment.id,l.id,'request_created','pending',amount,auth.uid(),'system',payment.reference,jsonb_build_object('origin','approved_rental','period_start',payment.period_start,'due_date',due));
 RETURN payment;
END $$;
REVOKE ALL ON FUNCTION public.tnp_scheduled_payment(uuid,text,date) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.tnp_prepare_approved_rental() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prop public.properties; l public.leases;
BEGIN
 IF NEW.status IS NULL OR lower(NEW.status) NOT IN('approved','accepted') OR lower(OLD.status) IN('approved','accepted') THEN RETURN NEW; END IF;
 SELECT * INTO prop FROM public.properties WHERE id=NEW.property_id FOR UPDATE;
 IF auth.uid() IS NOT NULL AND auth.uid()<>prop.owner_id AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only the owning landlord or administrator can approve this rental'; END IF;
 SELECT * INTO l FROM public.leases WHERE lease_request_id=NEW.id ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.leases occupied WHERE occupied.property_id=NEW.property_id AND occupied.id IS DISTINCT FROM l.id AND occupied.status IN('active','pending_approval') AND (occupied.end_date IS NULL OR NEW.move_in IS NULL OR occupied.end_date>=NEW.move_in)) THEN RAISE EXCEPTION 'This property already has an overlapping approved or active rental'; END IF;
 IF l.id IS NULL THEN
  INSERT INTO public.leases(lease_request_id,property_id,tenant_id,landlord_id,status,rent_usd,deposit_usd,start_date,payment_frequency,payment_due_day,escrow_status)
  VALUES(NEW.id,prop.id,NEW.tenant_id,prop.owner_id,'pending_approval',prop.rent_usd,coalesce(prop.deposit_usd,0),NEW.move_in,'monthly',1,'not_applicable') RETURNING * INTO l;
  INSERT INTO public.lease_events(lease_id,actor_id,event_type,to_status,detail) VALUES(l.id,auth.uid(),'rental_approved','pending_approval','Landlord approval opened rent/deposit payments. Lease activation and signatures are separate.');
 END IF;
 IF l.tenant_id<>NEW.tenant_id OR l.property_id<>NEW.property_id OR l.landlord_id<>prop.owner_id THEN RAISE EXCEPTION 'The existing lease does not match this approved rental'; END IF;
 NEW.lease_id:=l.id;
 IF l.status='pending_approval' THEN
  IF l.rent_usd>0 THEN PERFORM public.tnp_scheduled_payment(l.id,'rent',date_trunc('month',coalesce(l.start_date,CURRENT_DATE))::date); END IF;
  IF l.deposit_usd>0 THEN PERFORM public.tnp_scheduled_payment(l.id,'deposit',NULL); END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tnp_prepare_approved_rental() FROM PUBLIC;
-- Run after the existing guards have validated the caller's original changes.
CREATE TRIGGER zzzz_tnp_prepare_approved_rental BEFORE UPDATE OF status ON public.lease_requests FOR EACH ROW EXECUTE FUNCTION public.tnp_prepare_approved_rental();
CREATE OR REPLACE FUNCTION public.tnp_create_monthly_rent(p_lease_id uuid,p_month date)
RETURNS public.lease_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leases;
BEGIN
 SELECT * INTO l FROM public.leases WHERE id=p_lease_id AND tenant_id=auth.uid() FOR UPDATE;
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'tenant') OR l.id IS NULL OR NOT public.tnp_lease_payable(l.id) THEN RAISE EXCEPTION 'An approved rental belonging to you is required'; END IF;
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR (l.start_date IS NOT NULL AND p_month<date_trunc('month',l.start_date)::date) OR (l.end_date IS NOT NULL AND p_month>date_trunc('month',l.end_date)::date) OR p_month>date_trunc('month',CURRENT_DATE+interval '1 year')::date AND l.status='active' THEN RAISE EXCEPTION 'Choose a rent month within your rental dates'; END IF;
 IF l.status='pending_approval' AND p_month<>date_trunc('month',coalesce(l.start_date,CURRENT_DATE))::date THEN RAISE EXCEPTION 'Pay the initial rent month first; future months open after lease activation'; END IF;
 RETURN public.tnp_scheduled_payment(l.id,'rent',p_month);
END $$;
REVOKE ALL ON FUNCTION public.tnp_create_monthly_rent(uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tnp_create_monthly_rent(uuid,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.create_lease_payment(p_lease_id uuid,p_payment_type text,p_amount_usd numeric,p_idempotency_key text)
RETURNS public.lease_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leases; payment public.lease_payments;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'tenant') THEN RAISE EXCEPTION 'Tenant sign-in required'; END IF;
 SELECT * INTO l FROM public.leases WHERE id=p_lease_id AND tenant_id=auth.uid() FOR UPDATE;
 IF l.id IS NULL OR NOT public.tnp_lease_payable(l.id) THEN RAISE EXCEPTION 'An approved rental belonging to you is required'; END IF;
 IF p_amount_usd IS NULL OR p_amount_usd<=0 OR p_amount_usd::text IN('NaN','Infinity','-Infinity') OR p_amount_usd>1000000 OR p_payment_type IS NULL OR p_payment_type NOT IN('rent','deposit','utility','late_fee','other') OR length(coalesce(p_idempotency_key,'')) NOT BETWEEN 8 AND 200 THEN RAISE EXCEPTION 'Invalid payment request'; END IF;
 IF p_payment_type IN('rent','deposit') THEN
  IF p_amount_usd IS DISTINCT FROM (CASE WHEN p_payment_type='rent' THEN l.rent_usd ELSE l.deposit_usd END) THEN RAISE EXCEPTION 'Use the saved rent or deposit amount'; END IF;
  IF p_payment_type='rent' THEN RETURN public.tnp_create_monthly_rent(l.id,date_trunc('month',CASE WHEN l.status='pending_approval' THEN coalesce(l.start_date,CURRENT_DATE) ELSE CURRENT_DATE END)::date); END IF;
  RETURN public.tnp_scheduled_payment(l.id,'deposit',NULL);
 END IF;
 IF l.status<>'active' THEN RAISE EXCEPTION 'Additional lease charges open after activation'; END IF;
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
CREATE OR REPLACE FUNCTION public.tnp_reserve_gateway_payment(p_payment_id uuid,p_payer_id uuid,p_method text,p_integration_id text,p_mode text,p_claim_token uuid)
RETURNS public.tnp_gateway_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE payment public.lease_payments; lease public.leases; attempt public.tnp_gateway_attempts; attempt_id uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO payment FROM public.lease_payments WHERE id=p_payment_id FOR UPDATE;
 IF payment.id IS NULL OR payment.payer_id IS DISTINCT FROM p_payer_id OR p_method NOT IN('ecocash','mastercard') OR p_mode NOT IN('test','live') OR p_integration_id !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Invalid payment request'; END IF;
 SELECT * INTO lease FROM public.leases WHERE id=payment.lease_id;
 IF lease.tenant_id IS DISTINCT FROM p_payer_id OR lease.landlord_id IS DISTINCT FROM payment.payee_id OR NOT public.tnp_lease_payable(lease.id) OR payment.payment_type NOT IN('rent','deposit','utility','late_fee','other') OR payment.amount_usd<=0 OR payment.amount_usd>1000000 OR payment.amount_usd<>round(payment.amount_usd,2) THEN RAISE EXCEPTION 'An approved rental or active lease payment is required'; END IF;
 SELECT * INTO attempt FROM public.tnp_gateway_attempts WHERE payment_id=payment.id AND mode=p_mode;
 IF attempt.id IS NOT NULL THEN RETURN attempt; END IF;
 IF payment.status<>'pending' THEN RAISE EXCEPTION 'This payment is no longer awaiting checkout'; END IF;
 INSERT INTO public.tnp_gateway_attempts(id,payment_id,lease_id,payer_id,landlord_id,method,integration_id,claim_token,mode,currency,amount_usd,merchant_reference)
 VALUES(attempt_id,payment.id,lease.id,p_payer_id,lease.landlord_id,p_method,p_integration_id,p_claim_token,p_mode,'USD',payment.amount_usd,'TNP-'||attempt_id::text) RETURNING * INTO attempt;
 RETURN attempt;
END $$;
REVOKE ALL ON FUNCTION public.tnp_reserve_gateway_payment(uuid,uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tnp_reserve_gateway_payment(uuid,uuid,text,text,text,uuid) TO service_role;


CREATE OR REPLACE FUNCTION public.tnp_payment_summary(p_role text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_role IS NULL OR p_role NOT IN('tenant','landlord') OR NOT public.has_role(auth.uid(),p_role::public.app_role) THEN RAISE EXCEPTION 'Sign in with the correct rental role'; END IF;
 SELECT jsonb_build_object('paid',coalesce(sum(amount_usd) FILTER(WHERE status IN('paid','released')),0),'this_month',coalesce(sum(amount_usd) FILTER(WHERE status IN('paid','released') AND paid_at>=date_trunc('month',now())),0),'pending',coalesce(sum(amount_usd) FILTER(WHERE status IN('pending','processing')),0),'overdue',coalesce(sum(amount_usd) FILTER(WHERE status IN('pending','processing') AND due_date<CURRENT_DATE),0),'paid_count',count(*) FILTER(WHERE status IN('paid','released')),'pending_count',count(*) FILTER(WHERE status IN('pending','processing'))) INTO result
 FROM public.lease_payments WHERE CASE WHEN p_role='tenant' THEN payer_id=auth.uid() ELSE payee_id=auth.uid() END;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.tnp_payment_summary(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tnp_payment_summary(text) TO authenticated;
-- Repair previously approved applications without inventing signatures or paid transactions.
DO $$ DECLARE r public.lease_requests; prop public.properties; l public.leases; BEGIN
 FOR r IN SELECT * FROM public.lease_requests WHERE lower(status) IN('approved','accepted') LOOP
  SELECT * INTO prop FROM public.properties WHERE id=r.property_id;
  SELECT * INTO l FROM public.leases WHERE lease_request_id=r.id ORDER BY created_at LIMIT 1;
  IF l.id IS NULL THEN INSERT INTO public.leases(lease_request_id,property_id,tenant_id,landlord_id,status,rent_usd,deposit_usd,start_date,payment_frequency,payment_due_day,escrow_status) VALUES(r.id,r.property_id,r.tenant_id,prop.owner_id,'pending_approval',prop.rent_usd,coalesce(prop.deposit_usd,0),r.move_in,'monthly',1,'not_applicable') RETURNING * INTO l; END IF;
  UPDATE public.lease_requests SET lease_id=l.id WHERE id=r.id AND lease_id IS DISTINCT FROM l.id;
  IF l.status='pending_approval' THEN
   IF l.rent_usd>0 THEN PERFORM public.tnp_scheduled_payment(l.id,'rent',date_trunc('month',coalesce(l.start_date,CURRENT_DATE))::date); END IF;
   IF l.deposit_usd>0 THEN PERFORM public.tnp_scheduled_payment(l.id,'deposit',NULL); END IF;
  END IF;
 END LOOP;
END $$;
COMMIT;
