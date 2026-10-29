import test from "node:test";
import assert from "node:assert/strict";
import { normalizeScamCase, scamDate } from "../src/lib/scam-case-data.ts";
test("historical reports with empty fields can be searched and displayed", () => {
  const row = normalizeScamCase({
    id: "case-1",
    title: null,
    description: null,
    status: null,
    evidence: null,
  });
  assert.ok(row.title.toLowerCase());
  assert.equal(typeof row.description, "string");
  assert.deepEqual(row.evidence, []);
  assert.equal(row.status, "submitted");
});
test("invalid dates never crash the investigation panel", () => {
  for (const date of [null, undefined, "not-a-date", ""])
    assert.equal(scamDate(date), "—");
  assert.notEqual(scamDate("2026-10-28T08:00:00Z"), "—");
});
test("mixed or serialized evidence preserves readable evidence without React objects", () => {
  const row = normalizeScamCase({
    id: "case",
    evidence: [{ name: "Receipt", reference: "ABC" }, "Bank receipt", null],
  });
  assert.ok(row.evidence.every((item) => typeof item === "string"));
  assert.match(row.evidence[0], /Receipt/);
  assert.deepEqual(
    normalizeScamCase({ id: "a", evidence: '["receipt"]' }).evidence,
    ["receipt"],
  );
});
test("records without an identity are not actionable cases", () => {
  assert.equal(normalizeScamCase(null), null);
  assert.equal(normalizeScamCase({ title: "Missing ID" }), null);
});
