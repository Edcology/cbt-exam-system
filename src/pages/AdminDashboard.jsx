import React, { useState, useEffect } from 'react';
import { BookOpen, PlayCircle, Users, CheckCircle, Plus, FileSpreadsheet, ArrowRight, Activity, Lock } from 'lucide-react';
import { apiRequest } from '../api';

export default function AdminDashboard({ token, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Change Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await apiRequest('/admin/stats', 'GET', null, token);
      setStats(data);
    } catch (err) {
      console.error('Stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const response = await fetch(`/api/admin/backup-db`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Backup failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CBT_Database_Backup_${new Date().toISOString().slice(0, 10)}.sqlite`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download database backup');
    }
  };

  const handleRestoreBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm('Are you sure you want to restore this database backup file? Your session and exam data will be updated.')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const response = await fetch('/api/admin/restore-db', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/octet-stream'
          },
          body: event.target.result
        });
        const res = await response.json();
        if (!response.ok) throw new Error(res.error || 'Restore failed');
        alert(res.message);
        fetchStats();
      } catch (err) {
        alert('Failed to restore database: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (newPassword !== confirmPassword) {
      setPwdError('New password and confirm password do not match');
      return;
    }

    if (newPassword.length < 4) {
      setPwdError('New password must be at least 4 characters long');
      return;
    }

    setPwdLoading(true);
    try {
      const res = await apiRequest('/admin/change-password', 'POST', {
        currentPassword,
        newPassword
      }, token);

      setPwdSuccess('Admin password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowPasswordModal(false), 2000);
    } catch (err) {
      setPwdError(err.message || 'Failed to change password');
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-400 text-sm">Loading admin metrics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-xs text-slate-400">Manage your CBT exams, live sessions, and grade sheets</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={handleDownloadBackup}
            className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs py-2 px-2.5 rounded-xl border border-slate-700 transition"
            title="Download 1-click database backup"
          >
            💾 Backup DB
          </button>
          <label className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs py-2 px-2.5 rounded-xl border border-slate-700 transition cursor-pointer" title="Restore database from backup file">
            📥 Restore DB
            <input type="file" accept=".sqlite" onChange={handleRestoreBackup} className="hidden" />
          </label>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs py-2 px-2.5 rounded-xl border border-slate-700 transition"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" /> Password
          </button>
          <button
            onClick={() => onNavigate('exams-new')}
            className="flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-2.5 rounded-xl shadow-lg transition col-span-2 sm:col-span-1"
          >
            <Plus className="w-4 h-4" /> New Exam
          </button>
          <button
            onClick={() => onNavigate('sessions-new')}
            className="flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 px-2.5 rounded-xl shadow-lg transition col-span-2 sm:col-span-1"
          >
            <PlayCircle className="w-4 h-4" /> Launch Live Session
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Total Exam Bank</span>
            <BookOpen className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{stats?.totalExams || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Configured test templates</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Active LAN Sessions</span>
            <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400">{stats?.activeSessions || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Currently open for examinees</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Total Sessions</span>
            <PlayCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{stats?.totalSessions || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Total CBT sessions conducted</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Submissions Recorded</span>
            <Users className="w-5 h-5 text-rose-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{stats?.totalSubmissions || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Student test responses saved</div>
        </div>
      </div>

      {/* Recent Sessions Table */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <h3 className="font-bold text-white text-base">Recent CBT Sessions</h3>
          <button
            onClick={() => onNavigate('sessions')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
          >
            View All Sessions <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {stats?.recentSessions && stats.recentSessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Session Code</th>
                  <th className="p-3">Session Name</th>
                  <th className="p-3">Exam Title</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Submissions</th>
                  <th className="p-3">Result Mode</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {stats.recentSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono text-indigo-300 font-bold">{s.session_code}</td>
                    <td className="p-3 font-semibold text-white">{s.session_name}</td>
                    <td className="p-3">{s.exam_title}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        s.status === 'active'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : s.status === 'ended'
                          ? 'bg-slate-800 text-slate-400 border border-slate-700'
                          : 'bg-amber-950 text-amber-300 border border-amber-700'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3 font-bold">{s.submission_count} examinees</td>
                    <td className="p-3">
                      {s.results_released ? (
                        <span className="text-emerald-400 font-semibold">Released</span>
                      ) : (
                        <span className="text-amber-400 font-semibold">Withheld by Admin</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onNavigate(`results-${s.id}`)}
                        className="text-xs bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-300 px-2.5 py-1 rounded border border-indigo-500/40 transition"
                      >
                        Grade Sheet →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-xs">
            No active or past exam sessions found. Create an exam and start a session to begin!
          </div>
        )}
      </div>

      {/* Change Admin Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              Change Admin Password
            </h3>
            <p className="text-slate-400 text-xs mb-4">
              Update your administrator login password for security.
            </p>

            {pwdError && (
              <div className="mb-4 p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs">
                {pwdError}
              </div>
            )}

            {pwdSuccess && (
              <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs">
                {pwdSuccess}
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2.5 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="w-1/2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl shadow transition"
                >
                  {pwdLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
