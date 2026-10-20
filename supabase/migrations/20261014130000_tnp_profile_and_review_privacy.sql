BEGIN;
DROP POLICY IF EXISTS profiles_read_all ON public.profiles;
DROP POLICY IF EXISTS tnp_profiles_visible ON public.profiles;
CREATE POLICY tnp_profiles_visible ON public.profiles FOR SELECT TO authenticated USING(
 id=auth.uid() OR public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.properties p WHERE p.owner_id=profiles.id)
 OR EXISTS(SELECT 1 FROM public.lease_requests r JOIN public.properties p ON p.id=r.property_id WHERE r.tenant_id=profiles.id AND p.owner_id=auth.uid())
 OR EXISTS(SELECT 1 FROM public.leases l WHERE l.tenant_id=profiles.id AND l.landlord_id=auth.uid()));
DROP POLICY IF EXISTS reviews_read ON public.reviews;
CREATE POLICY reviews_read ON public.reviews FOR SELECT TO authenticated USING(moderation_status='approved' OR author_id=auth.uid() OR subject_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS tnp_reviews_reply ON public.reviews;
CREATE POLICY tnp_reviews_reply ON public.reviews FOR UPDATE TO authenticated USING(subject_id=auth.uid()) WITH CHECK(subject_id=auth.uid());
DROP POLICY IF EXISTS tnp_reviews_admin ON public.reviews;
CREATE POLICY tnp_reviews_admin ON public.reviews FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.tnp_guard_review() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.author_id<>auth.uid() OR NEW.rating NOT BETWEEN 1 AND 5 OR NOT EXISTS(SELECT 1 FROM public.leases l WHERE l.tenant_id=NEW.author_id AND l.landlord_id=NEW.subject_id AND l.property_id=NEW.property_id AND l.status IN('active','completed','terminated')) THEN RAISE EXCEPTION 'A qualifying lease is required to review a landlord'; END IF;
  IF length(trim(coalesce(NEW.body,''))) NOT BETWEEN 10 AND 10000 THEN RAISE EXCEPTION 'Review text must contain 10 to 10000 characters'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.author_id::text),hashtext(NEW.property_id::text));
  IF EXISTS(SELECT 1 FROM public.reviews r WHERE r.author_id=NEW.author_id AND r.subject_id=NEW.subject_id AND r.property_id=NEW.property_id) THEN RAISE EXCEPTION 'You have already reviewed this property'; END IF;
  NEW.moderation_status:='pending'; NEW.lease_confirmed:=true; NEW.admin_note:=NULL; NEW.reviewed_at:=NULL; NEW.landlord_response:=NULL; NEW.landlord_responded_at:=NULL; NEW.landlord_response_by:=NULL;
 ELSIF auth.uid()=OLD.author_id THEN
  IF length(trim(coalesce(NEW.body,''))) NOT BETWEEN 10 AND 10000 THEN RAISE EXCEPTION 'Review text must contain 10 to 10000 characters'; END IF;
  IF NEW.author_id<>OLD.author_id OR NEW.subject_id<>OLD.subject_id OR NEW.property_id IS DISTINCT FROM OLD.property_id OR NEW.lease_confirmed IS DISTINCT FROM OLD.lease_confirmed OR NEW.landlord_response IS DISTINCT FROM OLD.landlord_response OR NEW.landlord_response_by IS DISTINCT FROM OLD.landlord_response_by OR NEW.landlord_responded_at IS DISTINCT FROM OLD.landlord_responded_at OR NEW.rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Invalid review edit'; END IF;
  NEW.moderation_status:='pending'; NEW.reviewed_at:=NULL; NEW.admin_note:=NULL;
 ELSIF auth.uid()=OLD.subject_id THEN
  IF (to_jsonb(NEW)-ARRAY['landlord_response','landlord_responded_at','landlord_response_by']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['landlord_response','landlord_responded_at','landlord_response_by']) THEN RAISE EXCEPTION 'Only your response can be edited'; END IF;
  NEW.landlord_response_by:=auth.uid(); NEW.landlord_responded_at:=now();
 ELSE RAISE EXCEPTION 'Review access denied'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tnp_guard_review ON public.reviews;
CREATE TRIGGER tnp_guard_review BEFORE INSERT OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.tnp_guard_review();
COMMIT;
