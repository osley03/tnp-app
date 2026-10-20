import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePaymentSetup } from '../supabase/functions/_shared/payment-config.ts';
const input=process.argv[2];
if(!input) { console.error('Usage: npm run payments:check-config -- C:/private/tnp-payments.env'); process.exitCode=1; }
else {
 try {
  const file=path.resolve(input),root=fileURLToPath(new URL('../',import.meta.url));
  const relative=path.relative(root,file);
  if(relative===''||(!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))) throw new Error('Keep payment credentials outside the application folder.');
  const allowed=new Set(['TNP_APP_URL','PAYMENT_GATEWAY_ENABLED','PAYNOW_LIVE_ENABLED','PAYNOW_LANDLORD_MERCHANTS']);
  const env={};
  for(const line of (await fs.readFile(file,'utf8')).split(/\r?\n/)) {
   if(!line.trim()||line.trim().startsWith('#'))continue;
   const at=line.indexOf('=');if(at<1)throw new Error('Expected NAME=value on each configuration line');
   const name=line.slice(0,at).trim();if(!allowed.has(name))throw new Error('Only the four payment settings belong in this file');
   if(Object.hasOwn(env,name))throw new Error('Duplicate payment setting');
   let value=line.slice(at+1).trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
   env[name]=value;
  }
  console.log(JSON.stringify({configurationValid:true,...validatePaymentSetup(env)}));
  console.log('No secrets printed or uploaded. This checks configuration only, not Paynow approval or settlement.');
 } catch(error) { console.error(error.code?'Configuration file could not be read.':error.message);process.exitCode=1; }
}
