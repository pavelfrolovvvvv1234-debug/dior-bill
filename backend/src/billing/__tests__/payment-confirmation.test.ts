import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapWebhookToConfirmationStatus } from "../../core/billing/payment-confirmation";

describe("mapWebhookToConfirmationStatus", () => {
  it("maps paid webhooks directly to confirmed", () => {
    assert.equal(
      mapWebhookToConfirmationStatus(
        { externalId: "1", status: "paid", raw: {} },
        "CRYPTOBOT",
      ),
      "confirmed",
    );
  });

  it("maps failed and expired statuses", () => {
    assert.equal(
      mapWebhookToConfirmationStatus(
        { externalId: "1", status: "failed", raw: {} },
        "HELEKET",
      ),
      "failed",
    );
    assert.equal(
      mapWebhookToConfirmationStatus(
        { externalId: "1", status: "expired", raw: {} },
        "CRYSTALPAY",
      ),
      "expired",
    );
  });
});
