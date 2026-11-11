-- Email availability is checked only by the Edge Function, never by a public
-- query over Auth users. Retain hashed rate-limit keys for ten minutes only.
CREATE TABLE public.tnp_registration_limits (
  key_hash text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL
);
ALTER TABLE public.tnp_registration_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tnp_registration_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.tnp_registration_status(p_email text, p_client text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_attempts integer;
  v_hash text;
BEGIN
  IF length(p_email) > 254 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR p_client IS NULL OR length(p_client) > 256 THEN
    RAISE EXCEPTION 'Invalid registration check';
  END IF;
  DELETE FROM public.tnp_registration_limits WHERE window_start < now() - interval '10 minutes';
  v_hash := encode(extensions.digest(p_client, 'sha256'), 'hex');
  INSERT INTO public.tnp_registration_limits AS limits(key_hash, window_start, attempts)
  VALUES(v_hash, now(), 1)
  ON CONFLICT(key_hash) DO UPDATE SET attempts = limits.attempts + 1
  RETURNING attempts INTO v_attempts;
  IF v_attempts > 20 THEN
    RETURN jsonb_build_object('limited', true);
  END IF;
  RETURN jsonb_build_object('exists', EXISTS(
    SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(p_email))
  ));
END;
$$;
REVOKE ALL ON FUNCTION public.tnp_registration_status(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tnp_registration_status(text, text) TO service_role;
