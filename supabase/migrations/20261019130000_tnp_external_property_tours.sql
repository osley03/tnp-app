BEGIN;
CREATE OR REPLACE FUNCTION public.validate_tnp_property_tour() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE linked_id uuid;
BEGIN
 IF NEW.tour_url IS NULL OR btrim(NEW.tour_url)='' THEN NEW.tour_url:=NULL; RETURN NEW; END IF;
 NEW.tour_url:=btrim(NEW.tour_url);
 IF TG_OP='UPDATE' THEN IF NEW.tour_url IS NOT DISTINCT FROM OLD.tour_url AND NEW.owner_id=OLD.owner_id THEN RETURN NEW; END IF; END IF;
 IF NEW.tour_url ~ '^https://(www[.])?kuula[.]co/share/([A-Za-z0-9]+/)?(collection/)?[A-Za-z0-9]+/?([?][A-Za-z0-9_=&%.,:~-]+)?$' THEN RETURN NEW; END IF;
 IF NEW.tour_url ~ '^https://my[.]matterport[.]com/show/?[?][A-Za-z0-9_=&%.,:~-]+$' AND NEW.tour_url ~ '[?&]m=[A-Za-z0-9]+(&|$)' THEN RETURN NEW; END IF;
 IF NEW.tour_url !~ '^(/tours/|https?://[^/]+/tours/)[0-9a-fA-F-]{36}/?$' THEN RAISE EXCEPTION 'Use a TNP tour link, public Kuula share link or Matterport show link'; END IF;
 linked_id:=substring(NEW.tour_url from '/tours/([0-9a-fA-F-]{36})')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.tnp_tours WHERE id=linked_id AND owner_id=NEW.owner_id AND is_published AND visibility<>'private') THEN RAISE EXCEPTION 'Choose a published, shareable TNP tour owned by the property owner'; END IF;
 RETURN NEW;
END $$;
COMMIT;
