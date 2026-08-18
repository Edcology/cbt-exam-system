import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Search, Eye, ArrowLeft, RefreshCw, Printer, CheckCircle2, XCircle, Award, BarChart2 } from 'lucide-react';
import { apiRequest } from '../api';

export default function AdminResultsView({ token, sessionId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'PASSED', 'FAILED'
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
      if (!silent) setError('Failed to fetch candidate grade records');
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
      if (!response.ok) throw new Error('Failed to download grade sheet');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Exam_Report_${session.session_name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download Excel report');
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
    return <div className="text-center py-16 text-slate-400 text-sm">Loading examination report sheet...</div>;
  }

  if (!data) return null;

  const { session, submissions } = data;

  const submitted = submissions.filter(s => s.status === 'submitted');
  const inProgress = submissions.filter(s => s.status === 'in_progress');

  const passedCount = submitted.filter(s => s.passed === 1).length;
  const failedCount = submitted.filter(s => s.passed === 0).length;
  const totalCount = submitted.length;

  const passRate = totalCount > 0 ? ((passedCount / totalCount) * 100).toFixed(1) : 0;
  const failRate = totalCount > 0 ? ((failedCount / totalCount) * 100).toFixed(1) : 0;

  const scores = submitted.map(s => s.percentage);
  const avgScore = totalCount > 0 ? (scores.reduce((a, b) => a + b, 0) / totalCount).toFixed(1) : 0;

  // Filter & Sort Students
  const filteredStudents = submitted.filter(sub => {
    const matchesSearch = sub.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(sub.student_details).toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'PASSED') return sub.passed === 1;
    if (statusFilter === 'FAILED') return sub.passed === 0;
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Action Toolbar (Hidden during print) */}
      <div className="print:hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Examination Grade Report</h1>
              {refreshing && <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
            </div>
            <p className="text-xs text-slate-400">
              Exam: <strong className="text-white">{session.exam_title}</strong> | Code: <span className="text-indigo-300 font-mono">{session.session_code}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-lg transition col-span-2 sm:col-span-1"
          >
            <Printer className="w-4 h-4" /> Save PDF / Print
          </button>

          <button
            onClick={handleRegrade}
            className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 font-bold text-xs py-2 px-3 rounded-xl transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-Grade
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs py-2 px-3 rounded-xl transition"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="print:hidden p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* MAIN REPORT SHEET (Optimized for Screen & Printable PDF) */}
      <div id="printable-report-sheet" className="glass-panel p-6 md:p-8 rounded-3xl space-y-6 print:bg-white print:text-slate-900 print:shadow-none print:p-0 print:border-none">
        
        {/* REPORT HEADER */}
        <div className="border-b-2 border-slate-700 print:border-slate-800 pb-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-indigo-400 print:text-indigo-800">
              OFFICIAL CBT EXAMINATION REPORT SHEET
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white print:text-slate-900 mt-1">
              {session.exam_title}
            </h2>
            <div className="text-xs text-slate-400 print:text-slate-700 mt-1 flex flex-wrap gap-x-4">
              <span>Session Name: <strong className="text-white print:text-slate-900">{session.session_name}</strong></span>
              <span>Session Code: <strong className="font-mono text-indigo-300 print:text-indigo-800">{session.session_code}</strong></span>
              <span>Passing Cut-Off: <strong className="text-emerald-400 print:text-emerald-800 font-bold">{session.passing_score}%</strong></span>
            </div>
          </div>

          <div className="text-right text-xs text-slate-400 print:text-slate-700 bg-slate-900/80 print:bg-slate-100 p-3 rounded-2xl border border-slate-800 print:border-slate-300">
            <div>Date Generated: <strong>{new Date().toLocaleDateString()}</strong></div>
            <div>Total Submissions: <strong className="text-white print:text-slate-900">{totalCount} Students</strong></div>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 print:bg-slate-100 border border-slate-800 print:border-slate-300 p-4 rounded-2xl text-center">
            <div className="text-xs font-bold text-slate-400 print:text-slate-700 uppercase">Total Tested</div>
            <div className="text-3xl font-black text-white print:text-slate-900 mt-1">{totalCount}</div>
            <div className="text-[10px] text-slate-500 print:text-slate-600">Students</div>
          </div>

          <div className="bg-emerald-950/40 print:bg-emerald-50 border border-emerald-500/40 print:border-emerald-300 p-4 rounded-2xl text-center">
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-emerald-400 print:text-emerald-800 uppercase">
              <CheckCircle2 className="w-4 h-4" /> Passed
            </div>
            <div className="text-3xl font-black text-emerald-400 print:text-emerald-800 mt-1">{passedCount}</div>
            <div className="text-[11px] font-bold text-emerald-300 print:text-emerald-700">{passRate}% Pass Rate</div>
          </div>

          <div className="bg-rose-950/40 print:bg-rose-50 border border-rose-500/40 print:border-rose-300 p-4 rounded-2xl text-center">
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-rose-400 print:text-rose-800 uppercase">
              <XCircle className="w-4 h-4" /> Failed
            </div>
            <div className="text-3xl font-black text-rose-400 print:text-rose-800 mt-1">{failedCount}</div>
            <div className="text-[11px] font-bold text-rose-300 print:text-rose-700">{failRate}% Fail Rate</div>
          </div>

          <div className="bg-indigo-950/40 print:bg-indigo-50 border border-indigo-500/40 print:border-indigo-300 p-4 rounded-2xl text-center">
            <div className="text-xs font-bold text-indigo-300 print:text-indigo-800 uppercase">Class Average</div>
            <div className="text-3xl font-black text-indigo-300 print:text-indigo-900 mt-1">{avgScore}%</div>
            <div className="text-[10px] text-indigo-400 print:text-indigo-700">Mean Score</div>
          </div>
        </div>

        {/* SEARCH & FILTER CONTROLS (Hidden during print) */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 flex-1">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search candidate by name, matric number, or registration details..."
              className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Students ({submitted.length})
            </button>
            <button
              onClick={() => setStatusFilter('PASSED')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'PASSED' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🟢 Passed Only ({passedCount})
            </button>
            <button
              onClick={() => setStatusFilter('FAILED')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'FAILED' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🔴 Failed Only ({failedCount})
            </button>
          </div>
        </div>

        {/* MASTER STUDENT GRADE TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 print:bg-slate-200 text-slate-300 print:text-slate-900 font-extrabold uppercase border-b-2 border-slate-700 print:border-slate-400">
                <th className="p-3 w-10">S/N</th>
                <th className="p-3">Candidate Full Name</th>
                <th className="p-3">Registration & Department Details</th>
                <th className="p-3 text-center">Score / Total Marks</th>
                <th className="p-3 text-center">Score Percentage</th>
                <th className="p-3 text-center">Final Result</th>
                <th className="p-3 text-right print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 print:divide-slate-300 text-slate-200 print:text-slate-900">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((sub, idx) => (
                  <tr
                    key={sub.id}
                    className={`hover:bg-slate-800/40 print:hover:bg-transparent ${
                      sub.passed ? 'bg-emerald-950/10 print:bg-emerald-50/30' : 'bg-rose-950/10 print:bg-rose-50/30'
                    }`}
                  >
                    <td className="p-3 font-mono text-slate-500 print:text-slate-600 font-bold">{idx + 1}</td>
                    <td className="p-3 font-bold text-white print:text-slate-900 text-sm">{sub.student_name}</td>
                    <td className="p-3 text-[11px] text-slate-400 print:text-slate-700 max-w-xs">
                      {Object.entries(sub.student_details)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' | ')}
                    </td>
                    <td className="p-3 text-center font-bold text-white print:text-slate-900 text-sm">
                      {sub.score} / {sub.total_marks}
                    </td>
                    <td className={`p-3 text-center font-black text-sm ${
                      sub.passed ? 'text-emerald-400 print:text-emerald-700' : 'text-rose-400 print:text-rose-700'
                    }`}>
                      {sub.percentage.toFixed(1)}%
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black tracking-wide border uppercase ${
                        sub.passed
                          ? 'bg-emerald-950 print:bg-emerald-100 text-emerald-300 print:text-emerald-900 border-emerald-600 print:border-emerald-400'
                          : 'bg-rose-950 print:bg-rose-100 text-rose-300 print:text-rose-900 border-rose-600 print:border-rose-400'
                      }`}>
                        {sub.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>{sub.passed ? 'PASSED' : 'FAILED'}</span>
                      </span>
                    </td>
                    <td className="p-3 text-right print:hidden">
                      <button
                        onClick={() => setSelectedSubmission(sub)}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 transition"
                      >
                        View Answers
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 italic">
                    No student submission records matching your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PRINTABLE FOOTER */}
        <div className="hidden print:flex items-center justify-between border-t border-slate-400 pt-6 text-xs text-slate-600">
          <div>Report Certified By Administrator: ___________________________</div>
          <div>Signature & Stamp: ___________________________</div>
        </div>

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
