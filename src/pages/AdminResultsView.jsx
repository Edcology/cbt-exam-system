import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Search, Eye, ArrowLeft, ShieldAlert, Award, Clock, Activity, RefreshCw, Printer, CheckCircle2, XCircle, Users, Download } from 'lucide-react';
import { apiRequest } from '../api';

export default function AdminResultsView({ token, sessionId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRosterTab, setActiveRosterTab] = useState('all'); // 'all', 'passed', 'failed', 'in_progress'
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSubmissions();
    const autoRefresh = setInterval(() => {
      fetchSubmissions(true);
    }, 5000);

    return () => clearInterval(autoRefresh);
  }, [sessionId]);

  const fetchSubmissions = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await apiRequest(`/sessions/${sessionId}/submissions`, 'GET', null, token);
      setData(res);
    } catch (err) {
      if (!silent) setError('Failed to fetch session candidates');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/export-excel?token=${encodeURIComponent(token)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to download grade sheet');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CBT_Results_${session.session_name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to download grade sheet Excel file');
    }
  };

  const handleRegrade = async () => {
    setError('');
    try {
      const res = await apiRequest(`/sessions/${sessionId}/regrade`, 'POST', null, token);
      alert(res.message);
      fetchSubmissions();
    } catch (err) {
      setError(err.message || 'Failed to re-grade submissions');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-400 text-sm">Loading candidates grade roster...</div>;
  }

  if (!data) return null;

  const { session, submissions } = data;

  // Split submissions into Passed, Failed, and In-Progress
  const submitted = submissions.filter(s => s.status === 'submitted');
  const inProgress = submissions.filter(s => s.status === 'in_progress');

  const passedList = submitted.filter(s => s.passed === 1 && (
    s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    JSON.stringify(s.student_details).toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const failedList = submitted.filter(s => s.passed === 0 && (
    s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    JSON.stringify(s.student_details).toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const inProgressList = inProgress.filter(s => (
    s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    JSON.stringify(s.student_details).toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const totalSubmitted = submitted.length;
  const passRate = totalSubmitted > 0 ? ((passedList.length / totalSubmitted) * 100).toFixed(1) : 0;
  const failRate = totalSubmitted > 0 ? ((failedList.length / totalSubmitted) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Action Header - Screen Only */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">Candidates Pass / Fail Roster</h1>
              {refreshing && <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
            </div>
            <p className="text-xs text-slate-400">
              Exam: <span className="text-white font-semibold">{session.exam_title}</span> | Session Code: <span className="text-indigo-300 font-mono">{session.session_code}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs py-2 px-3 rounded-xl border border-slate-700 transition"
          >
            <Printer className="w-4 h-4 text-amber-400" /> Print / Save PDF
          </button>

          <button
            onClick={handleRegrade}
            className="flex items-center gap-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 font-bold text-xs py-2 px-3 rounded-xl transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-Grade
          </button>

          <button
            onClick={handleExportExcel}
            disabled={submissions.length === 0}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-lg transition"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="print:hidden p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Overview Stat Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl text-center">
          <div className="text-xs text-slate-400 font-bold uppercase">Total Candidates</div>
          <div className="text-2xl font-black text-white mt-1">{submissions.length}</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border-l-4 border-l-emerald-500 text-center">
          <div className="flex items-center justify-center gap-1 text-xs font-bold text-emerald-400 uppercase">
            <CheckCircle2 className="w-4 h-4" /> Passed Students
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{passedList.length}</div>
          <div className="text-[10px] text-emerald-300 font-semibold">{passRate}% Pass Rate</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border-l-4 border-l-rose-500 text-center">
          <div className="flex items-center justify-center gap-1 text-xs font-bold text-rose-400 uppercase">
            <XCircle className="w-4 h-4" /> Failed Students
          </div>
          <div className="text-2xl font-black text-rose-400 mt-1">{failedList.length}</div>
          <div className="text-[10px] text-rose-300 font-semibold">{failRate}% Fail Rate</div>
        </div>

        <div className="glass-panel p-4 rounded-xl text-center">
          <div className="text-xs text-slate-400 font-bold uppercase">Pass Cut-Off Mark</div>
          <div className="text-2xl font-black text-indigo-300 mt-1">{session.passing_score}%</div>
          <div className="text-[10px] text-slate-400">Required to pass</div>
        </div>
      </div>

      {/* Filter Bar & Tabs */}
      <div className="print:hidden glass-panel p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-800 flex-1">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search candidate name, matric/reg number, department..."
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="flex gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveRosterTab('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              activeRosterTab === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Students ({submitted.length})
          </button>

          <button
            onClick={() => setActiveRosterTab('passed')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              activeRosterTab === 'passed' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            🟢 Passed Only ({passedList.length})
          </button>

          <button
            onClick={() => setActiveRosterTab('failed')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              activeRosterTab === 'failed' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            🔴 Failed Only ({failedList.length})
          </button>

          {inProgress.length > 0 && (
            <button
              onClick={() => setActiveRosterTab('in_progress')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                activeRosterTab === 'in_progress' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              ⏳ Live Active ({inProgress.length})
            </button>
          )}
        </div>
      </div>

      {/* PRINTABLE OFFICIAL RESULTS ROSTER */}
      <div className="space-y-8 print:bg-white print:text-slate-900">
        
        {/* SECTION 1: PASSED STUDENTS */}
        {(activeRosterTab === 'all' || activeRosterTab === 'passed') && (
          <div className="glass-panel p-6 rounded-2xl border-t-4 border-t-emerald-500 print:shadow-none print:p-0 print:border-none">
            <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-300 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 print:text-emerald-700" />
                <h2 className="text-lg font-extrabold text-emerald-400 print:text-emerald-800">
                  PASSED STUDENTS ({passedList.length})
                </h2>
              </div>
              <span className="text-xs font-bold text-emerald-300 print:text-emerald-700 bg-emerald-950/80 print:bg-emerald-100 border border-emerald-700/60 print:border-emerald-400 px-3 py-1 rounded-full">
                Score ≥ {session.passing_score}%
              </span>
            </div>

            {passedList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-emerald-950/60 print:bg-emerald-100 text-emerald-300 print:text-emerald-900 font-bold border-b border-emerald-800 print:border-emerald-300">
                      <th className="p-3">#</th>
                      <th className="p-3">Candidate Name</th>
                      <th className="p-3">Registration / Details</th>
                      <th className="p-3 text-center">Score / Total</th>
                      <th className="p-3 text-center">Percentage</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right print:hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 print:divide-slate-300 text-slate-200 print:text-slate-900">
                    {passedList.map((sub, idx) => (
                      <tr key={sub.id} className="hover:bg-slate-800/40 print:hover:bg-transparent">
                        <td className="p-3 font-mono text-slate-500 print:text-slate-600">{idx + 1}</td>
                        <td className="p-3 font-bold text-white print:text-slate-900">{sub.student_name}</td>
                        <td className="p-3 text-[11px] text-slate-400 print:text-slate-600">
                          {Object.entries(sub.student_details)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' | ')}
                        </td>
                        <td className="p-3 text-center font-bold">{sub.score} / {sub.total_marks}</td>
                        <td className="p-3 text-center font-black text-emerald-400 print:text-emerald-700 text-sm">
                          {sub.percentage.toFixed(1)}%
                        </td>
                        <td className="p-3 text-center">
                          <span className="bg-emerald-950 print:bg-emerald-100 text-emerald-300 print:text-emerald-800 border border-emerald-700 print:border-emerald-400 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase">
                            PASSED
                          </span>
                        </td>
                        <td className="p-3 text-right print:hidden">
                          <button
                            onClick={() => setSelectedSubmission(sub)}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded border border-slate-700 transition"
                          >
                            View Answers
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs italic">
                No candidates passed in this list.
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: FAILED STUDENTS */}
        {(activeRosterTab === 'all' || activeRosterTab === 'failed') && (
          <div className="glass-panel p-6 rounded-2xl border-t-4 border-t-rose-500 print:shadow-none print:p-0 print:border-none">
            <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-300 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-400 print:text-rose-700" />
                <h2 className="text-lg font-extrabold text-rose-400 print:text-rose-800">
                  FAILED STUDENTS ({failedList.length})
                </h2>
              </div>
              <span className="text-xs font-bold text-rose-300 print:text-rose-700 bg-rose-950/80 print:bg-rose-100 border border-rose-700/60 print:border-rose-400 px-3 py-1 rounded-full">
                Score &lt; {session.passing_score}%
              </span>
            </div>

            {failedList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-rose-950/60 print:bg-rose-100 text-rose-300 print:text-rose-900 font-bold border-b border-rose-800 print:border-rose-300">
                      <th className="p-3">#</th>
                      <th className="p-3">Candidate Name</th>
                      <th className="p-3">Registration / Details</th>
                      <th className="p-3 text-center">Score / Total</th>
                      <th className="p-3 text-center">Percentage</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right print:hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 print:divide-slate-300 text-slate-200 print:text-slate-900">
                    {failedList.map((sub, idx) => (
                      <tr key={sub.id} className="hover:bg-slate-800/40 print:hover:bg-transparent">
                        <td className="p-3 font-mono text-slate-500 print:text-slate-600">{idx + 1}</td>
                        <td className="p-3 font-bold text-white print:text-slate-900">{sub.student_name}</td>
                        <td className="p-3 text-[11px] text-slate-400 print:text-slate-600">
                          {Object.entries(sub.student_details)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' | ')}
                        </td>
                        <td className="p-3 text-center font-bold">{sub.score} / {sub.total_marks}</td>
                        <td className="p-3 text-center font-black text-rose-400 print:text-rose-700 text-sm">
                          {sub.percentage.toFixed(1)}%
                        </td>
                        <td className="p-3 text-center">
                          <span className="bg-rose-950 print:bg-rose-100 text-rose-300 print:text-rose-800 border border-rose-700 print:border-rose-400 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase">
                            FAILED
                          </span>
                        </td>
                        <td className="p-3 text-right print:hidden">
                          <button
                            onClick={() => setSelectedSubmission(sub)}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded border border-slate-700 transition"
                          >
                            View Answers
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs italic">
                No candidates failed in this list.
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: IN PROGRESS CANDIDATES (IF ANY) */}
        {(activeRosterTab === 'all' || activeRosterTab === 'in_progress') && inProgressList.length > 0 && (
          <div className="glass-panel p-6 rounded-2xl border-t-4 border-t-amber-500 print:hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-400 animate-pulse" />
                <h2 className="text-lg font-extrabold text-amber-400">
                  LIVE IN-PROGRESS CANDIDATES ({inProgressList.length})
                </h2>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-amber-950/60 text-amber-300 font-bold border-b border-amber-800">
                    <th className="p-3">#</th>
                    <th className="p-3">Candidate Name</th>
                    <th className="p-3">Registration Details</th>
                    <th className="p-3">Time Spent</th>
                    <th className="p-3">Tab Switch Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {inProgressList.map((sub, idx) => (
                    <tr key={sub.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-3 font-bold text-white">{sub.student_name}</td>
                      <td className="p-3 text-[11px] text-slate-400">
                        {Object.entries(sub.student_details)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' | ')}
                      </td>
                      <td className="p-3 font-mono text-amber-300">
                        {Math.floor(sub.time_spent_seconds / 60)}m {sub.time_spent_seconds % 60}s
                      </td>
                      <td className="p-3 font-bold text-rose-400">
                        {sub.tab_switch_count} violations
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Student Answer Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedSubmission.student_name}</h3>
                <div className="text-xs text-indigo-300">
                  Score: <strong className="text-white">{selectedSubmission.score} / {selectedSubmission.total_marks}</strong> ({selectedSubmission.percentage.toFixed(1)}%)
                </div>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="text-slate-400 hover:text-white text-xs bg-slate-800 px-3 py-1.5 rounded-lg"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              {Object.entries(selectedSubmission.answers).map(([qId, ans]) => (
                <div key={qId} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                  <div className="font-semibold text-slate-200 mb-1">Question ID: #{qId}</div>
                  <div className="text-indigo-300 font-mono">
                    Selected Option: {Array.isArray(ans) ? ans.join(', ') : ans}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
