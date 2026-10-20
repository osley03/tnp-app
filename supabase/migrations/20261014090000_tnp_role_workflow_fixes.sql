-- Apply after the tour migrations. Existing administrator assignments are preserved.
BEGIN;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id,full_name,phone)
  VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name',''),NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles(user_id,role)
  VALUES(NEW.id, CASE WHEN NEW.raw_user_meta_data->>'role'='landlord' THEN 'landlord'::public.app_role ELSE 'tenant'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.tnp_guard_profile_trust()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
    IF TG_OP='INSERT' THEN
      IF NEW.trust_score<>50 OR NEW.verification<>'Email only' THEN RAISE EXCEPTION 'Trust and verification are administered by TNP'; END IF;
    ELSIF NEW.trust_score IS DISTINCT FROM OLD.trust_score OR NEW.verification IS DISTINCT FROM OLD.verification OR NEW.id<>OLD.id THEN
      RAISE EXCEPTION 'Trust and verification are administered by TNP';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tnp_guard_profile_trust ON public.profiles;
CREATE TRIGGER tnp_guard_profile_trust BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tnp_guard_profile_trust();
DROP POLICY IF EXISTS tnp_profiles_admin_update ON public.profiles;
CREATE POLICY tnp_profiles_admin_update ON public.profiles FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.tnp_guard_property_verification()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
    IF NOT public.has_role(auth.uid(),'landlord') THEN RAISE EXCEPTION 'Only landlords can manage listings'; END IF;
    IF TG_OP='INSERT' THEN
      IF NEW.verified OR cardinality(NEW.fraud_flags)>0 OR (to_jsonb(NEW)->>'trust_score') IS NOT NULL OR coalesce((to_jsonb(NEW)->>'landlord_verified')::boolean,false) OR (to_jsonb(NEW)->>'landlord_rating') IS NOT NULL THEN RAISE EXCEPTION 'Verification is administered by TNP'; END IF;
    ELSIF NEW.verified IS DISTINCT FROM OLD.verified OR NEW.fraud_flags IS DISTINCT FROM OLD.fraud_flags OR NEW.owner_id<>OLD.owner_id OR (to_jsonb(NEW)->'trust_score') IS DISTINCT FROM (to_jsonb(OLD)->'trust_score') OR (to_jsonb(NEW)->'landlord_verified') IS DISTINCT FROM (to_jsonb(OLD)->'landlord_verified') OR (to_jsonb(NEW)->'landlord_rating') IS DISTINCT FROM (to_jsonb(OLD)->'landlord_rating') THEN
      RAISE EXCEPTION 'Ownership and verification are administered by TNP';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tnp_guard_property_verification ON public.properties;
CREATE TRIGGER tnp_guard_property_verification BEFORE INSERT OR UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.tnp_guard_property_verification();
ALTER TABLE public.lease_requests
  ADD COLUMN IF NOT EXISTS landlord_message text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_id uuid,
  ADD COLUMN IF NOT EXISTS preferred_move_in date,
  ADD COLUMN IF NOT EXISTS occupants integer,
  ADD COLUMN IF NOT EXISTS employment_status text,
  ADD COLUMN IF NOT EXISTS monthly_income numeric,
  ADD COLUMN IF NOT EXISTS phone text;
DROP POLICY IF EXISTS lr_delete_tenant ON public.lease_requests;
CREATE POLICY lr_delete_tenant ON public.lease_requests FOR DELETE TO authenticated USING(auth.uid()=tenant_id AND lower(status) IN('pending','pending review','pending_review','submitted','under review','under_review','withdrawn'));
DROP POLICY IF EXISTS lr_update ON public.lease_requests;
CREATE POLICY lr_update ON public.lease_requests FOR UPDATE TO authenticated
  USING(auth.uid()=tenant_id OR EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK(auth.uid()=tenant_id OR EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.tnp_guard_application()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE pending boolean;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NOT public.has_role(auth.uid(),'tenant') OR NEW.tenant_id<>auth.uid() OR lower(NEW.status) NOT IN ('pending','pending review','pending_review','submitted','under review','under_review') OR NEW.landlord_message IS NOT NULL OR NEW.lease_id IS NOT NULL OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.decision_at IS NOT NULL OR NEW.rejection_reason IS NOT NULL THEN RAISE EXCEPTION 'Invalid application'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.properties p WHERE p.id=NEW.property_id AND p.available AND p.owner_id<>auth.uid()) THEN RAISE EXCEPTION 'Property is unavailable'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(NEW.tenant_id::text),hashtext(NEW.property_id::text));
    IF EXISTS(SELECT 1 FROM public.lease_requests r WHERE r.tenant_id=NEW.tenant_id AND r.property_id=NEW.property_id AND lower(r.status) IN ('pending','pending review','pending_review','submitted','under review','under_review','approved','accepted')) THEN RAISE EXCEPTION 'An active application already exists'; END IF;
  ELSE
    pending := lower(OLD.status) IN ('pending','pending review','pending_review','submitted','under review','under_review');
    IF NEW.tenant_id<>OLD.tenant_id OR NEW.property_id<>OLD.property_id THEN RAISE EXCEPTION 'Application identity cannot be changed'; END IF;
    IF auth.uid()=OLD.tenant_id THEN
      IF NOT pending OR lower(NEW.status)<>'withdrawn' OR (to_jsonb(NEW)-ARRAY['status','updated_at','withdrawn_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_at','withdrawn_at']) THEN RAISE EXCEPTION 'Tenants can only withdraw pending applications'; END IF;
      NEW.withdrawn_at:=now();
    ELSE
      IF NOT EXISTS(SELECT 1 FROM public.properties p WHERE p.id=OLD.property_id AND p.owner_id=auth.uid()) THEN RAISE EXCEPTION 'Not your application'; END IF;
      IF (to_jsonb(NEW)-ARRAY['status','updated_at','landlord_message','reviewed_at','reviewed_by','decision_at','rejection_reason']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_at','landlord_message','reviewed_at','reviewed_by','decision_at','rejection_reason']) THEN RAISE EXCEPTION 'Tenant application details cannot be changed'; END IF;
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT pending OR lower(NEW.status) NOT IN ('approved','rejected','declined') THEN RAISE EXCEPTION 'Application has already been decided or withdrawn'; END IF;
        NEW.reviewed_by:=auth.uid(); NEW.reviewed_at:=now(); NEW.decision_at:=now();
      END IF;
    END IF;
  END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tnp_guard_application ON public.lease_requests;
CREATE TRIGGER tnp_guard_application BEFORE INSERT OR UPDATE ON public.lease_requests FOR EACH ROW EXECUTE FUNCTION public.tnp_guard_application();
COMMIT;
