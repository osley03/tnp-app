BEGIN;
-- An initial rent request without an agreed move-in date is due on creation, not before approval.
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
 due:=CASE WHEN p_kind='deposit' THEN CURRENT_DATE WHEN l.status='pending_approval' AND l.start_date IS NULL THEN CURRENT_DATE WHEN l.start_date IS NOT NULL AND date_trunc('month',l.start_date)::date=month_start THEN l.start_date ELSE month_start+(least(greatest(coalesce(l.payment_due_day,1),1),28)-1) END;
 INSERT INTO public.lease_payments(lease_id,payer_id,payee_id,payment_type,amount_usd,status,reference,idempotency_key,due_date,period_start,period_end)
 VALUES(l.id,l.tenant_id,l.landlord_id,p_kind,amount,'pending','TNP-PAY-'||gen_random_uuid()::text,'scheduled:'||l.id::text||':'||p_kind||':'||CASE WHEN p_kind='rent' THEN month_start::text ELSE 'once' END,due,CASE WHEN p_kind='rent' THEN month_start ELSE NULL END,CASE WHEN p_kind='rent' THEN (month_start+interval '1 month - 1 day')::date ELSE NULL END) RETURNING * INTO payment;
 INSERT INTO public.payment_audit_logs(payment_id,lease_id,event_type,new_status,amount_usd,actor_id,actor_type,reference,metadata)
 VALUES(payment.id,l.id,'request_created','pending',amount,auth.uid(),'system',payment.reference,jsonb_build_object('origin','approved_rental','period_start',payment.period_start,'due_date',due));
 RETURN payment;
END $$;
REVOKE ALL ON FUNCTION public.tnp_scheduled_payment(uuid,text,date) FROM PUBLIC,anon,authenticated;

WITH corrected AS (
 UPDATE public.lease_payments p SET due_date=p.created_at::date,updated_at=now() FROM public.leases l
 WHERE p.lease_id=l.id AND l.status='pending_approval' AND l.start_date IS NULL AND p.payment_type='rent' AND p.status='pending'
 AND p.period_start=date_trunc('month',p.created_at)::date AND p.due_date<p.created_at::date
 AND NOT EXISTS(SELECT 1 FROM public.tnp_gateway_attempts a WHERE a.payment_id=p.id)
 RETURNING p.id,p.lease_id,p.amount_usd,p.reference,p.due_date
)
INSERT INTO public.payment_audit_logs(payment_id,lease_id,event_type,new_status,amount_usd,actor_type,reference,metadata)
SELECT id,lease_id,'schedule_corrected','pending',amount_usd,'system',reference,jsonb_build_object('reason','Initial rent without a move-in date is due on request creation','due_date',due_date) FROM corrected;
COMMIT;
