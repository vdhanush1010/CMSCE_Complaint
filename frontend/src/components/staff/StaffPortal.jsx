import React, { useState, useEffect } from 'react';
import StaffHeader from './StaffHeader';
import ComplaintsTable from '../admin/ComplaintsTable';
import DepartmentControlPanel from '../admin/DepartmentControlPanel';
import LoginScreen from '../admin/LoginScreen';
import { RefreshCw, Inbox, Megaphone, Bell, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import apiClient from '../../api/client';

export default function StaffPortal({ token: initialToken, user: initialUser, onLogout }) {
  const [token, setToken] = useState(
    () => initialToken || localStorage.getItem('dept_token')
  );
  const [user, setUser] = useState(() => {
    if (initialUser) return initialUser;
    try {
      const deptUser = localStorage.getItem('dept_user');
      if (deptUser) return JSON.parse(deptUser);
      return null;
    } catch (_) {
      return null;
    }
  });

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Department Isolated Broadcasts / Circulars
  const [circulars, setCirculars] = useState([]);
  const [isCircularsCollapsed, setIsCircularsCollapsed] = useState(false);

  const userDept = (user?.department || '').toUpperCase();

  const mapItem = (item) => {
    const now = new Date();
    const deadline = item.sla_deadline_at ? new Date(item.sla_deadline_at) : now;
    const diffHours = Math.round((deadline - now) / (1000 * 3600));

    return {
      id: item.ticket_id || item.id,
      db_id: item.id || item._id,
      category: item.category || item.title || 'General',
      description: item.description || '',
      assignedDept: item.assigned_department_code || item.department || userDept,
      priority: (item.priority || 'MEDIUM').toUpperCase(),
      status: item.status || 'Submitted',
      slaHoursLeft: diffHours,
      isSlaOverdue: Boolean(item.is_sla_breached) || diffHours < 0,
      studentName: item.is_anonymous ? 'Anonymous' : (item.student_name || 'Student User'),
      studentRoll: item.student_roll || '2026-STU',
      routingReasoning: item.ai_routing_reasoning || 'AI routing engine processed ticket.',
      attachments: item.attachments || item.proofs || [],
      resolutionProof: item.resolutionProof || null,
      resolution_proof_url: item.resolution_proof_url || item.resolutionProof?.fileData || '',
      resolution_notes: item.resolution_notes || '',
      proofs: (item.attachments && item.attachments.length > 0)
        ? item.attachments
        : (item.proofs && item.proofs.length > 0
          ? item.proofs
          : (item.resolution_proof_url ? [{ fileName: item.resolution_proof_url }] : [])),
      adminComments: (item.history || []).map((h) => ({
        author: h.changed_by_name || 'Staff',
        text: h.remarks || `${h.old_status} → ${h.new_status}`,
        timestamp: h.timestamp
          ? new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Recently',
      })),
    };
  };

  const syncData = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await apiClient.complaints.list({
        department: userDept
      });
      const data = Array.isArray(res) ? res : (res.complaints || []);

      if (Array.isArray(data)) {
        const mapped = data.map(mapItem);
        setComplaints(mapped);
        setLastSynced(new Date());
      }
    } catch (err) {
      console.warn('StaffPortal: fetch error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCirculars = async () => {
    if (!userDept) return;
    try {
      const items = await apiClient.announcements.getForDepartment(userDept);
      if (Array.isArray(items)) {
        setCirculars(items);
      }
    } catch (err) {
      console.warn('Failed to fetch department circulars:', err.message);
    }
  };

  useEffect(() => {
    if (!token || !user) return;
    syncData();
    fetchCirculars();
    const interval = setInterval(() => {
      syncData();
      fetchCirculars();
    }, 6000);
    return () => clearInterval(interval);
  }, [token, userDept]);

  const handleUpdateComplaint = async (updated) => {
    try {
      const body = {
        status: updated.status,
        ...(updated.resolutionProof ? { resolutionProof: updated.resolutionProof } : {}),
        ...(updated.resolution_proof_url ? { resolution_proof_url: updated.resolution_proof_url } : {}),
        ...(updated.resolution_notes ? { resolution_notes: updated.resolution_notes } : {}),
        ...(updated.adminComments ? { adminComments: updated.adminComments } : {})
      };

      await apiClient.complaints.updateStatus(updated.db_id || updated.id, body);

      setComplaints((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (selectedComplaint?.id === updated.id) {
        setSelectedComplaint(updated);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to update complaint status.' };
    }
  };

  const handleInternalLogout = () => {
    localStorage.removeItem('dept_token');
    localStorage.removeItem('dept_user');
    setToken(null);
    setUser(null);
    if (onLogout) onLogout();
  };

  if (!token || !user || (user.role !== 'DEPT_HEAD' && user.role !== 'DEPARTMENT_HEAD' && user.role !== 'STAFF')) {
    return (
      <LoginScreen
        onLoginSuccess={(newToken, newUser) => {
          setToken(newToken);
          setUser(newUser);
          localStorage.setItem('dept_token', newToken);
          localStorage.setItem('dept_user', JSON.stringify(newUser));
        }}
      />
    );
  }

  const filteredComplaints = complaints.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.id.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });

  const deptName = user?.department_name || `${userDept} Operations`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <StaffHeader user={user} onLogout={handleInternalLogout} />

      <main className="flex-1 w-full max-w-[1600px] mx-auto pb-12">
        
        {/* Dedicated Admin Broadcasts / Circulars Section */}
        <div className="px-6 pt-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-900 to-brand-green px-5 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/10 rounded-lg text-brand-yellow">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white m-0 flex items-center gap-2">
                    Admin Broadcasts / Circulars
                    {circulars.length > 0 && (
                      <span className="bg-brand-yellow text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                        {circulars.length}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-emerald-200/90 m-0">
                    Direct executive notices isolated for {deptName}
                  </p>
                </div>
              </div>

              {circulars.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCircularsCollapsed(!isCircularsCollapsed)}
                  className="p-1 hover:bg-white/10 rounded text-emerald-100 cursor-pointer"
                >
                  {isCircularsCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              )}
            </div>

            {!isCircularsCollapsed && (
              <div className="p-4 bg-slate-50/50">
                {circulars.length === 0 ? (
                  <div className="py-2 text-center text-xs text-slate-400 italic">
                    No active admin circulars or broadcasts for your department at this time.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {circulars.map((c) => {
                      const isUrgent = c.priority === 'URGENT' || c.priority === 'CRITICAL';
                      const formattedTime = c.createdAt
                        ? new Date(c.createdAt).toLocaleString([], {
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Recently';

                      return (
                        <div 
                          key={c.id || c._id}
                          className={`p-3.5 bg-white rounded-lg border transition-all ${
                            isUrgent 
                              ? 'border-rose-300 ring-1 ring-rose-200 shadow-xs' 
                              : 'border-slate-200 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                              isUrgent 
                                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {isUrgent ? 'URGENT CIRCULAR' : 'NORMAL CIRCULAR'}
                            </span>

                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formattedTime}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-slate-800 m-0 mb-1">
                            {c.title || 'Central Administration Directive'}
                          </h4>

                          <p className="text-xs text-slate-600 leading-relaxed break-words m-0">
                            {c.message || c.content}
                          </p>

                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                            <span>From: <strong>{c.author_name || 'Campus Administration'}</strong></span>
                            <span className="font-semibold text-emerald-700">
                              {c.targetAudience === 'ALL_DEPTS' ? 'All Dept Heads' : `${userDept} Only`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Title Bar */}
        <div className="px-6 pt-5 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 m-0">
              {deptName} — Assigned Grievance Queue
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing tickets routed to {deptName}.
              {lastSynced && (
                <span className="ml-2 text-slate-400">
                  Last synced {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search tickets…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white w-52"
            />
            <button
              onClick={() => syncData(true)}
              disabled={loading}
              title="Refresh Queue"
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Split Screen Queue */}
        <div className="px-6 py-4 flex flex-col lg:flex-row gap-6 items-start">
          <div className={`transition-all duration-300 w-full ${selectedComplaint ? 'lg:w-2/3' : 'lg:w-full'}`}>
            {loading && complaints.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center gap-3 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-sm font-medium">Loading department queue…</p>
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center gap-3 text-slate-400">
                <Inbox className="w-10 h-10" />
                <p className="text-sm font-medium">No active tickets currently assigned to your department.</p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-emerald-600 underline cursor-pointer"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <ComplaintsTable
                complaints={filteredComplaints}
                selectedComplaintId={selectedComplaint?.id || null}
                onSelectComplaint={(complaint) => {
                  if (selectedComplaint?.id === complaint.id) {
                    setSelectedComplaint(null);
                  } else {
                    setSelectedComplaint(complaint);
                  }
                }}
              />
            )}
          </div>

          {selectedComplaint && (
            <div className="w-full lg:w-1/3">
              <DepartmentControlPanel
                complaint={selectedComplaint}
                onClose={() => setSelectedComplaint(null)}
                onUpdateComplaint={handleUpdateComplaint}
                isStaffView={true}
              />
            </div>
          )}
        </div>

      </main>

      <footer className="bg-slate-900 text-slate-500 py-4 border-t border-slate-800 text-center text-xs">
        <p>© 2026 CMSCE Department Portal — {deptName}</p>
      </footer>
    </div>
  );
}
