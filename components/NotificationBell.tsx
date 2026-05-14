"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, CheckCircle, XCircle, Clock, X, CheckCheck } from "lucide-react";
import Link from "next/link";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  group: { id: string; name: string };
  settlement?: { id: string; status: string; paymentMethod: string; amountPaise: number } | null;
}

interface Props {
  memberId?: string;
  userId?: string;
}

const TYPE_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  SETTLEMENT_RECORDED: { icon: Clock, color: "text-yellow-400" },
  SETTLEMENT_CONFIRMED: { icon: CheckCircle, color: "text-emerald-400" },
  SETTLEMENT_REJECTED: { icon: XCircle, color: "text-red-400" },
  SETTLEMENT_REMINDER: { icon: Bell, color: "text-orange-400" },
};

export function NotificationBell({ memberId, userId }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    const param = memberId ? `memberId=${memberId}` : userId ? `userId=${userId}` : null;
    if (!param) return;
    try {
      const res = await fetch(`/api/notifications?${param}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silent fail
    }
  }, [memberId, userId]);

  useEffect(() => {
    if (memberId || userId) {
      fetchNotifications();
      // Poll every 30 seconds for new notifications
      const interval = setInterval(fetchNotifications, 30_000);
      return () => clearInterval(interval);
    }
  }, [memberId, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function markAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memberId ? { all: true, memberId } : { all: true, userId }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // silent fail
    }
  }

  async function markRead(ids: string[]) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - ids.length));
    } catch {
      // silent fail
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unreadCount > 0) {
            markAllRead();
          }
        }}
        className="relative p-1.5 hover:bg-white/5 rounded-lg transition-colors text-muted-foreground hover:text-white"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center bg-emerald-500 text-emerald-950 text-[10px] font-bold rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 glass border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="font-display font-semibold text-sm">Notifications</h3>
            <div className="flex items-center gap-1">
              {notifications.some((n) => !n.isRead) && (
                <button
                  onClick={markAllRead}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const meta = TYPE_ICON[n.type] ?? TYPE_ICON.SETTLEMENT_RECORDED;
                const Icon = meta.icon;
                return (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors cursor-pointer ${
                      !n.isRead ? "bg-emerald-500/3" : ""
                    }`}
                    onClick={() => {
                      if (!n.isRead) markRead([n.id]);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 ${meta.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-white truncate">{n.title}</p>
                          {!n.isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground/50">
                            {new Date(n.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <Link
                            href={`/groups/${n.group.id}?tab=settlements`}
                            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                            onClick={() => setOpen(false)}
                          >
                            View →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
