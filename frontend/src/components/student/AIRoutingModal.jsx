import React from 'react';
import { X, CheckCircle2, Utensils, Bus, Building2, Trophy, GraduationCap, ConciergeBell } from 'lucide-react';

export default function AIRoutingModal({ isOpen, onClose, aiResult, onConfirmSubmit, isSubmitting }) {
  if (!isOpen || !aiResult) return null;

  const departments = [
    { code: 'CANTEEN', name: 'Canteen', icon: Utensils, bg: 'bg-amber-50 text-amber-700 border-amber-200' },
    { code: 'TRANSPORT', name: 'Transport', icon: Bus, bg: 'bg-blue-50 text-blue-700 border-blue-200' },
    { code: 'HOSTEL', name: 'Hostel', icon: Building2, bg: 'bg-purple-50 text-purple-700 border-purple-200' },
    { code: 'SPORTS', name: 'Sports', icon: Trophy, bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { code: 'ACADEMIC', name: 'Academic', icon: GraduationCap, bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { code: 'HOSPITALITY', name: 'Hospitality', icon: ConciergeBell, bg: 'bg-rose-50 text-rose-700 border-rose-200' }
  ];

  const assignedCode = (
    aiResult.assigned_dept_code ||
    aiResult.department_code ||
    (aiResult.department_name ? aiResult.department_name.toUpperCase() : 'CANTEEN')
  ).toUpperCase();

  const confidenceScore = aiResult.ai_confidence_score || aiResult.confidence_score || 95;
  const displayScore = Math.round(confidenceScore > 1 ? confidenceScore : confidenceScore * 100);

  const priorityColor = {
    CRITICAL: 'bg-rose-500 text-white',
    HIGH: 'bg-orange-500 text-white',
    MEDIUM: 'bg-amber-500 text-white',
    LOW: 'bg-emerald-500 text-white'
  }[aiResult.priority?.toUpperCase()] || 'bg-rose-500 text-white';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative">
        
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">AI Routing Classification</h3>
            <p className="text-xs text-slate-500 font-medium">Neural engine analyzed your complaint text</p>
          </div>
        </div>

        {/* AI Result Card */}
        <div className="bg-slate-900 text-white rounded-xl p-4 mb-6 shadow-md border border-slate-800">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 block">Category</span>
              <span className="text-base font-bold text-white">{aiResult.category || 'General Grievance'}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 block">Priority</span>
              <span className={`inline-block px-2.5 py-0.5 text-xs font-black rounded-full uppercase tracking-wider ${priorityColor}`}>
                {aiResult.priority || 'Medium'}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">Match Confidence:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">{displayScore}% Match</span>
          </div>
          
          <div className="mt-2 text-xs text-slate-300 italic bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
            "{aiResult.reasoning || aiResult.ai_routing_reasoning || 'AI routing engine processed ticket.'}"
          </div>
        </div>

        {/* 6 Department Options Grid */}
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Target Department Routing Grid</h4>
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          {departments.map((dept) => {
            const isAssigned = dept.code === assignedCode;
            const Icon = dept.icon;
            return (
              <div
                key={dept.code}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1.5 ${
                  isAssigned
                    ? `${dept.bg} ring-2 ring-emerald-500 font-extrabold shadow-sm`
                    : 'bg-slate-50 border-slate-200 text-slate-500 opacity-60'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-bold">{dept.name}</span>
                {isAssigned && (
                  <span className="text-[9px] uppercase tracking-wider font-black bg-emerald-600 text-white px-1.5 py-0.2 rounded">
                    Routed
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            Edit Text
          </button>
          <button
            onClick={onConfirmSubmit}
            disabled={isSubmitting}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Filing Ticket...' : 'Confirm & File Ticket'}
          </button>
        </div>

      </div>
    </div>
  );
}
