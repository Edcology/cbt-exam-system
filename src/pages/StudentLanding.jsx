import React, { useState } from 'react';
import { LogIn, Key, CheckCircle, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiRequest } from '../api';

export default function StudentLanding({ onExamLoaded, onNavigateAdmin }) {
  const [sessionCode, setSessionCode] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!sessionCode.trim()) {
      setError('Please enter a session code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/student/session-info/${sessionCode.trim()}`);
      setSessionInfo(data);

      // Initialize form data defaults
      const initialForm = {};
      data.custom_fields.forEach(f => {
        initialForm[f.field_name] = f.options && f.options.length > 0 ? f.options[0] : '';
      });
      setFormData(initialForm);
    } catch (err) {
      setError(err.message);
      setSessionInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleStartExam = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const examData = await apiRequest('/student/start-exam', 'POST', {
        session_id: sessionInfo.session_id,
        student_details: formData
      });

      onExamLoaded(examData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-4 shadow-lg shadow-indigo-500/10">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">CBT Exam Portal</h1>
        <p className="text-slate-400 text-sm mt-1">Local Network Assessment System</p>
      </div>

      {/* Step 1: Session Code Input */}
      {!sessionInfo ? (
        <div className="glass-panel p-6 md:p-8 rounded-2xl">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-400" />
            Enter Exam Session Code
          </h2>
          <p className="text-slate-400 text-xs mb-6">
            Input the 6-character session code provided by your administrator (e.g. CBT-8421). No account creation required!
          </p>

          {error && (
            <div className="mb-4 p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">Session Code</label>
              <input
                type="text"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                placeholder="e.g. CBT-8421"
                className="w-full bg-slate-900/90 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-lg font-mono text-center tracking-widest text-white uppercase outline-none transition"
                maxLength={10}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2"
            >
              {loading ? 'Verifying Session Code...' : 'Proceed to Candidate Details →'}
            </button>
          </form>

          <div className="mt-8 pt-4 border-t border-slate-800 text-center">
            <button
              onClick={onNavigateAdmin}
              className="text-xs text-slate-400 hover:text-indigo-400 transition"
            >
              Are you an Administrator? <span className="underline font-semibold">Login to Admin Portal</span>
            </button>
          </div>
        </div>
      ) : (
        /* Step 2: Custom Registration Fields */
        <div className="glass-panel p-6 md:p-8 rounded-2xl">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-6">
            <div>
              <span className="text-xs font-mono bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/40">
                {sessionInfo.session_code}
              </span>
              <h2 className="text-xl font-bold text-white mt-1">{sessionInfo.exam_title}</h2>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-slate-300 text-xs">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Duration</span>
              </div>
              <div className="text-sm font-bold text-indigo-300">{sessionInfo.duration_minutes} Minutes</div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-slate-200 mb-4">Candidate Registration Information</h3>

          {error && (
            <div className="mb-4 p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleStartExam} className="space-y-4">
            {sessionInfo.custom_fields.map((field) => (
              <div key={field.id}>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {field.field_name} {field.is_required ? <span className="text-rose-400">*</span> : ''}
                </label>

                {field.field_type === 'select' ? (
                  <select
                    value={formData[field.field_name] || ''}
                    onChange={(e) => handleInputChange(field.field_name, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                    required={field.is_required === 1}
                  >
                    <option value="">Select option...</option>
                    {field.options && field.options.map((opt, idx) => (
                      <option key={idx} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.field_type === 'number' ? 'number' : 'text'}
                    value={formData[field.field_name] || ''}
                    onChange={(e) => handleInputChange(field.field_name, e.target.value)}
                    placeholder={`Enter your ${field.field_name.toLowerCase()}`}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                    required={field.is_required === 1}
                  />
                )}
              </div>
            ))}

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setSessionInfo(null)}
                className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-4 rounded-xl text-sm transition"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm"
              >
                {loading ? 'Launching Exam...' : 'Start Timed Exam Now →'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
