import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as paynow from '../supabase/functions/_shared/paynow.ts';
import * as paymentConfig from '../supabase/functions/_shared/payment-config.ts';
const tenant='11111111-1111-4111-8111-111111111111', landlord='22222222-2222-4222-8222-222222222222';
const paymentId='33333333-3333-4333-8333-333333333333', attemptId='44444444-4444-4444-8444-444444444444';
const key='merchant-secret-key-for-unit-tests';
const checkoutUrl='https://www.paynow.co.zw/Payment/ConfirmPayment/123';
const pollUrl='https://www.paynow.co.zw/Interface/CheckPayment/?guid=abc';
async function signed(fields) { return new URLSearchParams([...fields,['hash',await paynow.signPaynow(fields,key)]]).toString(); }
function edge(options={}) {
  let handler; const calls=[];
  const payment={id:paymentId,lease_id:'lease',payer_id:options.otherPayer?'another-user':tenant,payee_id:landlord,amount_usd:500,payment_type:'rent',status:'pending'};
  const attempt={id:attemptId,payment_id:paymentId,landlord_id:landlord,payer_id:tenant,integration_id:'12345',mode:options.live?'live':'test',currency:'USD',amount_usd:500,
    merchant_reference:'TNP-'+attemptId,method:'ecocash',status:'pending',poll_url:pollUrl,browser_url:checkoutUrl,provider_reference:'123'};
  const admin={
    auth:{getUser:async()=>({data:{user:options.noUser?null:{id:tenant,email:'tenant@example.test'}}})},
    from(table) {
      let update=null;
      const query={select(){return query;},eq(){return query;},or(){return query;},order(){return query;},limit(){return query;},
        update(values){update=values;calls.push({kind:'update',table,values});return query;},
        maybeSingle:async()=>({data:options.closedAccount?{account_id:tenant}:null,error:null}),
        single:async()=>({data:table==='lease_payments'?payment:table==='tnp_gateway_attempts'?{...attempt,...update}:null,error:null}),
        then(resolve,reject){return Promise.resolve({data:table==='tnp_gateway_attempts'?[attempt]:[{role:'landlord'}],error:null}).then(resolve,reject);}
      }; return query;
    },
    rpc:async(name,args)=>{calls.push({kind:'rpc',name,args});
      if(name==='tnp_reserve_gateway_payment')return{data:{...attempt,status:options.duplicate?'pending':'creating',claim_token:options.duplicate?'other-claim':args.p_claim_token},error:null};
      return{data:{id:'evidence',payment_status:paynow.paymentState(args.p_provider_status)},error:null};
    }
  };
  const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'secret',TNP_APP_URL:options.appUrl||'https://tnp.example',PAYMENT_GATEWAY_ENABLED:options.disabled?'false':'true',PAYNOW_LIVE_ENABLED:options.liveEnabled?'true':'false',
    PAYNOW_LANDLORD_MERCHANTS:JSON.stringify(options.noMerchant?{}:{[landlord]:{integrationId:'12345',integrationKey:key,currency:'USD',mode:options.live?'live':'test',testEmail:'merchant@example.test'}})};
  let source=fs.readFileSync(new URL('../supabase/functions/payment-gateway/index.ts',import.meta.url),'utf8').replace(/^import[^;]+;\s*/gm,'');
  source='const {createClient,field,moneyCents,parsePaynow,paymentState,paynowUrl,signPaynow,verifyPaynow,paymentAppOrigin,paymentMerchant}=globalThis.__deps;\n'+source;
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,{
    Deno:{serve:value=>{handler=value;},env:{get:name=>env[name]}},__deps:{createClient:()=>admin,...paynow,...paymentConfig},
    Request,Response,URL,URLSearchParams,AbortSignal,crypto,TextEncoder,console,
    fetch:async(url,init)=>{calls.push({kind:'fetch',url,body:init.body?.toString()});
      if(url.includes('initiatetransaction'))return new Response(await signed([['status','Ok'],['browserurl',checkoutUrl],['pollurl',pollUrl],['paynowreference','123']]));
      assert.equal(url,pollUrl);
      return new Response(await signed([['reference','TNP-'+attemptId],['amount',options.wrongAmount?'5.00':'500.00'],['paynowreference','123'],['pollurl',pollUrl],['status',options.pollStatus||'Paid']]));
    }
  }); return{handler,calls};
}
function request(body,token=true,url='https://project.supabase.co/functions/v1/payment-gateway') {
  return new Request(url,{method:'POST',headers:token?{authorization:'Bearer tenant-token'}:{},body:typeof body==='string'?body:JSON.stringify({paymentId,...body})});
}
test('checkout uses the saved amount and landlord merchant, ignoring client overrides',async()=>{
  const {handler,calls}=edge();const response=await handler(request({action:'checkout',method:'ecocash',amount:1,landlordId:'attacker'}));
  assert.equal(response.status,200);assert.equal((await response.json()).checkoutUrl,checkoutUrl);
  const outgoing=paynow.parsePaynow(calls.find(call=>call.kind==='fetch').body);await paynow.verifyPaynow(outgoing,key);
  assert.equal(paynow.field(outgoing,'amount'),'500.00');assert.equal(paynow.field(outgoing,'id'),'12345');
  assert.ok(paynow.field(outgoing,'resulturl').includes('attempt='+attemptId));
});
test('unconfigured landlord, unverified user, foreign payment and disabled live checkout cannot charge',async()=>{
  for(const options of [{noMerchant:true},{noUser:true},{otherPayer:true},{disabled:true},{live:true},{live:true,liveEnabled:true,appUrl:"http://localhost:3000"}]){
    const {handler,calls}=edge(options);const response=await handler(request({action:'checkout',method:'mastercard'}));
    assert.ok(response.status>=400);assert.equal(calls.some(call=>call.kind==='fetch'),false);
  }
});
test('duplicate checkout resumes the existing transaction without another provider request',async()=>{
  const {handler,calls}=edge({duplicate:true});const response=await handler(request({action:'checkout',method:'ecocash'}));
  assert.equal(response.status,200);assert.equal((await response.json()).checkoutUrl,checkoutUrl);
  assert.equal(calls.some(call=>call.kind==='fetch'),false);
});
test('forged callbacks cannot update the ledger or trigger provider polling',async()=>{
  const {handler,calls}=edge();const response=await handler(request('reference=TNP-'+attemptId+'&amount=500.00&status=Paid&hash=BAD',false,'https://project.supabase.co/functions/v1/payment-gateway?attempt='+attemptId));
  assert.equal(response.status,400);assert.equal(calls.some(call=>call.kind==='fetch'||call.name==='tnp_confirm_gateway_payment'),false);
});
test('a signed callback claiming paid still uses the current polled provider status',async()=>{
  const {handler,calls}=edge({pollStatus:'Created'});
  const body=await signed([['reference','TNP-'+attemptId],['amount','500.00'],['status','Paid'],['pollurl','https://evil.test/steal']]);
  assert.equal((await handler(request(body,false,'https://project.supabase.co/functions/v1/payment-gateway?attempt='+attemptId))).status,200);
  assert.equal(calls.find(call=>call.kind==='fetch').url,pollUrl);
  assert.equal(calls.find(call=>call.name==='tnp_confirm_gateway_payment').args.p_provider_status,'Created');
});
test('a signed provider response with the wrong amount is rejected before confirmation',async()=>{
  const {handler,calls}=edge({wrongAmount:true});assert.equal((await handler(request({action:'verify'}))).status,400);
  assert.equal(calls.some(call=>call.name==='tnp_confirm_gateway_payment'),false);
});

test('enabled live merchant uses the public return address and tenant email',async()=>{
 const {handler,calls}=edge({live:true,liveEnabled:true});
 const response=await handler(request({action:'checkout',method:'mastercard'}));
 assert.equal(response.status,200);assert.equal((await response.json()).mode,'live');
 const outgoing=paynow.parsePaynow(calls.find(call=>call.kind==='fetch').body);
 assert.equal(paynow.field(outgoing,'authemail'),'tenant@example.test');
 assert.equal(new URL(paynow.field(outgoing,'returnurl')).origin,'https://tnp.example');
});
test('pausing checkout still permits provider verification of existing attempts',async()=>{
 const {handler,calls}=edge({disabled:true});
 assert.equal((await handler(request({action:'verify'}))).status,200);
 assert.equal(calls.find(call=>call.kind==='fetch').url,pollUrl);
 assert.equal(calls.some(call=>call.name==='tnp_confirm_gateway_payment'),true);
});

test('closed account cannot start checkout or poll as a tenant',async()=>{const {handler,calls}=edge({closedAccount:true});const response=await handler(request({action:'checkout',method:'ecocash'}));assert.equal(response.status,403);assert.equal(calls.filter(c=>c.kind==='fetch').length,0);});
