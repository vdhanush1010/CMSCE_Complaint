import React, { useState, useEffect } from 'react';
import Header from './Header';
import AuthScreens from './AuthScreens';
import ComplaintDesk from './ComplaintDesk';
import TicketTracker from './TicketTracker';
import MyComplaints from './MyComplaints';
import NotificationsDrawer from './NotificationsDrawer';
import MobileBottomNav from './MobileBottomNav';
import apiClient from '../../api/client';

export default function StudentAppShell() {
  const [user, setUser] = useState(() => {
    try {
      const token = localStorage.getItem('cmsce_student_token');
      if (!token) return null;
      return JSON.parse(localStorage.getItem('cmsce_student_user') || 'null');
    } catch (_) {
      return null;
    }
  });

  const [activeScreen, setActiveScreen] = useState(() => {
    const token = localStorage.getItem('cmsce_student_token');
    return token ? 'DESK' : 'LOGIN';
  });

  const [trackedTicketId, setTrackedTicketId] = useState('');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const fetchAnnouncements = async () => {
    try {
      const items = await apiClient.announcements.getForStudents();
      if (Array.isArray(items)) {
        const notifs = items.map((a) => ({
          id: a.id || a._id,
          type: a.priority === 'URGENT' || a.priority === 'CRITICAL' ? 'CAMPUS_ALERT' : 'ANNOUNCEMENT',
          title: a.title,
          message: `${a.title} — ${a.content || a.message}`,
          timestamp: a.createdAt || a.created_at
            ? new Date(a.createdAt || a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Recently'
        }));
        setNotifications(notifs);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('cmsce_student_token');
    localStorage.removeItem('cmsce_student_user');
    setUser(null);
    setActiveScreen('LOGIN');
  };

  const handleTicketCreated = (ticketId) => {
    setTrackedTicketId(ticketId);
    setActiveScreen('TRACKER');
  };

  const handleScreenNavigation = (screen) => {
    if (!user && !['LOGIN', 'REGISTER', 'FORGOT_PASSWORD'].includes(screen)) {
      setActiveScreen('LOGIN');
    } else {
      setActiveScreen(screen);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-16 md:pb-0">
      
      {/* Header */}
      <Header
        user={user}
        activeScreen={activeScreen}
        setActiveScreen={handleScreenNavigation}
        unreadCount={notifications.length}
        onBellClick={() => setIsNotifOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {['LOGIN', 'REGISTER', 'FORGOT_PASSWORD'].includes(activeScreen) && (
          <AuthScreens
            screen={activeScreen}
            onNavigate={setActiveScreen}
            onLoginSuccess={(loggedInUser) => {
              setUser(loggedInUser);
              setActiveScreen('DESK');
            }}
          />
        )}

        {activeScreen === 'DESK' && (
          <ComplaintDesk
            user={user}
            onTicketCreated={handleTicketCreated}
          />
        )}

        {activeScreen === 'TRACKER' && (
          <TicketTracker
            ticketId={trackedTicketId}
            onBack={() => setActiveScreen('DESK')}
          />
        )}

        {activeScreen === 'MY_COMPLAINTS' && (
          <MyComplaints
            onSelectTicket={(tId) => {
              setTrackedTicketId(tId);
              setActiveScreen('TRACKER');
            }}
          />
        )}

      </main>

      {/* Slide-out Notifications Drawer */}
      <NotificationsDrawer
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        notifications={notifications}
        onClearAll={() => setNotifications([])}
      />

      {/* Mobile Bottom Navigation Bar (375px Viewport) */}
      <MobileBottomNav
        activeScreen={activeScreen}
        setActiveScreen={setActiveScreen}
        unreadCount={notifications.length}
        onBellClick={() => setIsNotifOpen(true)}
      />

      {/* Footer */}
      <footer className="hidden md:block bg-slate-900 text-slate-500 py-6 border-t border-slate-800 text-center text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 CMSCE Student Portal • AI-Powered Grievance System v1.2</p>
          <p className="mt-1 text-[10px] text-slate-600">Connected to CMSCE Node.js + MongoDB API • Branch: main</p>
        </div>
      </footer>

    </div>
  );
}
