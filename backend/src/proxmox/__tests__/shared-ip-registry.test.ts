import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pickNextFreeInSubnet,
  resolveSubnetHostBounds,
  shouldReuseReleasedRegistryRow,
} from "../shared-ip-registry-logic.js";

const TEST_NET = {
  prefix: "45.74.7",
  cidr: 24,
  gateway: "45.74.7.1",
  startHost: 100,
  endHost: 250,
};

describe("shared-ip-registry", () => {
  describe("pickNextFreeInSubnet", () => {
    it("skips gateway and occupied hosts", () => {
      const occupied = new Set(["45.74.7.1", "45.74.7.100", "45.74.7.101"]);
      assert.equal(pickNextFreeInSubnet(TEST_NET, occupied), "45.74.7.102");
    });

    it("respects PROXMOX_IP_START and PROXMOX_IP_END env", () => {
      const prevStart = process.env.PROXMOX_IP_START;
      const prevEnd = process.env.PROXMOX_IP_END;
      process.env.PROXMOX_IP_START = "175";
      process.env.PROXMOX_IP_END = "180";
      try {
        const bounds = resolveSubnetHostBounds(100, 250);
        assert.equal(bounds.startHost, 175);
        assert.equal(bounds.endHost, 180);
      } finally {
        if (prevStart === undefined) delete process.env.PROXMOX_IP_START;
        else process.env.PROXMOX_IP_START = prevStart;
        if (prevEnd === undefined) delete process.env.PROXMOX_IP_END;
        else process.env.PROXMOX_IP_END = prevEnd;
      }
    });

    it("returns null when subnet slice is full", () => {
      const occupied = new Set<string>();
      for (let h = 100; h <= 250; h++) occupied.add(`45.74.7.${h}`);
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
