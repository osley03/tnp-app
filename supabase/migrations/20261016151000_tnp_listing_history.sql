BEGIN;
CREATE OR REPLACE FUNCTION public.tnp_record_listing_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changes text[]:=ARRAY[]::text[];
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO public.property_history(property_id,event,detail) VALUES(NEW.id,'listing_created','Property listing created.');
 ELSE
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN changes:=array_append(changes,'Connected landlord changed'); END IF;
  IF NEW.rent_usd IS DISTINCT FROM OLD.rent_usd THEN changes:=array_append(changes,'Advertised rent updated to USD '||NEW.rent_usd::text); END IF;
  IF NEW.verified IS DISTINCT FROM OLD.verified THEN changes:=array_append(changes,CASE WHEN NEW.verified THEN 'Listing verified by TNP' ELSE 'Listing verification withdrawn' END); END IF;
  IF NEW.available IS DISTINCT FROM OLD.available THEN changes:=array_append(changes,CASE WHEN NEW.available THEN 'Listing marked available' ELSE 'Listing marked unavailable' END); END IF;
  IF NEW.tour_url IS DISTINCT FROM OLD.tour_url THEN changes:=array_append(changes,CASE WHEN NEW.tour_url IS NULL THEN 'Virtual tour removed' ELSE 'Virtual tour linked or updated' END); END IF;
  IF cardinality(changes)>0 THEN INSERT INTO public.property_history(property_id,event,detail) VALUES(NEW.id,'listing_updated',array_to_string(changes,'. ')||'.'); END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tnp_record_listing_history() FROM PUBLIC;
CREATE TRIGGER tnp_record_listing_history AFTER INSERT OR UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.tnp_record_listing_history();
INSERT INTO public.property_history(property_id,event,detail)
 SELECT p.id,'listing_snapshot','Existing listing connected to this landlord when property history tracking was enabled.' FROM public.properties p WHERE NOT EXISTS(SELECT 1 FROM public.property_history h WHERE h.property_id=p.id);
COMMIT;
