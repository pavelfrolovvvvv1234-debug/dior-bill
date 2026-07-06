import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encrypt } from "../../lib/crypto.js";
import { assessVpsCredentialFields, resolveVpsLoginUser } from "../vps-access.js";

describe("assessVpsCredentialFields", () => {
  const base = {
    hostname: "test-vps",
    os: "debian-12",
    primaryIp: "45.74.7.175",
    proxmoxVmid: 200,
    rootPasswordEnc: "iv:tag:cipher",
    service: { status: "ACTIVE" },
    node: null,
  };

  it("flags missing IP and password", () => {
    const { errors } = assessVpsCredentialFields({
      ...base,
      primaryIp: null,
      rootPasswordEnc: null,
      proxmoxVmid: null,
    });
    assert.ok(errors.some((e) => e.includes("primaryIp")));
    assert.ok(errors.some((e) => e.includes("proxmoxVmid")));
    assert.ok(errors.some((e) => e.includes("rootPasswordEnc")));
  });

  it("flags placeholder demo IPs", () => {
    const { errors } = assessVpsCredentialFields({
      ...base,
      primaryIp: "185.234.10.24",
    });
    assert.ok(errors.some((e) => e.includes("placeholder")));
  });

  it("accepts routable IP when password decrypts", () => {
    const { errors } = assessVpsCredentialFields({
      ...base,
      rootPasswordEnc: encrypt("TestPass123!A1"),
    });
    assert.equal(errors.length, 0);
  });

  it("uses ubuntu login for Ubuntu cloud images", () => {
    assert.equal(resolveVpsLoginUser("ubuntu-24.04"), "ubuntu");
    assert.equal(resolveVpsLoginUser("debian-12"), "root");
  });
});
