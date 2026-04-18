"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/subabase";
import { Calendar } from "lucide-react";

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



  // 📥 LOAD FROM SUPABASE
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

  // ➕ ADD
  const add = async () => {
    if (!title || !deadline) return;

    const { data: newItem, error } = await supabase
      .from("milestones")
      .insert([
        {
          title,
          deadline,
          progress: 0,
          difficulty,
        },
      ])
      .select();

    if (!error && newItem) {
      setData([newItem[0], ...data]);
      setTitle("");
      setDeadline("");
      setDifficulty(1);
    }
  };

  // ✏️ UPDATE PROGRESS
  const update = async (id: number, value: number) => {
    setData((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, progress: value } : item
      )
    );

    await supabase
      .from("milestones")
      .update({ progress: value })
      .eq("id", id);
  };

  // 🗑 DELETE
  const remove = async (id: number) => {
    setData((prev) => prev.filter((item) => item.id !== id));

    await supabase.from("milestones").delete().eq("id", id);
  };


  const unlock = () => {
    if (pin === CODE) {
      setLocked(false);
    } else {
      setPin("");
      alert("Wrong code");
    }
  };


  const updateDeadline = async (id: number, value: string) => {
    setData((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, deadline: value } : item
      )
    );
  
    await supabase
      .from("milestones")
      .update({ deadline: value })
      .eq("id", id);
  };

  if (locked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f19] text-gray-100">
        <div className="w-[320px] p-6 rounded-xl border border-white/10 bg-[#111827] text-center">
  
          <h1 className="text-lg font-semibold mb-4 text-red-400">
            🔒 Locked Dashboard
          </h1>
  
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
          className="w-full p-3 text-center tracking-[0.5em] bg-black border border-white/10 rounded mb-4"
          placeholder="••••"
        />
  
        </div>
      </div>
    );
  }

  return (
    
    <main className="min-h-screen bg-[#0b0f19] text-gray-100 p-6">
      

      {/* HEADER */}
      <div className="mb-6 border-b border-red-500/20 pb-3">
        <h1 className="text-xl text-red-400 uppercase tracking-widest">
        📅 Milestones
        </h1>
      </div>

      {/* INPUT */}
      <div className="bg-[#0a0d14] border border-red-500/20 p-4 rounded mb-6">
        <div className="grid grid-cols-4 gap-2">

          <input
            className="bg-[#111827] border border-gray-700 text-gray-100 placeholder-gray-400 p-2 text-sm"
            placeholder="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full p-2 text-sm rounded bg-[#111827] text-gray-100 border border-gray-700 focus:border-purple-500 outline-none"
          />

          <select
            className="bg-black border border-white/10 p-2 text-sm"
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
          >
            <option value={1}>Easy</option>
            <option value={2}>Medium</option>
            <option value={3}>Hard</option>
          </select>

          <button
            onClick={add}
            className="bg-red-500 hover:bg-red-600 text-sm"
          >
            Add
          </button>

        </div>
      </div>

      {/* LIST */}
      <div className="space-y-2">
        {data.map((item) => (
          <div
            key={item.id}
            className={`grid grid-cols-[1.5fr_1.3fr_1.2fr_0.8fr_1.2fr_0.5fr] items-center gap-4 p-3 border rounded text-gray-100
            ${
              item.progress < 30
                ? "bg-red-500/10 border-red-500/40"
                : item.progress < 70
                ? "bg-yellow-500/10 border-yellow-500/30"
                : "bg-green-500/10 border-green-500/30"
            }`}
          >

            <div>{item.title}</div>

            <div className="flex flex-col gap-1 text-sm">
  
            {/* TIMER */}
            <div className="flex items-center gap-2">
              <span className="text-red-400">⏳</span>
              <span className={timeMap[item.id] === "Expired" ? "text-red-500" : "text-gray-200"}>
                {timeMap[item.id]}
              </span>
            </div>

            {/* EDIT DEADLINE */}
            <input
              type="date"
              value={item.deadline.split("T")[0]} 
              onChange={(e) => updateDeadline(item.id, e.target.value)}
              className="text-xs bg-black border border-white/10 rounded px-1 py-0.5 text-gray-300"
            />

          </div>


          <input
            type="range"
            min="0"
            max="100"
            value={item.progress}
            onChange={(e) => update(item.id, Number(e.target.value))}
            className="accent-red-500"
          />


          <div className="flex justify-center">
            <span
              className={`text-sm font-semibold px-2 py-1 rounded
              ${
                item.progress < 30
                  ? "text-red-400 bg-red-500/10"
                  : item.progress < 70
                  ? "text-yellow-400 bg-yellow-500/10"
                  : "text-green-400 bg-green-500/10"
              }`}
            >
              {item.progress}%
            </span>
          </div>

            <div className="">

              {item.difficulty === 1 && (
                <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-300 border border-green-500/30 font-semibold">
                  EASY
                </span>
              )}

              {item.difficulty === 2 && (
                <span className="px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 font-semibold">
                  MEDIUM
                </span>
              )}

              {item.difficulty === 3 && (
                <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-300 border border-red-500/30 font-semibold">
                  HARD
                </span>
              )}

            </div>

            <button onClick={() => remove(item.id)}>🗑️</button>

          </div>
        ))}
      </div>

    </main>
  );
}