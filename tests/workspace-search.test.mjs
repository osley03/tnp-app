import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSearch, normalizeSearch } from '../src/lib/workspace-search.ts';
test('search tolerates casing, extra spaces, accents and missing fields',()=>{assert.equal(normalizeSearch('  HARARÉ   flat  '),'harare flat');assert.equal(matchesSearch('  HARARE  ',null,'Hararé',undefined),true);});
test('search matches words across property and landlord fields in either order',()=>{assert.equal(matchesSearch('Alice harare','Garden flat','Harare','Alice Moyo'),true);assert.equal(matchesSearch('harare alice','Garden flat','Harare','Alice Moyo'),true);assert.equal(matchesSearch('alice bulawayo','Harare','Alice Moyo'),false);});
test('clearing search restores every record while unmatched searches return none',()=>{const rows=['Garden flat','City apartment'];assert.deepEqual(rows.filter(row=>matchesSearch('   ',row)),rows);assert.deepEqual(rows.filter(row=>matchesSearch('not-a-listing',row)),[]);});
test('module finder searches labels and safely handles numeric references',()=>{const modules=['My Applications','Payments & Receipts','360° Tour Manager'];assert.deepEqual(modules.filter(label=>matchesSearch('tour 360',label)),['360° Tour Manager']);assert.equal(matchesSearch('123',123),true);});
