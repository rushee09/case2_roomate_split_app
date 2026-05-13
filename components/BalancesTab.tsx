"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, ArrowRight, Loader2, CheckCircle, Info } from "lucide-react";
import { formatCurrencyShort } from "@/lib/money";
import { toast } from "@/components/ui/use-toast";

interface Member {
  id: string;
  name: string;
}

interface MemberBalance {
  memberId: string;
  memberName: string;
  totalPaidPaise: number;
  totalOwedPaise: number;
  netBalancePaise: number;
}

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
  members: Member[];
  onSettled: () => void;
}

export function BalancesTab({ groupId, currency, members, onSettled }: Props) {
  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([]);
  const [totalSpend, setTotalSpend] = useState(0);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState<string | null>(null);

  async function fetchBalances() {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/balances`);
      const data = await res.json();
      setBalances(data.balances ?? []);
      setSuggestions(data.suggestions ?? []);
      setTotalSpend(data.totalGroupSpendPaise ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function settleUp(suggestion: SettlementSuggestion) {
    const key = `${suggestion.fromMemberId}-${suggestion.toMemberId}`;
    setSettling(key);
    try {
      const res = await fetch(`/api/groups/${groupId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromMemberId: suggestion.fromMemberId,
          toMemberId: suggestion.toMemberId,
          amountPaise: suggestion.amountPaise,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }

      toast({
        title: "Settlement recorded",
        description: `${suggestion.fromMemberName} paid ${suggestion.toMemberName} ${formatCurrencyShort(suggestion.amountPaise, currency)}`,
      });

      await fetchBalances();
      onSettled();
    } catch {
      toast({ title: "Error", description: "Failed to record settlement", variant: "destructive" });
    } finally {
      setSettling(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  const creditors = balances.filter((b) => b.netBalancePaise > 0);
  const debtors = balances.filter((b) => b.netBalancePaise < 0);
  const settled = balances.filter((b) => b.netBalancePaise === 0);

  return (
    <div className="space-y-8">
      {/* Algorithm explanation */}
      <div className="glass rounded-xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="text-white font-medium">How balances work: </span>
          Each expense credits the payer and debits each participant for their share.
          The settlement engine then greedily pairs the largest debtor with the largest creditor,
          producing the minimum number of transactions needed to clear all debts.
        </p>
      </div>

      {/* Net balances */}
      <div>
        <h3 className="font-display font-semibold mb-3">Net Balances</h3>
        <div className="space-y-2">
          {balances.map((b) => (
            <div
              key={b.memberId}
              className="glass rounded-xl px-4 py-3 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center font-semibold text-sm shrink-0">
                  {b.memberName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">{b.memberName}</p>
                  <p className="text-xs text-muted-foreground">
                    Paid {formatCurrencyShort(b.totalPaidPaise, currency)} · Owes{" "}
                    {formatCurrencyShort(b.totalOwedPaise, currency)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {b.netBalancePaise > 0 ? (
                  <>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="badge-positive px-2.5 py-1 rounded-lg text-sm font-mono font-semibold">
                      +{formatCurrencyShort(b.netBalancePaise, currency)}
                    </span>
                  </>
                ) : b.netBalancePaise < 0 ? (
                  <>
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <span className="badge-negative px-2.5 py-1 rounded-lg text-sm font-mono font-semibold">
                      -{formatCurrencyShort(Math.abs(b.netBalancePaise), currency)}
                    </span>
                  </>
                ) : (
                  <>
                    <Minus className="w-4 h-4 text-muted-foreground" />
                    <span className="badge-zero px-2.5 py-1 rounded-lg text-sm font-mono font-semibold">
                      Settled
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settlement suggestions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold">Suggested Settlements</h3>
          <span className="text-xs text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full">
            {suggestions.length} transaction{suggestions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {suggestions.length === 0 ? (
          <div className="glass rounded-xl py-12 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
            <p className="font-medium mb-1">All settled up!</p>
            <p className="text-sm text-muted-foreground">No outstanding balances in this group.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s) => {
              const key = `${s.fromMemberId}-${s.toMemberId}`;
              const isSettling = settling === key;
              return (
                <div
                  key={key}
                  className="glass rounded-xl px-4 py-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium text-sm">{s.fromMemberName}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm text-emerald-400">{s.toMemberName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-semibold text-sm">
                      {formatCurrencyShort(s.amountPaise, currency)}
                    </span>
                    <button
                      onClick={() => settleUp(s)}
                      disabled={isSettling}
                      className="bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSettling ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Settling…</>
                      ) : (
                        "Settle Up"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Group total */}
      <div className="glass rounded-xl p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Total group spend</span>
        <span className="font-display font-bold text-lg text-emerald-400">
          {formatCurrencyShort(totalSpend, currency)}
        </span>
      </div>
    </div>
  );
}
