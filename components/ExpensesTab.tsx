"use client";

import { useState } from "react";
import { Trash2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { formatCurrencyShort } from "@/lib/money";
import { toast } from "@/components/ui/use-toast";

interface Member {
  id: string;
  name: string;
}

interface ExpenseSplit {
  memberId: string;
  amountPaise: number;
  percentage?: number;
  member: Member;
}

interface Expense {
  id: string;
  title: string;
  amountPaise: number;
  date: string;
  category?: string;
  notes?: string;
  splitType: "EQUAL" | "PERCENTAGE" | "EXACT";
  isRecurring: boolean;
  recurringPeriod?: string;
  paidBy: Member;
  splits: ExpenseSplit[];
}

interface Props {
  expenses: Expense[];
  currency: string;
  groupId: string;
  onExpenseDeleted: () => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  Food: "🍔",
  Utilities: "⚡",
  Housing: "🏠",
  Transport: "🚗",
  Entertainment: "🎬",
  Health: "💊",
  Shopping: "🛍️",
  Other: "💰",
};

const SPLIT_COLORS: Record<string, string> = {
  EQUAL: "text-blue-400 bg-blue-500/10",
  PERCENTAGE: "text-purple-400 bg-purple-500/10",
  EXACT: "text-yellow-400 bg-yellow-500/10",
};

export function ExpensesTab({ expenses, currency, groupId, onExpenseDeleted }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function deleteExpense(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/groups/${groupId}/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast({ title: "Error", description: "Failed to delete expense", variant: "destructive" });
        return;
      }
      toast({ title: "Expense deleted", description: `"${title}" was removed.` });
      onExpenseDeleted();
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  }

  if (expenses.length === 0) {
    return (
      <div className="glass rounded-xl py-16 text-center">
        <p className="text-muted-foreground text-sm">No expenses yet. Add one to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {expenses.map((expense) => {
        const isExpanded = expanded === expense.id;
        const dateStr = new Date(expense.date).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });

        return (
          <div
            key={expense.id}
            className="glass rounded-xl overflow-hidden"
          >
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-base shrink-0">
                {CATEGORY_EMOJI[expense.category ?? "Other"] ?? "💰"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{expense.title}</p>
                  {expense.isRecurring && (
                    <span title={`Recurring ${expense.recurringPeriod}`}>
                      <RefreshCw className="w-3 h-3 text-muted-foreground" />
                    </span>
                  )}
                  <span
                    className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium ${
                      SPLIT_COLORS[expense.splitType] ?? ""
                    }`}
                  >
                    {expense.splitType.charAt(0) + expense.splitType.slice(1).toLowerCase()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {expense.paidBy.name} paid · {dateStr}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono font-semibold text-sm">
                  {formatCurrencyShort(expense.amountPaise, currency)}
                </span>

                <button
                  onClick={() => setExpanded(isExpanded ? null : expense.id)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
                  title="View splits"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  onClick={() => deleteExpense(expense.id, expense.title)}
                  disabled={deleting === expense.id}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                  title="Delete expense"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Expanded splits */}
            {isExpanded && (
              <div className="border-t border-white/5 px-4 py-3">
                {expense.notes && (
                  <p className="text-xs text-muted-foreground mb-3 italic">"{expense.notes}"</p>
                )}
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Split breakdown
                </p>
                <div className="space-y-1.5">
                  {expense.splits.map((split) => (
                    <div
                      key={split.memberId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{split.member.name}</span>
                      <div className="flex items-center gap-2">
                        {split.percentage !== undefined && split.percentage !== null && (
                          <span className="text-xs text-muted-foreground">
                            {split.percentage.toFixed(1)}%
                          </span>
                        )}
                        <span className="font-mono font-medium text-xs">
                          {formatCurrencyShort(split.amountPaise, currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
