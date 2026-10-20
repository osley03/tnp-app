-- Apply after 20261013103000_tnp_panorama_tours.sql. Additive, preserves tour IDs and listing URLs.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
ALTER TABLE public.tnp_tours
 ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','unlisted','private','password')),
 ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS revision int NOT NULL DEFAULT 0;
ALTER TABLE public.tnp_tour_scenes ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';
CREATE TABLE public.tnp_tour_secrets (tour_id uuid PRIMARY KEY REFERENCES public.tnp_tours(id) ON DELETE CASCADE, password_hash text NOT NULL);
CREATE TABLE public.tnp_tour_access (tour_id uuid NOT NULL REFERENCES public.tnp_tours(id) ON DELETE CASCADE, viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, PRIMARY KEY(tour_id, viewer_id));
CREATE TABLE public.tnp_tour_stats (tour_id uuid PRIMARY KEY REFERENCES public.tnp_tours(id) ON DELETE CASCADE, views bigint NOT NULL DEFAULT 0);
CREATE TABLE public.tnp_tour_rate_limits (key text PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT now(), attempts int NOT NULL DEFAULT 1);
ALTER TABLE public.tnp_tour_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tnp_tour_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tnp_tour_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tnp_tour_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tnp_tour_secrets, public.tnp_tour_access, public.tnp_tour_stats, public.tnp_tour_rate_limits FROM anon, authenticated;

-- Private storage: all viewers receive short-lived URLs from the access-checked Edge Function.
UPDATE storage.buckets SET public = false, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/wav','audio/ogg','video/mp4','video/webm'] WHERE id = 'tnp-panoramas';
DROP POLICY tnp_tours_public_read ON public.tnp_tours;
CREATE POLICY tnp_tours_public_read ON public.tnp_tours FOR SELECT USING (is_published AND visibility = 'public');
DROP POLICY tnp_scenes_read ON public.tnp_tour_scenes;
CREATE POLICY tnp_scenes_read ON public.tnp_tour_scenes FOR SELECT USING (
 false
);

