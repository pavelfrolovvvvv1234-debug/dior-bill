import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canTransition, assertTransition, SERVICE_LIFECYCLE } from "@dior/shared";

describe("Provisioning FSM contract", () => {
  it("allows PENDING → PROVISIONING", () => {
    assert.equal(canTransition(SERVICE_LIFECYCLE.PENDING, SERVICE_LIFECYCLE.PROVISIONING), true);
  });

  it("rejects ACTIVE → PENDING", () => {
    assert.equal(canTransition(SERVICE_LIFECYCLE.ACTIVE, SERVICE_LIFECYCLE.PENDING), false);
  });

  it("assertTransition throws on invalid", () => {
    assert.throws(() => assertTransition(SERVICE_LIFECYCLE.DELETED, SERVICE_LIFECYCLE.ACTIVE));
  });

  it("allows PROVISIONING → ROLLBACK", () => {
    assert.equal(canTransition(SERVICE_LIFECYCLE.PROVISIONING, SERVICE_LIFECYCLE.ROLLBACK), true);
  });
});
