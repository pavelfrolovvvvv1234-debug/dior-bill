import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeBalanceCredit,
  computeOrderDiscount,
  isPromoRedemptionConflict,
} from "../promo-redeem";

describe("promo-redeem", () => {
  it("computes fixed balance credit", () => {
    assert.equal(
      computeBalanceCredit({ discountType: "fixed", discountValue: 25 }),
      25,
    );
  });

  it("rejects percent codes for balance credit", () => {
    assert.throws(
      () => computeBalanceCredit({ discountType: "percent", discountValue: 10 }),
      /checkout/i,
    );
  });

  it("computes percent order discount", () => {
    assert.equal(
      computeOrderDiscount({ discountType: "percent", discountValue: 10 }, 50),
      5,
    );
  });

  it("rejects fixed codes for order discount", () => {
    assert.throws(
      () => computeOrderDiscount({ discountType: "fixed", discountValue: 5 }, 50),
      /balance/i,
    );
  });

  it("detects promo redemption unique conflicts", () => {
    assert.equal(isPromoRedemptionConflict({ code: "P2002" }), true);
    assert.equal(isPromoRedemptionConflict(new Error("nope")), false);
  });
});
