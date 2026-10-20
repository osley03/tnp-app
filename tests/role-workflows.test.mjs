import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveRole,requiredRole,roleHome} from '../src/lib/roles.ts';
import {applicationStatus} from '../src/lib/application-status.ts';
test('roles come from assigned database rows with deterministic multi-role priority',()=>{
 assert.equal(resolveRole([]),null);assert.equal(resolveRole([{role:'support'}]),null);
 assert.equal(resolveRole([{role:'tenant'},{role:'admin'}]),'admin');
 assert.equal(resolveRole([{role:'tenant'},{role:'landlord'}]),'landlord');
 assert.equal(resolveRole([{role:'landlord'},{role:'admin'}]),'admin');
});
test('all role modules and applicant vetting map to the correct access boundary',()=>{
 for(const role of ['tenant','landlord','admin']){
  assert.equal(requiredRole('/app/'+role+'/properties'),role);
  assert.equal(requiredRole('/app/'+role),role);
  assert.equal(roleHome(role),'/app/'+role);
 }
 assert.equal(requiredRole('/app/applicant/request-id'),'landlord');
 assert.equal(requiredRole('/app/tenant-other'),null);
 assert.equal(requiredRole('/app/settings'),null);
 assert.equal(requiredRole('/tours/tour-id'),null);
});
test('application states agree across legacy and current tenant/landlord records',()=>{
 for(const value of ['pending','Pending review','pending_review','submitted','under_review','under review'])assert.equal(applicationStatus(value),'Pending review');
 for(const value of ['Approved','approved','accepted'])assert.equal(applicationStatus(value),'Approved');
 for(const value of ['Rejected','Declined'])assert.equal(applicationStatus(value),'Rejected');
 for(const value of ['withdrawn','Cancelled'])assert.equal(applicationStatus(value),'Withdrawn');
 assert.equal(applicationStatus('Custom status'),'Custom status');
});

import {validateProperty} from '../src/lib/property-validation.ts';
const listing=()=>({title:'Garden flat',city:'Harare',suburb:'Avondale',rent_usd:'500',deposit_usd:'500',price_usd:'',beds:'2',baths:'1',rooms:'3',size:'100.5',listing_type:'For Rent',image_url:'https://example.com/house.jpg'});
test('property forms reject invalid numbers, fractional rooms and unsafe image links',()=>{
 assert.equal(validateProperty(listing()),null);
 for(const rent of ['NaN','Infinity','-1','0'])assert.ok(validateProperty({...listing(),rent_usd:rent}));
 assert.ok(validateProperty({...listing(),beds:'1.5'}));
 assert.ok(validateProperty({...listing(),suburb:''}));
 assert.ok(validateProperty({...listing(),image_url:'javascript:alert(1)'}));
 assert.ok(validateProperty({...listing(),image_url:'https://user:pass@example.com/image.jpg'}));
 assert.equal(validateProperty({...listing(),listing_type:'For Sale',rent_usd:'',price_usd:'100000'}),null);
});

import {paymentTotals} from '../src/lib/payment-totals.ts';
test('current escrow totals exclude pending requests and historical holds after release',()=>{
 assert.deepEqual(paymentTotals([{status:'pending',amount_usd:500},{status:'held',amount_usd:'200'},{status:'released',amount_usd:300},{status:'refunded',amount_usd:100},{status:'disputed',amount_usd:50},{status:'held',amount_usd:'NaN'}]),{paid:500,held:200,released:300,refunded:100,pending:500,disputed:50});
 assert.equal(paymentTotals([{status:'released',amount_usd:500}]).held,0);
});
