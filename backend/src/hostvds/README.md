# HostVDS (Standard VPS) — ops checklist

Bulletproof / Proxmox is a separate path. This module is **only** for Standard VPS.

## Env (minimal)

```env
HOSTVDS_AUTH_URL=https://os-api.hostvds.com/identity/v3
HOSTVDS_USERNAME=…
HOSTVDS_PASSWORD=…
HOSTVDS_PROJECT_NAME=…
HOSTVDS_REGION_NAME=eu-west2
HOSTVDS_NETWORK_ID=Internet-03
HOSTVDS_SECURITY_GROUPS=allow_all
```

Maps default to **names** (`hostvds-1`, `Ubuntu-24.04-amd64`). Do **not** paste UUIDs from another region.

## Acceptance

- [ ] Keystone auth OK; region `eu-west2` has compute/image/network
- [ ] Flavors/images/networks resolve by name
- [ ] Create → ACTIVE → IPv4 → TCP/22 open
- [ ] SSH `root` + password from Access panel
- [ ] Mid-fail → orphan VM deleted + wallet refund
- [ ] Panel delete removes OpenStack server
- [ ] Bulletproof / Proxmox unchanged
- [ ] Create is never retried (only wait/GET/SSH when `externalId` exists)

## Hard rules

1. Resolve flavor/image/network by **name** in the active region.
2. Always send **cloud-init user_data** + `security_groups: allow_all`.
3. `adminPass` alone is not enough on Ubuntu cloud images.
4. Create server **once**; recover via metadata `dior_vps_id` if needed.
