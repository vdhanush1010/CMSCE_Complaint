import React, { useState, useEffect } from 'react';
import { Eye, X, Clock, AlertTriangle, ShieldCheck, RefreshCw, Sparkles, Calendar, ArrowRight } from 'lucide-react';
import apiClient from '../../api/client';

export default function MyComplaints({ onSelectTicket }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickViewComplaint, setQuickViewComplaint] = useState(null);

  const fetchMyComplaints = async () => {
    setLoading(true);
    try {
      const data = await apiClient.complaints.list();
      if (Array.isArray(data)) {
        setComplaints(data);
      }
    } catch (err) {
      console.warn('Failed to fetch complaints:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyComplaints();
  }, []);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setQuickViewComplaint(null);
      }
    };
    if (quickViewComplaint) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickViewComplaint]);

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-600 text-white';
      case 'HIGH':
        return 'bg-amber-500 text-white';
      case 'MEDIUM':
        return 'bg-blue-600 text-white';
      case 'LOW':
        return 'bg-slate-600 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">My Submitted Complaints</h2>
          <p className="text-xs text-slate-500 mt-0.5">Click any ticket to view live SLA tracking and progression</p>
        </div>
        <button
          onClick={fetchMyComplaints}
          disabled={loading}
          className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
          title="Refresh List"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
        {loading && complaints.length === 0 ? (
          <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
            Loading submitted complaints...
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm font-medium">
            No complaints found. Submit a new ticket to see it here!
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {complaints.map((item) => (
              <div
                key={item.ticket_id || item.id}
                onClick={() => onSelectTicket(item.ticket_id)}
                className="p-5 hover:bg-slate-50 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      #{item.ticket_id}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase ${getPriorityStyle(item.priority)}`}>
                      {item.priority}
                    </span>
                    <span className="text-xs font-bold text-slate-500">{item.category}</span>
                    <span className="text-[11px] text-slate-400">
                      • {item.assigned_department_name || item.department}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1.5 group-hover:text-emerald-700 transition">
                    {item.title}
                  </h3>
                </div>

                <div className="flex items-center gap-4">
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-800 text-xs font-bold rounded-lg border border-blue-100">
                    {item.status}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickViewComplaint(item);
                    }}
                    className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition cursor-pointer"
                    title="Quick View Description"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Description Modal */}
      {quickViewComplaint && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setQuickViewComplaint(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                    #{quickViewComplaint.ticket_id}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase ${getPriorityStyle(quickViewComplaint.priority)}`}>
                    {quickViewComplaint.priority}
                  </span>
                  <span className="px-2 py-0.5 bg-white/10 text-slate-200 text-[10px] font-bold rounded">
                    {quickViewComplaint.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white leading-snug">
                  {quickViewComplaint.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickViewComplaint(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer ml-3 flex-shrink-0"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              
              {/* Submission Metadata */}
              <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Filed on:{' '}
                    <strong className="text-slate-700">
                      {quickViewComplaint.createdAt
                        ? new Date(quickViewComplaint.createdAt).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })
                        : 'Recent'}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>SLA: <strong>{quickViewComplaint.sla_hours || 24}h</strong></span>
                </div>
              </div>

              {/* Detailed Description */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Detailed Description
                </label>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {quickViewComplaint.description}
                </div>
              </div>

              {/* AI Routing & Intelligence Box */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>AI Triage & Routing Analysis</span>
                  </div>
                  {quickViewComplaint.ai_confidence_score && (
                    <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-600 text-white rounded-full">
                      {quickViewComplaint.ai_confidence_score}% Confidence
                    </span>
                  )}
                </div>
                
                <div className="text-xs text-emerald-950 font-medium grid grid-cols-2 gap-2 pt-1 border-t border-emerald-200/60">
                  <div>
                    <span className="text-[10px] text-emerald-700 uppercase font-bold block">Assigned Department</span>
                    <span className="font-bold">{quickViewComplaint.assigned_department_name || quickViewComplaint.department}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-700 uppercase font-bold block">Target Category</span>
                    <span className="font-bold">{quickViewComplaint.category}</span>
                  </div>
                </div>

                {quickViewComplaint.ai_routing_reasoning && (
                  <p className="text-xs text-emerald-800/90 italic pt-1 border-t border-emerald-200/60 leading-relaxed">
                    "{quickViewComplaint.ai_routing_reasoning}"
                  </p>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setQuickViewComplaint(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const tId = quickViewComplaint.ticket_id;
                  setQuickViewComplaint(null);
                  onSelectTicket(tId);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                Open Full Progression View <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
