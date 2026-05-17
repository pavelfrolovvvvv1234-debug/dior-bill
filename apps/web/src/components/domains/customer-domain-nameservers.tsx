"use client";

import {
  refreshDomainNameserversAction,
  updateDomainNameserversAction,
} from "@/app/actions/domains";
import { DomainNameserversForm } from "./domain-nameservers-form";

type Props = {
  domainId: string;
  initial: string[];
  amperConfigured: boolean;
};

export function CustomerDomainNameservers({
  domainId,
  initial,
  amperConfigured,
}: Props) {
  return (
    <DomainNameserversForm
      initial={initial}
      amperConfigured={amperConfigured}
      onSave={(nameservers) =>
        updateDomainNameserversAction(domainId, nameservers).then(() => undefined)
      }
      onRefresh={
        amperConfigured
          ? () => refreshDomainNameserversAction(domainId)
          : undefined
      }
    />
  );
}
