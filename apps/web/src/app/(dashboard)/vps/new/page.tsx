import { redirect } from "next/navigation";

export default function VpsNewRedirect() {
  redirect("/plans?tab=bulletproof-vps");
}
