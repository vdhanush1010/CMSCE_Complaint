import React from 'react';
import { Search, Users, ShieldCheck } from 'lucide-react';
import Logo from './Logo';

export default function Header({ 
  searchQuery, 
  setSearchQuery, 
  onManageDeptHeadsClick,
  onAddDeptHeadClick,
  onProfileClick,
  adminName = 'Dr. K. Ramanathan'
}) {
  const getInitials = (name) => {
    if (!name) return 'KR';
    const parts = name.replace(/^Dr\.\s*/i, '').trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleDeptHeadsClick = onManageDeptHeadsClick || onAddDeptHeadClick;

  return (
    <header className="bg-brand-green text-white shadow-md sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left Side: Brand and Title */}
        <div className="flex items-center gap-3">
          <Logo className="w-12 h-12 flex-shrink-0" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white m-0 leading-tight">
              CMSCE Admin Portal
            </h1>
            <p className="text-xs text-brand-yellow font-medium tracking-wide m-0">
              AI-Powered Complaint Management
            </p>
          </div>
        </div>

        {/* Center: Search Bar (Expanded cleanly across center space, redundant dropdown removed) */}
        <div className="flex flex-1 max-w-3xl w-full items-center">
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-300" />
            </span>
            <input
              type="text"
              className="w-full bg-[#06341d] text-white placeholder-slate-300 border border-emerald-800 rounded-lg pl-10 pr-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 focus:border-brand-yellow transition-all"
              placeholder="Search complaints, students, keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Right Side: Actions (Manage Dept Heads & Admin Profile Pill) */}
        <div className="flex items-center gap-3.5">
          {/* Manage Dept Heads Action Button */}
          <button
            onClick={handleDeptHeadsClick}
            className="flex items-center gap-2 bg-brand-yellow hover:bg-brand-yellow-hover text-slate-900 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Users className="h-4 w-4" />
            <span>Manage Dept Heads</span>
          </button>

          {/* Admin Profile Pill / Button */}
          <button
            onClick={onProfileClick}
            className="flex items-center gap-2.5 bg-[#06341d] hover:bg-[#052917] border border-emerald-800/90 pl-1.5 pr-4 py-1 rounded-full transition-all text-white shadow-sm cursor-pointer group"
            title="Admin Profile & Settings"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-700 border border-emerald-500/60 flex items-center justify-center font-bold text-xs text-brand-yellow shadow-inner">
              {getInitials(adminName)}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white group-hover:text-brand-yellow transition-colors leading-none">
                  {adminName}
                </span>
                <ShieldCheck className="h-3.5 w-3.5 text-brand-yellow inline-block" />
              </div>
              <span className="text-[10px] text-emerald-300/90 font-medium leading-tight block mt-0.5">
                Administrator
              </span>
            </div>
          </button>
        </div>

      </div>
    </header>
  );
}
