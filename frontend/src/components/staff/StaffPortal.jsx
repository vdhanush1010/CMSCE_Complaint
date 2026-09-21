import React, { useState, useEffect, useMemo } from 'react';
import StaffHeader from './StaffHeader';
import ComplaintsTable from '../admin/ComplaintsTable';
import DepartmentControlPanel from '../admin/DepartmentControlPanel';
import LoginScreen from '../admin/LoginScreen';
import { 
  RefreshCw, 
  Inbox, 
  Megaphone, 
  Bell, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  Star,
  CheckCircle2,
  AlertCircle,
  Scale,
  MessageSquare,
  Filter,
  X,
  Eye,
  Activity,
  Award
} from 'lucide-react';
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
  const [feedbackModalComplaint, setFeedbackModalComplaint] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'IN_PROGRESS' | 'PENDING_VERIFY' | 'RESOLVED' | 'APPEALED' | 'HAS_FEEDBACK'

  // Department Isolated Broadcasts / Circulars
  const [circulars, setCirculars] = useState([]);
  const [isCircularsCollapsed, setIsCircularsCollapsed] = useState(false);

  const userDept = (user?.department || '').toUpperCase();

const STATUS_TO_CANONICAL_STAGE = {
  'Submitted': 'SUBMITTED',
  'SUBMITTED': 'SUBMITTED',
  'AI Analysed': 'AI_ANALYSED',
  'AI_ANALYSED': 'AI_ANALYSED',
  'Assigned': 'ASSIGNED',
  'ASSIGNED': 'ASSIGNED',
  'In Progress': 'IN_PROGRESS',
  'IN_PROGRESS': 'IN_PROGRESS',
  'Resolution Pending Verification': 'PENDING_VERIFICATION',
  'Pending Verification': 'PENDING_VERIFICATION',
  'PENDING_VERIFICATION': 'PENDING_VERIFICATION',
  'Resolved': 'RESOLVED',
  'RESOLVED': 'RESOLVED',
  'Closed': 'RESOLVED',
  'CLOSED': 'RESOLVED',
  'Reopened': 'IN_PROGRESS',
  'REOPENED': 'IN_PROGRESS',
  'Appealed': 'SUBMITTED',
  'APPEALED': 'SUBMITTED'
};

const resolveCanonicalStage = (stage, status) => {
  if (stage && STATUS_TO_CANONICAL_STAGE[stage]) return STATUS_TO_CANONICAL_STAGE[stage];
  if (status && STATUS_TO_CANONICAL_STAGE[status]) return STATUS_TO_CANONICAL_STAGE[status];
  const s = (stage || status || '').toUpperCase();
  if (s.includes('RESOLV') || s.includes('CLOSE')) return 'RESOLVED';
  if (s.includes('VERIF') || s.includes('PENDING')) return 'PENDING_VERIFICATION';
  if (s.includes('IN_PROGRESS') || s === 'IN PROGRESS') return 'IN_PROGRESS';
  if (s.includes('ASSIGN')) return 'ASSIGNED';
  if (s.includes('AI') || s.includes('ANALYSE')) return 'AI_ANALYSED';
  return 'SUBMITTED';
};