CREATE OR REPLACE FUNCTION public.tnp_save_tour(p_id uuid, p_revision int, p_title text, p_description text, p_visibility text, p_published boolean, p_settings jsonb, p_scenes jsonb, p_password text DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE t public.tnp_tours; s jsonb; h jsonb; scene_ids uuid[]; new_revision int;
BEGIN
 SELECT * INTO t FROM public.tnp_tours WHERE id=p_id FOR UPDATE;
 IF t.id IS NULL OR t.owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Tour not found or access denied'; END IF;
 IF p_revision IS NULL OR t.revision <> p_revision THEN RAISE EXCEPTION 'This tour changed in another tab. Reload it before saving'; END IF;
 IF length(btrim(p_title)) NOT BETWEEN 1 AND 120 OR length(p_description)>4000 OR p_visibility NOT IN ('public','unlisted','private','password') THEN RAISE EXCEPTION 'Invalid tour settings'; END IF;
 IF jsonb_typeof(p_settings)<>'object' OR jsonb_typeof(p_scenes)<>'array' OR jsonb_array_length(p_scenes) NOT BETWEEN 1 AND 100 OR length(p_settings::text)>1048576 OR length(p_scenes::text)>1048576 THEN RAISE EXCEPTION 'Invalid tour data'; END IF;
 SELECT array_agg((value->>'id')::uuid) INTO scene_ids FROM jsonb_array_elements(p_scenes);
 IF (SELECT count(DISTINCT x) FROM unnest(scene_ids) x) <> cardinality(scene_ids) THEN RAISE EXCEPTION 'Duplicate scene ID'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(scene_ids) x WHERE NOT EXISTS(SELECT 1 FROM public.tnp_tour_scenes WHERE id=x AND tour_id=p_id)) THEN RAISE EXCEPTION 'A scene does not belong to this tour'; END IF;
 IF p_settings->>'startSceneId' IS NOT NULL AND NOT ((p_settings->>'startSceneId')::uuid = ANY(scene_ids)) THEN RAISE EXCEPTION 'Invalid starting room'; END IF;
 FOR s IN SELECT * FROM jsonb_array_elements(p_scenes) LOOP
  IF length(btrim(s->>'name')) NOT BETWEEN 1 AND 80 OR jsonb_typeof(s->'settings')<>'object' OR jsonb_typeof(s->'settings'->'hotspots')<>'array' OR jsonb_array_length(s->'settings'->'hotspots')>100 THEN RAISE EXCEPTION 'Invalid scene'; END IF;
  FOR h IN SELECT * FROM jsonb_array_elements(s->'settings'->'hotspots') LOOP
   IF h->>'kind' NOT IN ('scene','info','link','image','video') OR length(btrim(h->>'label')) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid hotspot'; END IF;
   IF h->>'kind'='scene' AND ((h->>'targetSceneId') IS NULL OR NOT ((h->>'targetSceneId')::uuid=ANY(scene_ids))) THEN RAISE EXCEPTION 'Room hotspot must target an existing scene'; END IF;
  END LOOP;
  UPDATE public.tnp_tour_scenes SET name=btrim(s->>'name'), scene_order=(s->>'scene_order')::int, settings=s->'settings' WHERE id=(s->>'id')::uuid AND tour_id=p_id;
 END LOOP;
 -- Missing scenes are deliberately removed, in the same transaction as their links.
 DELETE FROM public.tnp_tour_scenes WHERE tour_id=p_id AND NOT(id=ANY(scene_ids));
 IF p_password IS NOT NULL AND length(p_password)>0 THEN
  IF length(p_password) NOT BETWEEN 8 AND 128 THEN RAISE EXCEPTION 'Use a password of 8-128 characters'; END IF;
  INSERT INTO public.tnp_tour_secrets(tour_id,password_hash) VALUES(p_id,crypt(encode(digest(p_password,'sha256'),'hex'),gen_salt('bf',10))) ON CONFLICT(tour_id) DO UPDATE SET password_hash=EXCLUDED.password_hash;
 END IF;
 IF p_visibility='password' AND NOT EXISTS(SELECT 1 FROM public.tnp_tour_secrets WHERE tour_id=p_id) THEN RAISE EXCEPTION 'Set a tour password before publishing'; END IF;
 UPDATE public.tnp_tours SET title=btrim(p_title),description=p_description,visibility=p_visibility,is_published=p_published,settings=p_settings,revision=revision+1 WHERE id=p_id RETURNING revision INTO new_revision;
 RETURN new_revision;
