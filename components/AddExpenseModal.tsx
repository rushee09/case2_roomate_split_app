"use client";

import { useState } from "react";
import { X, Loader2, Plus, Minus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatCurrencyShort } from "@/lib/money";

interface Member {
  id: string;
  name: string;
}

interface Props {
  groupId: string;
  members: Member[];
  currency: string;
  onClose: () => void;
  onAdded: () => void;
}

type SplitType = "EQUAL" | "PERCENTAGE" | "EXACT";

const CATEGORIES = [
  "Food", "Utilities", "Housing", "Transport",
  "Entertainment", "Health", "Shopping", "Other",
];

export function AddExpenseModal({ groupId, members, currency, onClose, onAdded }: Props) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState(members[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("Food");
  const [notes, setNotes] = useState("");
  const [splitType, setSplitType] = useState<SplitType>("EQUAL");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPeriod, setRecurringPeriod] = useState("monthly");

  // Equal split — selected participant IDs
  const [equalMemberIds, setEqualMemberIds] = useState<string[]>(members.map((m) => m.id));

  // Percentage split
  const [percentSplits, setPercentSplits] = useState<{ memberId: string; percentage: string }[]>(
    members.map((m) => ({ memberId: m.id, percentage: (100 / members.length).toFixed(2) }))
  );

  // Exact split
  const [exactSplits, setExactSplits] = useState<{ memberId: string; amountInr: string }[]>(
    members.map((m) => ({ memberId: m.id, amountInr: "" }))
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ─── Validation helpers ──────────────────────────────────────────────────────

  const amountNum = parseFloat(amount);
  const percentTotal = percentSplits.reduce((s, p) => s + (parseFloat(p.percentage) || 0), 0);
  const exactTotal = exactSplits.reduce((s, e) => s + (parseFloat(e.amountInr) || 0), 0);
  const percentOk = Math.abs(percentTotal - 100) < 0.01;
  const exactOk = amountNum > 0 && Math.abs(exactTotal - amountNum) < 0.005;

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function toggleEqualMember(id: string) {
    setEqualMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function updatePercent(memberId: string, value: string) {
    setPercentSplits((prev) =>
      prev.map((s) => (s.memberId === memberId ? { ...s, percentage: value } : s))
    );
  }

  function updateExact(memberId: string, value: string) {
    setExactSplits((prev) =>
      prev.map((s) => (s.memberId === memberId ? { ...s, amountInr: value } : s))
    );
  }

  function distributeEqually() {
    const n = members.length;
    if (n === 0) return;
    const each = (100 / n).toFixed(2);
    setPercentSplits(members.map((m) => ({ memberId: m.id, percentage: each })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) { setError("Title is required"); return; }
    if (!amountNum || amountNum <= 0) { setError("Amount must be greater than zero"); return; }
    if (!paidById) { setError("Payer is required"); return; }

    let split: unknown;
    if (splitType === "EQUAL") {
      if (equalMemberIds.length === 0) { setError("Select at least one participant"); return; }
      split = { type: "EQUAL", memberIds: equalMemberIds };
    } else if (splitType === "PERCENTAGE") {
      if (!percentOk) { setError(`Percentages must sum to 100% (currently ${percentTotal.toFixed(2)}%)`); return; }
      split = {
        type: "PERCENTAGE",
        splits: percentSplits.map((s) => ({
          memberId: s.memberId,
          percentage: parseFloat(s.percentage),
        })),
      };
    } else {
      if (!exactOk) {
        setError(`Exact amounts must sum to ₹${amountNum.toFixed(2)} (currently ₹${exactTotal.toFixed(2)})`);
        return;
      }
      split = {
        type: "EXACT",
        splits: exactSplits.map((s) => ({
          memberId: s.memberId,
          amountInr: parseFloat(s.amountInr) || 0,
        })),
      };
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          amountInr: amountNum,
          paidById,
          date,
          category,
          notes: notes || undefined,
          isRecurring,
          recurringPeriod: isRecurring ? recurringPeriod : undefined,
          split,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to add expense");
        return;
      }

      toast({ title: "Expense added", description: `"${title}" was added successfully.` });
      onAdded();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto glass rounded-2xl p-6 animate-slide-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-semibold text-xl">Add Expense</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              TITLE
            </label>
            <input
              type="text"
              placeholder="e.g. Groceries from DMart"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
              required
            />
          </div>

          {/* Amount + Paid By */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                AMOUNT ({currency})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  {currency === "INR" ? "₹" : currency}
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                PAID BY
              </label>
              <select
                value={paidById}
                onChange={(e) => setPaidById(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors appearance-none"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id} className="bg-navy-900">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                DATE
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                CATEGORY
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors appearance-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-navy-900">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Split type */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              SPLIT TYPE
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["EQUAL", "PERCENTAGE", "EXACT"] as SplitType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSplitType(t)}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors border ${
                    splitType === t
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
                  }`}
                >
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Split participants */}
          {splitType === "EQUAL" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                SPLIT BETWEEN
              </label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleEqualMember(m.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      equalMemberIds.includes(m.id)
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
                    }`}
                  >
                    {m.name}
                    {equalMemberIds.includes(m.id) && amountNum > 0 && (
                      <span className="opacity-70 font-mono">
                        {formatCurrencyShort(
                          Math.floor((amountNum * 100) / equalMemberIds.length),
                          currency
                        )}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {splitType === "PERCENTAGE" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">
                  PERCENTAGE SPLIT
                </label>
                <button
                  type="button"
                  onClick={distributeEqually}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  Distribute equally
                </button>
              </div>
              <div className="space-y-2">
                {percentSplits.map((s) => {
                  const member = members.find((m) => m.id === s.memberId);
                  return (
                    <div key={s.memberId} className="flex items-center gap-3">
                      <span className="text-sm w-20 truncate">{member?.name}</span>
                      <div className="flex-1 relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={s.percentage}
                          onChange={(e) => updatePercent(s.memberId, e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 pr-7 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                      {amountNum > 0 && (
                        <span className="text-xs font-mono text-muted-foreground w-20 text-right shrink-0">
                          {formatCurrencyShort(
                            Math.floor((parseFloat(s.percentage) / 100) * amountNum * 100),
                            currency
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div
                className={`mt-2 text-xs text-right ${
                  percentOk ? "text-emerald-400" : "text-red-400"
                }`}
              >
                Total: {percentTotal.toFixed(2)}%{percentOk ? " ✓" : " (must be 100%)"}
              </div>
            </div>
          )}

          {splitType === "EXACT" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                EXACT AMOUNTS
              </label>
              <div className="space-y-2">
                {exactSplits.map((s) => {
                  const member = members.find((m) => m.id === s.memberId);
                  return (
                    <div key={s.memberId} className="flex items-center gap-3">
                      <span className="text-sm w-20 truncate">{member?.name}</span>
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {currency === "INR" ? "₹" : currency}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={s.amountInr}
                          onChange={(e) => updateExact(s.memberId, e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {amountNum > 0 && (
                <div
                  className={`mt-2 text-xs text-right ${
                    exactOk ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  Total: {formatCurrencyShort(Math.round(exactTotal * 100), currency)} /{" "}
                  {formatCurrencyShort(Math.round(amountNum * 100), currency)}
                  {exactOk ? " ✓" : ""}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              NOTES (optional)
            </label>
            <textarea
              placeholder="Any details about this expense…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors resize-none"
            />
          </div>

          {/* Recurring */}
          <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium">Recurring expense</p>
              <p className="text-xs text-muted-foreground">e.g. monthly rent or internet</p>
            </div>
            <div className="flex items-center gap-3">
              {isRecurring && (
                <select
                  value={recurringPeriod}
                  onChange={(e) => setRecurringPeriod(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
              <button
                type="button"
                onClick={() => setIsRecurring((p) => !p)}
                className={`w-10 h-6 rounded-full transition-colors ${
                  isRecurring ? "bg-emerald-500" : "bg-white/10"
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white mx-1 transition-transform ${
                    isRecurring ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</>
              ) : (
                "Add Expense"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
