import test from 'node:test';
import assert from 'node:assert/strict';
import {nextRentDate} from '../src/lib/rent-schedule.ts';
test('rent due today stays visible until the end of that calendar day',()=>{
 assert.equal(nextRentDate('2026-01-01',19,new Date(2026,9,19,23,59)),'2026-10-19');
 assert.equal(nextRentDate('2026-01-01',19,new Date(2026,9,20,0,1)),'2026-11-19');
});
test('scheduled rent never precedes the tenancy or follows its end',()=>{
 assert.equal(nextRentDate('2026-12-15',1,new Date(2026,9,19)),'2027-01-01');
 assert.equal(nextRentDate('2026-01-01',1,new Date(2026,9,19),'2026-10-31'),null);
 assert.equal(nextRentDate(null,1),null);
 assert.equal(nextRentDate('invalid',1),null);
});
