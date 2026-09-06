import React from 'react';
import { Home, FileText, Bell, User } from 'lucide-react';

export default function MobileBottomNav({ activeScreen, setActiveScreen, unreadCount = 0, onBellClick }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 text-slate-400 z-40 px-6 py-2 flex items-center justify-around">
      <button
        onClick={() => setActiveScreen('DESK')}
        className={`flex flex-col items-center gap-1 cursor-pointer ${
          activeScreen === 'DESK' ? 'text-emerald-400 font-bold' : 'hover:text-white'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px]">Desk</span>
      </button>

      <button
        onClick={() => setActiveScreen('MY_COMPLAINTS')}
        className={`flex flex-col items-center gap-1 cursor-pointer ${
          activeScreen === 'MY_COMPLAINTS' ? 'text-emerald-400 font-bold' : 'hover:text-white'
        }`}
      >
        <FileText className="w-5 h-5" />
        <span className="text-[10px]">Complaints</span>
      </button>

      <button
        onClick={onBellClick}
        className="flex flex-col items-center gap-1 hover:text-white relative cursor-pointer"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 right-2 w-3.5 h-3.5 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
        <span className="text-[10px]">Alerts</span>
      </button>

      <button
        onClick={() => setActiveScreen('LOGIN')}
        className="flex flex-col items-center gap-1 hover:text-white cursor-pointer"
      >
        <User className="w-5 h-5" />
        <span className="text-[10px]">Account</span>
      </button>
    </nav>
  );
}