END; $$;
REVOKE ALL ON FUNCTION public.tnp_save_tour(uuid,int,text,text,text,boolean,jsonb,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tnp_save_tour(uuid,int,text,text,text,boolean,jsonb,jsonb,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tnp_edge_read_tour(p_id uuid,p_viewer uuid,p_password text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE t public.tnp_tours; permitted boolean; hash text;
BEGIN
 SELECT * INTO t FROM public.tnp_tours WHERE id=p_id FOR SHARE;
 IF t.id IS NULL THEN RAISE EXCEPTION 'Tour unavailable or password required'; END IF;
 permitted := p_viewer=t.owner_id OR EXISTS(SELECT 1 FROM public.tnp_tour_access WHERE tour_id=p_id AND viewer_id=p_viewer);
 IF NOT COALESCE(permitted,false) AND t.is_published THEN
  permitted := t.visibility IN ('public','unlisted');
  IF t.visibility='password' AND length(p_password) BETWEEN 8 AND 128 THEN SELECT password_hash INTO hash FROM public.tnp_tour_secrets WHERE tour_id=p_id; permitted := hash IS NOT NULL AND crypt(encode(digest(p_password,'sha256'),'hex'),hash)=hash; END IF;
 END IF;
 IF NOT COALESCE(permitted,false) THEN RAISE EXCEPTION 'Tour unavailable or password required'; END IF;
 INSERT INTO public.tnp_tour_stats(tour_id,views) VALUES(p_id,1) ON CONFLICT(tour_id) DO UPDATE SET views=tnp_tour_stats.views+1;
 RETURN to_jsonb(t) || jsonb_build_object('scenes',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY scene_order) FROM public.tnp_tour_scenes s WHERE tour_id=p_id),'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.tnp_edge_read_tour(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tnp_edge_read_tour(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.tnp_tour_members(p_id uuid,p_viewer uuid DEFAULT NULL,p_remove boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.tnp_tours WHERE id=p_id AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_viewer IS NOT NULL THEN
  IF p_remove THEN DELETE FROM public.tnp_tour_access WHERE tour_id=p_id AND viewer_id=p_viewer;
  ELSE INSERT INTO public.tnp_tour_access(tour_id,viewer_id) VALUES(p_id,p_viewer) ON CONFLICT DO NOTHING; END IF;
 END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('viewer_id',viewer_id)) FROM public.tnp_tour_access WHERE tour_id=p_id),'[]'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.tnp_tour_members(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tnp_tour_members(uuid,uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.tnp_tour_view_count(p_id uuid) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.tnp_tours WHERE id=p_id AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF;
 RETURN COALESCE((SELECT views FROM public.tnp_tour_stats WHERE tour_id=p_id),0);
END; $$;
REVOKE ALL ON FUNCTION public.tnp_tour_view_count(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tnp_tour_view_count(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tnp_tour_rate_limit(p_key text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int;
BEGIN
 DELETE FROM public.tnp_tour_rate_limits WHERE started_at<now()-interval '1 day';
 INSERT INTO public.tnp_tour_rate_limits(key) VALUES(p_key) ON CONFLICT(key) DO UPDATE SET
 attempts=CASE WHEN tnp_tour_rate_limits.started_at<now()-interval '1 minute' THEN 1 ELSE tnp_tour_rate_limits.attempts+1 END,
 started_at=CASE WHEN tnp_tour_rate_limits.started_at<now()-interval '1 minute' THEN now() ELSE tnp_tour_rate_limits.started_at END RETURNING attempts INTO n;
 RETURN n<=30;
END; $$;
REVOKE ALL ON FUNCTION public.tnp_tour_rate_limit(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tnp_tour_rate_limit(text) TO service_role;

CREATE OR REPLACE FUNCTION public.validate_tnp_property_tour()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE linked_id uuid;
BEGIN
 IF NEW.tour_url IS NULL OR btrim(NEW.tour_url)='' THEN NEW.tour_url:=NULL; RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN IF NEW.tour_url IS NOT DISTINCT FROM OLD.tour_url AND NEW.owner_id=OLD.owner_id THEN RETURN NEW; END IF; END IF;
 IF NEW.tour_url !~ '^https?://[^/]+/tours/[0-9a-fA-F-]{36}/?$' THEN RAISE EXCEPTION 'Use a TNP tour URL'; END IF;
 linked_id:=substring(NEW.tour_url from '/tours/([0-9a-fA-F-]{36})')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.tnp_tours WHERE id=linked_id AND owner_id=NEW.owner_id AND is_published AND visibility<>'private') THEN RAISE EXCEPTION 'Choose a published, shareable tour owned by the property owner'; END IF;
 RETURN NEW;
END; $$;

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
-- Scene uploads and edits also advance the tour revision, preventing stale tabs from dropping newly uploaded rooms.
CREATE OR REPLACE FUNCTION public.tnp_touch_tour_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' THEN UPDATE public.tnp_tours SET revision=revision+1 WHERE id=OLD.tour_id; RETURN OLD; END IF;
 UPDATE public.tnp_tours SET revision=revision+1 WHERE id=NEW.tour_id;
 IF TG_OP='UPDATE' AND OLD.tour_id<>NEW.tour_id THEN UPDATE public.tnp_tours SET revision=revision+1 WHERE id=OLD.tour_id; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tnp_touch_tour_revision() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tnp_touch_tour_revision AFTER INSERT OR UPDATE OR DELETE ON public.tnp_tour_scenes FOR EACH ROW EXECUTE FUNCTION public.tnp_touch_tour_revision();
