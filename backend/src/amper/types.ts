export type AmperApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string;
    details?: unknown;
  };
};

export type AmperApiSuccess<T> = {
  success: true;
  data: T;
};

export type AmperAccount = {
  user_id: number;
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  balance: number;
  created_at: string;
};

export type AmperTldPrice = {
  tld: string;
  price: number;
  is_active: boolean;
};

export type AmperDomainSearchResult = {
  domain: string;
  available: boolean;
  premium: boolean;
  price: number;
  tld: string;
};

export type AmperDomainSearchResponse = {
  query: string;
  results: AmperDomainSearchResult[];
};

export type AmperDomainRecord = {
  domain: string;
  status?: string;
  expires_at?: string;
  nameservers?: string[];
  [key: string]: unknown;
};

export type AmperDnsRecord = {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
};
