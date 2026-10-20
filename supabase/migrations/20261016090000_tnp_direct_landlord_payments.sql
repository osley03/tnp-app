BEGIN;
-- Secrets and provider polling URLs are never exposed through the browser API.
CREATE TABLE public.tnp_gateway_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES public.lease_payments(id),
 lease_id uuid NOT NULL REFERENCES public.leases(id), payer_id uuid NOT NULL, landlord_id uuid NOT NULL,
 provider text NOT NULL DEFAULT 'paynow' CHECK(provider='paynow'), method text NOT NULL CHECK(method IN('ecocash','mastercard')),
 integration_id text NOT NULL, claim_token uuid NOT NULL, mode text NOT NULL CHECK(mode IN('test','live')), currency text NOT NULL CHECK(currency='USD'),
 amount_usd numeric(14,2) NOT NULL CHECK(amount_usd>0), merchant_reference text UNIQUE NOT NULL,
 status text NOT NULL DEFAULT 'creating' CHECK(status IN('creating','pending','paid','cancelled','disputed','refunded','error')),
 provider_reference text, browser_url text, poll_url text, last_checked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(payment_id,mode)
);
CREATE TABLE public.tnp_payment_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attempt_id uuid NOT NULL REFERENCES public.tnp_gateway_attempts(id),
 payment_id uuid NOT NULL REFERENCES public.lease_payments(id), lease_id uuid NOT NULL REFERENCES public.leases(id),
 payer_id uuid NOT NULL, landlord_id uuid NOT NULL, provider text NOT NULL DEFAULT 'paynow',
 method text NOT NULL, mode text NOT NULL CHECK(mode IN('test','live')), currency text NOT NULL,
 amount_usd numeric(14,2) NOT NULL, merchant_reference text NOT NULL, provider_reference text NOT NULL,
 integration_id text NOT NULL, provider_status text NOT NULL, payment_status text NOT NULL,
 verification text NOT NULL DEFAULT 'Signed Paynow response confirmed by server-side polling',
 response_fingerprint text NOT NULL CHECK(response_fingerprint ~ '^[A-F0-9]{128}$'),
 verified_at timestamptz NOT NULL DEFAULT now(), UNIQUE(attempt_id,response_fingerprint)
);
ALTER TABLE public.tnp_gateway_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tnp_payment_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tnp_gateway_attempts, public.tnp_payment_evidence FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.tnp_gateway_attempts TO service_role;
GRANT SELECT,INSERT ON public.tnp_payment_evidence TO service_role;
GRANT SELECT ON public.tnp_payment_evidence TO authenticated;
CREATE POLICY tnp_payment_evidence_participants ON public.tnp_payment_evidence FOR SELECT TO authenticated
 USING(payer_id=auth.uid() OR landlord_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.tnp_evidence_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Provider payment evidence cannot be edited or deleted'; END $$;
CREATE TRIGGER tnp_evidence_append_only BEFORE UPDATE OR DELETE ON public.tnp_payment_evidence FOR EACH ROW EXECUTE FUNCTION public.tnp_evidence_append_only();

CREATE FUNCTION public.tnp_reserve_gateway_payment(p_payment_id uuid,p_payer_id uuid,p_method text,p_integration_id text,p_mode text,p_claim_token uuid)
RETURNS public.tnp_gateway_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE payment public.lease_payments; lease public.leases; attempt public.tnp_gateway_attempts; attempt_id uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO payment FROM public.lease_payments WHERE id=p_payment_id FOR UPDATE;
 IF payment.id IS NULL OR payment.payer_id IS DISTINCT FROM p_payer_id OR p_method NOT IN('ecocash','mastercard') OR p_mode NOT IN('test','live') OR p_integration_id !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Invalid payment request'; END IF;
 SELECT * INTO lease FROM public.leases WHERE id=payment.lease_id;
 IF lease.tenant_id IS DISTINCT FROM p_payer_id OR lease.landlord_id IS DISTINCT FROM payment.payee_id OR lease.status<>'active' OR payment.payment_type NOT IN('rent','deposit','utility','late_fee','other') OR payment.amount_usd<=0 OR payment.amount_usd>1000000 OR payment.amount_usd<>round(payment.amount_usd,2) THEN RAISE EXCEPTION 'An eligible active lease payment is required'; END IF;
 SELECT * INTO attempt FROM public.tnp_gateway_attempts WHERE payment_id=payment.id AND mode=p_mode;
 IF attempt.id IS NOT NULL THEN RETURN attempt; END IF;
 IF payment.status<>'pending' THEN RAISE EXCEPTION 'This payment is no longer awaiting checkout'; END IF;
 INSERT INTO public.tnp_gateway_attempts(id,payment_id,lease_id,payer_id,landlord_id,method,integration_id,claim_token,mode,currency,amount_usd,merchant_reference)
 VALUES(attempt_id,payment.id,lease.id,p_payer_id,lease.landlord_id,p_method,p_integration_id,p_claim_token,p_mode,'USD',payment.amount_usd,'TNP-'||attempt_id::text) RETURNING * INTO attempt;
 RETURN attempt;
END $$;
REVOKE ALL ON FUNCTION public.tnp_reserve_gateway_payment(uuid,uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tnp_reserve_gateway_payment(uuid,uuid,text,text,text,uuid) TO service_role;

CREATE FUNCTION public.tnp_confirm_gateway_payment(p_attempt_id uuid,p_provider_reference text,p_provider_status text,p_amount_usd numeric,p_fingerprint text)
RETURNS public.tnp_payment_evidence LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE attempt public.tnp_gateway_attempts; payment public.lease_payments; evidence public.tnp_payment_evidence; next_status text; previous text;
BEGIN
 -- Lock the payment first everywhere to keep checkout and callbacks deadlock-free.
 SELECT p.* INTO payment FROM public.lease_payments p JOIN public.tnp_gateway_attempts a ON a.payment_id=p.id WHERE a.id=p_attempt_id FOR UPDATE OF p;
 SELECT * INTO attempt FROM public.tnp_gateway_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF attempt.id IS NULL OR p_amount_usd IS DISTINCT FROM attempt.amount_usd OR length(coalesce(p_provider_reference,'')) NOT BETWEEN 1 AND 100 OR p_fingerprint !~ '^[A-F0-9]{128}$' THEN RAISE EXCEPTION 'Provider confirmation does not match payment'; END IF;
 IF attempt.provider_reference IS NOT NULL AND attempt.provider_reference<>p_provider_reference THEN RAISE EXCEPTION 'Provider reference mismatch'; END IF;
 next_status:=CASE lower(p_provider_status) WHEN 'paid' THEN 'paid' WHEN 'awaiting delivery' THEN 'paid' WHEN 'delivered' THEN 'paid' WHEN 'created' THEN 'pending' WHEN 'sent' THEN 'pending' WHEN 'cancelled' THEN 'cancelled' WHEN 'disputed' THEN 'disputed' WHEN 'refunded' THEN 'refunded' ELSE NULL END;
 IF next_status IS NULL THEN RAISE EXCEPTION 'Unknown provider status'; END IF;
 SELECT * INTO evidence FROM public.tnp_payment_evidence WHERE attempt_id=attempt.id AND response_fingerprint=p_fingerprint;
 IF evidence.id IS NOT NULL THEN RETURN evidence; END IF;
 -- Never regress confirmed funds to an unpaid state or reverse a confirmed refund.
 IF attempt.status='refunded' AND next_status<>'refunded' OR attempt.status IN('paid','disputed') AND next_status IN('pending','cancelled') THEN
  RAISE EXCEPTION 'Stale provider status; refresh payment verification';
 END IF;
 previous:=payment.status;
 INSERT INTO public.tnp_payment_evidence(attempt_id,payment_id,lease_id,payer_id,landlord_id,method,mode,currency,amount_usd,merchant_reference,provider_reference,integration_id,provider_status,payment_status,response_fingerprint)
 VALUES(attempt.id,payment.id,attempt.lease_id,attempt.payer_id,attempt.landlord_id,attempt.method,attempt.mode,attempt.currency,attempt.amount_usd,attempt.merchant_reference,p_provider_reference,attempt.integration_id,p_provider_status,next_status,p_fingerprint) RETURNING * INTO evidence;
 UPDATE public.tnp_gateway_attempts SET status=next_status,provider_reference=p_provider_reference,last_checked_at=now(),updated_at=now() WHERE id=attempt.id;
 IF attempt.mode='live' THEN
  UPDATE public.lease_payments SET status=CASE next_status WHEN 'cancelled' THEN 'failed' ELSE next_status END,
   paid_at=CASE WHEN next_status='paid' THEN coalesce(paid_at,now()) ELSE paid_at END,updated_at=now() WHERE id=payment.id;
  INSERT INTO public.payment_audit_logs(payment_id,lease_id,event_type,previous_status,new_status,amount_usd,actor_type,reference,metadata)
   VALUES(payment.id,payment.lease_id,'gateway_verified',previous,CASE next_status WHEN 'cancelled' THEN 'failed' ELSE next_status END,attempt.amount_usd,'gateway',p_provider_reference,jsonb_build_object('provider','paynow','evidence_id',evidence.id,'destination','landlord_merchant','currency',attempt.currency));
 END IF;
 RETURN evidence;
END $$;
REVOKE ALL ON FUNCTION public.tnp_confirm_gateway_payment(uuid,text,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tnp_confirm_gateway_payment(uuid,text,text,numeric,text) TO service_role;

-- Even administrators cannot overwrite a provider-managed payment with a manual ledger state.
CREATE FUNCTION public.tnp_guard_gateway_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' AND EXISTS(SELECT 1 FROM public.tnp_gateway_attempts WHERE payment_id=OLD.id) THEN
  RAISE EXCEPTION 'Gateway payments are updated only by verified provider confirmation';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER tnp_guard_gateway_payment BEFORE UPDATE OR DELETE ON public.lease_payments FOR EACH ROW EXECUTE FUNCTION public.tnp_guard_gateway_payment();
COMMIT;
