"use client";

import { useState } from "react";
import { X, Loader2, ArrowRight, Banknote, Building2, Smartphone, CreditCard, MoreHorizontal } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatCurrencyShort } from "@/lib/money";

type PaymentMethod = "CASH" | "BANK_TRANSFER" | "UPI" | "CARD" | "OTHER";

interface SettlementSuggestion {
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amountPaise: number;
}

interface Props {
  groupId: string;
  currency: string;
  suggestion: SettlementSuggestion;
  onClose: () => void;
  onSettled: () => void;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "BANK_TRANSFER", label: "Bank Transfer", icon: Building2 },
  { value: "UPI", label: "UPI", icon: Smartphone },
  { value: "CARD", label: "Card", icon: CreditCard },
  { value: "OTHER", label: "Other", icon: MoreHorizontal },
];

export function SettleUpModal({ groupId, currency, suggestion, onClose, onSettled }: Props) {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromMemberId: suggestion.fromMemberId,
          toMemberId: suggestion.toMemberId,
          amountPaise: suggestion.amountPaise,
          paymentMethod: method,
          paymentReference: reference || undefined,
          proofUrl: proofUrl || undefined,
          note: note || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }

      toast({
        title: "Settlement recorded",
        description: `Payment of ${formatCurrencyShort(suggestion.amountPaise, currency)} via ${PAYMENT_METHODS.find((m) => m.value === method)?.label} sent for confirmation.`,
      });

      onSettled();
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to record settlement", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="font-display font-semibold text-lg">Settle Up</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Settlement summary */}
          <div className="glass border border-emerald-500/15 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="font-medium text-sm">You</span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-medium text-sm text-emerald-400">{suggestion.toMemberName}</span>
            <span className="ml-auto font-mono font-bold text-emerald-400">
              {formatCurrencyShort(suggestion.amountPaise, currency)}
            </span>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Payment Method
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-xs font-medium transition-all ${
                    method === value
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                      : "bg-white/3 border-white/8 text-muted-foreground hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="leading-tight text-center">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Payment Reference */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              Payment Reference <span className="normal-case text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={
                method === "UPI" ? "UTR / transaction ID" :
                method === "BANK_TRANSFER" ? "Reference / UTR number" :
                method === "CARD" ? "Last 4 digits or ref" :
                "Reference ID"
              }
              maxLength={200}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          {/* Proof URL */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              Proof / Screenshot URL <span className="normal-case text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://drive.google.com/… or any URL"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            <p className="text-xs text-muted-foreground/50 mt-1">Upload a screenshot to Drive/Imgur and paste the link.</p>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              Note <span className="normal-case text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Split for last month's groceries"
              maxLength={200}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          {/* Status info */}
          <p className="text-xs text-muted-foreground bg-white/3 rounded-xl px-4 py-3 border border-white/5">
            This settlement will be <span className="text-yellow-400 font-medium">pending confirmation</span> until{" "}
            <span className="text-white font-medium">{suggestion.toMemberName}</span> confirms it.
            Balances update only after confirmation.
          </p>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Recording…</>
              ) : (
                "Record Payment"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
