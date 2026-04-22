"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/subabase";
import Timeline from "../components/Timeline";


type Item = {
  id: number;
  title: string;
  deadline: string;
  progress: number;
  difficulty: number;
};

export default function Page() {
  const [data, setData] = useState<Item[]>([]);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [timeMap, setTimeMap] = useState<Record<number, string>>({});
  const [pin, setPin] = useState("");
  const [locked, setLocked] = useState(true);
  const CODE = "0001";
  const [showTimeline, setShowTimeline] = useState(false);

  // ── inline title editing ──────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const startEdit = (item: Item) => {
    setEditingId(item.id);
    setEditDraft(item.title);
  };

  const commitEdit = async (id: number) => {
    const trimmed = editDraft.trim();
    if (!trimmed) { setEditingId(null); return; }
    setData((prev) => prev.map((item) => (item.id === id ? { ...item, title: trimmed } : item)));
    await supabase.from("milestones").update({ title: trimmed }).eq("id", id);
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const newMap: Record<number, string> = {};
      data.forEach((item) => {
        const end = new Date(item.deadline).getTime();
        const diff = end - now;
        if (diff <= 0) {
          newMap[item.id] = "Expired";
        } else {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
          const minutes = Math.floor((diff / (1000 * 60)) % 60);
          const seconds = Math.floor((diff / 1000) % 60);
          newMap[item.id] = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        }
      });
      setTimeMap(newMap);
    }, 1000);
    return () => clearInterval(interval);
  }, [data]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("milestones")
      .select("*")
      .order("id", { ascending: false });
    if (!error && data) setData(data);
  };

  const add = async () => {
    if (!title || !deadline) return;
    const { data: newItem, error } = await supabase
      .from("milestones")
      .insert([{ title, deadline, progress: 0, difficulty }])
      .select();
    if (!error && newItem) {
      setData([newItem[0], ...data]);
      setTitle("");
      setDeadline("");
      setDifficulty(1);
    }
  };

  const update = async (id: number, value: number) => {
    setData((prev) =>
      prev.map((item) => (item.id === id ? { ...item, progress: value } : item))
    );
    await supabase.from("milestones").update({ progress: value }).eq("id", id);
  };

  const remove = async (id: number) => {
    setData((prev) => prev.filter((item) => item.id !== id));
    await supabase.from("milestones").delete().eq("id", id);
  };

  const updateDeadline = async (id: number, value: string) => {
    setData((prev) =>
      prev.map((item) => (item.id === id ? { ...item, deadline: value } : item))
    );
    await supabase.from("milestones").update({ deadline: value }).eq("id", id);
  };

  const difficultyConfig = {
    1: { label: "EASY", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
    2: { label: "MEDIUM", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
    3: { label: "HARD", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  };

  const getStatus = (progress: number, deadline: string) => {
    if (progress === 100) return { label: "DONE", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
    const expired = new Date(deadline).getTime() < Date.now();
    if (expired) return { label: "EXPIRED", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };
    return { label: "IN PROGRESS", color: "text-gray-400", bg: "bg-white/5", border: "border-white/10" };
  };

  const progressStyle = (p: number) =>
    p < 30
      ? { row: "bg-red-500/5 border-red-500/30", bar: "bg-gradient-to-r from-red-600 to-red-400", pct: "text-red-400" }
      : p < 70
      ? { row: "bg-amber-500/5 border-amber-500/30", bar: "bg-gradient-to-r from-amber-600 to-amber-400", pct: "text-amber-400" }
      : { row: "bg-emerald-500/5 border-emerald-500/30", bar: "bg-gradient-to-r from-emerald-600 to-emerald-400", pct: "text-emerald-400" };

  // ── reusable inline title editor ─────────────────────────────────────────

  const TitleCell = ({ item, className }: { item: Item; className?: string }) => {
    if (editingId === item.id) {
      return (
        <input
          autoFocus
          value={editDraft}
          onChange={(e) => setEditDraft(e.target.value)}
          onBlur={() => commitEdit(item.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit(item.id);
            if (e.key === "Escape") cancelEdit();
          }}
          className={`bg-black/60 border border-red-500/50 rounded-lg px-2 py-1 text-gray-100 focus:outline-none focus:border-red-500 font-semibold transition-colors w-full ${className ?? ""}`}
        />
      );
    }
    return (
      <span
        onClick={() => startEdit(item)}
        title="Click to edit title"
        className={`cursor-text hover:text-white transition-colors border-b border-dashed border-white/20 hover:border-white/40 ${className ?? ""}`}
      >
        {item.title}
      </span>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (locked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080c14] px-4">
        <div className="w-full max-w-sm p-8 rounded-2xl border border-white/10 bg-[#0e1320] shadow-2xl shadow-red-900/10">
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl">
              🔒
            </div>
            <h1 className="text-lg font-semibold text-red-400 tracking-widest uppercase">
              Locked Dashboard
            </h1>
            <p className="text-xs text-gray-500 text-center">Enter your 4-digit PIN to continue</p>
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                const val = e.target.value;
                setPin(val);
                if (val.length === 4) {
                  if (val === CODE) {
                    setLocked(false);
                  } else {
                    setPin("");
                    alert("Wrong code");
                  }
                }
              }}
              className="w-full p-4 text-center text-xl tracking-[0.8em] bg-black/60 border border-white/10 rounded-xl text-white focus:border-red-500/50 focus:outline-none transition-colors placeholder-gray-600"
              placeholder="••••"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#080c14] text-gray-100">
      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-10 bg-[#080c14]/90 backdrop-blur border-b border-red-500/15 px-4 sm:px-10 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">📅</span>
            <h1 className="text-base sm:text-2xl font-bold text-red-400 uppercase tracking-[0.2em]">
              Milestones
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
              {data.length} task{data.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="text-xs text-gray-500 hover:text-red-400 bg-white/5 px-3 py-1 rounded-full border border-white/10 transition-colors"
            >
              {showTimeline ? "✕ Timeline" : "📊 Timeline"}
            </button>
          </div>
        </div>
      </header>

      <div className="w-full px-4 sm:px-10 py-6 space-y-6">

        {/* ── ADD FORM ── */}
        <section className="bg-[#0e1320] border border-white/8 rounded-2xl p-4 sm:p-5 shadow-xl shadow-black/30">
          <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-4">Add Milestone</h2>
          <div className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-3">
            <input
              className="w-full bg-black/40 border border-white/10 text-gray-100 placeholder-gray-500 px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg focus:border-red-500/50 focus:outline-none transition-colors"
              placeholder="Milestone title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full sm:w-auto bg-black/40 border border-white/10 text-gray-300 px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg focus:border-red-500/50 focus:outline-none transition-colors scheme-dark"
            />
            <select
              className="w-full sm:w-auto bg-black/40 border border-white/10 text-gray-300 px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg focus:border-red-500/50 focus:outline-none transition-colors"
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
            >
              <option value={1}>Easy</option>
              <option value={2}>Medium</option>
              <option value={3}>Hard</option>
            </select>
            <button
              onClick={add}
              className="w-full sm:w-auto bg-red-500 hover:bg-red-600 active:scale-95 text-white text-sm sm:text-base font-semibold px-8 py-2.5 sm:py-3 rounded-lg transition-all"
            >
              + Add
            </button>
          </div>
        </section>

        {showTimeline && (
          <section className="bg-[#0e1320] border border-white/8 rounded-2xl p-4 sm:p-5 shadow-xl shadow-black/30">
            <Timeline />
          </section>
        )}

        {/* ── DESKTOP TABLE HEADER ── */}
        <div className="hidden sm:grid sm:grid-cols-[2fr_1.4fr_1.8fr_0.6fr_0.9fr_0.9fr_0.4fr] gap-4 px-6 text-xs uppercase tracking-widest text-gray-500">
          <span className="text-center">Milestone</span>
          <span>Time Left</span>
          <span className="text-center">Progress</span>
          <span className="text-center">%</span>
          <span className="text-center">Difficulty</span>
          <span className="text-center">Status</span>
          <span className="text-right">Del</span>
        </div>

        {/* ── LIST ── */}
        {data.length === 0 ? (
          <div className="text-center py-20 text-gray-600 text-sm">
            No milestones yet — add one above.
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((item) => {
              const ps = progressStyle(item.progress);
              const dc = difficultyConfig[item.difficulty as 1 | 2 | 3];
              const sc = getStatus(item.progress, item.deadline);
              return (
                <div
                  key={item.id}
                  className={`border rounded-xl ${ps.row} transition-colors`}
                >
                  {/* ── MOBILE LAYOUT ── */}
                  <div className="sm:hidden p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 font-semibold text-sm text-gray-100 leading-snug">
                        <TitleCell item={item} className="text-sm" />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${dc.color} ${dc.bg} ${dc.border}`}>
                          {dc.label}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${sc.color} ${sc.bg} ${sc.border}`}>
                          {sc.label}
                        </span>
                        <button
                          onClick={() => remove(item.id)}
                          className="text-gray-500 hover:text-red-400 transition-colors text-base"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-red-400 text-sm">⏳</span>
                        <span className={`text-xs font-mono ${timeMap[item.id] === "Expired" ? "text-red-500" : "text-gray-300"}`}>
                          {timeMap[item.id] ?? "—"}
                        </span>
                      </div>
                      <input
                        type="date"
                        value={item.deadline.split("T")[0]}
                        onChange={(e) => updateDeadline(item.id, e.target.value)}
                        className="text-xs bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-gray-400 focus:outline-none focus:border-red-500/40 scheme-dark"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={item.progress}
                        onChange={(e) => update(item.id, Number(e.target.value))}
                        className="flex-1 accent-red-500 h-1.5 cursor-pointer"
                      />
                      <span className={`text-sm font-bold w-10 text-right ${ps.pct}`}>
                        {item.progress}%
                      </span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${ps.bar}`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* ── DESKTOP LAYOUT ── */}
                  <div className="hidden sm:grid sm:grid-cols-[2fr_1.4fr_1.8fr_0.6fr_0.9fr_0.9fr_0.4fr] items-center gap-4 px-6 py-4">
                    <TitleCell item={item} className="text-base" />
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 text-sm">⏳</span>
                        <span className={`text-sm font-mono ${timeMap[item.id] === "Expired" ? "text-red-500" : "text-gray-300"}`}>
                          {timeMap[item.id] ?? "—"}
                        </span>
                      </div>
                      <input
                        type="date"
                        value={item.deadline.split("T")[0]}
                        onChange={(e) => updateDeadline(item.id, e.target.value)}
                        className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1 text-gray-400 focus:outline-none focus:border-red-500/40 scheme-dark w-fit"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={item.progress}
                        onChange={(e) => update(item.id, Number(e.target.value))}
                        className="w-full accent-red-500 h-2 cursor-pointer"
                      />
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${ps.bar}`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <span className={`text-base font-bold ${ps.pct}`}>{item.progress}%</span>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded border text-center ${dc.color} ${dc.bg} ${dc.border}`}>
                      {dc.label}
                    </span>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded border text-center ${sc.color} ${sc.bg} ${sc.border}`}>
                      {sc.label}
                    </span>
                    <div className="flex justify-end">
                      <button
                        onClick={() => remove(item.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors text-lg"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}