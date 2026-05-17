"use client";

import {
  adminRefreshDomainNameserversAction,
  adminUpdateDomainNameserversAction,
} from "@/app/actions/control";
import { DomainNameserversForm } from "@/components/domains/domain-nameservers-form";

type Props = {
  serviceId: string;
  initial: string[];
  amperConfigured: boolean;
};

export function AdminDomainNameservers({
  serviceId,
  initial,
  amperConfigured,
}: Props) {
  return (
    <DomainNameserversForm
      initial={initial}
      amperConfigured={amperConfigured}
      onSave={(nameservers) =>
        adminUpdateDomainNameserversAction(serviceId, nameservers).then(() => undefined)
      }
      onRefresh={
        amperConfigured
          ? () => adminRefreshDomainNameserversAction(serviceId)
          : undefined
      }
    />
  );
}
