import React, { useState, useEffect } from 'react';
import Header from './Header';
import MetricCards from './MetricCards';
import DepartmentTabs from './DepartmentTabs';
import ComplaintsTable from './ComplaintsTable';
import DepartmentControlPanel from './DepartmentControlPanel';
import NotificationsPanel from './NotificationsPanel';
import ManageDeptHeadsModal from './ManageDeptHeadsModal';
import AdminProfileModal from './AdminProfileModal';
import BroadcastSystem from './BroadcastSystem';
import LoginScreen from './LoginScreen';
import apiClient from '../../api/client';

export default function AdminDashboard({ onLogout }) {
  const [token, setToken] = useState(
    () => localStorage.getItem('admin_token')
  );
  const [user, setUser] = useState(() => {
    try {
      const adminUser = localStorage.getItem('admin_user');
      if (adminUser) return JSON.parse(adminUser);
      return null;
    } catch (_) {
      return null;
    }
  });

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [publishedAnnouncements, setPublishedAnnouncements] = useState([]);

  // Filters & Drawer State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  
  // KPI Interactive Filter: 'OPEN' | 'CRITICAL' | 'BREACHED' | 'RESOLVED' | null
  const [kpiFilter, setKpiFilter] = useState(null);

  // Modals Visibility
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isManageDeptHeadsOpen, setIsManageDeptHeadsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    // Clicking the "All" tab resets any KPI filter and clears any sticky department parameter
    if (tab === 'ALL') {
      setKpiFilter(null);
      localStorage.removeItem('selectedDepartment');
    }
  };

  useEffect(() => {
    // Ensure clean initialization without persisted department session pollution
    setActiveTab('ALL');
    setKpiFilter(null);
    localStorage.removeItem('selectedDepartment');
  }, []);

  const syncData = async () => {
    const activeTok = token || localStorage.getItem('admin_token');
    if (!activeTok) {
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.complaints.list();
      const data = Array.isArray(res) ? res : (res.complaints || []);
      if (Array.isArray(data)) {
        const mapped = data.map(item => {
          const now = new Date();
          const deadline = item.sla_deadline_at ? new Date(item.sla_deadline_at) : now;
          const diffHours = Math.round((deadline - now) / (1000 * 3600));

          return {
            id: item.ticket_id || item.id,
            db_id: item.id || item._id,
            category: item.category || item.title || 'General',
            description: item.description || '',
            assignedDept: item.assigned_department_code || item.department || 'CANTEEN',
            priority: (item.priority || 'MEDIUM').toUpperCase(),
            status: item.status || 'Submitted',
            slaHoursLeft: diffHours,
            isSlaOverdue: Boolean(item.is_sla_breached) || diffHours < 0,
            studentName: item.is_anonymous ? 'Anonymous' : (item.student_name || 'Student User'),
            studentRoll: item.student_roll || '2026-STU',
            routingReasoning: item.ai_routing_reasoning || 'AI routing engine processed ticket.',
            attachments: item.attachments || item.proofs || [],
            proofs: (item.attachments && item.attachments.length > 0)
              ? item.attachments
              : (item.proofs && item.proofs.length > 0
                ? item.proofs
                : (item.resolution_proof_url ? [{ fileName: item.resolution_proof_url }] : [])),
            adminComments: (item.history || []).map(h => ({
              author: h.changed_by_name || 'System AI',
              text: h.remarks || `${h.old_status} -> ${h.new_status}`,
              timestamp: h.timestamp ? new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'
            }))
          };
        });

        setComplaints(mapped);
        setLoading(false);
      }
    } catch (err) {
      console.warn('Sync complaints error:', err.message);
      setLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const items = await apiClient.announcements.getForAdmin();
      if (Array.isArray(items)) {
        setPublishedAnnouncements(items);
      }
    } catch (_) {}
  };

  useEffect(() => {
    syncData();
    fetchAnnouncements();
    const interval = setInterval(syncData, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const handleUpdateComplaint = async (updated) => {
    try {
      const body = {
        status: updated.status,
        ...(updated.resolution_proof_url ? { resolution_proof_url: updated.resolution_proof_url } : {}),
        ...(updated.resolution_notes ? { resolution_notes: updated.resolution_notes } : {}),
        ...(updated.priority ? { priority: updated.priority } : {}),
        ...(updated.department ? { department: updated.department } : {}),
        ...(updated.adminComments ? { adminComments: updated.adminComments } : {})
      };

      await apiClient.complaints.updateStatus(updated.db_id || updated.id, body);

      setComplaints(prev => prev.map(c => c.id === updated.id ? updated : c));
      if (selectedComplaint && selectedComplaint.id === updated.id) {
        setSelectedComplaint(updated);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to update complaint' };
    }
  };

  const handleLogin = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('admin_token', newToken);
    localStorage.setItem('admin_user', JSON.stringify(newUser));
    localStorage.removeItem('selectedDepartment');
  };

  const handleInternalLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('selectedDepartment');
    setToken(null);
    setUser(null);
    setComplaints([]);
    setSelectedComplaint(null);
    if (onLogout) onLogout();
  };

  const handlePublishAnnouncement = async (announcement) => {
    try {
      const created = await apiClient.announcements.create({
        title: announcement.title || 'Campus Announcement',
        message: announcement.message,
        content: announcement.message,
        targetAudience: announcement.targetAudience,
        targetDepartment: announcement.targetDepartment,
        departmentCode: announcement.departmentCode,
        priority: announcement.priority || 'NORMAL'
      });
      setPublishedAnnouncements(prev => [created, ...prev]);
    } catch (err) {
      console.warn('Publish error:', err);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    try {
      await apiClient.announcements.delete(id);
      setPublishedAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.warn('Delete error:', err);
    }
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  const handleAdminUpdated = (updatedAdmin) => {
    setUser(prev => ({ ...prev, ...updatedAdmin }));
    try {
      const existing = JSON.parse(localStorage.getItem('admin_user') || '{}');
      localStorage.setItem('admin_user', JSON.stringify({ ...existing, ...updatedAdmin }));
    } catch (_) {}
  };

  // Filter complaints based on Search, Active Tab, and Interactive KPI Card
  const filteredComplaints = complaints.filter(item => {
    // 1. Search filter
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = 
      !query ||
      item.id.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.studentRoll.toLowerCase().includes(query);

    // 2. Department Tab filter
    const matchesDept = 
      activeTab === 'ALL' || 
      item.assignedDept === activeTab;

    // 3. Interactive KPI Metric Card Filter
    let matchesKpi = true;
    if (kpiFilter === 'OPEN') {
      // Tickets where status is NOT Resolved
      matchesKpi = !['Resolved', 'Closed'].includes(item.status);
    } else if (kpiFilter === 'CRITICAL') {
      // Tickets with priority CRITICAL
      matchesKpi = (item.priority || '').toUpperCase() === 'CRITICAL';
    } else if (kpiFilter === 'BREACHED') {
      // Overdue tickets where SLA countdown has lapsed
      matchesKpi = Boolean(item.isSlaOverdue || item.is_sla_breached || item.slaHoursLeft < 0);
    } else if (kpiFilter === 'RESOLVED') {
      // Tickets with status Resolved
      matchesKpi = ['Resolved', 'Closed'].includes(item.status);
    }

    return matchesSearch && matchesDept && matchesKpi;
  });

  if (!token || !user || user.role !== 'ADMIN') {
    return <LoginScreen onLoginSuccess={handleLogin} />;
  }

  const adminDisplayName = user?.name || user?.full_name || 'Dr. K. Ramanathan';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Header Bar */}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onManageDeptHeadsClick={() => setIsManageDeptHeadsOpen(true)}
        onProfileClick={() => setIsProfileOpen(true)}
        adminName={adminDisplayName}
      />

      {/* Admin Subnav */}
      <div className="bg-slate-900 text-slate-300 px-6 py-2 text-xs flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Logged in as <strong>{adminDisplayName}</strong> (Administrator)</span>
        </div>
        <button
          onClick={handleInternalLogout}
          className="text-rose-400 hover:text-rose-300 font-bold hover:underline cursor-pointer"
        >
          Sign Out
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto pb-12">
        {activeTab !== 'ANNOUNCEMENTS' ? (
          <>
            {/* KPI Cards Row (Interactive) */}
            <MetricCards 
              token={token} 
              activeKpiFilter={kpiFilter}
              onSelectKpiFilter={setKpiFilter}
            />

            {/* Department Filter Tabs */}
            <DepartmentTabs activeTab={activeTab} setActiveTab={handleSelectTab} />

            {/* Split Screen layout: Table / Control Panel */}
            <div className="px-6 py-6 flex flex-col lg:flex-row gap-6 items-start">
              
              <div className={`transition-all duration-300 w-full ${
                selectedComplaint ? 'lg:w-2/3' : 'lg:w-full'
              }`}>
                {/* Active KPI Filter Banner */}
                {kpiFilter && (
                  <div className="mb-4 flex items-center justify-between bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl text-xs shadow-sm animate-in fade-in-50 duration-150">
                    <div className="flex items-center gap-2 text-emerald-900 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                      <span>
                        Filtered by KPI Metric:{' '}
                        <strong className="font-bold text-brand-green uppercase">
                          {kpiFilter === 'OPEN' && 'Total Open Tickets (Unresolved)'}
                          {kpiFilter === 'CRITICAL' && 'Critical Escalations (Priority: CRITICAL)'}
                          {kpiFilter === 'BREACHED' && 'SLA Breaches (Countdown Expired)'}
                          {kpiFilter === 'RESOLVED' && 'Resolved Tickets (Historical View)'}
                        </strong>
                        {' '}({filteredComplaints.length} tickets matching)
                      </span>
                    </div>
                    <button
                      onClick={() => setKpiFilter(null)}
                      className="font-bold text-emerald-700 hover:text-brand-green hover:underline cursor-pointer flex items-center gap-1"
                    >
                      Reset Filter
                    </button>
                  </div>
                )}

                <ComplaintsTable
                  complaints={filteredComplaints}
                  selectedComplaintId={selectedComplaint?.id || null}
                  onSelectComplaint={(complaint) => {
                    if (selectedComplaint && selectedComplaint.id === complaint.id) {
                      setSelectedComplaint(null);
                    } else {
                      setSelectedComplaint(complaint);
                    }
                  }}
                />
              </div>

              {selectedComplaint && (
                <div className="w-full lg:w-1/3">
                  <DepartmentControlPanel
                    complaint={selectedComplaint}
                    onClose={() => setSelectedComplaint(null)}
                    onUpdateComplaint={handleUpdateComplaint}
                  />
                </div>
              )}

            </div>
          </>
        ) : (
          <>
            <DepartmentTabs activeTab={activeTab} setActiveTab={handleSelectTab} />
            <BroadcastSystem 
              onPublishAnnouncement={handlePublishAnnouncement}
              publishedAnnouncements={publishedAnnouncements}
              onDeleteAnnouncement={handleDeleteAnnouncement}
            />
          </>
        )}
      </main>

      {/* Modals & Overlays */}
      <AdminProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={user}
        onAdminUpdated={handleAdminUpdated}
      />

      <ManageDeptHeadsModal
        isOpen={isManageDeptHeadsOpen}
        onClose={() => setIsManageDeptHeadsOpen(false)}
      />

      <NotificationsPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllRead}
        onClearAll={handleClearNotifications}
      />

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-500 py-6 border-t border-slate-800 text-center text-xs mt-auto">
        <div className="max-w-[1600px] mx-auto px-6">
          <p>© 2026 CMSCE Admin Portal. All rights reserved.</p>
          <p className="mt-1 text-[10px] opacity-70">AI-Powered Routing Engine v1.2.0 • Secured Backend Engine Active</p>
        </div>
      </footer>
    </div>
  );
}
