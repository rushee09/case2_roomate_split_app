"use client";

import { useEffect, useState } from "react";
import {
  UserPlus,
  Receipt,
  CheckCircle,
  PlusCircle,
  Trash2,
  Loader2,
  Edit2,
  RefreshCw,
  XCircle,
  Clock,
} from "lucide-react";
import { formatCurrencyShort } from "@/lib/money";

interface ActivityItem {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}

interface Props {
  groupId: string;
  currency: string;
}

export function ActivityTab({ groupId, currency }: Props) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/activity`)
      .then((r) => r.json())
      .then((data) => setActivities(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="glass rounded-xl py-16 text-center">
        <p className="text-muted-foreground text-sm">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[19px] top-0 bottom-0 w-px bg-white/5" />

      <div className="space-y-3">
        {activities.map((a) => {
          const { icon: Icon, color, bg, label } = getActivityMeta(a.type);
          const timeStr = new Date(a.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div key={a.id} className="flex gap-4 relative">
              <div
                className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0 z-10`}
              >
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="flex-1 glass rounded-xl px-4 py-3">
                <p className="text-sm font-medium">{label(a.data, currency)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{timeStr}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ActivityData = Record<string, unknown>;

function getActivityMeta(type: string): {
  icon: React.ElementType;
  color: string;
  bg: string;
  label: (data: ActivityData, currency: string) => string;
} {
  switch (type) {
    case "GROUP_CREATED":
      return {
        icon: PlusCircle,
        color: "text-emerald-400",
        bg: "bg-emerald-500/15",
        label: (d) => `Group "${d.groupName as string}" was created`,
      };
    case "MEMBER_ADDED":
      return {
        icon: UserPlus,
        color: "text-blue-400",
        bg: "bg-blue-500/15",
        label: (d) =>
          `${d.memberName as string} ${d.joinedViaInvite ? "joined via invite" : "was added"}`,
      };
    case "EXPENSE_ADDED":
      return {
        icon: Receipt,
        color: "text-purple-400",
        bg: "bg-purple-500/15",
        label: (d, currency) =>
          `${d.paidByName as string} added "${d.title as string}" · ${formatCurrencyShort(
            d.amountPaise as number,
            currency
          )}${d.isRecurring ? " (recurring)" : ""}`,
      };
    case "EXPENSE_EDITED":
      return {
        icon: Edit2,
        color: "text-yellow-400",
        bg: "bg-yellow-500/15",
        label: (d) => `Expense "${d.title as string}" was edited`,
      };
    case "EXPENSE_DELETED":
      return {
        icon: Trash2,
        color: "text-red-400",
        bg: "bg-red-500/15",
        label: (d, currency) =>
          `Expense "${d.title as string}" (${formatCurrencyShort(
            d.amountPaise as number,
            currency
          )}) was deleted`,
      };
    case "SETTLEMENT_RECORDED":
      return {
        icon: Clock,
        color: "text-yellow-400",
        bg: "bg-yellow-500/15",
        label: (d, currency) => {
          const method = d.paymentMethod as string | undefined;
          const methodLabel = method ? ` via ${formatMethod(method)}` : "";
          return `${d.fromMemberName as string} recorded a payment of ${formatCurrencyShort(d.amountPaise as number, currency)} to ${d.toMemberName as string}${methodLabel}. Awaiting confirmation.`;
        },
      };
    case "SETTLEMENT_COMPLETED":
      return {
        icon: CheckCircle,
        color: "text-emerald-400",
        bg: "bg-emerald-500/15",
        label: (d, currency) =>
          `${d.fromMemberName as string} paid ${d.toMemberName as string} ${formatCurrencyShort(
            d.amountPaise as number,
            currency
          )}`,
      };
    case "SETTLEMENT_CONFIRMED":
      return {
        icon: CheckCircle,
        color: "text-emerald-400",
        bg: "bg-emerald-500/15",
        label: (d) => (d.message as string) ?? `Settlement confirmed`,
      };
    case "SETTLEMENT_REJECTED":
      return {
        icon: XCircle,
        color: "text-red-400",
        bg: "bg-red-500/15",
        label: (d) => (d.message as string) ?? `Settlement rejected`,
      };
    case "RECURRING_GENERATED":
      return {
        icon: RefreshCw,
        color: "text-cyan-400",
        bg: "bg-cyan-500/15",
        label: (d) => `Recurring expense "${d.title as string}" was generated`,
      };
    default:
      return {
        icon: PlusCircle,
        color: "text-muted-foreground",
        bg: "bg-white/5",
        label: () => type,
      };
  }
}

function formatMethod(method: string): string {
  const map: Record<string, string> = {
    CASH: "Cash",
    BANK_TRANSFER: "Bank Transfer",
    UPI: "UPI",
    CARD: "Card",
    OTHER: "Other",
  };
  return map[method] ?? method;
}
