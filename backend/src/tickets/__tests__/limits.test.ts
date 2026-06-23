import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SUPPORT_TICKETS_PER_DAY } from "../limits";

describe("support ticket limits", () => {
  it("allows at most three manual tickets per rolling day", () => {
    assert.equal(SUPPORT_TICKETS_PER_DAY, 3);
  });
});
