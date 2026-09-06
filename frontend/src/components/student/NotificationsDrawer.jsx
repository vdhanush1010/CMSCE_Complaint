import React from 'react';
import { X, Bell, AlertTriangle } from 'lucide-react';

export default function NotificationsDrawer({ isOpen, onClose, notifications = [], onClearAll }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-extrabold">Notifications & SLA Alerts</h3>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                No active notifications.
              </div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>{notif.type || 'SLA_ALERT'}</span>
                    <span className="ml-auto text-[10px] text-slate-400 font-normal">{notif.timestamp}</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{notif.message}</p>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between">
            <button
              onClick={onClearAll}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Clear All Notifications
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
