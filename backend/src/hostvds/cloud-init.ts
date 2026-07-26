/**
 * Cloud-init must set root password — Nova adminPass alone does NOT work on Ubuntu cloud images.
 */
export function buildHostVdsCloudInitUserData(password: string): string {
  // Password must be alphanumeric (generateHostVdsPassword) — still escape single quotes defensively.
  const safe = password.replace(/'/g, "''");
  const yaml = `#cloud-config
ssh_pwauth: true
disable_root: false
chpasswd:
  expire: false
  users:
    - name: root
      password: '${safe}'
      type: text
users:
  - name: root
    lock_passwd: false
    ssh_pwauth: true
write_files:
  - path: /etc/ssh/sshd_config.d/99-billing.conf
    permissions: '0644'
    content: |
      PermitRootLogin yes
      PasswordAuthentication yes
      KbdInteractiveAuthentication yes
runcmd:
  - bash -lc "echo 'root:${safe}' | chpasswd"
  - bash -lc "systemctl restart sshd 2>/dev/null || systemctl restart ssh 2>/dev/null || true"
`;
  return Buffer.from(yaml, "utf8").toString("base64");
}
