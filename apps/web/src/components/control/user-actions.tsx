"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ROLES } from "@dior/shared";
import {
  activateUserAction,
  suspendUserAction,
  updateRoleAction,
} from "@/app/actions/control";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Ban,
  CheckCircle2,
  Crown,
  Headphones,
  Loader2,
  Shield,
  ShieldCheck,
  User,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ASSIGNABLE_ROLES = Object.values(ROLES);

type RoleMeta = {
  label: string;
  description: string;
  icon: LucideIcon;
  group: "customer" | "staff";
};

const ROLE_META: Record<string, RoleMeta> = {
  [ROLES.USER]: {
    label: "Customer",
    description: "Standard account access",
    icon: User,
    group: "customer",
  },
  [ROLES.AFFILIATE_VIP]: {
    label: "VIP Affiliate",
    description: "Enhanced referral tier",
    icon: Crown,
    group: "customer",
  },
  [ROLES.SUPPORT]: {
    label: "Support",
    description: "Tickets and user lookup",
    icon: Headphones,
    group: "staff",
  },
  [ROLES.OPERATOR]: {
    label: "Operator",
    description: "Services and provisioning",
    icon: Wrench,
    group: "staff",
  },
  [ROLES.ADMIN]: {
    label: "Admin",
    description: "Full control panel",
    icon: Shield,
    group: "staff",
  },
  [ROLES.SUPER_ADMIN]: {
    label: "Super Admin",
    description: "Unrestricted access",
    icon: ShieldCheck,
    group: "staff",
  },
};

function roleMeta(role: string): RoleMeta {
  return (
    ROLE_META[role] ?? {
      label: role,
      description: "Custom role",
      icon: User,
      group: "customer",
    }
  );
}

function AccountStatusPill({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5",
        active ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-amber-400",
        )}
      />
      <span className="text-xs font-medium">{active ? "Active" : "Suspended"}</span>
    </div>
  );
}

export function UserActions({
  userId,
  status,
  role,
}: {
  userId: string;
  status: string;
  role: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  const safeRole = ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])
    ? role
    : ROLES.USER;

  const current = roleMeta(safeRole);
  const CurrentIcon = current.icon;
  const isActive = status === "ACTIVE";

  const refresh = () => router.refresh();

  const customerRoles = ASSIGNABLE_ROLES.filter((r) => roleMeta(r).group === "customer");
  const staffRoles = ASSIGNABLE_ROLES.filter((r) => roleMeta(r).group === "staff");

  function handleRoleChange(nextRole: string) {
    if (nextRole === safeRole) return;
    start(async () => {
      await updateRoleAction(userId, nextRole);
      refresh();
    });
  }

  function handleActivate() {
    start(async () => {
      await activateUserAction(userId);
      refresh();
    });
  }

  function handleSuspend() {
    start(async () => {
      await suspendUserAction(userId, "Suspended by admin");
      setConfirmSuspend(false);
      refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] p-1.5 shadow-sm backdrop-blur-sm">
      <AccountStatusPill status={status} />

      <div className="hidden h-6 w-px bg-white/10 sm:block" />

      <div className="flex min-w-0 items-center gap-2 px-1">
        <div className="hidden items-center gap-1.5 text-[var(--muted-foreground)] sm:flex">
          <Shield className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Role</span>
        </div>

        <Select value={safeRole} onValueChange={handleRoleChange} disabled={pending}>
          <SelectTrigger
            className={cn(
              "h-9 w-[min(100vw-3rem,13rem)] border-white/10 bg-black/20 text-sm shadow-none",
              "hover:border-white/15 hover:bg-black/30",
              "focus:ring-primary/30",
            )}
          >
            <SelectValue>
              <span className="flex items-center gap-2">
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <CurrentIcon className="h-3.5 w-3.5 text-primary/80" strokeWidth={1.75} />
                )}
                <span className="truncate font-medium">{current.label}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end" className="min-w-[14rem]">
            <SelectGroup>
              <SelectLabel>Customer</SelectLabel>
              {customerRoles.map((r) => {
                const meta = roleMeta(r);
                const Icon = meta.icon;
                return (
                  <SelectItem key={r} value={r} className="py-2.5">
                    <span className="flex items-start gap-2.5">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" strokeWidth={1.75} />
                      <span>
                        <span className="block font-medium">{meta.label}</span>
                        <span className="block text-xs text-muted-foreground">{meta.description}</span>
                      </span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Staff</SelectLabel>
              {staffRoles.map((r) => {
                const meta = roleMeta(r);
                const Icon = meta.icon;
                return (
                  <SelectItem key={r} value={r} className="py-2.5">
                    <span className="flex items-start gap-2.5">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" strokeWidth={1.75} />
                      <span>
                        <span className="block font-medium">{meta.label}</span>
                        <span className="block text-xs text-muted-foreground">{meta.description}</span>
                      </span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="hidden h-6 w-px bg-white/10 sm:block" />

      {isActive ? (
        confirmSuspend ? (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span className="text-xs text-[var(--muted-foreground)]">Suspend account?</span>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              className="h-8 gap-1.5 px-3"
              onClick={handleSuspend}
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
              Confirm
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              className="h-8 px-3 text-[var(--muted-foreground)]"
              onClick={() => setConfirmSuspend(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className={cn(
              "h-9 gap-1.5 border-red-500/25 bg-red-500/5 px-3 text-red-300",
              "hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200",
            )}
            onClick={() => setConfirmSuspend(true)}
          >
            <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />
            Suspend
          </Button>
        )
      ) : (
        <Button
          type="button"
          size="sm"
          disabled={pending}
          className="h-9 gap-1.5 bg-emerald-600/90 px-3 hover:bg-emerald-600"
          onClick={handleActivate}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
          Reactivate
        </Button>
      )}
    </div>
  );
}
