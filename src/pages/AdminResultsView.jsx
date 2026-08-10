import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Search, Eye, ArrowLeft, ShieldAlert, Award, Clock, Activity, RefreshCw, Printer, BarChart3, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { apiRequest } from '../api';

export default function AdminResultsView({ token, sessionId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'in_progress', 'submitted', 'passed', 'failed'
  const [viewMode, setViewMode] = useState('table'); // 'table', 'executive-report'
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
      if (!silent) setError('Failed to fetch session candidates and grade sheet');
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

  const handlePrintReport = () => {
    window.print();
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-400 text-sm">Loading session candidates...</div>;
  }

  if (!data) return null;

  const { session, submissions } = data;

  // Compute Metrics
  const submittedSubmissions = submissions.filter(s => s.status === 'submitted');
  const inProgressSubmissions = submissions.filter(s => s.status === 'in_progress');
  const passedSubmissions = submittedSubmissions.filter(s => s.passed === 1);
  const failedSubmissions = submittedSubmissions.filter(s => s.passed === 0);

  const passedCount = passedSubmissions.length;
  const failedCount = failedSubmissions.length;
  const totalSubmitted = submittedSubmissions.length;

  const passRate = totalSubmitted > 0 ? ((passedCount / totalSubmitted) * 100).toFixed(1) : 0;
  const failRate = totalSubmitted > 0 ? ((failedCount / totalSubmitted) * 100).toFixed(1) : 0;

  const scoresList = submittedSubmissions.map(s => s.percentage);
  const avgScore = totalSubmitted > 0 ? (scoresList.reduce((a, b) => a + b, 0) / totalSubmitted).toFixed(1) : 0;
  const highestScore = totalSubmitted > 0 ? Math.max(...scoresList).toFixed(1) : 0;
  const lowestScore = totalSubmitted > 0 ? Math.min(...scoresList).toFixed(1) : 0;

  // Filter candidates for table view
  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = sub.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(sub.student_details).toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'in_progress') return sub.status === 'in_progress';
    if (filterStatus === 'submitted') return sub.status === 'submitted';
    if (filterStatus === 'passed') return sub.status === 'submitted' && sub.passed === 1;
    if (filterStatus === 'failed') return sub.status === 'submitted' && sub.passed === 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header - Screen Only */}
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
              <h1 className="text-2xl font-bold text-white">Candidate Monitor & Reports</h1>
              {refreshing && <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
            </div>
            <p className="text-xs text-slate-400">
              Session: <span className="text-indigo-300 font-semibold">{session.session_name}</span> ({session.session_code})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'executive-report' : 'table')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs transition ${
              viewMode === 'executive-report'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {viewMode === 'executive-report' ? <FileText className="w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />}
            <span>{viewMode === 'executive-report' ? 'Switch to Table View' : '📊 Visual Performance Report'}</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs py-2 px-3 rounded-xl border border-slate-700 transition"
            title="Print or Save official PDF report"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" /> Save PDF / Print
          </button>

          <button
            onClick={handleRegrade}
            className="flex items-center gap-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 font-bold text-xs py-2 px-3 rounded-xl transition"
            title="Recalculate scores for all student submissions"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-Grade
          </button>

          <button
            onClick={handleExportExcel}
            disabled={submissions.length === 0}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-lg transition"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel (.xlsx)
          </button>
        </div>
      </div>

      {error && (
        <div className="print:hidden p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* MODE 1: VISUAL EXECUTIVE PERFORMANCE REPORT */}
      {viewMode === 'executive-report' ? (
        <div className="glass-panel p-6 md:p-8 rounded-2xl space-y-6 print:bg-white print:text-slate-900 print:shadow-none print:p-0">
          {/* Printable Official Letterhead Header */}
          <div className="border-b border-slate-700/60 pb-4 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest print:text-indigo-700">
                Official Assessment Performance Summary
              </div>
              <h2 className="text-2xl font-black text-white print:text-slate-900 mt-0.5">{session.exam_title}</h2>
              <div className="text-xs text-slate-400 print:text-slate-600 mt-1">
                Batch Session: <strong className="text-white print:text-slate-900">{session.session_name}</strong> | Session Code: <span className="font-mono text-indigo-300 print:text-indigo-800">{session.session_code}</span>
              </div>
            </div>

            <div className="text-right bg-slate-900/60 print:bg-slate-100 p-3 rounded-xl border border-slate-800 print:border-slate-300 text-xs space-y-1">
              <div><span className="text-slate-400 print:text-slate-600">Passing Cut-off:</span> <strong className="text-emerald-400 print:text-emerald-700 font-bold">{session.passing_score}%</strong></div>
              <div><span className="text-slate-400 print:text-slate-600">Total Tested:</span> <strong className="text-white print:text-slate-900">{totalSubmitted} Candidates</strong></div>
              <div><span className="text-slate-400 print:text-slate-600">Report Generated:</span> <span className="text-slate-300 print:text-slate-700">{new Date().toLocaleString()}</span></div>
            </div>
          </div>

          {/* KPI Analytics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-emerald-950/40 print:bg-emerald-50 border border-emerald-500/30 print:border-emerald-200 p-4 rounded-xl text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-400 print:text-emerald-700 text-xs font-bold uppercase mb-1">
                <CheckCircle2 className="w-4 h-4" /> Passed Candidates
              </div>
              <div className="text-3xl font-black text-emerald-400 print:text-emerald-800">{passedCount}</div>
              <div className="text-xs font-semibold text-emerald-300 print:text-emerald-700 mt-0.5">{passRate}% Pass Rate</div>
            </div>

            <div className="bg-rose-950/40 print:bg-rose-50 border border-rose-500/30 print:border-rose-200 p-4 rounded-xl text-center">
              <div className="flex items-center justify-center gap-1 text-rose-400 print:text-rose-700 text-xs font-bold uppercase mb-1">
                <XCircle className="w-4 h-4" /> Failed Candidates
              </div>
              <div className="text-3xl font-black text-rose-400 print:text-rose-800">{failedCount}</div>
              <div className="text-xs font-semibold text-rose-300 print:text-rose-700 mt-0.5">{failRate}% Fail Rate</div>
            </div>

            <div className="bg-indigo-950/40 print:bg-indigo-50 border border-indigo-500/30 print:border-indigo-200 p-4 rounded-xl text-center">
              <div className="text-xs text-indigo-300 print:text-indigo-700 font-bold uppercase mb-1">Class Average</div>
              <div className="text-3xl font-black text-indigo-300 print:text-indigo-900">{avgScore}%</div>
              <div className="text-[11px] text-slate-400 print:text-slate-600 mt-0.5">Mean Score</div>
            </div>

            <div className="bg-slate-900/60 print:bg-slate-100 border border-slate-800 print:border-slate-300 p-4 rounded-xl text-center">
              <div className="text-xs text-slate-400 print:text-slate-600 font-bold uppercase mb-1">Highest / Lowest</div>
              <div className="text-xl font-black text-white print:text-slate-900">{highestScore}% <span className="text-slate-500 text-xs">/</span> {lowestScore}%</div>
              <div className="text-[11px] text-slate-400 print:text-slate-600 mt-0.5">Score Range</div>
            </div>
          </div>

          {/* Visual Pass / Fail Proportion Bar */}
          <div className="bg-slate-900/60 print:bg-slate-100 p-4 rounded-xl border border-slate-800 print:border-slate-300">
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span className="text-emerald-400 print:text-emerald-700 flex items-center gap-1">
                🟢 Passed: {passedCount} ({passRate}%)
              </span>
              <span className="text-rose-400 print:text-rose-700 flex items-center gap-1">
                🔴 Failed: {failedCount} ({failRate}%)
              </span>
            </div>

            <div className="w-full h-4 bg-slate-800 print:bg-slate-200 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${passRate}%` }}
                className="bg-emerald-500 h-full transition-all duration-500"
                title={`Passed: ${passRate}%`}
              ></div>
              <div
                style={{ width: `${failRate}%` }}
                className="bg-rose-500 h-full transition-all duration-500"
                title={`Failed: ${failRate}%`}
              ></div>
            </div>
          </div>

          {/* Official Candidate Performance Roster Table */}
          <div>
            <h3 className="font-bold text-white print:text-slate-900 text-sm mb-3 border-b border-slate-800 print:border-slate-300 pb-2">
              Official Candidates Performance Roster
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 print:bg-slate-200 text-slate-300 print:text-slate-800 font-bold border-b border-slate-700 print:border-slate-400">
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">Candidate Name</th>
                    <th className="p-2.5">Registration Details</th>
                    <th className="p-2.5 text-center">Score / Total</th>
                    <th className="p-2.5 text-center">Percentage</th>
                    <th className="p-2.5 text-center">Result Status</th>
                    <th className="p-2.5 text-right">Time Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-slate-300 text-slate-200 print:text-slate-900">
                  {submittedSubmissions.length > 0 ? (
                    submittedSubmissions.map((sub, idx) => (
                      <tr key={sub.id} className="hover:bg-slate-800/40 print:hover:bg-transparent">
                        <td className="p-2.5 font-mono text-slate-500 print:text-slate-600">{idx + 1}</td>
                        <td className="p-2.5 font-bold">{sub.student_name}</td>
                        <td className="p-2.5 text-[11px] text-slate-400 print:text-slate-600">
                          {Object.entries(sub.student_details)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' | ')}
                        </td>
                        <td className="p-2.5 text-center font-bold">{sub.score} / {sub.total_marks}</td>
                        <td className={`p-2.5 text-center font-extrabold ${sub.passed ? 'text-emerald-400 print:text-emerald-700' : 'text-rose-400 print:text-rose-700'}`}>
                          {sub.percentage.toFixed(1)}%
                        </td>
                        <td className="p-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                            sub.passed
                              ? 'bg-emerald-950 print:bg-emerald-100 text-emerald-300 print:text-emerald-800 border-emerald-700 print:border-emerald-400'
                              : 'bg-rose-950 print:bg-rose-100 text-rose-300 print:text-rose-800 border-rose-700 print:border-rose-400'
                          }`}>
                            {sub.passed ? 'PASSED' : 'FAILED'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-400 print:text-slate-600">
                          {Math.floor(sub.time_spent_seconds / 60)}m {sub.time_spent_seconds % 60}s
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-slate-500">No completed submissions recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* MODE 2: INTERACTIVE TABLE MONITOR VIEW */
        <>
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
              <div className="text-2xl font-extrabold text-emerald-400 mt-1">{inProgressSubmissions.length}</div>
              <div className="text-[10px] text-slate-400">Examinees taking test now</div>
            </div>

            <div className="glass-panel p-4 rounded-xl border-l-4 border-l-indigo-500">
              <div className="text-xs text-slate-400 font-semibold uppercase">Passed Candidates</div>
              <div className="text-2xl font-extrabold text-indigo-400 mt-1">{passedCount} <span className="text-xs text-slate-400">({passRate}%)</span></div>
              <div className="text-[10px] text-slate-400">Met passing score cut-off</div>
            </div>

            <div className="glass-panel p-4 rounded-xl border-l-4 border-l-rose-500">
              <div className="text-xs text-slate-400 font-semibold uppercase">Failed Candidates</div>
              <div className="text-2xl font-extrabold text-rose-400 mt-1">{failedCount} <span className="text-xs text-slate-400">({failRate}%)</span></div>
              <div className="text-[10px] text-slate-400">Below passing mark</div>
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

            <div className="flex flex-wrap gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
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
                🟢 Live Active ({inProgressSubmissions.length})
              </button>
              <button
                onClick={() => setFilterStatus('passed')}
                className={`px-3 py-1.5 rounded-lg transition font-semibold ${
                  filterStatus === 'passed' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                ✅ Passed ({passedCount})
              </button>
              <button
                onClick={() => setFilterStatus('failed')}
                className={`px-3 py-1.5 rounded-lg transition font-semibold ${
                  filterStatus === 'failed' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                ❌ Failed ({failedCount})
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
                        <td className={`p-3 font-extrabold ${sub.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
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
        </>
      )}

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
