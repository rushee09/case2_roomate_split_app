"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, Search, UserPlus, AtSign, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface UserResult {
  id: string;
  username: string;
  name: string | null;
  image: string | null;
  email: string;
}

interface Props {
  groupId: string;
  onClose: () => void;
  onAdded: () => void;
}

export function AddMemberModal({ groupId, onClose, onAdded }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [selected, setSelected] = useState<UserResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    setSearching(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, [query]);

  async function handleInvite() {
    if (!selected) return;
    setInviting(true);
    setError("");
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, username: selected.username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send invitation");
        setInviting(false);
        return;
      }
      setDone(true);
      toast({
        title: "Invitation sent!",
        description: `@${selected.username} will receive an email invite.`,
      });
      setTimeout(() => { onAdded(); onClose(); }, 1500);
    } catch {
      setError("Network error. Please try again.");
      setInviting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm glass rounded-2xl p-6 animate-slide-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-semibold text-xl">Invite Roommate</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="font-medium">Invitation sent to <span className="text-emerald-400">@{selected?.username}</span></p>
            <p className="text-sm text-muted-foreground mt-1">They'll get an email to join the group.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                SEARCH BY USERNAME
              </label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="e.g. aakar_roomie"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelected(null);
                    setError("");
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm
                             placeholder:text-muted-foreground focus:outline-none focus:ring-2
                             focus:ring-emerald-500/50 transition-colors"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Search results */}
            {results.length > 0 && !selected && (
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                {results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setSelected(u); setQuery(u.username); setResults([]); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left transition-colors"
                  >
                    {u.image ? (
                      <img src={u.image} alt={u.username} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold text-xs">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">@{u.username}</p>
                      {u.name && <p className="text-xs text-muted-foreground truncate">{u.name}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {query.length >= 2 && !searching && results.length === 0 && !selected && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No users found for "<span className="text-white">{query}</span>"
              </p>
            )}

            {/* Selected user */}
            {selected && (
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                {selected.image ? (
                  <img src={selected.image} alt={selected.username} className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold text-xs">
                    {selected.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-400">@{selected.username}</p>
                  {selected.name && <p className="text-xs text-muted-foreground">{selected.name}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => { setSelected(null); setQuery(""); }}
                  className="text-muted-foreground hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              An email invitation will be sent to their registered Google email.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInvite}
                disabled={inviting || !selected}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
              >
                {inviting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Send Invite</>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
