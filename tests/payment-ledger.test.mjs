import test from "node:test";
import assert from "node:assert/strict";
import {
  paymentReceivedAt,
  paymentPeriod,
  paymentDate,
  isSettledPayment,
} from "../src/modules/payments/ledger.ts";
const base = {
  id: "one",
  lease_id: "lease",
  payer_id: "tenant",
  payee_id: "landlord",
  payment_type: "rent",
  amount_usd: 450,
  status: "pending",
  reference: "TNP-PAY-one",
  paid_at: null,
  released_at: null,
  created_at: "2026-10-16T10:00:00Z",
};
test("unpaid requests never use their creation date as the date paid", () => {
  assert.equal(paymentReceivedAt(base), null);
  assert.equal(paymentDate(paymentReceivedAt(base)), "Not recorded");
  assert.equal(isSettledPayment("pending"), false);
  assert.equal(isSettledPayment("held"), false);
});
test("rent months and one-off deposits are clearly distinguished from unknown historical periods", () => {
  assert.match(paymentPeriod({ ...base, period_start: "2026-10-01" }), /October.*2026/);
  assert.equal(paymentPeriod({ ...base, payment_type: "deposit" }), "One-off deposit");
  assert.equal(paymentPeriod(base), "Period not recorded");
});
test("provider paid and externally released records retain their actual recorded dates", () => {
  assert.equal(
    paymentReceivedAt({ ...base, status: "paid", paid_at: "2026-10-16T12:00:00Z" }),
    "2026-10-16T12:00:00Z",
  );
  assert.equal(
    paymentReceivedAt({ ...base, status: "released", released_at: "2026-10-17T12:00:00Z" }),
    "2026-10-17T12:00:00Z",
  );
  assert.equal(isSettledPayment("paid"), true);
  assert.equal(isSettledPayment("refunded"), false);
});
