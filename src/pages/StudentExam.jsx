import React, { useState, useEffect, useRef } from 'react';
import { Clock, Bookmark, ChevronLeft, ChevronRight, Send, AlertTriangle, Maximize, ShieldAlert } from 'lucide-react';
import QuestionPalette from '../components/QuestionPalette';
import AntiCheatModal from '../components/AntiCheatModal';
import { apiRequest } from '../api';

export default function StudentExam({ examData, onExamSubmitted }) {
  const { submission_id, session_id, exam_title, duration_minutes, student_name, student_details, questions } = examData;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [qId]: answerArrayOrString }
  const [flagged, setFlagged] = useState([]); // array of qIds
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(duration_minutes * 60);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);

  // Anti-cheating state
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const currentQuestion = questions[currentIndex];

  // Countdown timer & time spent ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit(); // Auto-submit when time reaches 0
          return 0;
        }
        return prev - 1;
      });
      setTimeSpentSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Periodic heartbeat ping to update live candidate progress in DB
  useEffect(() => {
    if (!submission_id) return;
    const pingTimer = setInterval(() => {
      apiRequest('/student/ping-exam', 'POST', {
        submission_id,
        tab_switch_count: tabSwitchCount,
        time_spent_seconds: timeSpentSeconds,
        answers
      }).catch(err => console.error('Ping error:', err));
    }, 10000);

    return () => clearInterval(pingTimer);
  }, [submission_id, tabSwitchCount, timeSpentSeconds, answers]);

  // Anti-Cheating Event Listeners (tab switch & visibility change)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => prev + 1);
        setShowWarningModal(true);
      }
    };

    const handleBlur = () => {
      setTabSwitchCount(prev => prev + 1);
      setShowWarningModal(true);
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Prevent right click & copy paste
  useEffect(() => {
    const preventAction = (e) => e.preventDefault();
    document.addEventListener('contextmenu', preventAction);
    document.addEventListener('copy', preventAction);
    document.addEventListener('paste', preventAction);

    return () => {
      document.removeEventListener('contextmenu', preventAction);
      document.removeEventListener('copy', preventAction);
      document.removeEventListener('paste', preventAction);
    };
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleOptionSelect = (qId, optionValue, isMultiple) => {
    setAnswers(prev => {
      const currentAns = prev[qId] || [];
      if (isMultiple) {
        let updated = Array.isArray(currentAns) ? [...currentAns] : [currentAns];
        if (updated.includes(optionValue)) {
          updated = updated.filter(v => v !== optionValue);
        } else {
          updated.push(optionValue);
        }
        return { ...prev, [qId]: updated };
      } else {
        return { ...prev, [qId]: [optionValue] };
      }
    });
  };

  const toggleFlag = (qId) => {
    setFlagged(prev => prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]);
  };

  const handleAutoSubmit = () => {
    submitExamPayload();
  };

  const submitExamPayload = async () => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const resultData = await apiRequest('/student/submit-exam', 'POST', {
        submission_id,
        session_id,
        student_name,
        student_details,
        answers,
        tab_switch_count: tabSwitchCount,
        time_spent_seconds: timeSpentSeconds
      });

      onExamSubmitted(resultData);
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit exam. Please inform supervisor.');
      setIsSubmitting(false);
    }
  };

  const answeredCount = Object.keys(answers).filter(qId => {
    const val = answers[qId];
    return Array.isArray(val) ? val.length > 0 : val;
  }).length;

  const isLowTime = timeLeftSeconds <= 300; // < 5 minutes remaining

  return (
    <div className="min-h-screen py-4 px-3 max-w-7xl mx-auto select-none">
      {/* Top Fixed Header */}
      <div className="glass-panel p-4 rounded-xl mb-4 flex flex-wrap items-center justify-between gap-4 border border-indigo-500/20">
        <div>
          <span className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">Timed CBT Assessment</span>
          <h2 className="text-xl font-bold text-white">{exam_title}</h2>
          <div className="text-xs text-slate-400 mt-0.5">
            Candidate: <span className="text-slate-200 font-semibold">{student_name}</span>
          </div>
        </div>

        {/* Anti-Cheat Tab Switch Warning Badge */}
        {tabSwitchCount > 0 && (
          <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-500/60 text-rose-300 text-xs px-3 py-1.5 rounded-xl font-semibold">
            <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
            <span>Tab Switches: {tabSwitchCount}</span>
          </div>
        )}

        {/* Timer */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold border transition ${
          isLowTime
            ? 'bg-rose-950/80 border-rose-500 text-rose-400 animate-pulse'
            : 'bg-indigo-950/80 border-indigo-500/40 text-indigo-300'
        }`}>
          <Clock className={`w-5 h-5 ${isLowTime ? 'text-rose-400' : 'text-indigo-400'}`} />
          <span>{formatTime(timeLeftSeconds)}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Question Player (3 Cols) */}
        <div className="lg:col-span-3 glass-panel p-6 rounded-2xl flex flex-col justify-between min-h-[500px]">
          <div>
            {/* Question Header & Flag Toggle */}
            <div className="flex items-center justify-between mb-4 border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="bg-indigo-600/30 text-indigo-300 text-xs font-bold px-2.5 py-1 rounded-lg border border-indigo-500/30">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({currentQuestion.marks} Mark{currentQuestion.marks > 1 ? 's' : ''})
                </span>
                {currentQuestion.type === 'multiple_choice' && (
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30 uppercase">
                    Select All That Apply
                  </span>
                )}
              </div>

              <button
                onClick={() => toggleFlag(currentQuestion.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  flagged.includes(currentQuestion.id)
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{flagged.includes(currentQuestion.id) ? 'Flagged for Review' : 'Flag Question'}</span>
              </button>
            </div>

            {/* Question Text */}
            <h3 className="text-lg md:text-xl font-medium text-slate-100 mb-6 leading-relaxed">
              {currentQuestion.question_text}
            </h3>

            {/* Options */}
            <div className="space-y-3 mb-6">
              {currentQuestion.options.map((opt, optIdx) => {
                const selectedList = answers[currentQuestion.id] || [];
                const isSelected = selectedList.includes(opt);
                const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

                return (
                  <div
                    key={optIdx}
                    onClick={() => handleOptionSelect(
                      currentQuestion.id,
                      opt,
                      currentQuestion.type === 'multiple_choice'
                    )}
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-indigo-600/30 border-indigo-400 text-white font-medium shadow-md shadow-indigo-500/10'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-bold transition ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {letter}
                    </div>
                    <span className="text-sm md:text-base flex-1">{opt}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 text-sm font-semibold px-4 py-2.5 rounded-xl transition"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg transition"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg transition"
              >
                <Send className="w-4 h-4" /> Finish & Submit Exam
              </button>
            )}
          </div>
        </div>

        {/* Question Palette Sidebar (1 Col) */}
        <div className="space-y-4">
          <QuestionPalette
            questions={questions}
            currentIndex={currentIndex}
            answers={answers}
            flagged={flagged}
            onSelectQuestion={(idx) => setCurrentIndex(idx)}
          />

          <div className="glass-panel p-4 rounded-xl border border-slate-800 text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Progress Summary</div>
            <div className="text-xl font-extrabold text-indigo-400">
              {answeredCount} / {questions.length} <span className="text-xs font-normal text-slate-400">Answered</span>
            </div>

            <button
              onClick={() => setShowSubmitModal(true)}
              className="w-full mt-4 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-md flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Submit Exam Now
            </button>
          </div>
        </div>
      </div>

      {/* Anti-Cheat Warning Dialog */}
      {showWarningModal && (
        <AntiCheatModal
          switchCount={tabSwitchCount}
          onDismiss={() => setShowWarningModal(false)}
        />
      )}

      {/* Submit Confirmation Dialog */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
            <h3 className="text-xl font-bold text-white mb-2">Submit Exam Confirmation</h3>
            <p className="text-slate-300 text-xs mb-4">
              Are you sure you want to finish and submit your CBT assessment?
            </p>

            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 mb-6 text-left space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Total Questions:</span>
                <span className="font-bold text-white">{questions.length}</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-semibold">
                <span>Answered Questions:</span>
                <span>{answeredCount}</span>
              </div>
              <div className="flex justify-between text-rose-400 font-semibold">
                <span>Unanswered Questions:</span>
                <span>{questions.length - answeredCount}</span>
              </div>
              {flagged.length > 0 && (
                <div className="flex justify-between text-amber-400 font-semibold">
                  <span>Flagged Questions:</span>
                  <span>{flagged.length}</span>
                </div>
              )}
            </div>

            {submitError && (
              <div className="mb-4 p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs">
                {submitError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
                className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2.5 px-4 rounded-xl transition"
              >
                Return to Exam
              </button>
              <button
                onClick={submitExamPayload}
                disabled={isSubmitting}
                className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? 'Submitting...' : 'Yes, Final Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
