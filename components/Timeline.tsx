"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/subabase";

const HOURS = Array.from({ length: 25 }, (_, i) => i);
const ICON_POOL = ["🎯","🚀","⚡","🔑","💎","🏆","🌟","🔥","⚙️","🛡️","📌","🎪","🧩","💡","🎖️"];
const getIcon = (id: number) => ICON_POOL[id % ICON_POOL.length];

type Item = {
  id: number;
  title: string;
  deadline: string;
  progress: number;
  difficulty: number;
  timeline_position: number;
  timeline_end: number;
};

export default function Timeline() {
  const [items, setItems] = useState<Item[]>([]);
  const [now, setNow] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const draggingId = useRef<number | null>(null);
  const draggingType = useRef<"start" | "end" | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("milestones")
        .select("*")
        .order("id", { ascending: false });
      if (!error && data) setItems(data);
    };
    fetchData();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const currentHour = now.getHours() + now.getMinutes() / 60;
  const nowPct = (currentHour / 24) * 100;

  const updatePosition = async (id: number, field: "timeline_position" | "timeline_end", pct: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: pct } : item))
    );
    await supabase.from("milestones").update({ [field]: pct }).eq("id", id);
  };

  const getHourLabel = (pct: number) => {
    const totalMinutes = Math.round((pct / 100) * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const getHoursLabel = (width: number) => {
    const totalMinutes = Math.round((width / 100) * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  const startDrag = (id: number, type: "start" | "end") => {
    draggingId.current = id;
    draggingType.current = type;
    const field = type === "start" ? "timeline_position" : "timeline_end";

    const onMove = (clientX: number) => {
      if (!barRef.current || draggingId.current === null) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
      setItems((prev) =>
        prev.map((item) => (item.id === draggingId.current ? { ...item, [field]: pct } : item))
      );
    };

    const onEnd = (clientX: number) => {
      if (!barRef.current || draggingId.current === null) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
      updatePosition(draggingId.current, field, pct);
      draggingId.current = null;
      draggingType.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX);
    const onMouseUp = (e: MouseEvent) => onEnd(e.clientX);
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); onMove(e.touches[0].clientX); };
    const onTouchEnd = (e: TouchEvent) => onEnd(e.changedTouches[0].clientX);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
  };

  const activeItems = items.filter((item) => item.progress < 100);
  const doneItems = items.filter((item) => item.progress === 100);

  // on mobile show only major hour labels (0,6,12,18)
  const hourLabels = isMobile
    ? HOURS.filter((h) => h % 6 === 0 && h !== 24)
    : HOURS.filter((h) => h !== 24);

  return (
    <div style={{ padding: "4px 0", fontFamily: "'DM Mono', monospace" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <span style={{ fontSize: "11px", letterSpacing: "0.15em", color: "#6b7280", textTransform: "uppercase" }}>
          Daily Execution Strip
        </span>
        <span style={{ fontSize: "11px", color: "#ef4444", letterSpacing: "0.08em" }}>
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* AM / PM label row */}
      <div style={{ display: "flex", marginBottom: "6px" }}>
        <div style={{ flex: 1, fontSize: "9px", color: "#9ca3af", letterSpacing: "0.12em", textTransform: "uppercase" }}>AM</div>
        <div style={{ flex: 1, fontSize: "9px", color: "#9ca3af", letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "right" }}>PM</div>
      </div>

      {/* Icon pins above bar */}
      <div style={{ position: "relative", height: isMobile ? "90px" : "80px", marginBottom: "4px" }}>
        {activeItems.map((item) => {
          const pct = item.timeline_position ?? 50;
          const icon = getIcon(item.id);
          const start = item.timeline_position ?? 50;
          const end = item.timeline_end ?? 60;
          const left = Math.min(start, end);
          const right = Math.max(start, end);
          const width = right - left;
          const midPct = left + width / 2;
          return (
            <div key={item.id}>
              {/* hours label */}
              {width > 4 && (
                <div style={{
                  position: "absolute",
                  left: `${midPct}%`,
                  transform: "translateX(-50%)",
                  bottom: "3px",
                  fontSize: isMobile ? "10px" : "11px",
                  color: "rgba(52,211,153,0.9)",
                  whiteSpace: "nowrap",
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.05em",
                  pointerEvents: "none",
                  zIndex: 0,
                }}>
                  {getHoursLabel(width)}
                </div>
              )}
              {/* draggable start pin */}
              <div
                onMouseDown={(e) => { e.preventDefault(); startDrag(item.id, "start"); }}
                onTouchStart={(e) => { e.preventDefault(); startDrag(item.id, "start"); }}
                style={{
                  position: "absolute",
                  left: `${pct}%`,
                  transform: "translateX(-50%)",
                  bottom: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                  cursor: "grab",
                  userSelect: "none",
                  // larger touch target on mobile
                  padding: isMobile ? "4px" : "0",
                }}
              >
                <span style={{
                  fontSize: "9px",
                  color: "#d1d5db",
                  width: isMobile ? "60px" : "70px",
                  textAlign: "center",
                  letterSpacing: "0.03em",
                  lineHeight: "1.3",
                  wordBreak: "break-word",
                }}>
                  {item.title}
                </span>
                <span style={{ fontSize: isMobile ? "18px" : "16px", lineHeight: 1 }}>{icon}</span>
                <div style={{ width: "1px", height: "8px", background: "rgba(239,68,68,0.5)" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline bar */}
      <div
        ref={barRef}
        style={{
          position: "relative",
          height: isMobile ? "36px" : "28px",
          borderRadius: "6px",
          overflow: "visible",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.2)",
        }}
      >
        {/* AM half tint */}
        <div style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%", background: "rgba(59,130,246,0.15)", borderRight: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px 0 0 6px" }} />

        {/* Elapsed fill */}
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${nowPct}%`, background: "linear-gradient(90deg, rgba(239,68,68,0.18) 0%, rgba(239,68,68,0.08) 100%)", borderRadius: "6px 0 0 6px" }} />

        {/* Hour ticks */}
        {HOURS.map((h) => {
          if (h === 0 || h === 24) return null;
          const pct = (h / 24) * 100;
          const isMajor = h % 6 === 0;
          if (isMobile && !isMajor) return null;
          return (
            <div key={h} style={{ position: "absolute", left: `${pct}%`, top: 0, width: "1px", height: isMajor ? "100%" : "40%", background: isMajor ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)" }} />
          );
        })}

        {/* Now needle */}
        <div style={{ position: "absolute", left: `${nowPct}%`, top: 0, width: "2px", height: "100%", background: "#ef4444", boxShadow: "0 0 6px rgba(239,68,68,0.7)", transform: "translateX(-50%)" }} />

        {/* Milestone windows */}
        {activeItems.map((item) => {
          const start = item.timeline_position ?? 50;
          const end = item.timeline_end ?? 60;
          const left = Math.min(start, end);
          const right = Math.max(start, end);
          const width = right - left;
          const totalHours = (width / 100) * 24;
          const fillOpacity = totalHours >= 11 ? 0.02 : Math.max(0.15, 0.35 - (totalHours / 11) * 0.2);
          const borderOpacity = totalHours >= 11 ? 0.2 : Math.max(0.5, 0.9 - (totalHours / 11) * 0.4);
          return (
            <div key={item.id} style={{ position: "absolute", left: `${left}%`, width: `${width}%`, top: 0, height: "100%", pointerEvents: "none" }}>
              <div style={{
                position: "absolute",
                left: 0,
                top: "20%",
                width: "100%",
                height: "60%",
                background: `rgba(239,68,68,${fillOpacity})`,
                borderTop: `1px solid rgba(239,68,68,${borderOpacity})`,
                borderBottom: `1px solid rgba(239,68,68,${borderOpacity})`,
              }} />
              <div style={{ position: "absolute", left: 0, top: 0, width: "2px", height: "100%", background: "rgba(239,68,68,0.7)", transform: "translateX(-50%)" }} />
              <div style={{ position: "absolute", right: 0, top: 0, width: "2px", height: "100%", background: "#ef4444", boxShadow: "0 0 5px rgba(239,68,68,0.8)", transform: "translateX(50%)" }} />
            </div>
          );
        })}
      </div>

      {/* End point drag handles below bar — bigger on mobile */}
      <div style={{ position: "relative", height: isMobile ? "20px" : "14px" }}>
        {activeItems.map((item) => {
          const end = item.timeline_end ?? 60;
          const size = isMobile ? "16px" : "10px";
          return (
            <div
              key={item.id}
              onMouseDown={(e) => { e.preventDefault(); startDrag(item.id, "end"); }}
              onTouchStart={(e) => { e.preventDefault(); startDrag(item.id, "end"); }}
              style={{
                position: "absolute",
                left: `${end}%`,
                transform: "translateX(-50%)",
                top: 0,
                width: size,
                height: size,
                borderRadius: "50%",
                background: "#ef4444",
                boxShadow: "0 0 6px rgba(239,68,68,0.8)",
                cursor: "ew-resize",
                touchAction: "none",
              }}
            />
          );
        })}
      </div>

      {/* All hour labels */}
      <div style={{ position: "relative", height: "28px", marginTop: "2px" }}>
        {hourLabels.map((h) => {
          const pct = (h / 24) * 100;
          const isMajor = h % 6 === 0;
          const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          const ampm = h < 12 ? "AM" : "PM";
          const label = `${hour12}${ampm}`;
          return (
            <span key={h} style={{
              position: "absolute",
              left: `${pct}%`,
              transform: "translateX(-50%)",
              fontSize: isMobile ? "9px" : isMajor ? "9px" : "7.5px",
              color: isMajor ? "#9ca3af" : "#6b7280",
              whiteSpace: "nowrap",
              textAlign: "center",
              lineHeight: 1,
            }}>
              {label}
            </span>
          );
        })}
      </div>

      {/* Legend — active */}
      {activeItems.length > 0 && (
        <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: isMobile ? "12px" : "8px" }}>
          {activeItems.map((item) => {
            const icon = getIcon(item.id);
            const start = item.timeline_position ?? 50;
            const end = item.timeline_end ?? 60;
            const left = Math.min(start, end);
            const right = Math.max(start, end);
            const width = right - left;
            return (
              <div key={item.id} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? "4px" : "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "12px" }}>{icon}</span>
                  <span style={{ fontSize: "10px", color: "#d1d5db", fontWeight: 500 }}>{item.title}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", paddingLeft: isMobile ? "18px" : "0" }}>
                  <span style={{ fontSize: "10px", color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>
                    {getHourLabel(left)} → {getHourLabel(right)}
                  </span>
                  <span style={{ fontSize: "10px", color: "#34d399" }}>
                    {getHoursLabel(width)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend — done */}
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