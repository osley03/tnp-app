import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {auditModuleContracts} from './module-contracts.mjs';
process.on('uncaughtException',error=>{console.error('DATABASE VERIFICATION FAILED:',error.message);if(error.detail)console.error(error.detail);process.exit(1);});
const require=createRequire(process.argv[2] || new URL('../.validation/package.json',import.meta.url));
let PGlite,pgcrypto;try{({PGlite}=require('@electric-sql/pglite'));({pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto'));}catch{console.error('Run npm run setup:database-tests first.');process.exit(1);}
const db=new PGlite({extensions:{pgcrypto}});await db.waitReady;
await db.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}',email text);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('request.jwt.claim.role',true)$$;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$SELECT (string_to_array(name,'/'))[1:cardinality(string_to_array(name,'/'))-1]$$;GRANT USAGE ON SCHEMA auth,storage,public TO anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION auth.uid(),storage.foldername(text) TO anon,authenticated,service_role;GRANT ALL ON storage.objects,storage.buckets TO service_role;GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated;");
const names=(await fs.readdir(new URL('../supabase/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort();
for(const name of names){try{await db.exec(await fs.readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));console.log('MIGRATION PASS',name);}catch(error){console.error('MIGRATION FAIL',name,error.message,error.position);process.exit(1);}}
const contracts=await auditModuleContracts(db);console.log('CONTRACT AUDIT PASS',contracts.moduleCount,'source modules');
const ids={tenant:'11111111-1111-4111-8111-111111111111',landlord:'22222222-2222-4222-8222-222222222222',admin:'33333333-3333-4333-8333-333333333333',other:'44444444-4444-4444-8444-444444444444',property:'55555555-5555-4555-8555-555555555555',tour:'66666666-6666-4666-8666-666666666666',scene:'77777777-7777-4777-8777-777777777777'};
for(const name of ['tenant','landlord','admin','other'])await db.query('INSERT INTO auth.users(id,raw_user_meta_data,email) VALUES($1,$2,$3)',[ids[name],JSON.stringify({role:name==='other'?'tenant':name,full_name:'Test '+name}),name+'@example.test']);
assert.equal((await db.query('SELECT role FROM public.user_roles WHERE user_id=$1',[ids.admin])).rows[0].role,'tenant');await db.query("INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')",[ids.admin]);
async function asUser(name,fn,role='authenticated'){await db.exec('SET ROLE '+role);await db.query("SELECT set_config('request.jwt.claim.role',$1,false)",[role]);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[name?ids[name]:'']);try{return await fn();}finally{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub','',false)");}}
let groups=0;async function group(name,fn){await fn();groups++;console.log('WORKFLOW PASS',name);}
let application,lease,payment;

await group('signup and trust boundaries',async()=>{await assert.rejects(()=>asUser('tenant',()=>db.query('UPDATE public.profiles SET trust_score=100 WHERE id=$1',[ids.tenant])));await asUser('admin',()=>db.query('UPDATE public.profiles SET trust_score=80 WHERE id=$1',[ids.tenant]));assert.equal((await db.query('SELECT trust_score FROM public.profiles WHERE id=$1',[ids.tenant])).rows[0].trust_score,80);});
await asUser('landlord',()=>db.query("INSERT INTO public.properties(id,owner_id,title,suburb,city,rent_usd,deposit_usd) VALUES($1,$2,'Garden flat','Avondale','Harare',500,500)",[ids.property,ids.landlord]));
await group('administrator-only listing verification',async()=>{await assert.rejects(()=>asUser('landlord',()=>db.query('UPDATE public.properties SET verified=true WHERE id=$1',[ids.property])));await asUser('admin',()=>db.query('UPDATE public.properties SET verified=true WHERE id=$1',[ids.property]));});
await group('tenant message integrity and withdrawal',async()=>{application=(await asUser('tenant',()=>db.query("INSERT INTO public.lease_requests(property_id,tenant_id,message) VALUES($1,$2,'Original tenant message') RETURNING *",[ids.property,ids.tenant]))).rows[0];await asUser('landlord',()=>db.query("UPDATE public.lease_requests SET landlord_message='Landlord reply' WHERE id=$1",[application.id]));assert.equal((await db.query('SELECT message FROM public.lease_requests WHERE id=$1',[application.id])).rows[0].message,'Original tenant message');await asUser('tenant',()=>db.query("UPDATE public.lease_requests SET status='withdrawn' WHERE id=$1",[application.id]));await assert.rejects(()=>asUser('landlord',()=>db.query("UPDATE public.lease_requests SET status='Approved' WHERE id=$1",[application.id])));});
await group('atomic idempotent lease conversion',async()=>{application=(await asUser('tenant',()=>db.query("INSERT INTO public.lease_requests(property_id,tenant_id,message) VALUES($1,$2,'Another application') RETURNING *",[ids.property,ids.tenant]))).rows[0];await asUser('landlord',()=>db.query("UPDATE public.lease_requests SET status='Approved' WHERE id=$1",[application.id]));lease=(await asUser('admin',()=>db.query('SELECT * FROM public.tnp_create_lease_from_request($1)',[application.id]))).rows[0];assert.equal((await asUser('admin',()=>db.query('SELECT * FROM public.tnp_create_lease_from_request($1)',[application.id]))).rows[0].id,lease.id);assert.equal((await db.query('SELECT lease_id FROM public.lease_requests WHERE id=$1',[application.id])).rows[0].lease_id,lease.id);await asUser('admin',()=>db.query("SELECT public.tnp_change_lease_status($1,'active')",[lease.id]));assert.equal((await asUser('other',()=>db.query('SELECT * FROM public.leases'))).rows.length,0);});
await group('payment types, idempotency and audit records',async()=>{payment=(await asUser('tenant',()=>db.query("SELECT * FROM public.create_lease_payment($1,'rent',500,'payment-key-123')",[lease.id]))).rows[0];assert.equal((await asUser('tenant',()=>db.query("SELECT * FROM public.create_lease_payment($1,'rent',500,'payment-key-123')",[lease.id]))).rows[0].id,payment.id);assert.equal(payment.status,'pending');await assert.rejects(()=>asUser('other',()=>db.query("SELECT public.create_lease_payment($1,'rent',500,'other-key-123')",[lease.id])));await asUser('admin',()=>db.query("SELECT public.tnp_record_payment_status($1,'held','held')",[payment.id]));await asUser('admin',()=>db.query("SELECT public.tnp_record_payment_status($1,'released','released')",[payment.id]));assert.equal(Number((await db.query('SELECT count(*) AS n FROM public.payment_audit_logs WHERE payment_id=$1',[payment.id])).rows[0].n),3);for(const type of ['utility','late_fee','other'])assert.equal((await asUser('tenant',()=>db.query('SELECT * FROM public.create_lease_payment($1,$2,10,$3)',[lease.id,type,'payment-kind-'+type]))).rows[0].payment_type,type);assert.equal((await asUser('other',()=>db.query('SELECT * FROM public.lease_payments'))).rows.length,0);});
await group('lease-qualified review moderation and replies',async()=>{const review=(await asUser('tenant',()=>db.query("SELECT * FROM public.submit_tenant_review($1,$2,5,'A helpful and accurate listing')",[ids.property,ids.landlord]))).rows[0];assert.equal((await asUser('other',()=>db.query('SELECT * FROM public.reviews WHERE id=$1',[review.id]))).rows.length,0);await asUser('admin',()=>db.query("UPDATE public.reviews SET moderation_status='approved' WHERE id=$1",[review.id]));await asUser('landlord',()=>db.query("UPDATE public.reviews SET landlord_response='Thank you' WHERE id=$1",[review.id]));assert.equal((await db.query('SELECT body FROM public.reviews WHERE id=$1',[review.id])).rows[0].body,'A helpful and accurate listing');await asUser('tenant',()=>db.query("UPDATE public.reviews SET moderation_status='approved',body='An updated tenant review' WHERE id=$1",[review.id]));assert.equal((await db.query('SELECT moderation_status FROM public.reviews WHERE id=$1',[review.id])).rows[0].moderation_status,'pending');});
await group('dispute ownership and administrator resolution',async()=>{const dispute=(await asUser('tenant',()=>db.query("INSERT INTO public.disputes(lease_id,opened_by,title,description,category,priority) VALUES($1,$2,'Deposit concern','Please review the deposit record','deposit','medium') RETURNING *",[lease.id,ids.tenant]))).rows[0];assert.equal(dispute.landlord_id,ids.landlord);await asUser('landlord',()=>db.query("UPDATE public.disputes SET landlord_response='I will check',status='under_review' WHERE id=$1",[dispute.id]));await assert.rejects(()=>asUser('landlord',()=>db.query("UPDATE public.disputes SET status='resolved' WHERE id=$1",[dispute.id])));await asUser('admin',()=>db.query("UPDATE public.disputes SET status='resolved',resolution='Recorded outcome' WHERE id=$1",[dispute.id]));assert.equal((await asUser('other',()=>db.query('SELECT * FROM public.disputes'))).rows.length,0);});
await group('private enquiries and report forwarding',async()=>{const enquiry=(await asUser('tenant',()=>db.query("INSERT INTO public.landlord_contact_requests(tenant_id,landlord_id,subject,message) VALUES($1,$2,'Viewing','Can I view this property?') RETURNING id",[ids.tenant,ids.landlord]))).rows[0];await asUser('landlord',()=>db.query("SELECT public.tnp_reply_to_enquiry($1,'Please suggest a time')",[enquiry.id]));assert.equal((await asUser('other',()=>db.query('SELECT * FROM public.landlord_contact_requests'))).rows.length,0);await asUser('tenant',()=>db.query("INSERT INTO public.landlord_reports(reporter_id,landlord_id,category,description) VALUES($1,$2,'other','Please review this concern')",[ids.tenant,ids.landlord]));assert.equal(Number((await asUser('admin',()=>db.query('SELECT count(*) AS n FROM public.scam_cases'))).rows[0].n),1);assert.equal((await asUser('other',()=>db.query('SELECT * FROM public.scam_cases'))).rows.length,0);});
await group('tenant profile and favourite privacy',async()=>{assert.equal((await asUser('other',()=>db.query('SELECT * FROM public.profiles WHERE id=$1',[ids.tenant]))).rows.length,0);assert.equal((await asUser('landlord',()=>db.query('SELECT * FROM public.profiles WHERE id=$1',[ids.tenant]))).rows.length,1);await asUser('tenant',()=>db.query('INSERT INTO public.property_favorites(tenant_id,property_id) VALUES($1,$2)',[ids.tenant,ids.property]));assert.equal((await asUser('other',()=>db.query('SELECT * FROM public.property_favorites'))).rows.length,0);});
await group('saved listing safety findings',async()=>{const result=(await asUser('tenant',()=>db.query("SELECT public.run_land_scam_check($1,'property',null,null,null,null,null,null,null,null) AS result",[ids.property]))).rows[0].result;assert.match(result.summary,/rules-based/);assert.equal((await asUser('tenant',()=>db.query('SELECT * FROM public.land_scam_check_findings WHERE check_id=$1',[result.check_id]))).rows.length,4);assert.equal((await asUser('other',()=>db.query('SELECT * FROM public.land_scam_check_findings'))).rows.length,0);});
await group('linked tour publication integrity',async()=>{await asUser('landlord',()=>db.query("INSERT INTO public.tnp_tours(id,owner_id,title,is_published,visibility) VALUES($1,$2,'Garden flat tour',false,'public')",[ids.tour,ids.landlord]));await asUser('landlord',()=>db.query("INSERT INTO public.tnp_tour_scenes(id,tour_id,name,panorama_url,storage_path) VALUES($1,$2,'Living room','',$3)",[ids.scene,ids.tour,ids.landlord+'/'+ids.tour+'/living.jpg']));await asUser('landlord',()=>db.query('UPDATE public.tnp_tours SET is_published=true WHERE id=$1',[ids.tour]));await asUser('landlord',()=>db.query('UPDATE public.properties SET tour_url=$1 WHERE id=$2',['https://tnp.example/tours/'+ids.tour,ids.property]));assert.equal((await db.query('SELECT tour_url FROM public.properties WHERE id=$1',[ids.property])).rows[0].tour_url,'/tours/'+ids.tour);await assert.rejects(()=>asUser('landlord',()=>db.query('UPDATE public.tnp_tours SET is_published=false WHERE id=$1',[ids.tour])));await assert.rejects(()=>asUser('landlord',()=>db.query("UPDATE public.tnp_tours SET visibility='private' WHERE id=$1",[ids.tour])));});
await group('tour passwords, invitations and service-only authorization',async()=>{await asUser('landlord',()=>db.query('UPDATE public.properties SET tour_url=null WHERE id=$1',[ids.property]));const revision=(await db.query('SELECT revision FROM public.tnp_tours WHERE id=$1',[ids.tour])).rows[0].revision;const scenes=JSON.stringify([{id:ids.scene,name:'Living room',scene_order:0,settings:{hotspots:[]}}]);await asUser('landlord',()=>db.query("SELECT public.tnp_save_tour($1,$2,'Garden flat tour','','password',true,'{}'::jsonb,$3::jsonb,'correct-password')",[ids.tour,revision,scenes]));await assert.rejects(()=>asUser(null,()=>db.query("SELECT public.tnp_edge_read_tour($1,null,'wrong-password')",[ids.tour]),'service_role'));assert.equal((await asUser(null,()=>db.query("SELECT public.tnp_edge_read_tour($1,null,'correct-password') AS tour",[ids.tour]),'service_role')).rows[0].tour.id,ids.tour);await assert.rejects(()=>asUser('other',()=>db.query("SELECT public.tnp_edge_read_tour($1,$2,'correct-password')",[ids.tour,ids.other])));await asUser('landlord',()=>db.query("UPDATE public.tnp_tours SET visibility='private' WHERE id=$1",[ids.tour]));await assert.rejects(()=>asUser(null,()=>db.query("SELECT public.tnp_edge_read_tour($1,$2,'correct-password')",[ids.tour,ids.other]),'service_role'));await asUser('landlord',()=>db.query('SELECT public.tnp_tour_members($1,$2,false)',[ids.tour,ids.other]));assert.equal((await asUser(null,()=>db.query("SELECT public.tnp_edge_read_tour($1,$2,'') AS tour",[ids.tour,ids.other]),'service_role')).rows[0].tour.id,ids.tour);});

await group('direct landlord checkout, server-only confirmation and evidence privacy',async()=>{
 const created=(await asUser('tenant',()=>db.query("SELECT * FROM public.create_lease_payment($1,'other',500,'gateway-payment-key-123')",[lease.id]))).rows[0];
 await assert.rejects(()=>asUser('tenant',()=>db.query("SELECT public.create_lease_payment($1,'application_fee',10,'gateway-app-fee-key')",[lease.id])));
 const reserve=(payer,mode='test')=>asUser(null,()=>db.query("SELECT * FROM public.tnp_reserve_gateway_payment($1,$2,'ecocash','12345',$3,gen_random_uuid())",[created.id,payer,mode]),'service_role');
 await assert.rejects(()=>reserve(ids.other));
 const sandbox=(await reserve(ids.tenant)).rows[0];
 assert.equal(sandbox.landlord_id,ids.landlord);assert.equal(sandbox.amount_usd,'500.00');
 assert.equal((await reserve(ids.tenant)).rows[0].id,sandbox.id);
 await assert.rejects(()=>asUser('tenant',()=>db.query('SELECT * FROM public.tnp_gateway_attempts')));
 await assert.rejects(()=>asUser('tenant',()=>db.query("SELECT public.tnp_reserve_gateway_payment($1,$2,'ecocash','12345','test',gen_random_uuid())",[created.id,ids.tenant])));
 const confirm=(attempt,status,hash='A',amount=500,reference='PAYNOW-123')=>asUser(null,()=>db.query('SELECT * FROM public.tnp_confirm_gateway_payment($1,$2,$3,$4,$5)',[attempt.id,reference,status,amount,hash.repeat(128)]),'service_role');
 await assert.rejects(()=>confirm(sandbox,'Paid','A',5));
 await confirm(sandbox,'Paid');
 assert.equal((await db.query('SELECT status FROM public.lease_payments WHERE id=$1',[created.id])).rows[0].status,'pending');
 const live=(await reserve(ids.tenant,'live')).rows[0];
 const evidence=(await confirm(live,'Paid','B')).rows[0];
 assert.equal((await db.query('SELECT status FROM public.lease_payments WHERE id=$1',[created.id])).rows[0].status,'paid');
 assert.equal((await confirm(live,'Paid','B')).rows[0].id,evidence.id);
 assert.equal(Number((await db.query("SELECT count(*) AS n FROM public.payment_audit_logs WHERE payment_id=$1 AND event_type='gateway_verified'",[created.id])).rows[0].n),1);
 await assert.rejects(()=>confirm(live,'Created','C'));
 await assert.rejects(()=>confirm(live,'Paid','D',500,'WRONG-REFERENCE'));
 await assert.rejects(()=>asUser('admin',()=>db.query("SELECT public.tnp_record_payment_status($1,'held','manual')",[created.id])));
 await assert.rejects(()=>asUser('tenant',()=>db.query('SELECT public.tnp_confirm_gateway_payment($1,$2,$3,$4,$5)',[live.id,'PAYNOW-123','Paid',500,'E'.repeat(128)])));
 assert.equal((await asUser('other',()=>db.query('SELECT * FROM public.tnp_payment_evidence'))).rows.length,0);
 for(const who of ['tenant','landlord','admin'])assert.equal((await asUser(who,()=>db.query('SELECT * FROM public.tnp_payment_evidence'))).rows.length,2);
 await assert.rejects(()=>db.query("UPDATE public.tnp_payment_evidence SET amount_usd=1 WHERE id=$1",[evidence.id]));
 await assert.rejects(()=>db.query('DELETE FROM public.tnp_payment_evidence WHERE id=$1',[evidence.id]));
 await confirm(live,'Refunded','F');await assert.rejects(()=>confirm(live,'Paid','E'));
 assert.equal((await db.query('SELECT status FROM public.lease_payments WHERE id=$1',[created.id])).rows[0].status,'refunded');
 assert.equal(Number((await db.query('SELECT count(*) AS n FROM public.escrow_transactions WHERE payment_id=$1',[created.id])).rows[0].n),0);
});

await group('rental application validation and decision integrity',async()=>{
 const create=(date,message)=>asUser('other',()=>db.query('INSERT INTO public.lease_requests(property_id,tenant_id,move_in,message) VALUES($1,$2,$3,$4) RETURNING *',[ids.property,ids.other,date,message]));
 await assert.rejects(()=>create('2000-01-01','Past date'));
 await assert.rejects(()=>create(null,'x'.repeat(2001)));
 await db.query("UPDATE public.properties SET listing_type='For Sale' WHERE id=$1",[ids.property]);
 await assert.rejects(()=>create(null,'Sale listing'));
 await db.query("UPDATE public.properties SET listing_type='For Rent',available=false WHERE id=$1",[ids.property]);
 await assert.rejects(()=>create(null,'Unavailable listing'));
 await db.query('UPDATE public.properties SET available=true WHERE id=$1',[ids.property]);
 const request=(await create('2099-01-01','  Please review  ')).rows[0];
 assert.equal(request.message,'Please review');
 await assert.rejects(()=>create('2099-01-01','Duplicate'));
 await assert.rejects(()=>asUser('landlord',()=>db.query("UPDATE public.lease_requests SET status='Rejected' WHERE id=$1",[request.id])));
 await asUser('landlord',()=>db.query('UPDATE public.lease_requests SET reviewed_by=$1,reviewed_at=now(),decision_at=now() WHERE id=$2',[ids.tenant,request.id]));
 const unchanged=(await db.query('SELECT * FROM public.lease_requests WHERE id=$1',[request.id])).rows[0];
 assert.equal(unchanged.reviewed_by,null);assert.equal(unchanged.decision_at,null);
 await asUser('landlord',()=>db.query("UPDATE public.lease_requests SET status='Rejected',rejection_reason='Property no longer suitable' WHERE id=$1",[request.id]));
 const rejected=(await asUser('other',()=>db.query('SELECT * FROM public.lease_requests WHERE id=$1',[request.id]))).rows[0];
 assert.equal(rejected.status,'Rejected');assert.equal(rejected.reviewed_by,ids.landlord);assert.ok(rejected.decision_at);
 await assert.rejects(()=>asUser('other',()=>db.query("UPDATE public.lease_requests SET status='withdrawn' WHERE id=$1",[request.id])));
});
await group('lease renewal idempotency and ownership',async()=>{
 const renewed=(await asUser('tenant',()=>db.query('SELECT * FROM public.request_lease_renewal($1)',[lease.id]))).rows[0];
 assert.equal(renewed.renewal_status,'requested');
 await asUser('tenant',()=>db.query('SELECT public.request_lease_renewal($1)',[lease.id]));
 assert.equal(Number((await db.query("SELECT count(*) AS n FROM public.lease_events WHERE lease_id=$1 AND event_type='renewal_requested'",[lease.id])).rows[0].n),1);
 await assert.rejects(()=>asUser('other',()=>db.query('SELECT public.request_lease_renewal($1)',[lease.id])));
});
await group('review editing and report privacy',async()=>{
 const review=(await db.query('SELECT id FROM public.reviews WHERE author_id=$1',[ids.tenant])).rows[0];
 await assert.rejects(()=>asUser('other',()=>db.query("SELECT public.update_tenant_review($1,4,'Someone else changing this review')",[review.id])));
 await asUser('tenant',()=>db.query("SELECT public.update_tenant_review($1,4,'Updated genuine rental experience')",[review.id]));
 assert.equal((await db.query('SELECT moderation_status FROM public.reviews WHERE id=$1',[review.id])).rows[0].moderation_status,'pending');
 await asUser('tenant',()=>db.query("SELECT public.report_review($1,'other','Please check this record')",[review.id]));
 assert.equal((await asUser('other',()=>db.query('SELECT * FROM public.review_reports'))).rows.length,0);
 await assert.rejects(()=>asUser('tenant',()=>db.query("SELECT public.submit_tenant_review($1,$2,5,'A duplicate review for the same listing')",[ids.property,ids.landlord])));
});
await group('scam submission validation and administrator visibility',async()=>{
 const args=['rental','TEST: rental scam report','This synthetic report tests the complete reporting workflow.','medium','TEST location',null,null,null,null,null,10,'other','TEST-REFERENCE',ids.property,null,[]];
 const submit=()=>db.query('SELECT * FROM public.submit_scam_case('+args.map((_,i)=>'$'+(i+1)).join(',')+')',args);
 const report=(await asUser('tenant',submit)).rows[0];
 assert.equal(report.reporter_id,ids.tenant);assert.equal(report.status,'submitted');
 assert.equal((await asUser('admin',()=>db.query('SELECT * FROM public.scam_cases WHERE id=$1',[report.id]))).rows.length,1);
 assert.equal((await asUser('other',()=>db.query('SELECT * FROM public.scam_cases WHERE id=$1',[report.id]))).rows.length,0);
 args[2]='short';await assert.rejects(()=>asUser('tenant',submit));
});
await group('anonymous public reporting, private tracking and atomic administrator resolution',async()=>{
 const input={name:'Public reporter',email:'public@example.test',case_type:'fake_listing',title:'TEST public listing concern',description:'This synthetic public report checks anonymous submission and administrator resolution.',amount:'25.00',evidence:['https://example.test/evidence']};
 const result=(await asUser(null,()=>db.query('SELECT public.tnp_submit_public_report($1::jsonb) AS result',[JSON.stringify(input)]),'anon')).rows[0].result;
 assert.equal(result.status,'submitted');assert.equal(result.tracking_code.length,64);
 await assert.rejects(()=>asUser(null,()=>db.query('SELECT * FROM public.scam_cases'),'anon'));
 await assert.rejects(()=>asUser(null,()=>db.query('SELECT * FROM public.tnp_public_report_access'),'anon'));
 await assert.rejects(()=>asUser('other',()=>db.query('SELECT * FROM public.tnp_public_report_access')));
 const c=(await asUser('admin',()=>db.query('SELECT * FROM public.scam_cases WHERE reference=$1',[result.reference]))).rows[0];assert.equal(c.reporter_email,input.email);
 const track=(token=result.tracking_code)=>asUser(null,()=>db.query('SELECT public.tnp_track_public_report($1,$2) AS result',[result.reference,token]),'anon');
 await assert.rejects(()=>track('0'.repeat(64)));
 assert.equal((await track()).rows[0].result.status,'submitted');
 await assert.rejects(()=>asUser('tenant',()=>db.query("SELECT public.tnp_admin_case_action($1,'resolved','Unauthorized outcome',null)",[c.id])));
 await assert.rejects(()=>asUser('admin',()=>db.query("SELECT public.tnp_admin_case_action($1,'status_changed','closed',null)",[c.id])));
 await asUser('admin',()=>db.query("SELECT public.tnp_admin_case_action($1,'note_added','Private administrator investigation',null)",[c.id]));
 await asUser('admin',()=>db.query("SELECT public.tnp_admin_case_action($1,'status_changed','under_review','Review started')",[c.id]));
 await asUser('admin',()=>db.query("SELECT public.tnp_admin_case_action($1,'resolved','Listing reviewed and the reported issue was corrected.',null)",[c.id]));
 const outcome=(await track()).rows[0].result;assert.equal(outcome.status,'resolved');assert.match(outcome.resolution,/corrected/);assert.equal(outcome.admin_notes,undefined);assert.equal(outcome.reporter_email,undefined);
 assert.equal(Number((await asUser('admin',()=>db.query('SELECT count(*) AS n FROM public.scam_case_admin_actions WHERE case_id=$1',[c.id]))).rows[0].n),3);
 for(let i=0;i<2;i++)await asUser(null,()=>db.query('SELECT public.tnp_submit_public_report($1::jsonb)',[JSON.stringify(input)]),'anon');
 await assert.rejects(()=>asUser(null,()=>db.query('SELECT public.tnp_submit_public_report($1::jsonb)',[JSON.stringify(input)]),'anon'));
 await assert.rejects(()=>asUser(null,()=>db.query('SELECT public.tnp_submit_public_report($1::jsonb)',[JSON.stringify({...input,email:'other-public@example.test',evidence:['javascript:alert(1)']})]),'anon'));
});
await group('landlord approval opens dated invoices, blocks duplicates and protects payment ownership',async()=>{
 const property='88888888-8888-4888-8888-888888888888';
 await asUser('landlord',()=>db.query("INSERT INTO public.properties(id,owner_id,title,suburb,city,rent_usd,deposit_usd) VALUES($1,$2,'TEST approved rental','Avondale','Harare',450,900)",[property,ids.landlord]));
 const request=(await asUser('tenant',()=>db.query("INSERT INTO public.lease_requests(property_id,tenant_id,message) VALUES($1,$2,'Test approval to payment') RETURNING *",[property,ids.tenant]))).rows[0];
 const approved=(await asUser('landlord',()=>db.query("UPDATE public.lease_requests SET status='Approved' WHERE id=$1 RETURNING *",[request.id]))).rows[0];assert.ok(approved.lease_id);
 const rental=(await asUser('tenant',()=>db.query('SELECT * FROM public.leases WHERE id=$1',[approved.lease_id]))).rows[0];assert.equal(rental.status,'pending_approval');assert.equal(rental.signed_at,null);
 const invoices=(await asUser('tenant',()=>db.query('SELECT * FROM public.lease_payments WHERE lease_id=$1 ORDER BY payment_type',[rental.id]))).rows;assert.equal(invoices.length,2);assert.equal(invoices[0].payment_type,'deposit');assert.equal(Number(invoices[0].amount_usd),900);assert.equal(invoices[1].payment_type,'rent');assert.equal(Number(invoices[1].amount_usd),450);assert.ok(invoices.every(payment=>payment.status==='pending'&&payment.paid_at===null&&payment.due_date));assert.ok(invoices[1].period_start&&invoices[1].period_end);assert.deepEqual(invoices[1].due_date,(await db.query("SELECT CURRENT_DATE AS due")).rows[0].due);
 await asUser('landlord',()=>db.query("UPDATE public.lease_requests SET status='Approved' WHERE id=$1",[request.id]));assert.equal(Number((await db.query('SELECT count(*) AS n FROM public.lease_payments WHERE lease_id=$1',[rental.id])).rows[0].n),2);
 assert.equal((await asUser('tenant',()=>db.query('SELECT * FROM public.tnp_create_monthly_rent($1,$2)',[rental.id,invoices[1].period_start]))).rows[0].id,invoices[1].id);
 await assert.rejects(()=>asUser('tenant',()=>db.query("SELECT public.create_lease_payment($1,'rent',1,'underpay-test-key')",[rental.id])));
 await assert.rejects(()=>asUser('other',()=>db.query('SELECT public.tnp_create_monthly_rent($1,$2)',[rental.id,invoices[1].period_start])));
 await assert.rejects(()=>asUser('tenant',()=>db.query("SELECT public.tnp_scheduled_payment($1,'deposit',null)",[rental.id])));
 await assert.rejects(()=>asUser('tenant',()=>db.query("SELECT public.tnp_payment_summary('landlord')")));
 const conflict=(await asUser('other',()=>db.query('INSERT INTO public.lease_requests(property_id,tenant_id) VALUES($1,$2) RETURNING id',[property,ids.other]))).rows[0];await assert.rejects(()=>asUser('landlord',()=>db.query("UPDATE public.lease_requests SET status='Approved' WHERE id=$1",[conflict.id])));
 const attempt=(await asUser(null,()=>db.query("SELECT * FROM public.tnp_reserve_gateway_payment($1,$2,'ecocash','12345','live',gen_random_uuid())",[invoices[1].id,ids.tenant]),'service_role')).rows[0];assert.equal(attempt.landlord_id,ids.landlord);assert.equal(Number(attempt.amount_usd),450);
 const before=(await asUser('landlord',()=>db.query("SELECT public.tnp_payment_summary('landlord') AS summary"))).rows[0].summary;
 await asUser(null,()=>db.query("SELECT public.tnp_confirm_gateway_payment($1,'TEST-APPROVED-RENT','Paid',450,$2)",[attempt.id,'A'.repeat(128)]),'service_role');
 const paid=(await asUser('landlord',()=>db.query('SELECT * FROM public.lease_payments WHERE id=$1',[invoices[1].id]))).rows[0];assert.equal(paid.status,'paid');assert.ok(paid.paid_at);assert.deepEqual(paid.period_start,invoices[1].period_start);
 const after=(await asUser('landlord',()=>db.query("SELECT public.tnp_payment_summary('landlord') AS summary"))).rows[0].summary;assert.equal(Number(after.paid)-Number(before.paid),450);
 await asUser('admin',()=>db.query("SELECT public.tnp_change_lease_status($1,'active')",[rental.id]));
 const nextMonth=(await db.query("SELECT (date_trunc('month',CURRENT_DATE)+interval '1 month')::date AS month")).rows[0].month;
 const next=(await asUser('tenant',()=>db.query('SELECT * FROM public.tnp_create_monthly_rent($1,$2)',[rental.id,nextMonth]))).rows[0];assert.equal(Number(next.amount_usd),450);assert.equal((await asUser('tenant',()=>db.query('SELECT * FROM public.tnp_create_monthly_rent($1,$2)',[rental.id,nextMonth]))).rows[0].id,next.id);
});
await group('manual payment privacy, mismatch decisions, immutable proof and chained evidence',async()=>{
 const property='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa19';
 await asUser('landlord',()=>db.query("INSERT INTO public.properties(id,owner_id,title,suburb,city,rent_usd,deposit_usd) VALUES($1,$2,'TEST manual rental','Avondale','Harare',300,600)",[property,ids.landlord]));
 const request=(await asUser('tenant',()=>db.query("INSERT INTO public.lease_requests(property_id,tenant_id) VALUES($1,$2) RETURNING id",[property,ids.tenant]))).rows[0];
 const approved=(await asUser('landlord',()=>db.query("UPDATE public.lease_requests SET status='Approved' WHERE id=$1 RETURNING lease_id",[request.id]))).rows[0];
 const invoice=(await asUser('tenant',()=>db.query("SELECT * FROM public.lease_payments WHERE lease_id=$1 AND payment_type='rent'",[approved.lease_id]))).rows[0];
 await assert.rejects(()=>asUser('tenant',()=>db.query("SELECT public.tnp_save_payment_destination('ecocash','Tenant account','0770000000','','',true)")));
 const destination=(await asUser('landlord',()=>db.query("SELECT * FROM public.tnp_save_payment_destination('ecocash','Test landlord','0771234567','','Use TNP reference',true)"))).rows[0];
 assert.equal((await asUser('tenant',()=>db.query('SELECT * FROM public.tnp_payment_destinations_for($1)',[invoice.id]))).rows[0].id,destination.id);
 await assert.rejects(()=>asUser('other',()=>db.query('SELECT * FROM public.tnp_payment_destinations_for($1)',[invoice.id])));
 assert.equal((await asUser('other',()=>db.query('SELECT * FROM public.tnp_payment_destinations'))).rows.length,0);
 async function submit(amount,ref){const id=crypto.randomUUID(),path=ids.tenant+'/'+invoice.id+'/'+id+'.jpg';await asUser('tenant',()=>db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('tnp-manual-receipts',$1)",[path]));return (await asUser('tenant',()=>db.query('SELECT * FROM public.tnp_submit_manual_payment($1,$2,$3,$4,CURRENT_DATE,$5,$6,$7)',[id,invoice.id,destination.id,amount,ref,path,'a'.repeat(64)]))).rows[0];}
 const mismatch=await submit(30,'MANUAL-MISMATCH-001');assert.ok(mismatch.flags.includes('amount_mismatch'));
 assert.equal((await asUser('other',()=>db.query('SELECT * FROM public.tnp_manual_payment_submissions'))).rows.length,0);
 assert.equal((await asUser('other',()=>db.query("SELECT * FROM storage.objects WHERE bucket_id='tnp-manual-receipts'"))).rows.length,0);
 await assert.rejects(()=>asUser('tenant',()=>db.query("SELECT public.tnp_decide_manual_payment($1,'confirmed','')",[mismatch.id])));
 await assert.rejects(()=>asUser('landlord',()=>db.query("SELECT public.tnp_decide_manual_payment($1,'confirmed','')",[mismatch.id])));
 await asUser('landlord',()=>db.query("SELECT public.tnp_decide_manual_payment($1,'disputed','Amount does not match the rent request')",[mismatch.id]));
 const changed=(await asUser('landlord',()=>db.query("SELECT * FROM public.tnp_save_payment_destination('ecocash','Test landlord','0777654321','','Updated wallet',true)"))).rows[0];assert.notEqual(changed.id,destination.id);
 const proof=await submit(300,'MANUAL-RENT-001');assert.ok(proof.flags.includes('destination_changed'));
 await assert.rejects(()=>submit(300,'MANUAL-DOUBLE-001'));
 assert.equal((await db.query('SELECT destination_snapshot FROM public.tnp_manual_payment_submissions WHERE id=$1',[proof.id])).rows[0].destination_snapshot.account_number,'0771234567');
 assert.equal((await asUser('tenant',()=>db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING id',[proof.receipt_path]))).rows.length,0);
 await assert.rejects(()=>asUser(null,()=>db.query("SELECT public.tnp_reserve_gateway_payment($1,$2,'ecocash','12345','live',gen_random_uuid())",[invoice.id,ids.tenant]),'service_role'));
 await asUser('landlord',()=>db.query("SELECT public.tnp_decide_manual_payment($1,'confirmed','Checked wallet statement')",[proof.id]));
 const settled=(await db.query('SELECT * FROM public.lease_payments WHERE id=$1',[invoice.id])).rows[0];assert.equal(settled.status,'paid');assert.ok(settled.paid_at);
 await assert.rejects(()=>asUser('admin',()=>db.query("UPDATE public.lease_payments SET amount_usd=1 WHERE id=$1",[invoice.id])));
 await assert.rejects(()=>db.query('DELETE FROM public.tnp_manual_payment_submissions WHERE id=$1',[proof.id]));
 await assert.rejects(()=>db.query("UPDATE public.tnp_manual_payment_events SET entry_hash='changed' WHERE lease_id=$1",[approved.lease_id]));
 const chain=(await asUser('admin',()=>db.query('SELECT public.tnp_verify_manual_chain($1) AS chain',[approved.lease_id]))).rows[0].chain;assert.equal(chain.valid,true);assert.ok(chain.entries>=5);assert.equal(chain.head.length,64);
 await assert.rejects(()=>asUser('other',()=>db.query('SELECT public.tnp_verify_manual_chain($1)',[approved.lease_id])));
 await db.exec('BEGIN');try{await db.exec('ALTER TABLE public.tnp_manual_payment_events DISABLE TRIGGER tnp_manual_event_immutable');await db.query("UPDATE public.tnp_manual_payment_events SET payload=payload||'{\"tampered\":true}'::jsonb WHERE id=(SELECT min(id) FROM public.tnp_manual_payment_events WHERE lease_id=$1)",[approved.lease_id]);const damaged=(await asUser('admin',()=>db.query('SELECT public.tnp_verify_manual_chain($1) AS chain',[approved.lease_id]))).rows[0].chain;assert.equal(damaged.valid,false);}finally{await db.exec('ROLLBACK');}

});
await group('external tour allowlist preserves internal ownership checks',async()=>{
 for(const url of ['https://kuula.co/share/collection/7AbCd?fs=1','https://my.matterport.com/show/?m=SxQL3iGyoDo']){await asUser('landlord',()=>db.query('UPDATE public.properties SET tour_url=$1 WHERE id=$2',[url,ids.property]));assert.equal((await db.query('SELECT tour_url FROM public.properties WHERE id=$1',[ids.property])).rows[0].tour_url,url);}
 for(const url of ['https://evil.test/tour','https://kuula.co.evil.test/share/AbCd1','https://user@kuula.co/share/AbCd1','http://kuula.co/share/AbCd1'])await assert.rejects(()=>asUser('landlord',()=>db.query('UPDATE public.properties SET tour_url=$1 WHERE id=$2',[url,ids.property])));
 await assert.rejects(()=>asUser('landlord',()=>db.query('UPDATE public.properties SET tour_url=$1 WHERE id=$2',['https://tnp.example/tours/ffffffff-ffff-4fff-8fff-ffffffffffff',ids.property])));
 await asUser('landlord',()=>db.query('UPDATE public.properties SET tour_url=NULL WHERE id=$1',[ids.property]));
});
await group('account closure preserves evidence and rejects closed sessions',async()=>{
 await db.exec('BEGIN');async function rejected(fn){await db.exec('SAVEPOINT denied');try{await assert.rejects(fn);}finally{await db.exec('ROLLBACK TO SAVEPOINT denied');}}try{
 const before=(await db.query("SELECT (SELECT count(*) FROM public.leases) leases,(SELECT count(*) FROM public.lease_payments) payments,(SELECT count(*) FROM public.tnp_manual_payment_events) events")).rows[0];
 await rejected(()=>asUser('tenant',()=>db.query('SELECT public.tnp_archive_account($1)',[ids.tenant])));
 await rejected(()=>db.query('SELECT public.tnp_archive_account($1)',[ids.admin]));
 for(const who of ['tenant','landlord']){
 await db.query('SELECT public.tnp_archive_account($1)',[ids[who]]);
 await db.query('SELECT public.tnp_archive_account($1)',[ids[who]]);
 const profile=(await db.query('SELECT * FROM public.profiles WHERE id=$1',[ids[who]])).rows[0];assert.equal(profile.full_name,'Deleted account');assert.equal(profile.phone,null);assert.equal(profile.bio,null);
 assert.equal((await db.query('SELECT * FROM public.user_roles WHERE user_id=$1',[ids[who]])).rows.length,0);
 await rejected(()=>asUser(who,()=>db.query('SELECT public.tnp_require_active_account()')));
 assert.equal((await asUser(who,()=>db.query('SELECT * FROM public.leases'))).rows.length,0);
 assert.equal((await asUser(who,()=>db.query('SELECT * FROM public.tnp_deleted_accounts'))).rows.length,0);
 }
 const after=(await db.query("SELECT (SELECT count(*) FROM public.leases) leases,(SELECT count(*) FROM public.lease_payments) payments,(SELECT count(*) FROM public.tnp_manual_payment_events) events")).rows[0];assert.deepEqual(after,before);
 assert.equal((await asUser('admin',()=>db.query('SELECT * FROM public.tnp_deleted_accounts'))).rows.length,2);
 assert.equal((await db.query('SELECT * FROM public.properties WHERE owner_id=$1 AND available',[ids.landlord])).rows.length,0);
 assert.equal((await db.query('SELECT * FROM public.tnp_tours WHERE owner_id=$1 AND is_published',[ids.landlord])).rows.length,0);
 }finally{await db.exec('ROLLBACK');}
});
const fixtures={ids};for(const {table_name} of (await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows)fixtures[table_name]=(await db.query('SELECT * FROM public."'+table_name+'"')).rows;
await fs.mkdir(new URL('../.validation/fixtures/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../.validation/fixtures/database.json',import.meta.url),JSON.stringify(fixtures));
console.log('DATABASE VERIFICATION PASS: '+names.length+' migrations; '+groups+' workflow groups; '+contracts.moduleCount+' source contracts. Auth and storage are simulated locally.');await db.close();
