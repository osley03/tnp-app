-- Listing photos are public; tour assets and payment evidence remain separate.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('tnp-property-photos','tnp-property-photos',true,10485760,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=EXCLUDED.public,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
CREATE POLICY tnp_property_photo_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='tnp-property-photos' AND split_part(name,'/',1)=auth.uid()::text
AND (public.has_role(auth.uid(),'landlord') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY tnp_property_photo_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='tnp-property-photos' AND (split_part(name,'/',1)=auth.uid()::text OR public.has_role(auth.uid(),'admin')));
-- Immutable object paths; no overwrite or deletion policy.
