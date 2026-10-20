import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHostingEnv } from '../scripts/check-hosting-env.mjs';
const valid={VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example'};
test('hosting accepts public Supabase credentials and rejects missing settings',()=>{assert.equal(validateHostingEnv(valid),true);assert.throws(()=>validateHostingEnv({}));});
test('hosting rejects secret and service-role keys in browser settings',()=>{for(const key of ['sb_secret_example','x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.x'])assert.throws(()=>validateHostingEnv({...valid,VITE_SUPABASE_PUBLISHABLE_KEY:key}));});
test('hosting requires the secure Supabase project origin',()=>{for(const url of ['http://test.supabase.co','https://user:password@test.supabase.co','https://test.supabase.co/path'])assert.throws(()=>validateHostingEnv({...valid,VITE_SUPABASE_URL:url}));});
