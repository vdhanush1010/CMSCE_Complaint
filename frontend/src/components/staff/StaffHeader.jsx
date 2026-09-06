import React from 'react';
import Logo from '../admin/Logo';
import { LogOut, Building2, Utensils, Bus, Home, Trophy, BookOpen, Coffee } from 'lucide-react';

export default function StaffHeader({ user, onLogout }) {
  const deptCode = (user?.department || user?.department_code || '').toUpperCase();
  const deptName = user?.department_name || (deptCode ? `${deptCode} Operations` : 'Department');

  let DeptIcon = Building2;
  if (deptCode === 'CANTEEN') DeptIcon = Utensils;
  else if (deptCode === 'TRANSPORT') DeptIcon = Bus;
  else if (deptCode === 'HOSTEL') DeptIcon = Home;
  else if (deptCode === 'SPORTS') DeptIcon = Trophy;
  else if (deptCode === 'ACADEMIC') DeptIcon = BookOpen;
  else if (deptCode === 'HOSPITALITY') DeptIcon = Coffee;

  return (
    <header className="bg-brand-green text-white shadow-md sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between gap-4">

        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <Logo className="w-12 h-12 flex-shrink-0" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white m-0 leading-tight flex items-center gap-2">
              CMS {deptName} Portal
              <DeptIcon className="w-5 h-5 text-brand-yellow" />
            </h1>
            <p className="text-xs text-brand-yellow font-medium tracking-wide m-0 flex items-center gap-1">
              Secured Department Head Access
            </p>
          </div>
        </div>

        {/* Right: user info + logout */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-white m-0">{user?.full_name || user?.name || 'Staff'}</p>
            <p className="text-[11px] text-emerald-200 m-0">{user?.email || ''}</p>
          </div>
          <button
            id="staff-logout-btn"
            onClick={onLogout}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>

      </div>
    </header>
  );
}
