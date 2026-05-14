"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Banknote,
  Building2,
  Smartphone,
  CreditCard,
  MoreHorizontal,
  ExternalLink,
} from "lucide-react";
import { formatCurrencyShort } from "@/lib/money";
import { toast } from "@/components/ui/use-toast";

interface Member {
  id: string;
  name: string;
}

interface Settlement {
  id: string;
  amountPaise: number;
  paymentMethod: string;
  paymentReference?: string | null;
  proofUrl?: string | null;
  note?: string | null;
  status: string;
  confirmedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  fromMember: Member;
  toMember: Member;
}

interface Props {
  groupId: string;
  currency: string;
  currentMemberId?: string;
  onSettlementUpdated: () => void;
}

const METHOD_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  CASH: { label: "Cash", icon: Banknote, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  BANK_TRANSFER: { label: "Bank Transfer", icon: Building2, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  UPI: { label: "UPI", icon: Smartphone, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  CARD: { label: "Card", icon: CreditCard, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  OTHER: { label: "Other", icon: MoreHorizontal, color: "text-gray-400 bg-gray-500/10 border-gray-500/20" },
};

const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  PENDING_CONFIRMATION: {
    label: "Pending",
    icon: Clock,
    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  },
  CONFIRMED: {
    label: "Confirmed",
    icon: CheckCircle,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    color: "text-red-400 bg-red-500/10 border-red-500/20",
  },
};

export function SettlementsTab({ groupId, currency, currentMemberId, onSettlementUpdated }: Props) {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  async function fetchSettlements() {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/settlements`);
      const data = await res.json();
      setSettlements(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettlements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function handleAction(settlementId: string, action: "confirm" | "reject") {
    if (!currentMemberId) return;
    setActing(settlementId + action);
    try {
      const res = await fetch(`/api/groups/${groupId}/settlements/${settlementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, actorMemberId: currentMemberId }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }

      toast({
        title: action === "confirm" ? "Settlement confirmed" : "Settlement rejected",
        description:
          action === "confirm"
            ? "Balance has been updated."
            : "The payer has been notified.",
      });

      await fetchSettlements();
      onSettlementUpdated();
    } catch {
      toast({ title: "Error", description: "Failed to update settlement", variant: "destructive" });
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (settlements.length === 0) {
    return (
      <div className="glass rounded-xl py-16 text-center">
        <CheckCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium mb-1">No settlements yet</p>
        <p className="text-sm text-muted-foreground">Settled payments will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {settlements.map((s) => {
        const methodMeta = METHOD_META[s.paymentMethod] ?? METHOD_META.OTHER;
        const statusMeta = STATUS_META[s.status] ?? STATUS_META.PENDING_CONFIRMATION;
        const MethodIcon = methodMeta.icon;
        const StatusIcon = statusMeta.icon;
        const isReceiver = s.toMember.id === currentMemberId;
        const isPending = s.status === "PENDING_CONFIRMATION";
        const canActOnIt = isReceiver && isPending;

        return (
          <div
            key={s.id}
            className={`glass rounded-xl p-4 border ${
              isPending && isReceiver
                ? "border-yellow-500/20"
                : "border-white/5"
            }`}
          >
            {/* Top row: payer → receiver + amount */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium text-sm truncate">
                  {s.fromMember.id === currentMemberId ? "You" : s.fromMember.name}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium text-sm truncate text-emerald-400">
                  {s.toMember.id === currentMemberId ? "You" : s.toMember.name}
                </span>
              </div>
              <span className="font-mono font-bold text-sm shrink-0">
                {formatCurrencyShort(s.amountPaise, currency)}
              </span>
            </div>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {/* Payment method badge */}
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg border ${methodMeta.color}`}
              >
                <MethodIcon className="w-3 h-3" />
                {methodMeta.label}
              </span>
              {/* Status badge */}
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg border ${statusMeta.color}`}
              >
                <StatusIcon className="w-3 h-3" />
                {statusMeta.label}
              </span>
              {/* Reference */}
              {s.paymentReference && (
                <span className="text-xs text-muted-foreground bg-white/5 border border-white/8 px-2 py-0.5 rounded-lg font-mono">
                  Ref: {s.paymentReference}
                </span>
              )}
              {/* Proof link */}
              {s.proofUrl && (
                <a
                  href={s.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Proof
                </a>
              )}
            </div>

            {/* Note */}
            {s.note && (
              <p className="text-xs text-muted-foreground mb-3 bg-white/3 rounded-lg px-3 py-2 border border-white/5">
                {s.note}
              </p>
            )}

            {/* Date */}
            <p className="text-xs text-muted-foreground/50 mb-3">
              {new Date(s.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {s.confirmedAt && (
                <> · Confirmed {new Date(s.confirmedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</>
              )}
              {s.rejectedAt && (
                <> · Rejected {new Date(s.rejectedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</>
              )}
            </p>

            {/* Confirm / Reject buttons for receiver */}
            {canActOnIt && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(s.id, "confirm")}
                  disabled={acting !== null}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {acting === s.id + "confirm" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  Confirm
                </button>
                <button
                  onClick={() => handleAction(s.id, "reject")}
                  disabled={acting !== null}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {acting === s.id + "reject" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
