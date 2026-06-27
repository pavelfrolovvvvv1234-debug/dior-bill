import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  encodeInvoiceBillingAction,
  parseInvoiceBillingAction,
} from "../invoice-actions";

describe("invoice billing action codec", () => {
  it("round-trips renewal actions", () => {
    const action = { type: "renewal" as const, serviceId: "svc_123" };
    const notes = encodeInvoiceBillingAction(action);
    assert.deepEqual(parseInvoiceBillingAction(notes), action);
  });

  it("round-trips upgrade actions", () => {
    const action = {
      type: "upgrade" as const,
      vpsId: "vps_abc",
      cpuCores: 4,
      ramMb: 8192,
      diskGb: 80,
      monthlyPrice: 65,
      planLabel: "Elite 1",
    };
    const notes = encodeInvoiceBillingAction(action);
    assert.deepEqual(parseInvoiceBillingAction(notes), action);
  });

  it("ignores unrelated invoice notes", () => {
    assert.equal(parseInvoiceBillingAction(null), null);
    assert.equal(parseInvoiceBillingAction("manual invoice"), null);
    assert.equal(parseInvoiceBillingAction("@@billing:{bad json"), null);
  });
});
