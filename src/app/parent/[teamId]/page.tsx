"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useT } from "@/i18n";

type ChildInfo = {
  name: string;
  status: "in" | "out" | "none";
  lastCheckIn: string | null;
  lastCheckOut: string | null;
  recentDays: Array<{ date: string; checkIn: string | null; checkOut: string | null }>;
};

export default function ParentPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { t } = useT();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChildInfo | null>(null);
  const [error, setError] = useState("");
  const [teamName, setTeamName] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    fetch(`/api/teams/${teamId}/status`)
      .then(r => r.json())
      .then(data => setTeamName(data.team?.name || ""))
      .catch(() => {});
  }, [teamId]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/parent/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (data.found) {
        setResult(data.child);
      } else {
        setError(t.parentNotFound);
      }
    } catch {
      setError(t.parentNotFound);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear().toString().slice(2)}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const statusText = (status: "in" | "out" | "none") => {
    if (status === "in") return { text: t.checkInLabel, color: "var(--green)" };
    if (status === "out") return { text: t.gone, color: "orange" };
    return { text: t.absent, color: "var(--dim)" };
  };

  return (
    <main className="min-h-screen flex flex-col items-center relative z-10" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="w-full text-center py-6 px-4 border-b border-[var(--border)]" style={{ background: "var(--bg-card)" }}>
        <h1 className="text-xl font-bold font-display tracking-wider" style={{ fontFamily: "'Barlow Condensed', 'Noto Sans TC', sans-serif" }}>
          {teamName || ""}
        </h1>
      </div>

      {/* Search form */}
      <div className="w-full max-w-md mx-auto p-6">
        <form onSubmit={handleSearch} className="space-y-3">
          <p className="text-sm text-[var(--muted)] text-center">{t.parentLookupTitle}</p>
          <div className="flex gap-2">
            <input
              className="input-pt flex-1 text-sm py-3 px-3.5"
              placeholder={t.phonePlaceholder}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              type="tel"
              autoFocus
            />
            <button type="submit" disabled={loading || !phone.trim()} className="bg-[var(--green)] text-white px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-40 hover:brightness-110 transition-all flex-shrink-0" style={{ boxShadow: "0 2px 12px rgba(0,232,92,0.3)" }}>
              {t.search}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && searched && (
          <p className="text-center text-sm text-red-400 mt-6">{error}</p>
        )}

        {/* Result */}
        {result && (
          <div className="mt-6 space-y-4">
            {/* Child name + status */}
            <div className="rounded-2xl p-5 border border-[var(--border)]" style={{ background: "var(--bg-card)" }}>
              <p className="text-xs text-[var(--dim)] uppercase tracking-widest mb-1">{t.childName}</p>
              <p className="text-2xl font-bold mb-3">{result.name}</p>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{
                  background: statusText(result.status).color,
                  boxShadow: result.status === "in" ? "0 0 8px rgba(0,128,51,0.5)" : "none",
                  ...(result.status === "in" ? { animation: "pulse 2s infinite" } : {}),
                }} />
                <span className="text-sm" style={{ color: statusText(result.status).color }}>{statusText(result.status).text}</span>
                <span className="text-xs text-[var(--dim)]">
                  {result.lastCheckIn && ` ${formatTime(result.lastCheckIn)}${result.lastCheckOut ? ` — ${formatTime(result.lastCheckOut)}` : ""}`}
                </span>
              </div>
            </div>

            {/* Recent 7 days */}
            <div>
              <p className="text-xs text-[var(--dim)] uppercase tracking-widest mb-2 font-medium">{t.recentDays}</p>
              <div className="space-y-1">
                {result.recentDays.map(day => (
                  <div key={day.date} className="flex items-center justify-between rounded-xl px-4 py-2.5 border border-[var(--border)]" style={{ background: "var(--bg-card)" }}>
                    <span className="text-sm text-[var(--text)]/80">{formatDate(day.date)}</span>
                    <span className="text-sm">
                      {day.checkIn ? (
                        <span className="text-[var(--green)]">{formatTime(day.checkIn)}</span>
                      ) : (
                        <span className="text-[var(--dim)]">{t.noRecord}</span>
                      )}
                      {day.checkOut && (
                        <span className="text-[var(--muted)]"> — {formatTime(day.checkOut)}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}