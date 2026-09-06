import React from 'react';
import { X, AlertTriangle, Cpu, ArrowRightLeft, Check } from 'lucide-react';

export default function NotificationsPanel({ 
  isOpen, 
  onClose, 
  notifications = [], 
  onMarkAllAsRead, 
  onClearAll 
}) {
  if (!isOpen) return null;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'SLA_BREACH':
        return <AlertTriangle className="h-5 w-5 text-rose-600" />;
      case 'AUTO_ESCALATION':
        return <Cpu className="h-5 w-5 text-indigo-600" />;
      case 'ROUTING_UPDATE':
        return <ArrowRightLeft className="h-5 w-5 text-emerald-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-slate-600" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'SLA_BREACH':
        return 'bg-rose-50 border-rose-100 text-rose-800';
      case 'AUTO_ESCALATION':
        return 'bg-indigo-50 border-indigo-100 text-indigo-800';
      case 'ROUTING_UPDATE':
        return 'bg-emerald-50 border-emerald-100 text-emerald-800';
      default:
        return 'bg-slate-50 border-slate-100 text-slate-800';
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 border-l border-slate-200 flex flex-col h-full animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-brand-green text-white">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">System Alerts</span>
            <span className="px-2 py-0.5 rounded-full bg-brand-yellow text-slate-900 text-xs font-bold">
              {notifications.filter(n => !n.isRead).length} New
            </span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-emerald-800 rounded-md transition-colors cursor-pointer text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="px-6 py-3 border-b border-slate-100 flex justify-between items-center text-xs bg-slate-50">
          <button 
            onClick={onMarkAllAsRead}
            className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Check className="h-3 w-3" />
            Mark all read
          </button>
          <button 
            onClick={onClearAll}
            className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
          >
            Clear all
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium">
              No notifications at this time.
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`p-4 rounded-xl border flex gap-3 shadow-sm hover:shadow-md transition-shadow relative ${getNotificationColor(notif.type)} ${
                  !notif.isRead ? 'ring-2 ring-brand-yellow/30' : ''
                }`}
              >
                {!notif.isRead && (
                  <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-brand-yellow" />
                )}
                <div className="flex-shrink-0 mt-0.5">
                  {getNotificationIcon(notif.type)}
                </div>
                <div>
                  <div className="font-bold text-xs uppercase tracking-wide opacity-80 mb-1">
                    {notif.type.replace('_', ' ')}
                  </div>
                  <p className="text-sm font-medium leading-snug">
                    {notif.message}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-2 block font-mono">
                    {notif.timestamp}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400 font-mono">
          CMSCE Engine v1.2.0
        </div>

      </div>
    </>
  );
}
