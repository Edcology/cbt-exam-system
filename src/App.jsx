import React, { useState } from 'react';
import NetworkBanner from './components/NetworkBanner';
import StudentLanding from './pages/StudentLanding';
import StudentExam from './pages/StudentExam';
import StudentResultView from './pages/StudentResultView';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminExamManager from './pages/AdminExamManager';
import AdminSessionManager from './pages/AdminSessionManager';
import AdminResultsView from './pages/AdminResultsView';
import { ShieldCheck, LogOut, LayoutDashboard, BookOpen, PlayCircle, Lock } from 'lucide-react';

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState('student-landing'); // 'student-landing', 'student-exam', 'student-result', 'admin-login', 'admin-dashboard', 'admin-exams', 'admin-sessions', 'admin-results'
  const [activeSessionId, setActiveSessionId] = useState(null);

  // Admin Auth State
  const [adminToken, setAdminToken] = useState(localStorage.getItem('cbt_admin_token') || null);
  const [adminUsername, setAdminUsername] = useState(localStorage.getItem('cbt_admin_username') || '');

  // Student Exam Data
  const [loadedExamData, setLoadedExamData] = useState(null);
  const [examResultData, setExamResultData] = useState(null);

  const handleAdminLoginSuccess = (token, username) => {
    setAdminToken(token);
    setAdminUsername(username);
    localStorage.setItem('cbt_admin_token', token);
    localStorage.setItem('cbt_admin_username', username);
    setCurrentView('admin-dashboard');
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    setAdminUsername('');
    localStorage.removeItem('cbt_admin_token');
    localStorage.removeItem('cbt_admin_username');
    setCurrentView('student-landing');
  };

  const handleExamLoaded = (examData) => {
    setLoadedExamData(examData);
    setCurrentView('student-exam');
  };

  const handleExamSubmitted = (resultData) => {
    setExamResultData(resultData);
    setCurrentView('student-result');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Network IP Broadcast Banner (Admin View Only) */}
      {adminToken && <NetworkBanner />}

      {/* Global Navigation Header */}
      <header className="bg-slate-900/80 border-b border-slate-800 backdrop-blur px-4 py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div
            onClick={() => setCurrentView('student-landing')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/20 group-hover:scale-105 transition">
              CBT
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight">LAN CBT Engine</span>
              <span className="text-[10px] text-indigo-400 block font-mono -mt-1">Local Network Testing</span>
            </div>
          </div>

          {/* Admin Header Bar Controls */}
          {adminToken ? (
            <div className="flex items-center gap-2 md:gap-3 text-xs">
              <button
                onClick={() => setCurrentView('admin-dashboard')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  currentView === 'admin-dashboard' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Overview</span>
              </button>

              <button
                onClick={() => setCurrentView('admin-exams')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  currentView === 'admin-exams' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exam Bank</span>
              </button>

              <button
                onClick={() => setCurrentView('admin-sessions')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  currentView === 'admin-sessions' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Live Sessions</span>
              </button>

              <button
                onClick={handleAdminLogout}
                className="bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                title="Log out from Admin"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout ({adminUsername})</span>
              </button>
            </div>
          ) : (
            currentView !== 'student-exam' && (
              <button
                onClick={() => setCurrentView('admin-login')}
                className="text-xs bg-indigo-600/30 hover:bg-indigo-600/70 border border-indigo-500/40 text-indigo-200 px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" /> Admin Login
              </button>
            )
          )}
        </div>
      </header>

      {/* Main View Router */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4">
        {currentView === 'student-landing' && (
          <StudentLanding
            onExamLoaded={handleExamLoaded}
            onNavigateAdmin={() => setCurrentView(adminToken ? 'admin-dashboard' : 'admin-login')}
          />
        )}

        {currentView === 'student-exam' && loadedExamData && (
          <StudentExam
            examData={loadedExamData}
            onExamSubmitted={handleExamSubmitted}
          />
        )}

        {currentView === 'student-result' && examResultData && (
          <StudentResultView
            resultData={examResultData}
            onReset={() => setCurrentView('student-landing')}
          />
        )}

        {currentView === 'admin-login' && (
          <AdminLogin
            onLoginSuccess={handleAdminLoginSuccess}
            onNavigateStudent={() => setCurrentView('student-landing')}
          />
        )}

        {currentView === 'admin-dashboard' && adminToken && (
          <AdminDashboard
            token={adminToken}
            onNavigate={(view) => {
              if (view.startsWith('results-')) {
                setActiveSessionId(view.replace('results-', ''));
                setCurrentView('admin-results');
              } else if (view === 'exams-new') {
                setCurrentView('admin-exams');
              } else if (view === 'sessions-new') {
                setCurrentView('admin-sessions');
              } else {
                setCurrentView(view);
              }
            }}
          />
        )}

        {currentView === 'admin-exams' && adminToken && (
          <AdminExamManager
            token={adminToken}
            onBack={() => setCurrentView('admin-dashboard')}
          />
        )}

        {currentView === 'admin-sessions' && adminToken && (
          <AdminSessionManager
            token={adminToken}
            onNavigate={(view) => {
              if (view.startsWith('results-')) {
                setActiveSessionId(view.replace('results-', ''));
                setCurrentView('admin-results');
              } else {
                setCurrentView(view);
              }
            }}
          />
        )}

        {currentView === 'admin-results' && adminToken && activeSessionId && (
          <AdminResultsView
            token={adminToken}
            sessionId={activeSessionId}
            onBack={() => setCurrentView('admin-sessions')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 text-center py-4 text-xs text-slate-500">
        Local Network CBT Exam System &copy; {new Date().getFullYear()} — Zero Cloud Dependency LAN Assessment Engine
      </footer>
    </div>
  );
}
