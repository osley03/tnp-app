import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
await fs.mkdir(path.join(root,'.validation/results'),{recursive:true});
const checks=[...(process.argv.includes('--browser-only')?[]:[['project',['scripts/verify-project.mjs']]]),['role-browser',['scripts/verify-browser.mjs','--production','--chrome']],['payment-browser',['scripts/verify-payment-journey.mjs']],['tenant-browser',['scripts/verify-tenant-modules.mjs']]];
const results=[];
for(const [name,args] of checks){
 const log=await fs.open(path.join(root,'.validation/results',name+'.log'),'w');
 const code=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:root,stdio:['ignore',log.fd,log.fd],windowsHide:true});child.on('error',()=>resolve(-1));child.on('exit',resolve);});
 await log.close();results.push({check:name,passed:code===0,exitCode:code});console.log(name,code===0?'PASS':'FAIL');
 const report={date:new Date().toISOString(),scope:'Local application and synthetic browser tests. No live payment or hosted deployment is certified.',passed:results.every(result=>result.passed),results};
 const target=path.join(root,'docs/workflow-verification.json');await fs.writeFile(target+'.writing',JSON.stringify(report,null,2));await fs.rename(target+'.writing',target);
 if(code!==0){process.exitCode=1;break;}
}
