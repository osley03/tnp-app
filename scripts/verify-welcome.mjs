import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const root=new URL('../',import.meta.url);const require=createRequire(new URL('../.validation/package.json',import.meta.url));const {chromium}=require('playwright');
const server=spawn(process.execPath,['.output/server/index.mjs'],{cwd:root,env:{...process.env,PORT:'4186',HOST:'127.0.0.1'},stdio:'ignore',windowsHide:true});
let browser;const results=[];
try{
 for(let i=0;i<120;i++){try{if((await fetch('http://127.0.0.1:4186/health',{signal:AbortSignal.timeout(2000)})).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 const context=await browser.newContext({viewport});const page=await context.newPage();
 await page.goto('http://127.0.0.1:4186/',{waitUntil:'networkidle'});
 await page.locator('.tnp-welcome-backdrop').evaluate(img=>img.decode());
 if(!await page.getByRole('heading',{level:1}).isVisible())throw Error('Welcome heading missing');
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow');
 await fs.mkdir(new URL('../docs/previews/',import.meta.url),{recursive:true});
 await page.screenshot({path:fileURLToPath(new URL('../docs/previews/welcome-'+label+'.png',import.meta.url)),fullPage:true});
 await page.getByRole('link',{name:'Continue',exact:true}).click({noWaitAfter:true});
 await page.waitForURL('**/auth?mode=signup');
 await page.getByRole('button',{name:'Tenant',exact:true}).waitFor();await page.getByRole('button',{name:'Landlord',exact:true}).waitFor();
 await page.goto('http://127.0.0.1:4186/');await page.getByRole('link',{name:'Sign in',exact:true}).click({noWaitAfter:true});await page.waitForURL('**/auth?mode=signin');
 if(await page.getByRole('button',{name:'Tenant',exact:true}).count())throw Error('Sign-in displayed signup role selector');
 results.push({viewport:label,welcome:true,signup:true,signin:true,overflow:false});await context.close();
 }
 await fs.writeFile(new URL('../docs/welcome-verification.json',import.meta.url),JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify(results));
}finally{await browser?.close();server.kill();}
