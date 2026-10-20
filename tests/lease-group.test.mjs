import test from 'node:test';
import assert from 'node:assert/strict';
import {leaseGroup} from '../src/lib/lease-group.ts';
test('approval-created leases stay upcoming until administration activates them',()=>{
 for(const status of ['draft','requested','pending_approval','approved'])assert.equal(leaseGroup({status}),'upcoming');
 assert.equal(leaseGroup({status:'active'}),'active');
});
test('completed and terminated leases remain past even without an end date',()=>{
 for(const status of ['completed','terminated','cancelled','closed'])assert.equal(leaseGroup({status}),'past');
 assert.equal(leaseGroup({status:'disputed'}),'active');
});
