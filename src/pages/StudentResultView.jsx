import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, Award, Clock, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function StudentResultView({ resultData, onReset }) {
  const {
    can_view_results,
    student_name,
    exam_title,
    score,
    total_marks,
    percentage,
    passed,
    message,
    breakdown
  } = resultData;

  useEffect(() => {
    if (can_view_results && passed) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [can_view_results, passed]);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* If Admin set results as pending/withheld */}
      {!can_view_results ? (
        <div className="glass-panel p-8 rounded-2xl text-center">
          <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Exam Submitted Successfully!</h2>
          <p className="text-slate-300 text-sm max-w-md mx-auto mb-6 leading-relaxed">
            {message || 'Your test responses have been securely submitted to the local database server. Results will be made available once released by your administrator.'}
          </p>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 max-w-sm mx-auto mb-8 text-left text-xs space-y-2 text-slate-300">
            <div className="flex justify-between">
              <span>Candidate:</span>
              <span className="font-semibold text-white">{student_name}</span>
            </div>
            <div className="flex justify-between">
              <span>Exam:</span>
              <span className="font-semibold text-white">{exam_title}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-emerald-400 font-bold uppercase">Submitted & Recorded</span>
            </div>
          </div>

          <button
            onClick={onReset}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl text-sm transition shadow-lg"
          >
            Return to Portal Homepage
          </button>
        </div>
      ) : (
        /* Results View (Immediate or Admin Released) */
        <div className="space-y-6">
          {/* Main Score Card */}
          <div className={`glass-panel p-8 rounded-2xl text-center border-2 ${
            passed ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-rose-500/50 bg-rose-950/20'
          }`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 shadow-xl ${
              passed ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-rose-500/20 text-rose-400 border-rose-500/50'
            }`}>
              {passed ? <Award className="w-12 h-12" /> : <XCircle className="w-12 h-12" />}
            </div>

            <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${
              passed ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700' : 'bg-rose-900/60 text-rose-300 border-rose-700'
            }`}>
              {passed ? 'PASSED' : 'FAILED'}
            </span>

            <h2 className="text-3xl font-extrabold text-white mt-3 mb-1">{exam_title}</h2>
            <p className="text-slate-400 text-xs mb-6">Candidate: <span className="text-slate-200 font-semibold">{student_name}</span></p>

            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-6">
              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Score</div>
                <div className="text-xl font-black text-white">{score} <span className="text-xs text-slate-400">/ {total_marks}</span></div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Percentage</div>
                <div className={`text-xl font-black ${passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {percentage ? percentage.toFixed(1) : 0}%
                </div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Status</div>
                <div className={`text-sm font-bold mt-1 ${passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {passed ? 'SUCCESS' : 'RE-TAKE'}
                </div>
              </div>
            </div>

            <button
              onClick={onReset}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition shadow-lg"
            >
              Done & Exit
            </button>
          </div>

          {/* Question Breakdown Section */}
          {breakdown && breakdown.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-400" />
                Detailed Question Performance Review
              </h3>

              <div className="space-y-4">
                {breakdown.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border ${
                      item.is_correct
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-rose-950/20 border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          item.is_correct ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                        }`}>
                          {idx + 1}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-100">{item.question_text}</h4>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border shrink-0 ${
                        item.is_correct ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700' : 'bg-rose-900/60 text-rose-300 border-rose-700'
                      }`}>
                        {item.is_correct ? `+${item.marks} Mark` : '0 Marks'}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 mt-3 pl-8 text-slate-300">
                      <div>
                        <span className="font-semibold text-slate-400">Your Answer: </span>
                        <span className={item.is_correct ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                          {Array.isArray(item.student_answer) ? item.student_answer.join(', ') || 'No answer' : item.student_answer || 'No answer'}
                        </span>
                      </div>
                      {!item.is_correct && (
                        <div>
                          <span className="font-semibold text-slate-400">Correct Key: </span>
                          <span className="text-emerald-400 font-semibold">
                            {Array.isArray(item.correct_answers) ? item.correct_answers.join(', ') : item.correct_answers}
                          </span>
                        </div>
                      )}
                      {item.explanation && (
                        <div className="mt-2 text-indigo-300 bg-indigo-950/50 p-2.5 rounded-lg border border-indigo-800/40 text-[11px]">
                          💡 <span className="font-semibold">Explanation:</span> {item.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
