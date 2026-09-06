import React, { useState, useEffect, useRef } from 'react';
import CMSLotusLogo from './CMSLotusLogo';
import { Bell, LogOut, FileText, User, ChevronDown } from 'lucide-react';
import apiClient from '../../api/client';

export default function Header({
  user,
  activeScreen,
  setActiveScreen,
  unreadCount = 0,
  onBellClick,
  onLogout
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [complaintCount, setComplaintCount] = useState(0);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
    };

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen]);

  // Fetch live complaint count when user changes or dropdown opens
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const fetchCount = async () => {
      try {
        const data = await apiClient.complaints.list();
        if (isMounted && Array.isArray(data)) {
          setComplaintCount(data.length);
        }
      } catch (_) {}
    };

    fetchCount();
    return () => {
      isMounted = false;
    };
  }, [user, isProfileOpen]);

  const studentName = user ? (user.full_name || user.name || 'Student') : '';
  const initial = studentName ? studentName.charAt(0).toUpperCase() : 'S';

  return (
    <header className="bg-slate-900 text-white sticky top-0 z-40 border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveScreen('DESK')}>
          <CMSLotusLogo className="w-10 h-10" />
          <div>
            <span className="text-lg font-black tracking-tight text-white block leading-none">CMSCE</span>
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest block mt-0.5">Student Desk</span>
          </div>
        </div>

        {/* Navigation Actions */}
        {user ? (
          <div className="flex items-center space-x-3 sm:space-x-4 relative">
            <button
              onClick={() => setActiveScreen('MY_COMPLAINTS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeScreen === 'MY_COMPLAINTS' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">My Complaints</span>
            </button>

            <button
              onClick={onBellClick}
              className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-amber-500 text-slate-950 font-extrabold text-[10px] rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Clickable Student Profile Section */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer border border-transparent hover:border-slate-700 text-xs"
                title="View Profile Details"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {initial}
                </div>
                <span className="font-semibold text-slate-200 hidden md:inline max-w-[120px] truncate">
                  {studentName}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Floating Profile Dropdown Card */}
              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-800">
                  
                  {/* Dropdown Header */}
                  <div className="bg-slate-900 p-4 text-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-sm">
                        {initial}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-sm font-bold truncate leading-tight text-white">{studentName}</h4>
                        <span className="text-[10px] text-emerald-400 font-semibold block uppercase tracking-wider mt-0.5">
                          Student Desk Member
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Profile Details */}
                  <div className="p-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Roll Number</span>
                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {user.rollNo || user.roll_number || 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Department</span>
                      <span className="font-bold text-slate-800 text-right max-w-[150px] truncate">
                        {user.department || 'N/A'}
                      </span>
                    </div>

                    <div className="flex flex-col py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium mb-0.5">Email Address</span>
                      <span className="font-medium text-slate-800 truncate" title={user.email}>
                        {user.email || 'N/A'}
                      </span>
                    </div>

                    {/* Live Metric */}
                    <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-emerald-950">Total Complaints Filed</span>
                      </div>
                      <span className="px-2.5 py-0.5 bg-emerald-600 text-white font-black text-xs rounded-full shadow-xs">
                        {complaintCount}
                      </span>
                    </div>
                  </div>

                  {/* Institutional Divider Line & Functional Sign Out Button */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onLogout();
                      }}
                      className="w-full py-2 px-3 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      Sign Out
                    </button>
                  </div>

                </div>
              )}
            </div>

            {/* Quick Logout Button */}
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer hidden sm:block"
              title="Quick Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveScreen('LOGIN')}
              className="text-xs font-bold px-3 py-1.5 text-slate-300 hover:text-white cursor-pointer"
            >
              Login
            </button>
            <button
              onClick={() => setActiveScreen('REGISTER')}
              className="text-xs font-bold px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition shadow cursor-pointer"
            >
              Register
            </button>
          </div>
        )}

      </div>
    </header>
  );
}
