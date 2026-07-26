import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calcHostVdsSellPrice,
  hostVdsMarkupMultiplier,
  DEFAULT_HOSTVDS_COST_EUR,
  resolveHostVdsSellPrice,
} from "../pricing";

describe("hostvds pricing markup", () => {
  it("applies tiered multipliers on base amount", () => {
    assert.equal(hostVdsMarkupMultiplier(1.99), 2.2);
    assert.equal(hostVdsMarkupMultiplier(2), 2.0);
    assert.equal(hostVdsMarkupMultiplier(4), 2.0);
    assert.equal(hostVdsMarkupMultiplier(8), 1.7);
    assert.equal(hostVdsMarkupMultiplier(10), 1.5);
    assert.equal(hostVdsMarkupMultiplier(30), 1.5);
  });

  it("marks up 2,4,8… ladder to sell prices", () => {
    assert.equal(calcHostVdsSellPrice(2, 1), 4);
    assert.equal(calcHostVdsSellPrice(4, 1), 8);
    assert.equal(calcHostVdsSellPrice(8, 1), 14);
    assert.equal(calcHostVdsSellPrice(30, 1), 45);
    assert.equal(calcHostVdsSellPrice(45, 1), 68);
    assert.equal(calcHostVdsSellPrice(60, 1), 90);
    assert.equal(calcHostVdsSellPrice(75, 1), 113);
    assert.equal(calcHostVdsSellPrice(120, 1), 180);
    assert.equal(calcHostVdsSellPrice(150, 1), 225);
    assert.equal(calcHostVdsSellPrice(180, 1), 270);
  });

  it("has unique sell prices for std-1..std-10", () => {
    const prices: number[] = [];
    for (let i = 1; i <= 10; i++) {
      const id = `std-${i}`;
      assert.ok(DEFAULT_HOSTVDS_COST_EUR[id] != null, id);
      const sell = resolveHostVdsSellPrice(id);
      assert.ok(sell != null && sell > 0, id);
      prices.push(sell!);
    }
    assert.equal(new Set(prices).size, prices.length, `duplicate prices: ${prices.join(",")}`);
  });
});
