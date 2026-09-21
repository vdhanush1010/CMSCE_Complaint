import React from 'react';
import { AlertCircle, Clock, Star, Scale, Eye, CheckCircle2 } from 'lucide-react';

export default function ComplaintsTable({ 
  complaints = [], 
  selectedComplaintId, 
  onSelectComplaint,
  onViewFeedback
}) {
  
  const getDeptLabel = (code) => {
    const mapping = {
      CANTEEN: 'Canteen',
      TRANSPORT: 'Transport',
      HOSTEL: 'Hostel',
      SPORTS: 'Sports',
      ACADEMIC: 'Academic',
      HOSPITALITY: 'Hospitality'
    };
    return mapping[code] || code;
  };

  const getPriorityStyle = (priority = '') => {
    switch (priority.toUpperCase()) {
      case 'CRITICAL':
        return { bgClass: 'bg-[#DC2626] text-white', label: 'Critical' };
      case 'HIGH':
        return { bgClass: 'bg-[#F97316] text-white', label: 'High' };
      case 'MEDIUM':
        return { bgClass: 'bg-[#EAB308] text-white', label: 'Medium' };
      case 'LOW':
      case 'RESOLVED':
        return { bgClass: 'bg-[#10B981] text-white', label: priority };
      default:
        return { bgClass: 'bg-slate-100 text-slate-700', label: priority || 'Normal' };
    }
  };

  const getStageBadge = (stage, status) => {
    const isAppealed = status === 'APPEALED' || status === 'Appealed';
    if (isAppealed) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-full animate-pulse">
          <Scale className="w-3 h-3 text-rose-600" />
          APPEALED (Reset Stage 1)
        </span>
      );
    }

    const s = (stage || status || '').toUpperCase();
    if (s.includes('RESOLV') || s.includes('CLOSE')) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Stage 6: Resolved
        </span>
      );
    }
    if (s.includes('VERIF') || s.includes('PENDING')) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-300 px-2.5 py-1 rounded-full">
          Stage 5: Pending Verify
        </span>
      );
    }
    if (s.includes('IN_PROGRESS') || s === 'IN PROGRESS') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full">
          Stage 4: In Progress
        </span>
      );
    }
    if (s.includes('ASSIGN')) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-1 rounded-full">
          Stage 3: Assigned
        </span>
      );
    }
    if (s.includes('AI') || s.includes('ANALYSE')) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 px-2.5 py-1 rounded-full">
          Stage 2: AI Analysed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-1 rounded-full">
        Stage 1: Submitted
      </span>
    );
  };

  const getSLATimerBadge = (hoursLeft, isOverdue, priority = '') => {
    const isCritical = (priority || '').toUpperCase() === 'CRITICAL';
    const targetLabel = isCritical ? 'CRITICAL: 12 Hours' : 'HIGH / MEDIUM / LOW: 48 Hours';
    if (isOverdue) {
      return (
        <div className="flex flex-col" title={`Target Window: ${targetLabel}`}>
          <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-xs bg-rose-50 px-2 py-1 rounded-md border border-rose-100">
            <AlertCircle className="h-3 w-3" />
            Overdue {Math.abs(hoursLeft)}h
          </span>
          <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{isCritical ? '12h Target' : '48h Target'}</span>
        </div>
      );
    }
    if (hoursLeft <= 3) {
      return (
        <div className="flex flex-col" title={`Target Window: ${targetLabel}`}>
          <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-xs bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
            <Clock className="h-3 w-3 animate-pulse" />
            {hoursLeft}h left
          </span>
          <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{isCritical ? '12h Target' : '48h Target'}</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col" title={`Target Window: ${targetLabel}`}>
        <span className="inline-flex items-center gap-1 text-slate-500 text-xs bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
          <Clock className="h-3 w-3" />
          {hoursLeft}h left
        </span>
        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{isCritical ? '12h Target' : '48h Target'}</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
              <th className="px-5 py-3.5">Ticket ID</th>
              <th className="px-5 py-3.5">Category & Subject</th>
              <th className="px-5 py-3.5">Dept</th>
              <th className="px-5 py-3.5">Priority</th>
              <th className="px-5 py-3.5">Stage & Workflow</th>
              <th className="px-5 py-3.5">SLA Timer</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {complaints.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-medium">
                  No grievances matching the selected filters.
                </td>
              </tr>
            ) : (
              complaints.map((complaint) => {
                const isSelected = selectedComplaintId === complaint.id;
                const priorityInfo = getPriorityStyle(complaint.priority);
                const hasFeedback = Boolean(
                  complaint.feedback && (complaint.feedback.rating > 0 || complaint.feedback.comments)
                );
                const isResolved = ['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(complaint.status) || complaint.stage === 'RESOLVED';
                const appealCycle = complaint.appeal?.cycle || (Array.isArray(complaint.appealHistory) ? complaint.appealHistory.length : 0);

                return (
                  <tr
                    key={complaint.id}
                    onClick={() => onSelectComplaint(complaint)}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-emerald-50/70 hover:bg-emerald-50' 
                        : ''
                    }`}
                  >
                    <td className="px-5 py-3.5 font-mono text-slate-600 font-bold text-xs">
                      <div className="flex items-center gap-1.5">
                        <span>{complaint.id}</span>
                        {appealCycle > 0 && (
                          <span className="text-[9px] font-black bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300">
                            C#{appealCycle}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="font-bold text-slate-800 truncate" title={complaint.category}>
                        {complaint.category}
                      </div>
                      <div className="text-xs text-slate-500 truncate" title={complaint.description}>
                        {complaint.description}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-700 text-xs">
                      {getDeptLabel(complaint.assignedDept)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${priorityInfo.bgClass}`}>
                        {priorityInfo.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {getStageBadge(complaint.stage, complaint.status)}
                    </td>
                    <td className="px-5 py-3.5">
                      {getSLATimerBadge(complaint.slaHoursLeft, complaint.isSlaOverdue, complaint.priority)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {isResolved && hasFeedback && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onViewFeedback) onViewFeedback(complaint);
                            }}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title="View Student Feedback & Rating"
                          >
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                            <span>{complaint.feedback.rating}★ Feedback</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectComplaint(complaint);
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>Manage</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
