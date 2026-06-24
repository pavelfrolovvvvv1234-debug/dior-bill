"use client";

import { createTicketAction } from "@/app/actions/support";
import { TicketPriorityPicker } from "@/components/support/ticket-priority-picker";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/store";

export function NewTicketForm() {
  const { t } = useI18n();

  return (
    <SettingsPanel title={t("support.describeIssue")}>
      <form action={createTicketAction} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="subject" className="text-sm font-medium">
            {t("support.subject")}
          </label>
          <Input
            id="subject"
            name="subject"
            required
            placeholder={t("support.subjectPlaceholder")}
          />
        </div>

        <TicketPriorityPicker />

        <div className="space-y-2">
          <label htmlFor="body" className="text-sm font-medium">
            {t("support.message")}
          </label>
          <textarea
            id="body"
            name="body"
            required
            rows={6}
            placeholder={t("support.messagePlaceholder")}
            className="flex w-full rounded-md border border-white/8 bg-white/[0.03] px-3 py-2 text-sm focus-glow"
          />
        </div>

        <Button type="submit" className="w-full">
          {t("support.submitTicket")}
        </Button>
      </form>
    </SettingsPanel>
  );
}
