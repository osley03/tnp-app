BEGIN;
CREATE OR REPLACE FUNCTION public.tnp_create_lease_from_request(p_request_id uuid) RETURNS public.leases LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.lease_requests; prop public.properties; l public.leases;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 SELECT * INTO r FROM public.lease_requests WHERE id=p_request_id FOR UPDATE;
 IF r.id IS NULL OR lower(r.status) NOT IN('pending','pending review','submitted','under review','under_review','approved') THEN RAISE EXCEPTION 'This application cannot be converted to a lease'; END IF;
 SELECT * INTO l FROM public.leases WHERE lease_request_id=r.id LIMIT 1;
 IF l.id IS NOT NULL THEN RETURN l; END IF;
 SELECT * INTO prop FROM public.properties WHERE id=r.property_id;
 IF prop.id IS NULL THEN RAISE EXCEPTION 'Property not found'; END IF;
 INSERT INTO public.leases(lease_request_id,property_id,tenant_id,landlord_id,status,rent_usd,deposit_usd,start_date,payment_frequency,payment_due_day,escrow_status)
 VALUES(r.id,prop.id,r.tenant_id,prop.owner_id,'pending_approval',prop.rent_usd,prop.deposit_usd,r.move_in,'monthly',1,'unfunded') RETURNING * INTO l;
 UPDATE public.lease_requests SET status='Approved',lease_id=l.id,reviewed_by=auth.uid(),reviewed_at=now(),decision_at=now(),updated_at=now() WHERE id=r.id;
 INSERT INTO public.lease_events(lease_id,actor_id,event_type,from_status,to_status,detail) VALUES(l.id,auth.uid(),'created','requested','pending_approval','Administrator created a lease from an application. No electronic signature or payment was recorded.');
 INSERT INTO public.lease_admin_actions(lease_id,admin_id,action,reason) VALUES(l.id,auth.uid(),'created','Converted application to lease');
 RETURN l;
END $$;
REVOKE ALL ON FUNCTION public.tnp_create_lease_from_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tnp_create_lease_from_request(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.tnp_change_lease_status(p_lease_id uuid,p_status text) RETURNS public.leases LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leases; previous text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 SELECT * INTO l FROM public.leases WHERE id=p_lease_id FOR UPDATE;
 IF l.id IS NULL THEN RAISE EXCEPTION 'Lease not found'; END IF;
 previous:=l.status;
 IF previous=p_status THEN RETURN l; END IF;
 IF p_status IS NULL OR NOT ((previous IN('draft','requested') AND p_status IN('pending_approval','terminated')) OR (previous='pending_approval' AND p_status IN('active','terminated')) OR (previous='active' AND p_status IN('completed','terminated','disputed')) OR (previous='disputed' AND p_status IN('active','completed','terminated'))) THEN RAISE EXCEPTION 'Invalid lease transition from % to %',previous,p_status; END IF;
 UPDATE public.leases SET status=p_status,updated_at=now() WHERE id=l.id RETURNING * INTO l;
 INSERT INTO public.lease_events(lease_id,actor_id,event_type,from_status,to_status,detail) VALUES(l.id,auth.uid(),'status_changed',previous,p_status,'Administrator updated the lease record');
 INSERT INTO public.lease_admin_actions(lease_id,admin_id,action,reason) VALUES(l.id,auth.uid(),'status_changed',previous||' → '||p_status); RETURN l;
END $$;
REVOKE ALL ON FUNCTION public.tnp_change_lease_status(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tnp_change_lease_status(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.tnp_record_payment_status(p_payment_id uuid,p_status text,p_action text) RETURNS public.lease_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE payment public.lease_payments; previous text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 SELECT * INTO payment FROM public.lease_payments WHERE id=p_payment_id FOR UPDATE;
 IF payment.id IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
 previous:=payment.status;
 IF previous=p_status THEN RETURN payment; END IF;
 IF p_status IS NULL OR NOT ((previous='pending' AND p_status IN('held','failed','disputed')) OR (previous='held' AND p_status IN('released','refunded','disputed')) OR (previous='disputed' AND p_status IN('held','released','refunded')) OR (previous='released' AND p_status IN('refunded','disputed'))) THEN RAISE EXCEPTION 'Invalid payment transition from % to %',previous,p_status; END IF;
 UPDATE public.lease_payments SET status=p_status,updated_at=now(),paid_at=CASE WHEN p_status='held' THEN coalesce(paid_at,now()) ELSE paid_at END,released_at=CASE WHEN p_status='released' THEN now() ELSE released_at END WHERE id=payment.id RETURNING * INTO payment;
 INSERT INTO public.payment_admin_actions(payment_id,admin_id,action,reason) VALUES(payment.id,auth.uid(),coalesce(p_action,'status_changed'),previous||' → '||p_status||'; ledger record only');
 INSERT INTO public.payment_audit_logs(payment_id,lease_id,event_type,previous_status,new_status,amount_usd,actor_id,actor_type,reference) VALUES(payment.id,payment.lease_id,'status_recorded',previous,p_status,payment.amount_usd,auth.uid(),'admin',payment.reference);
 INSERT INTO public.escrow_transactions(payment_id,lease_id,transaction_type,amount_usd,status,reference,actor_id,actor_type,notes,processed_at) VALUES(payment.id,payment.lease_id,p_status,payment.amount_usd,p_status,payment.reference,auth.uid(),'admin','Administrator recorded an external settlement state; no funds were moved by TNP.',now());
 RETURN payment;
END $$;
REVOKE ALL ON FUNCTION public.tnp_record_payment_status(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tnp_record_payment_status(uuid,text,text) TO authenticated;
COMMIT;
