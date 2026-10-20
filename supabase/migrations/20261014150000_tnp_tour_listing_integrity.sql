BEGIN;
CREATE OR REPLACE FUNCTION public.tnp_prevent_linked_tour_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.owner_id) AND EXISTS(SELECT 1 FROM public.properties WHERE substring(tour_url FROM '/tours/([0-9a-fA-F-]{36})')=OLD.id::text) THEN
  RAISE EXCEPTION 'Unlink this tour from property listings before deleting it';
 END IF;
 RETURN OLD;
END; $$;
REVOKE ALL ON FUNCTION public.tnp_prevent_linked_tour_delete() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS tnp_prevent_linked_tour_delete ON public.tnp_tours;
CREATE TRIGGER tnp_prevent_linked_tour_delete BEFORE DELETE ON public.tnp_tours FOR EACH ROW EXECUTE FUNCTION public.tnp_prevent_linked_tour_delete();
CREATE OR REPLACE FUNCTION public.tnp_guard_linked_tour_publication() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.is_published THEN RAISE EXCEPTION 'Create a draft and upload scenes before publishing'; END IF;
 IF NEW.is_published AND NOT EXISTS(SELECT 1 FROM public.tnp_tour_scenes s WHERE s.tour_id=NEW.id) THEN RAISE EXCEPTION 'Upload at least one scene before publishing'; END IF;
 IF NEW.is_published AND NEW.visibility='password' AND NOT EXISTS(SELECT 1 FROM public.tnp_tour_secrets s WHERE s.tour_id=NEW.id) THEN RAISE EXCEPTION 'Set a tour password before publishing'; END IF;
 IF (NOT NEW.is_published OR NEW.visibility='private') AND EXISTS(SELECT 1 FROM public.properties p WHERE substring(p.tour_url FROM '/tours/([0-9a-fA-F-]{36})')=NEW.id::text) THEN
  RAISE EXCEPTION 'Remove this tour from its property listings before unpublishing it or making it private';
 END IF;
 IF TG_OP='UPDATE' AND NEW.owner_id<>OLD.owner_id THEN RAISE EXCEPTION 'Tour ownership cannot be changed'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tnp_guard_linked_tour_publication ON public.tnp_tours;
CREATE TRIGGER tnp_guard_linked_tour_publication BEFORE INSERT OR UPDATE OF is_published,visibility,owner_id ON public.tnp_tours FOR EACH ROW EXECUTE FUNCTION public.tnp_guard_linked_tour_publication();
COMMIT;
