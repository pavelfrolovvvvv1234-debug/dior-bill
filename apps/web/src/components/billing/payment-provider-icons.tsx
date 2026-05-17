import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import type { TopUpProviderId } from "@dior/shared";

type IconProps = { className?: string };

function HeleketIcon({ className }: IconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/providers/heleket.png"
      alt=""
      width={40}
      height={40}
      draggable={false}
      decoding="async"
      aria-hidden
      className={cn("object-cover", className)}
    />
  );
}

function CryptoBotIcon({ className }: IconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/providers/cryptobot.png"
      alt=""
      width={40}
      height={40}
      draggable={false}
      decoding="async"
      aria-hidden
      className={cn("object-cover", className)}
    />
  );
}

function CrystalPayIcon({ className }: IconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/providers/crystalpay.png"
      alt=""
      width={40}
      height={40}
      draggable={false}
      decoding="async"
      aria-hidden
      className={cn("object-cover", className)}
    />
  );
}

function ManualTransferIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <rect width="40" height="40" rx="10" fill="url(#manual-bg)" />
      <path
        d="M11 26V17l9-5 9 5v9"
        stroke="#E2E8F0"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M15 21h10M15 24h6" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="28" cy="14" r="5" fill="#10B981" fillOpacity="0.2" stroke="#34D399" strokeWidth="1.2" />
      <path
        d="M26.5 14.2 27.8 15.5 29.8 13.2"
        stroke="#6EE7B7"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 29h-2.5a1.5 1.5 0 0 1-1.5-1.5v-1"
        stroke="#CBD5E1"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="manual-bg" x1="8" y1="8" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E293B" />
          <stop offset="1" stopColor="#334155" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const ICONS: Record<TopUpProviderId, ComponentType<IconProps>> = {
  HELEKET: HeleketIcon,
  CRYPTOBOT: CryptoBotIcon,
  CRYSTALPAY: CrystalPayIcon,
  MANUAL_TRANSFER: ManualTransferIcon,
};

export function PaymentProviderIcon({
  id,
  className,
}: {
  id: TopUpProviderId;
  className?: string;
}) {
  const Icon = ICONS[id];
  if (!Icon) return null;

  return (
    <Icon
      className={cn(
        "h-10 w-10 shrink-0 rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.25)]",
        className,
      )}
    />
  );
}
