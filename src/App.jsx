import React, { useState, useEffect } from 'react';
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
  // Admin Auth State
  const [adminToken, setAdminToken] = useState(localStorage.getItem('cbt_admin_token') || null);
  const [adminUsername, setAdminUsername] = useState(localStorage.getItem('cbt_admin_username') || '');

  // Persistent View Navigation
  const getInitialView = () => {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    if (hash && ['student-landing', 'student-exam', 'student-result', 'admin-login', 'admin-dashboard', 'admin-exams', 'admin-sessions', 'admin-results'].includes(hash)) {
      return hash;
    }
    const saved = localStorage.getItem('cbt_current_view');
    if (saved) return saved;
    return localStorage.getItem('cbt_admin_token') ? 'admin-dashboard' : 'student-landing';
  };

  const [currentView, setCurrentViewRaw] = useState(getInitialView);
  const [activeSessionId, setActiveSessionIdState] = useState(() => {
    return localStorage.getItem('cbt_active_session_id') || null;
  });

  // Student Exam Data Persistence
  const [loadedExamData, setLoadedExamDataState] = useState(() => {
    const saved = localStorage.getItem('cbt_loaded_exam_data');
    return saved ? JSON.parse(saved) : null;
  });

  const [examResultData, setExamResultDataState] = useState(() => {
    const saved = localStorage.getItem('cbt_exam_result_data');
    return saved ? JSON.parse(saved) : null;
  });

  const setCurrentView = (view) => {
    setCurrentViewRaw(view);
    window.location.hash = '#/' + view;
    localStorage.setItem('cbt_current_view', view);
  };

  const setActiveSessionId = (id) => {
    setActiveSessionIdState(id);
    if (id) localStorage.setItem('cbt_active_session_id', id);
    else localStorage.removeItem('cbt_active_session_id');
  };

  const handleExamLoaded = (examData) => {
    if (examData.submission_completed) {
      setExamResultDataState(examData);
      localStorage.setItem('cbt_exam_result_data', JSON.stringify(examData));
      setCurrentView('student-result');
    } else {
      setLoadedExamDataState(examData);
      localStorage.setItem('cbt_loaded_exam_data', JSON.stringify(examData));
      setCurrentView('student-exam');
    }
  };

  const handleExamSubmitted = (resultData) => {
    setExamResultDataState(resultData);
    localStorage.setItem('cbt_exam_result_data', JSON.stringify(resultData));
    localStorage.removeItem('cbt_loaded_exam_data');
    setCurrentView('student-result');
  };

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
    localStorage.removeItem('cbt_current_view');
    window.location.hash = '';
    setCurrentView('student-landing');
  };

  // Synchronize browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      if (hash && ['student-landing', 'student-exam', 'student-result', 'admin-login', 'admin-dashboard', 'admin-exams', 'admin-sessions', 'admin-results'].includes(hash)) {
        setCurrentViewRaw(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Network IP Broadcast Banner (Admin View Only) */}
      {adminToken && <NetworkBanner />}

      {/* Global Navigation Header - Fully Mobile Responsive */}
      <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-3 sm:px-6 py-2.5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div
            onClick={() => setCurrentView('student-landing')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/20 group-hover:scale-105 transition">
              CBT
            </div>
            <div>
              <span className="font-black text-white text-sm sm:text-base tracking-tight block leading-tight">CBT System</span>
              <span className="text-[10px] text-indigo-400 font-mono block -mt-0.5">Online Assessment</span>
            </div>
          </div>

          {/* Admin Header Bar Controls */}
          {adminToken ? (
            <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-xs">
              <button
                onClick={() => setCurrentView('admin-dashboard')}
                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition ${
                  currentView === 'admin-dashboard' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="text-xs">Overview</span>
              </button>

              <button
                onClick={() => setCurrentView('admin-exams')}
                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition ${
                  currentView === 'admin-exams' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="text-xs">Exams</span>
              </button>

              <button
                onClick={() => setCurrentView('admin-sessions')}
                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition ${
                  currentView === 'admin-sessions' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span className="text-xs">Sessions</span>
              </button>

              <button
                onClick={handleAdminLogout}
                className="bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden xs:inline text-xs">Logout</span>
              </button>
            </div>
          ) : (
            currentView !== 'student-exam' && (
              <button
                onClick={() => setCurrentView('admin-login')}
                className="text-xs bg-indigo-600/30 hover:bg-indigo-600/70 border border-indigo-500/40 text-indigo-200 px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" /> Admin Portal
              </button>
            )
          )}
        </div>
      </header>

      {/* Main View Router */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6">
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
            onBack={() => setCurrentView('student-landing')}
          />
        )}

        {currentView === 'admin-dashboard' && adminToken && (
          <AdminDashboard
            token={adminToken}
            onNavigate={(target, sessionId) => {
              if (sessionId) setActiveSessionId(sessionId);
              setCurrentView(target);
            }}
          />
        )}

        {currentView === 'admin-exams' && adminToken && (
          <AdminExamManager
            token={adminToken}
            onNavigate={(target) => setCurrentView(target)}
          />
        )}

        {currentView === 'admin-sessions' && adminToken && (
          <AdminSessionManager
            token={adminToken}
            onNavigateResults={(sessionId) => {
              setActiveSessionId(sessionId);
              setCurrentView('admin-results');
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
      <footer className="border-t border-slate-800/80 py-4 px-4 text-center text-xs text-slate-500">
        <div>CBT Assessment System &bull; Secure Exam Portal</div>
      </footer>
    </div>
  );
}
