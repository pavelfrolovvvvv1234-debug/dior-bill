import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pickNextFreeInSubnet,
  shouldReuseReleasedRegistryRow,
} from "../shared-ip-registry-logic.js";

const TEST_NET = {
  prefix: "45.74.7",
  cidr: 24,
  gateway: "45.74.7.1",
  startHost: 175,
  endHost: 180,
};

describe("shared-ip-registry", () => {
  describe("pickNextFreeInSubnet", () => {
    it("skips gateway and occupied hosts", () => {
      const occupied = new Set(["45.74.7.1", "45.74.7.175", "45.74.7.176"]);
      assert.equal(pickNextFreeInSubnet(TEST_NET, occupied), "45.74.7.177");
    });

    it("returns null when subnet slice is full", () => {
      const occupied = new Set([
        "45.74.7.175",
        "45.74.7.176",
        "45.74.7.177",
        "45.74.7.178",
        "45.74.7.179",
        "45.74.7.180",
      ]);
      assert.equal(pickNextFreeInSubnet(TEST_NET, occupied), null);
    });
  });

  describe("released IP reuse", () => {
    it("reuses released rows via UPDATE not INSERT", () => {
      assert.equal(shouldReuseReleasedRegistryRow({ status: "released" }), true);
      assert.equal(shouldReuseReleasedRegistryRow({ status: "active" }), false);
      assert.equal(shouldReuseReleasedRegistryRow({ status: "reserved" }), false);
      assert.equal(shouldReuseReleasedRegistryRow(null), false);
    });

    it("documents reserve → activate → release → reserve flow", () => {
      type Row = { ip: string; status: string; vmid: number | null };
      let row: Row | null = null;

      // reserve
      row = { ip: "45.74.7.177", status: "reserved", vmid: null };
      assert.equal(row.status, "reserved");

      // activate
      row = { ...row, status: "active", vmid: 999 };
      assert.equal(row.status, "active");

      // release
      row = { ...row, status: "released", vmid: null };
      assert.equal(shouldReuseReleasedRegistryRow(row), true);

      // reserve same IP again (reuse)
      row = { ...row, status: "reserved", vmid: null };
      assert.equal(row.ip, "45.74.7.177");
      assert.equal(row.status, "reserved");
    });
  });
});
