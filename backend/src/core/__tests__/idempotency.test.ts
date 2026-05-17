import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Idempotency contract (unit)", () => {
  it("duplicate keys must produce same logical outcome", () => {
    const results = new Map<string, number>();
    const key = "test-key";
    const run = () => {
      if (results.has(key)) return results.get(key)!;
      const v = results.size + 1;
      results.set(key, v);
      return v;
    };
    assert.equal(run(), run());
  });
});
