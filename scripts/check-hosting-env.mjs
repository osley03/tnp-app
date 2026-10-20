import { pathToFileURL } from 'node:url';
export function validateHostingEnv(env) {
 const url=env.VITE_SUPABASE_URL;
 const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before building.');
 let parsed;try{parsed=new URL(url);}catch{throw new Error('Supabase URL is invalid.');}
 if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.search || parsed.hash || !['','/'].includes(parsed.pathname))throw new Error('Use the HTTPS Supabase project URL.');
 if(key.startsWith('sb_secret_'))throw new Error('A secret key must never be used in browser environment variables.');
 if(!key.startsWith('sb_publishable_')) {
  let payload;try{payload=JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url'));}catch{throw new Error('Use a Supabase publishable key or legacy anon key.');}
  if(payload.role!=='anon')throw new Error('Only a public anon or publishable key may be used for the frontend.');
 }
 return true;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){validateHostingEnv(process.env);console.log('Hosting environment check passed; no credentials printed.');}
