import { redirect } from "next/navigation";

export default function DedicatedRedirect() {
  redirect("/plans?tab=dedicated");
}
