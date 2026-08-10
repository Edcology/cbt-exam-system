import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Search, Eye, ArrowLeft, ShieldAlert, Award, Clock, Activity, RefreshCw } from 'lucide-react';
import { apiRequest } from '../api';

export default function AdminResultsView({ token, sessionId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'in_progress', 'submitted'
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSubmissions();
    const autoRefresh = setInterval(() => {
      fetchSubmissions(true);
    }, 5000); // Auto-refresh live candidates every 5 seconds!

    return () => clearInterval(autoRefresh);
  }, [sessionId]);

  const fetchSubmissions = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await apiRequest(`/sessions/${sessionId}/submissions`, 'GET', null, token);
      setData(res);
    } catch (err) {
      if (!silent) setError('Failed to fetch session candidates and grade sheet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleExportExcel = () => {
    window.open(`/api/sessions/${sessionId}/export-excel`, '_blank');
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-400 text-sm">Loading session candidates...</div>;
  }

  if (!data) return null;

  const { session, submissions } = data;

  // Filter candidates by status & search query
  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = sub.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(sub.student_details).toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'in_progress') return sub.status === 'in_progress';
    if (filterStatus === 'submitted') return sub.status === 'submitted';
    return true;
  });

  const inProgressCount = submissions.filter(s => s.status === 'in_progress').length;
  const submittedCount = submissions.filter(s => s.status === 'submitted').length;
  const passedCount = submissions.filter(s => s.status === 'submitted' && s.passed === 1).length;
  const avgScore = submittedCount > 0
    ? (submissions.filter(s => s.status === 'submitted').reduce((acc, s) => acc + s.percentage, 0) / submittedCount).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">Candidate Monitor & Grade Sheet</h1>
              {refreshing && <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
            </div>
            <p className="text-xs text-slate-400">
              Session: <span className="text-indigo-300 font-semibold">{session.session_name}</span> ({session.session_code})
            </p>
          </div>
        </div>

        <button
          onClick={handleExportExcel}
          disabled={submissions.length === 0}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg transition"
        >
          <FileSpreadsheet className="w-4 h-4" /> Export Grade Sheet (.xlsx)
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-semibold uppercase">Total Candidates Registered</div>
          <div className="text-2xl font-extrabold text-white mt-1">{submissions.length}</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
            <span>Currently Active</span>
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">{inProgressCount}</div>
          <div className="text-[10px] text-slate-400">Examinees taking test now</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border-l-4 border-l-indigo-500">
          <div className="text-xs text-slate-400 font-semibold uppercase">Submitted Tests</div>
          <div className="text-2xl font-extrabold text-indigo-400 mt-1">{submittedCount}</div>
          <div className="text-[10px] text-slate-400">Completed assessments</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border-l-4 border-l-amber-500">
          <div className="text-xs text-slate-400 font-semibold uppercase">Average Score</div>
          <div className="text-2xl font-extrabold text-amber-400 mt-1">{avgScore}%</div>
        </div>
      </div>

      {/* Filter / Search Bar & Status Tabs */}
      <div className="glass-panel p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter candidates by name, registration ID, department..."
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="flex gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg transition font-semibold ${
              filterStatus === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({submissions.length})
          </button>
          <button
            onClick={() => setFilterStatus('in_progress')}
            className={`px-3 py-1.5 rounded-lg transition font-semibold ${
              filterStatus === 'in_progress' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            🟢 Live Active ({inProgressCount})
          </button>
          <button
            onClick={() => setFilterStatus('submitted')}
            className={`px-3 py-1.5 rounded-lg transition font-semibold ${
              filterStatus === 'submitted' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            🔵 Submitted ({submittedCount})
          </button>
        </div>
      </div>

      {/* Candidate Table */}
      <div className="glass-panel p-6 rounded-2xl">
        {filteredSubmissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Candidate Name</th>
                  <th className="p-3">Registration Details</th>
                  <th className="p-3">Live Status</th>
                  <th className="p-3">Score / Marks</th>
                  <th className="p-3">Percentage</th>
                  <th className="p-3">Tab Violations</th>
                  <th className="p-3">Time Spent</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredSubmissions.map((sub, idx) => (
                  <tr key={sub.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-bold text-white flex items-center gap-1.5">
                      {sub.status === 'in_progress' && (
                        <span className="relative flex h-2 w-2" title="Taking Exam Right Now">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                      <span>{sub.student_name}</span>
                    </td>
                    <td className="p-3 text-[11px] text-slate-400 max-w-xs truncate">
                      {Object.entries(sub.student_details)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' | ')}
                    </td>
                    <td className="p-3">
                      {sub.status === 'in_progress' ? (
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 w-max">
                          <Activity className="w-3 h-3 animate-pulse" /> In Progress
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          sub.passed
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                            : 'bg-rose-950 text-rose-300 border border-rose-700'
                        }`}>
                          {sub.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold">
                      {sub.status === 'submitted' ? `${sub.score} / ${sub.total_marks}` : '—'}
                    </td>
                    <td className="p-3 font-extrabold">
                      {sub.status === 'submitted' ? `${sub.percentage.toFixed(1)}%` : '—'}
                    </td>
                    <td className="p-3">
                      {sub.tab_switch_count > 0 ? (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> {sub.tab_switch_count} Violations
                        </span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400 font-mono">
                      {Math.floor(sub.time_spent_seconds / 60)}m {sub.time_spent_seconds % 60}s
                    </td>
                    <td className="p-3 text-right">
                      {sub.status === 'submitted' ? (
                        <button
                          onClick={() => setSelectedSubmission(sub)}
                          className="text-xs bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-300 px-2.5 py-1 rounded border border-indigo-500/40 transition flex items-center gap-1 ml-auto"
                        >
                          <Eye className="w-3 h-3" /> View Answers
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">Taking test...</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 text-xs">
            No candidates registered or matching your query yet.
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
              {Object.entries(selectedSubmission.answers).map(([qId, ans], idx) => (
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
