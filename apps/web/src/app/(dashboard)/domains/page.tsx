import { redirect } from "next/navigation";

export default function DomainsRedirect() {
  redirect("/plans?tab=bulletproof-domains");
}
