import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzePassword,
  isValidRegistrationEmail,
  validateRegistrationEmail,
  validateRegistrationPassword,
} from "../auth-validation";
import { assertCustomerEmailAllowed } from "../staff-privacy";

describe("auth-validation", () => {
  it("accepts valid domain emails", () => {
    assert.equal(isValidRegistrationEmail("user@company.com"), true);
    assert.equal(isValidRegistrationEmail("  Name@Mail.Example.COM "), true);
  });

  it("rejects garbage emails", () => {
    assert.equal(isValidRegistrationEmail(""), false);
    assert.equal(isValidRegistrationEmail("notanemail"), false);
    assert.equal(isValidRegistrationEmail("user@"), false);
    assert.equal(isValidRegistrationEmail("@domain.com"), false);
    assert.equal(isValidRegistrationEmail("user@localhost"), false);
    assert.equal(isValidRegistrationEmail("user@gmail"), false);
    assert.equal(isValidRegistrationEmail("a@b.c"), false);
  });

  it("requires strong enough passwords", () => {
    assert.throws(() => validateRegistrationPassword("short"), /at least 8/i);
    assert.throws(() => validateRegistrationPassword("alllowercase1"), /uppercase/i);
    assert.doesNotThrow(() => validateRegistrationPassword("SecurePass1"));
  });

  it("scores password strength progressively", () => {
    const weak = analyzePassword("abc");
    const good = analyzePassword("SecurePass1!");
    assert.equal(weak.strongEnough, false);
    assert.equal(good.strongEnough, true);
    assert.ok(good.score > weak.score);
  });

  it("normalizes email on validate", () => {
    assert.equal(validateRegistrationEmail("  User@Example.com "), "user@example.com");
  });

  it("blocks reserved staff emails for customers", () => {
    assert.throws(() => assertCustomerEmailAllowed("admin@dior.cloud"), /cannot be used/i);
    assert.throws(() => assertCustomerEmailAllowed("  Admin@Dior.Cloud "), /cannot be used/i);
    assert.doesNotThrow(() => assertCustomerEmailAllowed("user@gmail.com"));
  });
});
