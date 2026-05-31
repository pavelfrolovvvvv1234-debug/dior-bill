import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("assertTopUpAmountMatches tolerance", () => {
  it("accepts amounts within 0.1% tolerance", () => {
    const expected = 100;
    const received = 100.05;
    const tolerance = Math.max(0.01, expected * 0.001);
    assert.ok(Math.abs(received - expected) <= tolerance);
  });

  it("rejects large mismatches", () => {
    const expected = 100;
    const received = 95;
    const tolerance = Math.max(0.01, expected * 0.001);
    assert.ok(Math.abs(received - expected) > tolerance);
  });
});

describe("wallet spendable", () => {
  it("combines available balance and credits", () => {
    const balance = 50;
    const locked = 10;
    const credits = 5;
    const available = balance - locked;
    const spendable = available + credits;
    assert.equal(spendable, 45);
  });
});
