export type AmperDnsDomain = {
  id: string;
  name: string;
  status?: string;
  nameservers?: string[];
  ns?: string[];
  sslMode?: string;
  ssl_mode?: string;
  activated?: boolean;
  verified?: boolean;
  [key: string]: unknown;
};

export type AmperDnsRecord = {
  id?: string;
  type: string;
  name: string;
  content?: string;
  value?: string;
  ttl?: number;
  priority?: number;
  proxied?: boolean;
  [key: string]: unknown;
};

export type AmperDnsSslStatus = {
  status?: string;
  state?: string;
  mode?: string;
  issuer?: string;
  expiresAt?: string;
  expires_at?: string;
  message?: string;
  [key: string]: unknown;
};
