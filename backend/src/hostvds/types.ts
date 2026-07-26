export type HostVdsServerStatus =
  | "BUILD"
  | "ACTIVE"
  | "ERROR"
  | "SHUTOFF"
  | "REBOOT"
  | "HARD_REBOOT"
  | "REBUILD"
  | "DELETED"
  | "UNKNOWN"
  | string;

export type HostVdsServer = {
  id: string;
  name: string;
  status: HostVdsServerStatus;
  addresses: string[];
  adminPass?: string;
  metadata?: Record<string, string>;
};

export type HostVdsCreateServerInput = {
  name: string;
  imageRef: string;
  flavorRef: string;
  networkId: string;
  adminPass: string;
  /** base64 cloud-init — required for Ubuntu cloud root password */
  userData: string;
  securityGroups?: string[];
  metadata?: Record<string, string>;
};
