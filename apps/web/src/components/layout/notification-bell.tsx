"use client";

import { useCallback, useEffect, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FastLink } from "@/components/ui/fast-link";
import {
  getNotificationsPreviewAction,
  getUnreadNotificationsCountAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  link: string | null;
  createdAt: Date | string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const count = await getUnreadNotificationsCountAction();
      setUnreadCount(count);
    } catch {
      /* ignore */
    }
  }, []);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotificationsPreviewAction();
      setItems(data.items as NotificationItem[]);
      setUnreadCount(data.unreadCount);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    if (open) loadPreview();
  }, [open, loadPreview]);

  async function handleItemClick(item: NotificationItem) {
    if (!item.read) {
      await markNotificationReadAction(item.id);
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) return;
    await markAllNotificationsReadAction();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 hover:bg-white/5"
          aria-label="Уведомления"
        >
          <Bell className="h-4 w-4" strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 w-80 origin-top-right rounded-lg border border-border bg-card text-card-foreground shadow-float",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex h-10 items-center justify-between gap-2 border-b border-border px-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Уведомления
            </p>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => void handleMarkAllRead()}
                    className="text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Прочитать все
                  </button>
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {unreadCount} новых
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="scroll-dior h-72 overflow-y-auto p-1">
            {loading ? (
              <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Загрузка…
              </p>
            ) : items.length === 0 ? (
              <p className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                Нет уведомлений
              </p>
            ) : (
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const inner = (
                    <>
                      <div className="flex items-start gap-2">
                        {!item.read && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                        <div className={cn("min-w-0 flex-1", item.read && "pl-3.5")}>
                          <p className="truncate text-xs font-medium leading-snug">{item.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                            {item.body}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground/80">
                            {formatRelative(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    </>
                  );

                  return (
                    <li key={item.id}>
                      {item.link ? (
                        <DropdownMenu.Item asChild>
                          <FastLink
                            href={item.link}
                            onClick={() => handleItemClick(item)}
                            className={cn(
                              "block cursor-pointer rounded-md px-2.5 py-2 outline-none transition-premium",
                              "hover:bg-accent focus:bg-accent",
                              !item.read && "bg-primary/10",
                            )}
                          >
                            {inner}
                          </FastLink>
                        </DropdownMenu.Item>
                      ) : (
                        <DropdownMenu.Item
                          className={cn(
                            "cursor-pointer rounded-md px-2.5 py-2 outline-none transition-premium",
                            "hover:bg-accent focus:bg-accent",
                            !item.read && "bg-primary/10",
                          )}
                          onSelect={() => handleItemClick(item)}
                        >
                          {inner}
                        </DropdownMenu.Item>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border p-1.5">
            <DropdownMenu.Item asChild>
              <FastLink
                href="/notifications"
                className="flex h-8 w-full items-center justify-center rounded-md bg-primary text-xs font-medium text-primary-foreground outline-none transition-premium hover:bg-primary/90"
                onClick={() => setOpen(false)}
              >
                Все уведомления
              </FastLink>
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
