import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calcHostVdsSellPrice,
  hostVdsMarkupMultiplier,
  DEFAULT_HOSTVDS_COST_EUR,
} from "../pricing";

describe("hostvds pricing markup", () => {
  it("applies tiered multipliers", () => {
    assert.equal(hostVdsMarkupMultiplier(0.99), 2.2);
    assert.equal(hostVdsMarkupMultiplier(3.99), 2.0);
    assert.equal(hostVdsMarkupMultiplier(19.99), 1.5);
    assert.equal(hostVdsMarkupMultiplier(5), 1.7);
  });

  it("matches handoff sell prices at EUR_USD=1", () => {
    assert.equal(calcHostVdsSellPrice(0.99, 1), 2);
    assert.equal(calcHostVdsSellPrice(3.99, 1), 8);
    assert.equal(calcHostVdsSellPrice(19.99, 1), 30);
    assert.equal(calcHostVdsSellPrice(39.99, 1), 60);
    assert.equal(calcHostVdsSellPrice(79.99, 1), 120);
    assert.equal(calcHostVdsSellPrice(119.99, 1), 180);
  });

  it("has default costs for std-1..std-10", () => {
    for (let i = 1; i <= 10; i++) {
      assert.ok(DEFAULT_HOSTVDS_COST_EUR[`std-${i}`] != null);
    }
  });
});
