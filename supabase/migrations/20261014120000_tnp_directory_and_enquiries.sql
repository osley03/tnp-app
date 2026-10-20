BEGIN;
CREATE TABLE IF NOT EXISTS public.landlord_contact_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES auth.users(id),landlord_id uuid NOT NULL REFERENCES auth.users(id),subject text NOT NULL,message text NOT NULL,status text NOT NULL DEFAULT 'open',landlord_reply text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.landlord_contact_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.landlord_contact_requests TO authenticated;
DROP POLICY IF EXISTS tnp_contact_read ON public.landlord_contact_requests;
CREATE POLICY tnp_contact_read ON public.landlord_contact_requests FOR SELECT TO authenticated USING(tenant_id=auth.uid() OR landlord_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS tnp_contact_insert ON public.landlord_contact_requests;
CREATE POLICY tnp_contact_insert ON public.landlord_contact_requests FOR INSERT TO authenticated WITH CHECK(tenant_id=auth.uid() AND public.has_role(auth.uid(),'tenant') AND tenant_id<>landlord_id AND landlord_reply IS NULL AND status='open' AND length(message) BETWEEN 1 AND 10000 AND EXISTS(SELECT 1 FROM public.properties p WHERE p.owner_id=landlord_id));
CREATE OR REPLACE FUNCTION public.tnp_reply_to_enquiry(p_id uuid,p_reply text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR length(trim(coalesce(p_reply,''))) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Enter a reply'; END IF;
 UPDATE public.landlord_contact_requests SET landlord_reply=trim(p_reply),status='replied',updated_at=now() WHERE id=p_id AND landlord_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Enquiry not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.tnp_reply_to_enquiry(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tnp_reply_to_enquiry(uuid,text) TO authenticated;
CREATE TABLE IF NOT EXISTS public.landlord_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reporter_id uuid NOT NULL REFERENCES auth.users(id),landlord_id uuid NOT NULL REFERENCES auth.users(id),category text,description text,status text DEFAULT 'submitted',priority text DEFAULT 'medium',created_at timestamptz DEFAULT now());
ALTER TABLE public.landlord_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.landlord_reports TO authenticated;
DROP POLICY IF EXISTS tnp_landlord_reports_read ON public.landlord_reports;
CREATE POLICY tnp_landlord_reports_read ON public.landlord_reports FOR SELECT TO authenticated USING(reporter_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS tnp_landlord_reports_insert ON public.landlord_reports;
CREATE POLICY tnp_landlord_reports_insert ON public.landlord_reports FOR INSERT TO authenticated WITH CHECK(reporter_id=auth.uid() AND length(description) BETWEEN 1 AND 20000 AND status='submitted');
CREATE OR REPLACE FUNCTION public.tnp_forward_landlord_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.scam_cases(reporter_id,scammer_id,case_type,title,description,status,priority,reference) VALUES(NEW.reporter_id,NEW.landlord_id,'other','Landlord concern: '||coalesce(NEW.category,'other'),NEW.description,'submitted','medium','TNP-SC-'||NEW.id::text); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tnp_forward_landlord_report ON public.landlord_reports;
CREATE TRIGGER tnp_forward_landlord_report AFTER INSERT ON public.landlord_reports FOR EACH ROW EXECUTE FUNCTION public.tnp_forward_landlord_report();
CREATE OR REPLACE VIEW public.tenant_landlord_properties WITH (security_invoker=true) AS
 SELECT p.id AS property_id,p.owner_id AS landlord_id,p.title,p.suburb,p.city,p.rent_usd,p.deposit_usd,p.beds,p.baths,p.rooms,p.property_type,p.property_category,p.description,p.amenities,p.image_url,p.image_urls,p.verified,p.available,pr.trust_score,pr.full_name AS landlord_name,(pr.verification<>'Email only') AS landlord_verified,
 (SELECT avg(r.rating) FROM public.reviews r WHERE r.subject_id=p.owner_id AND r.moderation_status='approved') AS landlord_rating,(p.tour_url IS NOT NULL) AS has_360_tour,p.listing_type,p.created_at FROM public.properties p JOIN public.profiles pr ON pr.id=p.owner_id;
CREATE OR REPLACE VIEW public.tenant_landlord_profiles WITH (security_invoker=true) AS
 SELECT pr.id AS landlord_id,pr.full_name,pr.bio,pr.verification,pr.trust_score,pr.created_at AS member_since,
 (SELECT count(*) FROM public.properties p WHERE p.owner_id=pr.id) AS property_count,
 (SELECT count(*) FROM public.properties p WHERE p.owner_id=pr.id AND p.available) AS active_property_count,
 (SELECT count(*) FROM public.properties p WHERE p.owner_id=pr.id AND p.verified) AS verified_property_count,
 (SELECT count(*) FROM public.properties p WHERE p.owner_id=pr.id AND p.tour_url IS NOT NULL) AS properties_with_360_tour_count,
 (SELECT count(*) FROM public.reviews r WHERE r.subject_id=pr.id AND r.moderation_status='approved') AS review_count,
 (SELECT coalesce(avg(r.rating),0) FROM public.reviews r WHERE r.subject_id=pr.id AND r.moderation_status='approved') AS average_rating,
 (SELECT count(*) FROM public.reviews r WHERE r.subject_id=pr.id AND r.rating=5 AND r.moderation_status='approved') AS five_star_count,
 (SELECT count(*) FROM public.reviews r WHERE r.subject_id=pr.id AND r.rating=4 AND r.moderation_status='approved') AS four_star_count,
 (SELECT count(*) FROM public.reviews r WHERE r.subject_id=pr.id AND r.rating=3 AND r.moderation_status='approved') AS three_star_count,
 (SELECT count(*) FROM public.reviews r WHERE r.subject_id=pr.id AND r.rating=2 AND r.moderation_status='approved') AS two_star_count,
 (SELECT count(*) FROM public.reviews r WHERE r.subject_id=pr.id AND r.rating=1 AND r.moderation_status='approved') AS one_star_count,
 (SELECT count(*) FROM public.reviews r WHERE r.subject_id=pr.id AND r.lease_confirmed AND r.moderation_status='approved') AS verified_review_count,
 (SELECT count(*) FROM public.reviews r WHERE r.subject_id=pr.id AND r.landlord_response IS NOT NULL AND r.moderation_status='approved') AS responded_review_count
 FROM public.profiles pr WHERE EXISTS(SELECT 1 FROM public.properties p WHERE p.owner_id=pr.id);
GRANT SELECT ON public.tenant_landlord_properties,public.tenant_landlord_profiles TO authenticated;
-- Legacy panorama tables are retained for old listings; new tours use tnp_tours.
CREATE TABLE IF NOT EXISTS public.property_tours(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,title text,description text,cover_image_url text,is_published boolean DEFAULT false);
CREATE TABLE IF NOT EXISTS public.property_tour_scenes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tour_id uuid REFERENCES public.property_tours(id) ON DELETE CASCADE,name text,description text,panorama_url text,scene_order integer DEFAULT 0);
ALTER TABLE public.property_tour_scenes ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
ALTER TABLE public.property_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_tour_scenes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.property_tours,public.property_tour_scenes TO authenticated;
DROP POLICY IF EXISTS tnp_legacy_tour_read ON public.property_tours;
CREATE POLICY tnp_legacy_tour_read ON public.property_tours FOR SELECT TO authenticated USING(is_published OR EXISTS(SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.owner_id=auth.uid()) OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS tnp_legacy_scene_read ON public.property_tour_scenes;
CREATE POLICY tnp_legacy_scene_read ON public.property_tour_scenes FOR SELECT TO authenticated USING(is_published AND EXISTS(SELECT 1 FROM public.property_tours t WHERE t.id=tour_id));
CREATE OR REPLACE VIEW public.lease_disputes WITH (security_invoker=true) AS SELECT id,lease_id,opened_by,category,description,status,created_at FROM public.disputes;
GRANT SELECT ON public.lease_disputes TO authenticated;
COMMIT;
