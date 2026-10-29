import test from "node:test";
import assert from "node:assert/strict";
import {
  registrationNotice,
  TNP_EMAIL_REDIRECT,
} from "../src/lib/registration-notice.ts";
test("duplicate signup does not promise a new account or email delivery", () => {
  const message = registrationNotice({
    session: null,
    user: { identities: [] },
  });
  assert.match(message, /already exist/);
  assert.doesNotMatch(
    message,
    /Account created|email sent|Check your email to confirm/,
  );
});
test("new or ambiguous responses use conditional verification wording", () => {
  for (const user of [{ identities: [{ id: "test" }] }, null, undefined]) {
    const message = registrationNotice({ session: null, user });
    assert.match(message, /if this email is eligible/);
    assert.doesNotMatch(message, /Account created|email sent/);
  }
});
test("authenticated signup does not need inbox instructions", () =>
  assert.equal(registrationNotice({ session: { user: { id: "test" } } }), ""));
test("confirmation stays on the TNP domain", () =>
  assert.equal(TNP_EMAIL_REDIRECT, "https://tnp-app-alpha.vercel.app/auth"));
