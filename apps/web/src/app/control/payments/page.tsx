import { redirect } from "next/navigation";
import { controlPath } from "@/lib/control-paths";

export default async function PaymentsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  redirect(`${controlPath("/billing/top-ups")}${suffix}`);
}
