"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useTransition, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type FastLinkProps = ComponentProps<typeof Link> & {
  prefetchOnHover?: boolean;
};

/**
 * Link with hover prefetch + instant pending feedback (no perceived lag on click).
 */
export function FastLink({
  href,
  prefetch = true,
  prefetchOnHover = true,
  onClick,
  className,
  children,
  ...props
}: FastLinkProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const hrefStr =
    typeof href === "string"
      ? href
      : typeof href === "object" && href !== null && "pathname" in href
        ? String(href.pathname ?? "")
        : "";

  const doPrefetch = useCallback(() => {
    if (!prefetchOnHover || !hrefStr.startsWith("/")) return;
    router.prefetch(hrefStr);
  }, [router, hrefStr, prefetchOnHover]);

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onMouseEnter={doPrefetch}
      onFocus={doPrefetch}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const target = e.currentTarget.getAttribute("target");
        if (target && target !== "_self") return;
        startTransition(() => {});
      }}
      className={cn(
        pending && "opacity-80",
        className,
      )}
      style={{ touchAction: "manipulation" }}
      {...props}
    >
      {children}
    </Link>
  );
}
