import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile} from 'node:fs/promises';
const run=promisify(execFile);
const project='kjtkwujuevbzcydbjscq';
const origin='https://tnp-app-alpha.vercel.app';
const cli=process.env.LOCALAPPDATA+'/npm-cache/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-windows-x64/bin/supabase.exe';
const {stdout}=await run(cli,['projects','api-keys','--project-ref',project,'--output','json'],{timeout:120000});
const key=JSON.parse(stdout).find(k=>k.name==='service_role')?.api_key;
if(!key)throw Error('Project administrator credential unavailable');
const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
const api='https://'+project+'.supabase.co/auth/v1';
const results=[];
for(const redirect of [null,origin+'/auth']){
 let id;
 try{
 const response=await fetch(api+'/admin/generate_link',{method:'POST',headers,body:JSON.stringify({type:'signup',email:'tnp-confirmation-test-'+crypto.randomUUID()+'@example.invalid',password:crypto.randomUUID()+'Aa1!',...(redirect?{redirect_to:redirect}:{})})});
 const data=await response.json();
 if(!response.ok)throw Error('Unable to generate synthetic confirmation link: '+response.status);
 id=data.id||data.user?.id;
 assert.ok(id,'Synthetic test account must have an ID');
 const link=data.action_link||data.properties?.action_link;
 assert.ok(link,'Confirmation link missing');
 const target=new URL(link).searchParams.get('redirect_to');
 assert.equal(new URL(target).origin,origin);
 if(redirect)assert.equal(target,redirect);
 const verification=await fetch(link,{redirect:'manual'});
 assert.ok([302,303].includes(verification.status),'Confirmation must redirect');
 const destination=new URL(verification.headers.get('location'));
 assert.equal(destination.origin,origin);
 assert.equal(new URLSearchParams(destination.hash.slice(1)).has('error'),false,'Confirmation must not return an error');
 const userResponse=await fetch(api+'/admin/users/'+id,{headers});
 const user=await userResponse.json();
 assert.ok(user.email_confirmed_at,'Synthetic email must be confirmed');
 results.push({flow:redirect?'signup redirect':'default Site URL',destination:destination.origin+destination.pathname,emailConfirmed:true});
 console.log('CONFIRMATION PASS: '+results.at(-1).flow+' -> '+results.at(-1).destination);
 }finally{
 if(id){const cleanup=await fetch(api+'/admin/users/'+id,{method:'DELETE',headers,body:JSON.stringify({should_soft_delete:false})});if(!cleanup.ok)throw Error('Synthetic account cleanup failed');}
 }
}
const report={checkedAt:new Date().toISOString(),project,results,emailsSent:false,existingAccountsModified:false};
await writeFile(new URL('../docs/email-confirmation-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
