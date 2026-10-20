import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePaynow, field, signPaynow, verifyPaynow, moneyCents, paynowUrl, paymentState } from '../supabase/functions/_shared/paynow.ts';

const key = '3e9fed89-60e1-4ce5-ab6e-6b1eb2d4f977';
test('Paynow inbound signature matches the official documented test vector', async () => {
  const result = parsePaynow('status=Ok&browserurl=https%3a%2f%2fstaging.paynow.co.zw%2fPayment%2fConfirmPayment%2f9510&pollurl=https%3a%2f%2fstaging.paynow.co.zw%2fInterface%2fCheckPayment%2f%3fguid%3dc7ed41da-0159-46da-b428-69549f770413&paynowreference=9510&hash=750DD0B0DF374678707BB5AF915AF81C228B9058AD57BB7120569EC68BBB9C2EFC1B26C6375D2BC562AC909B3CD6B2AF1D42E1A5E479FFAC8F4FB3FDCE71DF4D');
  await verifyPaynow(result, key);
  assert.equal(field(result, 'paynowreference'), '9510');
});
test('altered amounts, missing signatures and duplicate provider fields are rejected', async () => {
  const original = [['reference','TNP-demo'], ['amount','500.00'], ['status','Paid']];
  const hash = await signPaynow(original, key);
  await verifyPaynow([...original, ['hash', hash]], key);
  await assert.rejects(() => verifyPaynow([['reference','TNP-demo'], ['amount','5.00'], ['status','Paid'], ['hash',hash]], key));
  await assert.rejects(() => verifyPaynow(original, key));
  assert.throws(() => parsePaynow('amount=1&Amount=500&hash=x'));
});
test('amounts use exact cents and reject fractional-cent or nonnumeric requests', () => {
  assert.equal(moneyCents('500.01'),50001); assert.equal(moneyCents('0.10'),10);
  for (const value of ['1.001','-1','0','NaN','Infinity','1e3','1000000.01']) assert.throws(() => moneyCents(value));
});
test('provider URLs cannot redirect checkout or polling to other hosts', () => {
  assert.equal(paynowUrl('https://www.paynow.co.zw/Payment/ConfirmPayment/123','checkout'),'https://www.paynow.co.zw/Payment/ConfirmPayment/123');
  assert.ok(paynowUrl('https://www.paynow.co.zw/Interface/CheckPayment/?guid=abc','poll'));
  for (const value of ['http://www.paynow.co.zw/Payment/123','https://www.paynow.co.zw.evil.test/Payment/123','https://user@www.paynow.co.zw/Payment/123','https://127.0.0.1/Payment/123','https://www.paynow.co.zw:444/Payment/123']) assert.throws(() => paynowUrl(value,'checkout'));
  assert.throws(() => paynowUrl('https://www.paynow.co.zw/other?guid=abc','poll'));
});
test('only known provider states are mapped; paid does not mean landlord settlement', () => {
  assert.equal(paymentState('Created'),'pending'); assert.equal(paymentState('Paid'),'paid');
  assert.equal(paymentState('Awaiting Delivery'),'paid'); assert.equal(paymentState('Disputed'),'disputed');
  assert.equal(paymentState('Refunded'),'refunded'); assert.equal(paymentState('Cancelled'),'cancelled');
  assert.throws(() => paymentState('success=true'));
});
