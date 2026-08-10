import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export default function AntiCheatModal({ switchCount, onDismiss }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-rose-500/60 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center warning-overlay">
        <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/40">
          <ShieldAlert className="w-10 h-10 animate-bounce" />
        </div>

        <h3 className="text-xl font-bold text-rose-400 mb-2">Anti-Cheating Warning!</h3>
        <p className="text-slate-300 text-sm mb-4">
          You navigated away from the exam window or switched browser tabs!
        </p>

        <div className="bg-rose-950/50 border border-rose-800/40 rounded-lg p-3 mb-5">
          <div className="text-xs text-rose-300 uppercase tracking-wider font-semibold">Total Violation Count</div>
          <div className="text-2xl font-black text-rose-400">{switchCount} Warning{switchCount > 1 ? 's' : ''}</div>
          <div className="text-xs text-rose-400/80 mt-1">This violation count will be recorded in your final submission grade sheet for the administrator.</div>
        </div>

        <button
          onClick={onDismiss}
          className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg transition active:scale-95"
        >
          I Understand & Return to Exam
        </button>
      </div>
    </div>
  );
}
