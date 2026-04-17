"use client";

import { useState } from "react";

export default function AddModal({ onClose, onAdd }: any) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [progress, setProgress] = useState(0);
  const [difficulty, setDifficulty] = useState(3);

  const handleSubmit = () => {
    if (!title || !deadline) return;

    const newMilestone = {
      id: Date.now(),
      title,
      deadline,
      progress,
      difficulty,
    };

    onAdd(newMilestone);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
      
      <div className="bg-gray-900 border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl">
        
        <h2 className="text-xl font-semibold mb-4">
          ➕ Add Milestone
        </h2>

        {/* Title */}
        <input
          placeholder="Milestone title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full mb-3 p-2 rounded bg-[#111827] text-gray-100 border border-gray-700 outline-none focus:border-purple-500"
        />

        {/* Deadline */}
        <div className="relative mb-3">

          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full p-2 rounded bg-[#ffffff] text-gray-100 border border-gray-700 outline-none focus:border-purple-500"
          />

          </div>

        {/* Progress */}
        <div className="mb-3">
          <label className="text-sm">Progress: {progress}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Difficulty */}
        <div className="mb-4">
          <label className="text-sm">
            Difficulty: {"🔥".repeat(difficulty)}
          </label>
          <input
            type="range"
            min="1"
            max="5"
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white font-semibold hover:scale-105 transition"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}