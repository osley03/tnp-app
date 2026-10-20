import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentAppOrigin,validatePaymentSetup} from '../supabase/functions/_shared/payment-config.ts';
const landlord='22222222-2222-4222-8222-222222222222';
const merchant={integrationId:'12345',integrationKey:'unit-test-only-secret',currency:'USD',mode:'live'};
const config={TNP_APP_URL:'https://tnp.example',PAYMENT_GATEWAY_ENABLED:'true',PAYNOW_LIVE_ENABLED:'true',PAYNOW_LANDLORD_MERCHANTS:JSON.stringify({[landlord]:merchant})};
test('live checkout requires a public HTTPS origin without embedded credentials or paths',()=>{
 assert.equal(paymentAppOrigin('https://tnp.example/','live'),'https://tnp.example');
 for(const url of ['http://localhost:3000','https://localhost','https://127.0.0.1','https://192.168.1.10','https://[::1]','https://tnp.local','https://tnp.example/path','https://user:pass@tnp.example','https://tnp.example?next=x'])assert.throws(()=>paymentAppOrigin(url,'live'));
 assert.equal(paymentAppOrigin('http://localhost:3000','test'),'http://localhost:3000');
});
test('live setup validates enable flags, currency and distinct receiving landlords',()=>{
 assert.deepEqual(validatePaymentSetup(config),{liveMerchants:1,testMerchants:0,checkoutEnabled:true,liveEnabled:true});
 for(const override of [{PAYNOW_LANDLORD_MERCHANTS:'{}'},{PAYMENT_GATEWAY_ENABLED:'false'},{PAYNOW_LANDLORD_MERCHANTS:'[]'},{PAYNOW_LANDLORD_MERCHANTS:JSON.stringify({[landlord]:{...merchant,currency:'ZWG'}})},{PAYNOW_LANDLORD_MERCHANTS:JSON.stringify({[landlord]:merchant,'33333333-3333-4333-8333-333333333333':merchant})}])assert.throws(()=>validatePaymentSetup({...config,...override}));
});
