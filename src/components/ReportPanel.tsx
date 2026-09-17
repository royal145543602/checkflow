"use client";

import { useState, useCallback, useEffect } from "react";
import { useT } from "@/i18n";

type DayRec = { date: string; checkIn: string | null; checkOut: string | null };
type MemberReport = { name: string; total: number; present: number; rate: number; days: DayRec[] };

interface ReportPanelProps {
  teamId: string;
  onClose: () => void;
}

export default function ReportPanel({ teamId, onClose }: ReportPanelProps) {
  const { t } = useT();
  const [from, setFrom] = useState(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [data, setData] = useState<MemberReport[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/report?from=${from}&to=${to}`);
      const json = await res.json();
      setData(json.members);
    } catch {} finally {
      setLoading(false);
    }
  }, [teamId, from, to]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear().toString().slice(2)}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const rateColor = (rate: number) => {
    if (rate >= 90) return { text: "var(--green)" };
    if (rate >= 70) return { text: "orange" };
    return { text: "red" };
  };

  const sorted = data ? [...data].sort((a, b) => a.rate - b.rate) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold font-display tracking-wider" style={{ fontFamily: "'Barlow Condensed', 'Noto Sans TC', sans-serif" }}>{t.report}</h3>
        <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--muted)] hover:bg-black/5 hover:text-[var(--text)] transition-all">&times;</button>
      </div>

      {/* Date range */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs text-[var(--dim)] block mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-pt w-full text-sm py-2.5 px-3" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-[var(--dim)] block mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-pt w-full text-sm py-2.5 px-3" />
        </div>
        <button onClick={fetchReport} disabled={loading} className="bg-[var(--green)] text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 hover:brightness-110 transition-all" style={{ boxShadow: "0 2px 10px rgba(0,232,92,0.3)" }}>
          {t.refresh}
        </button>
      </div>

      {/* Table */}
      {loading && <p className="text-center text-sm text-[var(--muted)] py-8">{t.loading}</p>}

      {!loading && data && data.length === 0 && (
        <p className="text-center text-sm text-[var(--muted)] py-8">{t.noRecord}</p>
      )}

      {!loading && sorted.length > 0 && (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {/* Header row */}
          <div className="flex items-center px-4 py-2 text-xs text-[var(--dim)] font-medium uppercase tracking-widest">
            <span className="flex-[2]">{t.members}</span>
            <span className="flex-1 text-center">{t.expectedDays}</span>
            <span className="flex-1 text-center">{t.actualDays}</span>
            <span className="flex-1 text-center">{t.attendanceRate}</span>
          </div>

          {sorted.map(m => (
            <div key={m.name}>
              <button
                onClick={() => setExpanded(expanded === m.name ? null : m.name)}
                className="w-full flex items-center px-4 py-3 rounded-xl border border-[var(--border)] hover:border-[rgba(0,128,51,0.15)] transition-all text-left"
                style={{ background: "var(--bg-card)" }}
              >
                <span className="flex-[2] text-sm font-medium text-[var(--text)]/85">{m.name}</span>
                <span className="flex-1 text-center text-sm text-[var(--text)]/60">{m.total}{t.day}</span>
                <span className="flex-1 text-center text-sm text-[var(--text)]/80">{m.present}{t.day}</span>
                <span className="flex-1 text-center text-sm font-bold" style={{ color: rateColor(m.rate).text }}>
                  {m.rate}%
                </span>
              </button>
              {/* Expanded detail */}
              {expanded === m.name && (
                <div className="mx-4 border-x border-b border-[var(--border)] rounded-b-xl overflow-hidden" style={{ background: "var(--bg)" }}>
                  <div className="divide-y divide-[var(--border)]">
                    {m.days.filter(d => d.checkIn || d.checkOut).map(day => (
                      <div key={day.date} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span className="text-[var(--text)]/70">{formatDate(day.date)}</span>
                        <span className="text-[var(--text)]/60">
                          {day.checkIn ? (
                            <><span className="text-[var(--green)]">{formatTime(day.checkIn)}</span> 签到</>
                          ) : ""}
                          {day.checkIn && day.checkOut ? " — " : ""}
                          {day.checkOut ? (
                            <><span className="text-[var(--muted)]">{formatTime(day.checkOut)}</span> 签退</>
                          ) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}