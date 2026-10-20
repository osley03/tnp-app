BEGIN;
CREATE OR REPLACE FUNCTION public.tnp_validate_application_input()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.move_in IS NOT NULL AND NEW.move_in < CURRENT_DATE THEN RAISE EXCEPTION 'Move-in date cannot be in the past'; END IF;
  IF char_length(coalesce(NEW.message,''))>2000 THEN RAISE EXCEPTION 'Application message must be within 2000 characters'; END IF;
  IF EXISTS(SELECT 1 FROM public.properties WHERE id=NEW.property_id AND lower(trim(listing_type)) NOT IN ('for rent','for lease','for rent or sale','rent','rental')) THEN RAISE EXCEPTION 'Rental applications are only available for rental listings'; END IF;
  NEW.message:=nullif(trim(NEW.message),'');
 ELSIF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') AND NEW.tenant_id<>auth.uid() THEN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
   NEW.reviewed_by:=OLD.reviewed_by; NEW.reviewed_at:=OLD.reviewed_at; NEW.decision_at:=OLD.decision_at;
  END IF;
  IF lower(NEW.status) IN ('rejected','declined') AND nullif(trim(NEW.rejection_reason),'') IS NULL THEN RAISE EXCEPTION 'Please provide a rejection reason'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_tnp_validate_application_input ON public.lease_requests;
CREATE TRIGGER zz_tnp_validate_application_input BEFORE INSERT OR UPDATE ON public.lease_requests FOR EACH ROW EXECUTE FUNCTION public.tnp_validate_application_input();
COMMIT;
