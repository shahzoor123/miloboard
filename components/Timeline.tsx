"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/subabase";

const HOURS = Array.from({ length: 25 }, (_, i) => i);
const ICON_POOL = ["🎯","🚀","⚡","🔑","💎","🏆","🌟","🔥","⚙️","🛡️","📌","🎪","🧩","💡","🎖️"];
const getIcon = (id: number) => ICON_POOL[id % ICON_POOL.length];

type Break = {
  start: number; // % of 24h timeline
  end: number;
};

type Item = {
  id: number;
  title: string;
  deadline: string;
  progress: number;
  difficulty: number;
  timeline_position: number;
  timeline_end: number;
  breaks?: Break[];
};

// ── helpers ──────────────────────────────────────────────────────────────────

const pctToMinutes = (pct: number) => Math.round((pct / 100) * 24 * 60);

const formatHourLabel = (pct: number) => {
  const totalMinutes = pctToMinutes(pct);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${m.toString().padStart(2, "0")} ${ampm}`;
};

const formatDuration = (widthPct: number) => {
  const totalMinutes = pctToMinutes(widthPct);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};

const breakMinutesInside = (breaks: Break[], itemLeft: number, itemRight: number): number =>
  breaks.reduce((sum, b) => {
    const bL = Math.max(b.start, itemLeft);
    const bR = Math.min(b.end, itemRight);
    return bR > bL ? sum + pctToMinutes(bR - bL) : sum;
  }, 0);

const formatNetDuration = (
  widthPct: number,
  breaks: Break[],
  itemLeft: number,
  itemRight: number
) => {
  const net = Math.max(0, pctToMinutes(widthPct) - breakMinutesInside(breaks, itemLeft, itemRight));
  const h = Math.floor(net / 60);
  const m = net % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

// ── row stagger ───────────────────────────────────────────────────────────────

const getRowIndex = (items: Item[], currentId: number): number => {
  const current = items.find((i) => i.id === currentId);
  if (!current) return 0;
  const cL = Math.min(current.timeline_position ?? 50, current.timeline_end ?? 60);
  const cR = Math.max(current.timeline_position ?? 50, current.timeline_end ?? 60);
  const preceding = items.filter((i) => i.id !== currentId);
  const usedRows: number[] = [];
  for (const other of preceding) {
    const oL = Math.min(other.timeline_position ?? 50, other.timeline_end ?? 60);
    const oR = Math.max(other.timeline_position ?? 50, other.timeline_end ?? 60);
    if ((cL < oR + 8 && cL > oL - 8) || (cL < oR && cR > oL))
      usedRows.push(getRowIndex(preceding, other.id));
  }
  for (let r = 0; r < 6; r++) if (!usedRows.includes(r)) return r;
  return 0;
};

// ── component ─────────────────────────────────────────────────────────────────

export default function Timeline() {
  const [items, setItems] = useState<Item[]>([]);
  const [now, setNow] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [breakDraftId, setBreakDraftId] = useState<number | null>(null);
  const [breakDraftPct, setBreakDraftPct] = useState<{ start: number; end: number } | null>(null);

  const barRef = useRef<HTMLDivElement>(null);
  const draggingId = useRef<number | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("milestones")
        .select("*")
        .order("id", { ascending: false });
      if (!error && data)
        setItems(
          data.map((row: Item) => ({
            ...row,
            breaks: typeof row.breaks === "string" ? JSON.parse(row.breaks) : (row.breaks ?? []),
          }))
        );
    })();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const nowPct = (now.getHours() + now.getMinutes() / 60) / 24 * 100;

  // ── db helpers ────────────────────────────────────────────────────────────

  const updateField = async (id: number, field: string, value: unknown) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    await supabase.from("milestones").update({ [field]: value }).eq("id", id);
  };

  const saveTitle = async (id: number, title: string) => {
    const t = title.trim();
    if (t) await updateField(id, "title", t);
    setEditingId(null);
  };

  const saveBreaks = (id: number, breaks: Break[]) =>
    updateField(id, "breaks", breaks);

  // ── milestone drag (start / end) ─────────────────────────────────────────

  const startDrag = (id: number, type: "start" | "end") => {
    draggingId.current = id;
    const field = type === "start" ? "timeline_position" : "timeline_end";
    const getPct = (clientX: number) => {
      if (!barRef.current) return 0;
      const r = barRef.current.getBoundingClientRect();
      return Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
    };
    const onMove = (cx: number) =>
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, [field]: getPct(cx) } : i))
      );
    const onEnd = (cx: number) => {
      updateField(id, field, getPct(cx));
      draggingId.current = null;
      cleanup();
    };
    const onMM = (e: MouseEvent) => onMove(e.clientX);
    const onMU = (e: MouseEvent) => onEnd(e.clientX);
    const onTM = (e: TouchEvent) => { e.preventDefault(); onMove(e.touches[0].clientX); };
    const onTE = (e: TouchEvent) => onEnd(e.changedTouches[0].clientX);
    const cleanup = () => {
      window.removeEventListener("mousemove", onMM);
      window.removeEventListener("mouseup", onMU);
      window.removeEventListener("touchmove", onTM);
      window.removeEventListener("touchend", onTE);
    };
    window.addEventListener("mousemove", onMM);
    window.addEventListener("mouseup", onMU);
    window.addEventListener("touchmove", onTM, { passive: false });
    window.addEventListener("touchend", onTE);
  };

  // ── break handle drag ────────────────────────────────────────────────────

  const startBreakHandleDrag = (itemId: number, bIdx: number, edge: "start" | "end") => {
    const getPct = (cx: number) => {
      if (!barRef.current) return 0;
      const r = barRef.current.getBoundingClientRect();
      return Math.min(100, Math.max(0, ((cx - r.left) / r.width) * 100));
    };
    const apply = (cx: number, save: boolean) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          const bs = [...(item.breaks ?? [])];
          const b = { ...bs[bIdx] };
          const p = getPct(cx);
          if (edge === "start") b.start = Math.min(p, b.end - 0.3);
          else b.end = Math.max(p, b.start + 0.3);
          bs[bIdx] = b;
          if (save) saveBreaks(itemId, bs);
          return { ...item, breaks: bs };
        })
      );
    };
    const onMM = (e: MouseEvent) => apply(e.clientX, false);
    const onMU = (e: MouseEvent) => { apply(e.clientX, true); cleanup(); };
    const onTM = (e: TouchEvent) => { e.preventDefault(); apply(e.touches[0].clientX, false); };
    const onTE = (e: TouchEvent) => { apply(e.changedTouches[0].clientX, true); cleanup(); };
    const cleanup = () => {
      window.removeEventListener("mousemove", onMM);
      window.removeEventListener("mouseup", onMU);
      window.removeEventListener("touchmove", onTM);
      window.removeEventListener("touchend", onTE);
    };
    window.addEventListener("mousemove", onMM);
    window.addEventListener("mouseup", onMU);
    window.addEventListener("touchmove", onTM, { passive: false });
    window.addEventListener("touchend", onTE);
  };

  // ── break draw (drag on milestone fill) ──────────────────────────────────

  const startBreakDraw = (
    e: React.MouseEvent | React.TouchEvent,
    itemId: number,
    itemLeft: number,
    itemRight: number
  ) => {
    if (!barRef.current) return;
    e.stopPropagation();
    const r = barRef.current.getBoundingClientRect();
    const cx0 = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clamp = (cx: number) =>
      Math.min(itemRight, Math.max(itemLeft, ((cx - r.left) / r.width) * 100));
    const s0 = clamp(cx0);
    setBreakDraftId(itemId);
    setBreakDraftPct({ start: s0, end: s0 });

    const onMM = (e: MouseEvent) => setBreakDraftPct({ start: s0, end: clamp(e.clientX) });
    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      setBreakDraftPct({ start: s0, end: clamp(e.touches[0].clientX) });
    };
    const onEnd = (cx: number) => {
      const s = Math.min(s0, clamp(cx));
      const end = Math.max(s0, clamp(cx));
      if (end - s > 0.3) {
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== itemId) return item;
            const newBreaks = [...(item.breaks ?? []), { start: s, end }];
            saveBreaks(itemId, newBreaks);
            return { ...item, breaks: newBreaks };
          })
        );
      }
      setBreakDraftId(null);
      setBreakDraftPct(null);
      cleanup();
    };
    const onMU = (e: MouseEvent) => onEnd(e.clientX);
    const onTE = (e: TouchEvent) => onEnd(e.changedTouches[0].clientX);
    const cleanup = () => {
      window.removeEventListener("mousemove", onMM);
      window.removeEventListener("mouseup", onMU);
      window.removeEventListener("touchmove", onTM);
      window.removeEventListener("touchend", onTE);
    };
    window.addEventListener("mousemove", onMM);
    window.addEventListener("mouseup", onMU);
    window.addEventListener("touchmove", onTM, { passive: false });
    window.addEventListener("touchend", onTE);
  };

  const removeBreak = (itemId: number, bIdx: number) =>
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const nb = (item.breaks ?? []).filter((_, i) => i !== bIdx);
        saveBreaks(itemId, nb);
        return { ...item, breaks: nb };
      })
    );

  // ── derived ───────────────────────────────────────────────────────────────

  const activeItems = items.filter((i) => i.progress < 100);
  const doneItems = items.filter((i) => i.progress === 100);
  const ROW_HEIGHT = isMobile ? 52 : 44;
  const maxRow = activeItems.reduce((m, i) => Math.max(m, getRowIndex(activeItems, i.id)), 0);
  const pinsAreaHeight = (maxRow + 1) * ROW_HEIGHT + 8;

  // ── title input (shared between pin and legend) ───────────────────────────

  const TitleInput = ({ id }: { id: number }) => (
    <input
      autoFocus
      value={editDraft}
      onChange={(e) => setEditDraft(e.target.value)}
      onBlur={() => saveTitle(id, editDraft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") saveTitle(id, editDraft);
        if (e.key === "Escape") setEditingId(null);
        e.stopPropagation();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      style={{
        width: isMobile ? "60px" : "100px",
        fontSize: "9px",
        background: "rgba(17,24,39,0.97)",
        border: "1px solid rgba(239,68,68,0.65)",
        borderRadius: "3px",
        color: "#f3f4f6",
        padding: "2px 4px",
        fontFamily: "'DM Mono', monospace",
        outline: "none",
        textAlign: "center",
      }}
    />
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        padding: isMobile ? "8px 4px" : "4px 0",
        fontFamily: "'DM Mono', monospace",
        overflowX: "hidden",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <span style={{ fontSize: isMobile ? "10px" : "11px", letterSpacing: "0.15em", color: "#6b7280", textTransform: "uppercase" }}>
          Daily Execution Strip
        </span>
        <span style={{ fontSize: isMobile ? "10px" : "11px", color: "#ef4444", letterSpacing: "0.08em" }}>
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* AM/PM */}
      <div style={{ display: "flex", marginBottom: "6px" }}>
        <div style={{ flex: 1, fontSize: "9px", color: "#9ca3af", letterSpacing: "0.12em", textTransform: "uppercase" }}>AM</div>
        <div style={{ flex: 1, fontSize: "9px", color: "#9ca3af", letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "right" }}>PM</div>
      </div>

      {/* ── PINS AREA ── */}
      <div style={{ position: "relative", height: `${pinsAreaHeight}px`, marginBottom: "4px", overflow: "hidden" }}>
        {activeItems.map((item) => {
          const start = item.timeline_position ?? 50;
          const end = item.timeline_end ?? 60;
          const left = Math.min(start, end);
          const right = Math.max(start, end);
          const width = right - left;
          const row = getRowIndex(activeItems, item.id);
          const pinBottom = (maxRow - row) * ROW_HEIGHT + 12;
          const icon = getIcon(item.id);
          const breaks = item.breaks ?? [];

          return (
            <div key={item.id}>
              {/* Duration above bar */}
              {width > 5 && (
                <div style={{
                  position: "absolute",
                  left: `${Math.max(2, Math.min(98, left + width / 2))}%`,
                  transform: "translateX(-50%)",
                  bottom: "3px",
                  fontSize: isMobile ? "9px" : "10px",
                  color: "rgba(52,211,153,0.85)",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  zIndex: 0,
                }}>
                  {breaks.length > 0
                    ? formatNetDuration(width, breaks, left, right)
                    : formatDuration(width)}
                  {breaks.length > 0 && (
                    <span style={{ color: "rgba(156,163,175,0.65)", fontSize: "8px", marginLeft: "3px" }}>
                      −{formatDuration((breakMinutesInside(breaks, left, right) / (24 * 60)) * 100)}
                    </span>
                  )}
                </div>
              )}

              {/* Start-pin */}
              <div
                onMouseDown={(e) => { e.preventDefault(); startDrag(item.id, "start"); }}
                onTouchStart={(e) => { e.preventDefault(); startDrag(item.id, "start"); }}
                style={{
                  position: "absolute",
                  left: `${Math.max(1, Math.min(99, start))}%`,
                  transform: "translateX(-50%)",
                  bottom: `${pinBottom}px`,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                  cursor: "grab", userSelect: "none",
                  padding: isMobile ? "6px" : "2px",
                  touchAction: "none", zIndex: 10,
                }}
              >
                {editingId === item.id ? (
                  <TitleInput id={item.id} />
                ) : (
                  <span
                    onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditDraft(item.title); }}
                    onTouchEnd={(e) => { e.stopPropagation(); setEditingId(item.id); setEditDraft(item.title); }}
                    title={item.title}
                    style={{
                      fontSize: "9px",
                      color: "#d1d5db",
                      // Mobile: truncate at ~60px; Desktop: wrap up to 90px
                      width: isMobile ? "60px" : "90px",
                      textAlign: "center",
                      letterSpacing: "0.03em",
                      lineHeight: "1.3",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: isMobile ? "nowrap" : "normal",
                      wordBreak: isMobile ? undefined : "break-word",
                      cursor: "text",
                      borderBottom: "1px dashed rgba(255,255,255,0.14)",
                    }}
                  >
                    {isMobile && item.title.length > 7
                      ? item.title.slice(0, 6) + "…"
                      : item.title}
                  </span>
                )}

                <span style={{ fontSize: isMobile ? "20px" : "16px", lineHeight: 1 }}>{icon}</span>

                {/* Stem */}
                <div style={{
                  width: "1px", height: `${pinBottom - 4}px`,
                  background: "rgba(239,68,68,0.35)",
                  position: "absolute", bottom: `-${pinBottom - 4}px`,
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── TIMELINE BAR ── */}
      <div
        ref={barRef}
        style={{
          position: "relative",
          height: isMobile ? "44px" : "32px",
          borderRadius: "6px",
          overflow: "visible",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.2)",
          touchAction: "none",
        }}
      >
        {/* AM tint */}
        <div style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%", background: "rgba(59,130,246,0.15)", borderRight: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px 0 0 6px" }} />

        {/* Elapsed */}
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${nowPct}%`, background: "linear-gradient(90deg,rgba(239,68,68,0.18),rgba(239,68,68,0.08))", borderRadius: "6px 0 0 6px" }} />

        {/* Ticks */}
        {HOURS.map((h) => {
          if (h === 0 || h === 24) return null;
          const pct = (h / 24) * 100;
          const isMajor = h % 6 === 0;
          if (isMobile && !isMajor) return null;
          return <div key={h} style={{ position: "absolute", left: `${pct}%`, top: 0, width: "1px", height: isMajor ? "100%" : "40%", background: isMajor ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)" }} />;
        })}

        {/* Now needle */}
        <div style={{ position: "absolute", left: `${nowPct}%`, top: 0, width: "2px", height: "100%", background: "#ef4444", boxShadow: "0 0 6px rgba(239,68,68,0.7)", transform: "translateX(-50%)" }} />

        {/* ── Milestone windows + breaks ── */}
        {activeItems.map((item) => {
          const start = item.timeline_position ?? 50;
          const end = item.timeline_end ?? 60;
          const left = Math.min(start, end);
          const right = Math.max(start, end);
          const width = right - left;
          const totalHours = (width / 100) * 24;
          const fillOp = totalHours >= 11 ? 0.02 : Math.max(0.15, 0.35 - (totalHours / 11) * 0.2);
          const borderOp = totalHours >= 11 ? 0.2 : Math.max(0.5, 0.9 - (totalHours / 11) * 0.4);
          const breaks = item.breaks ?? [];

          return (
            <div key={item.id} style={{ position: "absolute", left: `${left}%`, width: `${width}%`, top: 0, height: "100%" }}>
              {/* Milestone fill — drag to draw break */}
              <div
                onMouseDown={(e) => startBreakDraw(e, item.id, left, right)}
                onTouchStart={(e) => startBreakDraw(e, item.id, left, right)}
                style={{
                  position: "absolute", left: 0, top: "15%", width: "100%", height: "70%",
                  background: `rgba(239,68,68,${fillOp})`,
                  borderTop: `1px solid rgba(239,68,68,${borderOp})`,
                  borderBottom: `1px solid rgba(239,68,68,${borderOp})`,
                  cursor: "crosshair", zIndex: 2,
                }}
              />

              {/* Edges */}
              <div style={{ position: "absolute", left: 0, top: 0, width: "2px", height: "100%", background: "rgba(239,68,68,0.7)", transform: "translateX(-50%)", zIndex: 3, pointerEvents: "none" }} />
              <div style={{ position: "absolute", right: 0, top: 0, width: "2px", height: "100%", background: "#ef4444", boxShadow: "0 0 5px rgba(239,68,68,0.8)", transform: "translateX(50%)", zIndex: 3, pointerEvents: "none" }} />

              {/* ── Breaks ── */}
              {breaks.map((b, bIdx) => {
                const bL = Math.max(b.start, left);
                const bR = Math.min(b.end, right);
                if (bR <= bL) return null;
                const bLI = ((bL - left) / width) * 100;
                const bWI = ((bR - bL) / width) * 100;
                const handleW = isMobile ? 14 : 7;

                return (
                  <div
                    key={bIdx}
                    style={{ position: "absolute", left: `${bLI}%`, width: `${bWI}%`, top: 0, height: "100%", zIndex: 4, pointerEvents: "none" }}
                  >
                    {/* Gray fill */}
                    <div style={{
                      position: "absolute", left: 0, top: "10%", width: "100%", height: "80%",
                      background: "rgba(75,85,99,0.55)",
                      borderTop: "1px solid rgba(156,163,175,0.55)",
                      borderBottom: "1px solid rgba(156,163,175,0.55)",
                    }} />

                    {/* BREAK label */}
                    {bWI > 6 && (
                      <div style={{
                        position: "absolute", left: "50%", top: "50%",
                        transform: "translate(-50%,-50%)",
                        fontSize: "7px", color: "rgba(209,213,219,0.65)",
                        letterSpacing: "0.1em", whiteSpace: "nowrap",
                        pointerEvents: "none", userSelect: "none",
                      }}>
                        BREAK
                      </div>
                    )}

                    {/* Left handle */}
                    <div
                      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); startBreakHandleDrag(item.id, bIdx, "start"); }}
                      onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); startBreakHandleDrag(item.id, bIdx, "start"); }}
                      style={{
                        position: "absolute", left: 0, top: "10%",
                        width: `${handleW}px`, height: "80%",
                        transform: "translateX(-50%)",
                        background: "rgba(156,163,175,0.8)",
                        cursor: "ew-resize", pointerEvents: "all", zIndex: 6,
                        borderRadius: "2px",
                      }}
                    />

                    {/* Right handle */}
                    <div
                      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); startBreakHandleDrag(item.id, bIdx, "end"); }}
                      onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); startBreakHandleDrag(item.id, bIdx, "end"); }}
                      style={{
                        position: "absolute", right: 0, top: "10%",
                        width: `${handleW}px`, height: "80%",
                        transform: "translateX(50%)",
                        background: "rgba(209,213,219,0.85)",
                        cursor: "ew-resize", pointerEvents: "all", zIndex: 6,
                        borderRadius: "2px",
                      }}
                    />

                    {/* Double-click to remove */}
                    <div
                      onDoubleClick={(e) => { e.stopPropagation(); removeBreak(item.id, bIdx); }}
                      style={{
                        position: "absolute", left: 0, top: 0, width: "100%", height: "100%",
                        pointerEvents: "all", cursor: "pointer", zIndex: 5,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Break draft preview */}
        {breakDraftId !== null && breakDraftPct !== null && (() => {
          const item = activeItems.find((i) => i.id === breakDraftId);
          if (!item) return null;
          const dL = Math.min(breakDraftPct.start, breakDraftPct.end);
          const dR = Math.max(breakDraftPct.start, breakDraftPct.end);
          return (
            <div style={{
              position: "absolute",
              left: `${dL}%`, width: `${dR - dL}%`,
              top: "15%", height: "70%",
              background: "rgba(107,114,128,0.28)",
              border: "1px dashed rgba(156,163,175,0.6)",
              pointerEvents: "none", zIndex: 15,
            }} />
          );
        })()}

        {/* End-point handles */}
        {activeItems.map((item) => {
          const end = item.timeline_end ?? 60;
          const dot = isMobile ? 20 : 12;
          return (
            <div
              key={item.id}
              onMouseDown={(e) => { e.preventDefault(); startDrag(item.id, "end"); }}
              onTouchStart={(e) => { e.preventDefault(); startDrag(item.id, "end"); }}
              style={{
                position: "absolute", left: `${end}%`, top: "50%",
                transform: "translate(-50%,-50%)",
                width: `${dot}px`, height: `${dot}px`, borderRadius: "50%",
                background: "#ef4444", boxShadow: "0 0 8px rgba(239,68,68,0.9)",
                cursor: "ew-resize", touchAction: "none", zIndex: 20,
                ...(isMobile && { outline: "12px solid transparent" }),
              }}
            />
          );
        })}
      </div>

      {/* Hour labels */}
      <div style={{ position: "relative", height: "28px", marginTop: "6px" }}>
        {HOURS.filter((h) => (isMobile ? h % 6 === 0 && h !== 24 : h !== 24)).map((h) => {
          const pct = (h / 24) * 100;
          const isMajor = h % 6 === 0;
          const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          const ampm = h < 12 ? "AM" : "PM";
          return (
            <span key={h} style={{
              position: "absolute", left: `${pct}%`,
              transform: h === 0 ? "none" : "translateX(-50%)",
              fontSize: isMobile ? "9px" : isMajor ? "9px" : "7.5px",
              color: isMajor ? "#9ca3af" : "#6b7280",
              whiteSpace: "nowrap",
            }}>
              {`${hour12}${ampm}`}
            </span>
          );
        })}
      </div>

      {/* Hint */}
      <div style={{ marginTop: "5px", fontSize: "8px", color: "#374151", letterSpacing: "0.05em" }}>
        drag inside milestone window to add break · double-click break to remove · click title to edit
      </div>

      {/* ── LEGEND — active ── */}
      {activeItems.length > 0 && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: isMobile ? "10px" : "8px" }}>
          {activeItems.map((item) => {
            const icon = getIcon(item.id);
            const start = item.timeline_position ?? 50;
            const end = item.timeline_end ?? 60;
            const left = Math.min(start, end);
            const right = Math.max(start, end);
            const width = right - left;
            const breaks = item.breaks ?? [];
            const breakMins = breakMinutesInside(breaks, left, right);

            return (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", flexShrink: 0 }}>{icon}</span>

                {editingId === item.id ? (
                  <input
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onBlur={() => saveTitle(item.id, editDraft)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveTitle(item.id, editDraft);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    style={{
                      width: isMobile ? "80px" : "130px",
                      fontSize: "10px",
                      background: "rgba(17,24,39,0.97)",
                      border: "1px solid rgba(239,68,68,0.6)",
                      borderRadius: "3px",
                      color: "#f3f4f6",
                      padding: "1px 4px",
                      fontFamily: "'DM Mono', monospace",
                      outline: "none",
                    }}
                  />
                ) : (
                  <span
                    onClick={() => { setEditingId(item.id); setEditDraft(item.title); }}
                    title={item.title}
                    style={{
                      fontSize: "10px", color: "#d1d5db", fontWeight: 500,
                      minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      // Mobile: truncated; Desktop: full title
                      maxWidth: isMobile ? "72px" : "none",
                      cursor: "text",
                      borderBottom: "1px dashed rgba(255,255,255,0.12)",
                    }}
                  >
                    {item.title}
                  </span>
                )}

                <span style={{ fontSize: "10px", color: "#6b7280", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {formatHourLabel(left)} → {formatHourLabel(right)}
                </span>

                <span style={{ fontSize: "10px", color: "#34d399", flexShrink: 0 }}>
                  {breaks.length > 0
                    ? formatNetDuration(width, breaks, left, right)
                    : formatDuration(width)}
                </span>

                {breaks.length > 0 && (
                  <span style={{ fontSize: "9px", color: "#6b7280", flexShrink: 0 }}>
                    −{formatDuration((breakMins / (24 * 60)) * 100)} break{breaks.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── LEGEND — done ── */}
      {doneItems.length > 0 && (
        <div style={{ marginTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "9px", color: "#4b5563", letterSpacing: "0.1em", textTransform: "uppercase" }}>Completed</span>
          {doneItems.map((item) => {
            const icon = getIcon(item.id);
            return (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "8px", opacity: 0.4 }}>
                <span style={{ fontSize: "12px" }}>{icon}</span>
                <span style={{ fontSize: "10px", color: "#34d399", textDecoration: "line-through", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
                  {item.title}
                </span>
                <span style={{ fontSize: "9px", color: "#34d399" }}>DONE</span>
              </div>
            );
          })}
        </div>
      )}

      {items.length === 0 && (
        <div style={{ marginTop: "12px", fontSize: "10px", color: "#374151", textAlign: "center" }}>
          no milestones yet
        </div>
      )}
    </div>
  );
}