const isMatchingComplaint = (a, b) => {
  if (!a || !b) return false;
  return (
    (a.id && (a.id === b.id || a.id === b.ticket_id || a.id === b.db_id)) ||
    (a.db_id && (a.db_id === b.db_id || a.db_id === b.id || a.db_id === b._id)) ||
    (a._id && (a._id === b.db_id || a._id === b.id || a._id === b._id)) ||
    (a.ticket_id && (a.ticket_id === b.id || a.ticket_id === b.ticket_id))
  );
};

  const mapItem = (item) => {
    const now = new Date();
    const deadline = (item.slaExtendedUntil || item.slaDeadline || item.sla_deadline_at) ? new Date(item.slaExtendedUntil || item.slaDeadline || item.sla_deadline_at) : now;
    const diffHours = Math.round((deadline - now) / (1000 * 3600));

    return {
      id: item.ticket_id || item.id,
      db_id: item.id || item._id,
      category: item.category || item.title || 'General',
      description: item.description || '',
      assignedDept: item.assigned_department_code || item.department || userDept,
      priority: (item.priority || 'MEDIUM').toUpperCase(),
      status: item.status || 'Submitted',
      stage: resolveCanonicalStage(item.stage, item.status),
      slaHoursLeft: diffHours,
      isSlaOverdue: Boolean(item.is_sla_breached) || diffHours < 0,
      studentName: item.is_anonymous ? 'Anonymous' : (item.student_name || 'Student User'),
      studentRoll: item.student_roll || '2026-STU',
      routingReasoning: item.ai_routing_reasoning || 'AI routing engine processed ticket.',
      attachments: item.attachments || item.proofs || [],
      resolutionProof: item.resolutionProof || null,
      resolution_proof_url: item.resolution_proof_url || (item.resolutionProof?.fileData || (typeof item.resolutionProof === 'string' ? item.resolutionProof : '')),
      resolution_notes: item.resolution_notes || item.resolutionNotes || '',
      resolutionNotes: item.resolutionNotes || item.resolution_notes || '',
      feedback: item.feedback || null,
      appealHistory: item.appealHistory || [],
      appealCount: item.appealCount || (item.appealHistory?.length || 0),
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
        setSelectedComplaint((prev) => {
          if (!prev) return null;
          const fresh = mapped.find((c) => isMatchingComplaint(c, prev));
          return fresh ? { ...prev, ...fresh } : prev;
        });
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
      setComplaints((prev) => prev.map((c) => (isMatchingComplaint(c, updated) ? { ...c, ...updated } : c)));
      setSelectedComplaint((prev) => (isMatchingComplaint(prev, updated) ? { ...prev, ...updated } : prev));
      // Re-fetch queue to guarantee all components and metrics are synchronized
      await syncData(false);
      return { success: true };
    } catch (err) {
      console.warn('handleUpdateComplaint error:', err);
      return { success: false, error: err.message || 'Failed to sync updated complaint.' };
    }
  };

  const handleInternalLogout = () => {
    localStorage.removeItem('dept_token');
    localStorage.removeItem('dept_user');
    setToken(null);
    setUser(null);
    if (onLogout) onLogout();
  };

  // KPIs
  const stats = useMemo(() => {
    const total = complaints.length;
    const inProgress = complaints.filter(c => ['IN_PROGRESS', 'In Progress'].includes(c.stage || c.status)).length;
    const pendingVerify = complaints.filter(c => ['PENDING_VERIFICATION', 'Resolution Pending Verification'].includes(c.stage || c.status)).length;
    const resolved = complaints.filter(c => ['RESOLVED', 'Resolved', 'Closed', 'CLOSED'].includes(c.stage || c.status)).length;
    const appealed = complaints.filter(c => (c.status || '').toUpperCase() === 'APPEALED' || (c.appealHistory && c.appealHistory.length > 0 && c.stage !== 'RESOLVED')).length;
    
    const feedbackList = complaints.filter(c => c.feedback && c.feedback.rating);
    const feedbackCount = feedbackList.length;
    const avgRating = feedbackCount > 0 
      ? (feedbackList.reduce((sum, c) => sum + Number(c.feedback.rating || 0), 0) / feedbackCount).toFixed(1)
      : null;

    return { total, inProgress, pendingVerify, resolved, appealed, feedbackCount, avgRating };
  }, [complaints]);

  // Filtered complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((item) => {
      // 1. Text Search
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchesQuery = 
          item.id.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.studentName && item.studentName.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      // 2. Active Filter Tab
      if (activeFilter === 'IN_PROGRESS') {
        return ['IN_PROGRESS', 'In Progress'].includes(item.stage || item.status);
      }
      if (activeFilter === 'PENDING_VERIFY') {
        return ['PENDING_VERIFICATION', 'Resolution Pending Verification'].includes(item.stage || item.status);
      }
      if (activeFilter === 'RESOLVED') {
        return ['RESOLVED', 'Resolved', 'Closed', 'CLOSED'].includes(item.stage || item.status);
      }
      if (activeFilter === 'APPEALED') {
        return (item.status || '').toUpperCase() === 'APPEALED' || (item.appealHistory && item.appealHistory.length > 0 && item.stage !== 'RESOLVED');
      }
      if (activeFilter === 'HAS_FEEDBACK') {
        return Boolean(item.feedback && item.feedback.rating);
      }

      return true;
    });
  }, [complaints, searchQuery, activeFilter]);

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

  const deptName = user?.department_name || `${userDept} Operations`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <StaffHeader user={user} onLogout={handleInternalLogout} />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Dedicated Admin Broadcasts / Circulars Section */}
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

        {/* Top Department Metrics & Student Feedback KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Total */}
          <div 
            onClick={() => setActiveFilter('ALL')}
            className={`p-4 bg-white rounded-xl border transition-all cursor-pointer shadow-xs ${
              activeFilter === 'ALL' ? 'border-emerald-600 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-500">Total Queue</span>
              <Inbox className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900">{stats.total}</div>
            <span className="text-[10px] text-slate-400">All assigned tickets</span>
          </div>

          {/* In Progress */}
          <div 
            onClick={() => setActiveFilter('IN_PROGRESS')}
            className={`p-4 bg-white rounded-xl border transition-all cursor-pointer shadow-xs ${
              activeFilter === 'IN_PROGRESS' ? 'border-amber-600 ring-2 ring-amber-500/20' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-amber-700">In Progress</span>
              <Activity className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-700">{stats.inProgress}</div>
            <span className="text-[10px] text-amber-600">Active maintenance</span>
          </div>

          {/* Pending Verify */}
          <div 
            onClick={() => setActiveFilter('PENDING_VERIFY')}
            className={`p-4 bg-white rounded-xl border transition-all cursor-pointer shadow-xs ${
              activeFilter === 'PENDING_VERIFY' ? 'border-orange-600 ring-2 ring-orange-500/20' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-orange-700">Pending Verify</span>
              <Clock className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-black text-orange-700">{stats.pendingVerify}</div>
            <span className="text-[10px] text-orange-600">Awaiting sign-off</span>
          </div>

          {/* Resolved */}
          <div 
            onClick={() => setActiveFilter('RESOLVED')}
            className={`p-4 bg-white rounded-xl border transition-all cursor-pointer shadow-xs ${
              activeFilter === 'RESOLVED' ? 'border-emerald-600 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-emerald-700">Resolved</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-700">{stats.resolved}</div>
            <span className="text-[10px] text-emerald-600">Completed cases</span>
          </div>

          {/* Appealed */}
          <div 
            onClick={() => setActiveFilter('APPEALED')}
            className={`p-4 bg-white rounded-xl border transition-all cursor-pointer shadow-xs ${
              activeFilter === 'APPEALED' ? 'border-rose-600 ring-2 ring-rose-500/20' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-rose-700">Appeals</span>
              <Scale className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-700">{stats.appealed}</div>
            <span className="text-[10px] text-rose-600">Re-investigation needed</span>
          </div>

          {/* Student Feedback KPI Card */}
          <div 
            onClick={() => setActiveFilter('HAS_FEEDBACK')}
            className={`p-4 rounded-xl border transition-all cursor-pointer shadow-xs ${
              activeFilter === 'HAS_FEEDBACK' 
                ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-400/30' 
                : 'bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 border-amber-200 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-amber-900 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                Student Feedback
              </span>
              <Award className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-800">
                {stats.avgRating ? `${stats.avgRating}★` : 'N/A'}
              </span>
              {stats.feedbackCount > 0 && (
                <span className="text-xs text-amber-700 font-semibold">
                  ({stats.feedbackCount})
                </span>
              )}
            </div>
            <span className="text-[10px] text-amber-700 block truncate">
              {stats.feedbackCount > 0 ? `${stats.feedbackCount} ratings received` : 'No ratings yet'}
            </span>
          </div>
        </div>

        {/* Search, Filters & Action Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'ALL', label: 'All Tickets', count: stats.total },
              { id: 'IN_PROGRESS', label: 'In Progress', count: stats.inProgress },
              { id: 'PENDING_VERIFY', label: 'Pending Verification', count: stats.pendingVerify },
              { id: 'RESOLVED', label: 'Resolved', count: stats.resolved },
              { id: 'APPEALED', label: 'Appealed', count: stats.appealed, badgeClass: 'bg-rose-500 text-white' },
              { id: 'HAS_FEEDBACK', label: 'With Feedback', count: stats.feedbackCount, badgeClass: 'bg-amber-500 text-white' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  tab.badgeClass 
                    ? tab.badgeClass 
                    : activeFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search and Refresh */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search ID, Student, Title…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white w-full sm:w-60"
            />
            <button
              onClick={() => syncData(true)}
              disabled={loading}
              title="Refresh Queue"
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Full-Width Complaints Table (NO Cramped 1/3 Side Drawer) */}
        <div className="w-full">
          {loading && complaints.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-sm font-semibold text-slate-600">Loading department grievances…</p>
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Inbox className="w-12 h-12 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No tickets match your active filter.</p>
              {(searchQuery || activeFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilter('ALL');
                  }}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="w-full shadow-sm rounded-xl overflow-hidden border border-slate-200">
              <ComplaintsTable
                complaints={filteredComplaints}
                selectedComplaintId={selectedComplaint?.id || null}
                onSelectComplaint={(complaint) => setSelectedComplaint(complaint)}
                onViewFeedback={(complaint) => setFeedbackModalComplaint(complaint)}
              />
            </div>
          )}
        </div>

      </main>

      {/* Spacious Full-Page Department Control Panel Modal Dialog */}
      {selectedComplaint && (
        <DepartmentControlPanel
          complaint={selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          onUpdateComplaint={handleUpdateComplaint}
          isStaffView={true}
        />
      )}

      {/* Dedicated Quick View Feedback Modal */}
      {feedbackModalComplaint && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setFeedbackModalComplaint(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 m-0">Student Resolution Feedback</h3>
                  <p className="text-xs text-slate-400 m-0">
                    Ticket #{feedbackModalComplaint.id} • {feedbackModalComplaint.category}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackModalComplaint(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100/80 flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-1.5 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star}
                    className={`w-7 h-7 ${
                      star <= (feedbackModalComplaint.feedback?.rating || 0)
                        ? 'fill-amber-400 text-amber-500 drop-shadow-xs'
                        : 'text-slate-200 fill-slate-100'
                    }`}
                  />
                ))}
              </div>
              <div className="text-xl font-black text-amber-900">
                {feedbackModalComplaint.feedback?.rating || 0} out of 5 Stars
              </div>
              <span className="text-xs text-amber-700/80">
                Submitted by {feedbackModalComplaint.studentName} ({feedbackModalComplaint.studentRoll})
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Student Feedback Comments
              </label>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed min-h-[70px]">
                {feedbackModalComplaint.feedback?.comments || (
                  <span className="italic text-slate-400">No written comments provided with rating.</span>
                )}
              </div>
            </div>

            {feedbackModalComplaint.feedback?.createdAt && (
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Feedback Received:</span>
                <span className="font-semibold text-slate-600">
                  {new Date(feedbackModalComplaint.feedback.createdAt).toLocaleString()}
                </span>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedComplaint(feedbackModalComplaint);
                  setFeedbackModalComplaint(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Open Full Grievance</span>
              </button>
              <button
                type="button"
                onClick={() => setFeedbackModalComplaint(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-slate-900 text-slate-500 py-4 border-t border-slate-800 text-center text-xs">
        <p>© 2026 CMSCE Department Portal — {deptName}</p>
      </footer>
    </div>
  );
}
