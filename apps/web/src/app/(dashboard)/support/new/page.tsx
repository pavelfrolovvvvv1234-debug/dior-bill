import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/enterprise/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { Panel } from "@/components/ui/enterprise/panel";
import { createTicketAction } from "@/app/actions/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function NewSupportTicketPage() {
  await requireSession();

  return (
    <>
      <PageHeader
        title="New ticket"
        description="Contact infrastructure support"
        breadcrumbs={[
          { label: "Support", href: "/support" },
          { label: "New ticket" },
        ]}
      />
      <PageContainer className="max-w-2xl">
        <Panel title="Describe your issue">
          <form action={createTicketAction} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="subject" className="text-sm font-medium">
                Subject
              </label>
              <Input id="subject" name="subject" required placeholder="Brief summary" />
            </div>
            <div className="space-y-2">
              <label htmlFor="body" className="text-sm font-medium">
                Message
              </label>
              <textarea
                id="body"
                name="body"
                required
                rows={6}
                placeholder="Include IPs, service IDs, and steps to reproduce…"
                className="flex w-full rounded-md border border-white/8 bg-white/[0.03] px-3 py-2 text-sm focus-glow"
              />
            </div>
            <Button type="submit" className="w-full">
              Submit ticket
            </Button>
          </form>
        </Panel>
      </PageContainer>
    </>
  );
}
