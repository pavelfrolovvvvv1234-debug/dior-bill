import { redirect } from "next/navigation";

export default function CdnRedirect() {
  redirect("/plans?tab=cdn");
}
