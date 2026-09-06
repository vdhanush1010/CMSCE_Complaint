import React, { useState } from 'react';
import Logo from './Logo';
import { Lock, Mail, LogIn, AlertCircle, Eye, EyeOff, ShieldCheck, UserCheck } from 'lucide-react';
import apiClient from '../../api/client';

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const [isStaff, setIsStaff] = useState(urlParams.get('type') === 'staff');

  const titleText = isStaff ? 'Department Staff Login' : 'Admin Login';
  const idLabel = isStaff ? 'Staff ID / Email' : 'Admin Email / ID';
  const idPlaceholder = isStaff ? 'canteen@cmsce.edu' : 'admin@cmsce.edu';
  const headerColor = isStaff ? 'bg-indigo-700' : 'bg-slate-800';
  const buttonColor = isStaff ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-600/40' : 'bg-slate-800 hover:bg-slate-900 focus:ring-slate-800/40';
  const buttonRingColor = isStaff ? 'focus:border-indigo-600' : 'focus:border-slate-800';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError(`${idLabel} and password are required.`);
      return;
    }
    setLoading(true);
    try {
      const data = await apiClient.auth.loginOffice(email.trim(), password);
      const { access, token, user } = data;
      const activeToken = access || token;

      if (user.role === 'STUDENT') {
        setError('Student accounts cannot access this portal. Please use the Student Desk.');
        setLoading(false);
        return;
      }

      if (!isStaff && (user.role === 'DEPT_HEAD' || user.role === 'DEPARTMENT_HEAD')) {
        setError('This account is a Department Head account — please switch to Department Staff Login.');
        setLoading(false);
        return;
      }

      if (isStaff && user.role === 'ADMIN') {
        setError('This account is an Admin account — please switch to Admin Login.');
        setLoading(false);
        return;
      }

      if (user.role === 'ADMIN') {
        localStorage.setItem('admin_token', activeToken);
        localStorage.setItem('admin_user', JSON.stringify(user));
        localStorage.removeItem('selectedDepartment');
      } else if (user.role === 'DEPARTMENT_HEAD' || user.role === 'DEPT_HEAD' || user.role === 'STAFF') {
        localStorage.setItem('dept_token', activeToken);
        localStorage.setItem('dept_user', JSON.stringify(user));
      }

      onLoginSuccess(activeToken, user);
    } catch (err) {
      setError(err.message || 'Invalid credentials or connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Brand Bar */}
      <header className={`${headerColor} shadow-md transition-colors duration-300`}>
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="w-12 h-12 flex-shrink-0" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white m-0 leading-tight">
                CMSCE Grievance Hub
              </h1>
              <p className={`text-xs ${isStaff ? 'text-indigo-200' : 'text-slate-300'} font-medium tracking-wide m-0`}>
                Official Administrative & Staff Portal
              </p>
            </div>
          </div>

          {/* Quick toggle between Admin and Staff */}
          <div className="flex items-center bg-white/10 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => {
                setIsStaff(false);
                setError('');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                !isStaff ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-200 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Admin Portal
            </button>
            <button
              type="button"
              onClick={() => {
                setIsStaff(true);
                setError('');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                isStaff ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-200 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" /> Staff Portal
            </button>
          </div>
        </div>
      </header>

      {/* Login Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            
            <div className={`${headerColor} px-8 py-6 text-center transition-colors duration-300`}>
              <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-full mb-3">
                <Lock className={`w-7 h-7 ${isStaff ? 'text-indigo-200' : 'text-slate-300'}`} />
              </div>
              <h2 className="text-xl font-bold text-white m-0">{titleText}</h2>
              <p className={`text-xs ${isStaff ? 'text-indigo-200' : 'text-slate-300'} mt-1 m-0`}>
                Sign in to manage grievance queues and workflows
              </p>
            </div>

            <div className="px-8 py-8">
              {error && (
                <div className="mb-5 flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {idLabel}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </span>
                    <input
                      type="text"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={idPlaceholder}
                      required
                      className={`w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 ${buttonRingColor} transition-all`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </span>
                    <input
                      type={showPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>Demo quick-fill:</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (isStaff) {
                        setEmail('canteen@cmsce.edu');
                        setPassword('staff123');
                      } else {
                        setEmail('admin@cmsce.edu');
                        setPassword('admin123');
                      }
                    }}
                    className="font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    Auto-fill {isStaff ? 'Staff' : 'Admin'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex items-center justify-center gap-2 py-3 ${buttonColor} disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-colors shadow cursor-pointer`}
                >
                  {loading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      Sign In
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-[11px] text-slate-400">
                Official staff accounts only. Students can file grievances at the{' '}
                <a href="/" className="font-semibold text-emerald-600 hover:underline">Student Desk</a>.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-[11px] text-slate-400">
        © 2026 CMSCE Grievance Hub — Secured Office Portal
      </footer>
    </div>
  );
}
