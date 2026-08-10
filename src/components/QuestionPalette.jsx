import React from 'react';
import { Bookmark, CheckCircle2, Circle } from 'lucide-react';

export default function QuestionPalette({
  questions,
  currentIndex,
  answers,
  flagged,
  onSelectQuestion
}) {
  return (
    <div className="glass-panel p-4 rounded-xl border border-slate-700/50">
      <div className="flex items-center justify-between mb-3 border-b border-slate-700/50 pb-2">
        <h4 className="font-semibold text-slate-200 text-sm">Question Palette</h4>
        <span className="text-xs font-mono text-slate-400">{questions.length} Items</span>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-4 text-slate-300">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-indigo-600 border border-indigo-400"></span>
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-600 border border-emerald-400"></span>
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-400"></span>
          <span>Flagged</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-slate-700 border border-slate-600"></span>
          <span>Unanswered</span>
        </div>
      </div>

      {/* Palette Buttons */}
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 lg:grid-cols-5 gap-2 max-h-60 overflow-y-auto pr-1">
        {questions.map((q, idx) => {
          const isCurrent = idx === currentIndex;
          const hasAnswer = answers[q.id] && (
            Array.isArray(answers[q.id]) ? answers[q.id].length > 0 : answers[q.id].toString().trim() !== ''
          );
          const isFlagged = flagged.includes(q.id);

          let btnBg = "bg-slate-800 text-slate-400 border-slate-700";
          if (isCurrent) {
            btnBg = "bg-indigo-600 text-white font-bold border-indigo-400 ring-2 ring-indigo-400/50";
          } else if (isFlagged) {
            btnBg = "bg-amber-600/80 text-amber-100 border-amber-400 font-semibold";
          } else if (hasAnswer) {
            btnBg = "bg-emerald-600/80 text-emerald-100 border-emerald-400 font-semibold";
          }

          return (
            <button
              key={q.id}
              onClick={() => onSelectQuestion(idx)}
              className={`relative h-10 w-full rounded-lg border flex items-center justify-center text-xs transition active:scale-95 ${btnBg}`}
            >
              {idx + 1}
              {isFlagged && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-slate-900"></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
