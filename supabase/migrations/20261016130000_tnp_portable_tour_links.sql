BEGIN;
CREATE OR REPLACE FUNCTION public.tnp_portable_listing_tour() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE tour_id text;
BEGIN
 tour_id:=substring(NEW.tour_url FROM '/tours/([0-9a-fA-F-]{36})$');
 IF tour_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.tnp_tours WHERE id::text=lower(tour_id) AND owner_id=NEW.owner_id) THEN
  NEW.tour_url:='/tours/'||lower(tour_id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zz_tnp_portable_listing_tour BEFORE INSERT OR UPDATE OF tour_url ON public.properties FOR EACH ROW EXECUTE FUNCTION public.tnp_portable_listing_tour();
UPDATE public.properties p SET tour_url='/tours/'||t.id::text FROM public.tnp_tours t
WHERE t.owner_id=p.owner_id AND t.is_published AND t.visibility<>'private'
 AND p.tour_url ~ '^https?://(localhost|127[.]0[.]0[.]1)(:[0-9]+)?/tours/[0-9a-fA-F-]{36}$'
 AND substring(p.tour_url FROM '/tours/([0-9a-fA-F-]{36})$')=t.id::text;
COMMIT;
