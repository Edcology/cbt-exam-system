import React, { useState, useEffect } from 'react';
import { PlayCircle, PauseCircle, StopCircle, Key, Copy, Check, Eye, EyeOff, Plus, FileSpreadsheet } from 'lucide-react';
import { apiRequest } from '../api';
import { copyText } from '../utils/copy';

export default function AdminSessionManager({ token, onNavigateResults }) {
  const [sessions, setSessions] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create Session Form State
  const [selectedExamId, setSelectedExamId] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [scheduledStartTime, setScheduledStartTime] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sessionsData, examsData] = await Promise.all([
        apiRequest('/sessions', 'GET', null, token),
        apiRequest('/exams', 'GET', null, token)
      ]);
      setSessions(sessionsData);
      setExams(examsData);
      if (examsData.length > 0) setSelectedExamId(examsData[0].id);
    } catch (err) {
      setError('Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await apiRequest('/sessions', 'POST', {
        exam_id: selectedExamId,
        session_name: sessionName,
        scheduled_start_time: scheduledStartTime || null
      }, token);

      setSuccess(`Session launched! Code: ${res.session_code}`);
      setSessionName('');
      setScheduledStartTime('');
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to launch session');
    }
  };

  const handleUpdateStatus = async (sessionId, status) => {
    try {
      await apiRequest(`/sessions/${sessionId}/status`, 'PATCH', { status }, token);
      fetchData();
    } catch (err) {
      setError('Failed to update session status');
    }
  };

  const handleToggleResultRelease = async (sessionId, currentVal) => {
    try {
      const newVal = !currentVal;
      await apiRequest(`/sessions/${sessionId}/results-release`, 'PATCH', { results_released: newVal }, token);
      setSuccess(newVal ? 'Results released to candidates!' : 'Results withheld by admin');
      fetchData();
    } catch (err) {
      setError('Failed to update result release setting');
    }
  };

  const copyCode = (code) => {
    copyText(code)
      .then(() => {
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
      })
      .catch(err => console.error('Copy failed:', err));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Exam Session Control</h1>
          <p className="text-xs text-slate-400">Launch live sessions, manage session codes, and control result releases</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-lg transition"
        >
          <Plus className="w-4 h-4" /> Launch New Session
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs">
          {success}
        </div>
      )}

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map((s) => (
          <div key={s.id} className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
            <div>
              {/* Header Badge & Code */}
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  s.status === 'active'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : s.status === 'ended'
                    ? 'bg-slate-800 text-slate-400 border border-slate-700'
                    : 'bg-amber-950 text-amber-300 border border-amber-700'
                }`}>
                  {s.status}
                </span>

                <button
                  onClick={() => copyCode(s.session_code)}
                  className="flex items-center gap-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 text-xs px-2.5 py-1 rounded-lg font-mono font-bold transition"
                  title="Copy session code to share with examinees"
                >
                  <Key className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{s.session_code}</span>
                  {copiedCode === s.session_code ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              <h3 className="font-bold text-white text-base leading-snug">{s.session_name}</h3>
              <div className="text-xs text-indigo-300 mt-0.5">{s.exam_title} ({s.duration_minutes} Mins)</div>

              <div className="grid grid-cols-2 gap-2 text-xs mt-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <div>
                  <span className="block text-slate-500 text-[10px] font-semibold uppercase">Total Candidates</span>
                  <span className="font-extrabold text-white text-base">{s.total_submissions}</span>
                </div>
                <div>
                  <span className="block text-slate-500 text-[10px] font-semibold uppercase">Result Mode</span>
                  <span className={`text-[11px] font-bold ${s.results_released ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {s.results_released ? 'Released' : 'Withheld'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              {/* Session Status Control Buttons */}
              <div className="flex gap-1.5">
                {s.status !== 'active' && (
                  <button
                    onClick={() => handleUpdateStatus(s.id, 'active')}
                    className="flex-1 bg-emerald-600/30 hover:bg-emerald-600/70 border border-emerald-500/40 text-emerald-200 text-xs font-semibold py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1"
                  >
                    <PlayCircle className="w-3.5 h-3.5" /> Start
                  </button>
                )}
                {s.status === 'active' && (
                  <button
                    onClick={() => handleUpdateStatus(s.id, 'paused')}
                    className="flex-1 bg-amber-600/30 hover:bg-amber-600/70 border border-amber-500/40 text-amber-200 text-xs font-semibold py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1"
                  >
                    <PauseCircle className="w-3.5 h-3.5" /> Pause
                  </button>
                )}
                {s.status !== 'ended' && (
                  <button
                    onClick={() => handleUpdateStatus(s.id, 'ended')}
                    className="flex-1 bg-rose-600/30 hover:bg-rose-600/70 border border-rose-500/40 text-rose-200 text-xs font-semibold py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1"
                  >
                    <StopCircle className="w-3.5 h-3.5" /> End
                  </button>
                )}
              </div>

              {/* Release Results Toggle & Grade Sheet Navigation */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleToggleResultRelease(s.id, s.results_released)}
                  className={`flex-1 border text-xs font-semibold py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1 ${
                    s.results_released
                      ? 'bg-amber-950/60 border-amber-700/60 text-amber-300 hover:bg-amber-900'
                      : 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900'
                  }`}
                >
                  {s.results_released ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{s.results_released ? 'Withhold Results' : 'Release Results'}</span>
                </button>

                <button
                  onClick={() => onNavigateResults(s.id)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 px-3 rounded-xl shadow transition flex items-center gap-1"
                >
                  Grade Sheet & Monitor →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Launch New CBT Session</h3>
            <p className="text-slate-400 text-xs mb-4">
              Select an exam template from your question bank and assign a session batch name.
            </p>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Exam Template</label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  required
                >
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>{e.title} ({e.question_count} Questions)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Session / Batch Name</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g. Morning Batch 1 - Room 204"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Designated Start Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledStartTime}
                  onChange={(e) => setScheduledStartTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">Students cannot start until this designated time.</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2.5 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-xl shadow transition"
                >
                  Launch & Generate Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
