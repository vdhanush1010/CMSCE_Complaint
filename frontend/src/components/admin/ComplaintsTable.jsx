import React from 'react';
import { AlertCircle, Clock } from 'lucide-react';

export default function ComplaintsTable({ 
  complaints = [], 
  selectedComplaintId, 
  onSelectComplaint 
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

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Submitted':
      case 'SUBMITTED':
      case 'AI Analysed':
      case 'Assigned':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'In Progress':
      case 'IN_PROGRESS':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'Resolution Pending Verification':
      case 'PENDING_VERIFICATION':
        return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'Resolved':
      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'Closed':
      case 'CLOSED':
        return 'bg-slate-200 text-slate-700 border border-slate-300 font-semibold';
      case 'Appealed':
      case 'APPEALED':
        return 'bg-amber-100 text-amber-900 border border-amber-300 font-bold';
      case 'Reopened':
      case 'REOPENED':
        return 'bg-rose-100 text-rose-800 border border-rose-200 font-bold';
      default:
        return 'bg-slate-100 text-slate-800 border border-slate-200';
    }
  };

  const getSLATimerBadge = (hoursLeft, isOverdue) => {
    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-xs bg-rose-50 px-2 py-1 rounded-md border border-rose-100">
          <AlertCircle className="h-3 w-3" />
          Overdue {Math.abs(hoursLeft)}h
        </span>
      );
    }
    if (hoursLeft <= 3) {
      return (
        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-xs bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
          <Clock className="h-3 w-3 animate-pulse" />
          {hoursLeft}h left
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-slate-500 text-xs bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
        <Clock className="h-3 w-3" />
        {hoursLeft}h left
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Assigned Dept</th>
              <th className="px-6 py-4">Priority</th>
              <th className="px-6 py-4">SLA Timer</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {complaints.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-10 text-center text-slate-400 font-medium">
                  No complaints found matching criteria.
                </td>
              </tr>
            ) : (
              complaints.map((complaint) => {
                const isSelected = selectedComplaintId === complaint.id;
                const priorityInfo = getPriorityStyle(complaint.priority);
                
                return (
                  <tr
                    key={complaint.id}
                    onClick={() => onSelectComplaint(complaint)}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-emerald-50/50 hover:bg-emerald-50' 
                        : ''
                    }`}
                  >
                    <td className="px-6 py-4 font-mono text-slate-500 font-semibold">
                      {complaint.id}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {complaint.category}
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                      {complaint.description}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {getDeptLabel(complaint.assignedDept)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${priorityInfo.bgClass}`}>
                        {priorityInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getSLATimerBadge(complaint.slaHoursLeft, complaint.isSlaOverdue)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusStyle(complaint.status)}`}>
                        {complaint.status}
                      </span>
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
