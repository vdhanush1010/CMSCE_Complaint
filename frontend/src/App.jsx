import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import StudentAppShell from './components/student/StudentAppShell';
import AdminDashboard from './components/admin/AdminDashboard';
import DepartmentPortal from './components/staff/DepartmentPortal';
import LoginScreen from './components/admin/LoginScreen';

/**
 * Route guard for Admin Portal routes (/admin/*)
 * Validates admin session; redirects unauthorized requests to /office/login
 */
function AdminProtectedRoute({ children }) {
  const token = localStorage.getItem('admin_token');
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('admin_user') || 'null');
  } catch (_) {
    user = null;
  }

  if (!token || !user || user.role !== 'ADMIN') {
    return <Navigate to="/office/login" replace />;
  }

  return children;
}

/**
 * Route guard for Department Portal routes (/department/* and /staff/*)
 * Validates department staff session; redirects unauthorized requests to /office/login?type=staff
 * Never redirects staff to student routes or student login.
 */
function DepartmentProtectedRoute({ children }) {
  const token = localStorage.getItem('dept_token');
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('dept_user') || 'null');
  } catch (_) {
    user = null;
  }

  const isStaffRole = Boolean(
    user && (user.role === 'DEPARTMENT_HEAD' || user.role === 'DEPT_HEAD' || user.role === 'STAFF')
  );

  if (!token || !user || !isStaffRole) {
    return <Navigate to="/office/login?type=staff" replace />;
  }

  return children;
}

function OfficeLoginWrapper() {
  const navigate = useNavigate();

  const handleLoginSuccess = (token, user) => {
    const role = user?.role;
    if (role === 'ADMIN') {
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(user));
      navigate('/admin');
    } else if (role === 'DEPARTMENT_HEAD' || role === 'DEPT_HEAD' || role === 'STAFF') {
      localStorage.setItem('dept_token', token);
      localStorage.setItem('dept_user', JSON.stringify(user));
      navigate('/department/dashboard');
    } else {
      localStorage.setItem('cmsce_student_token', token);
      localStorage.setItem('cmsce_student_user', JSON.stringify(user));
      navigate('/');
    }
  };

  return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Student Portal Default */}
        <Route path="/" element={<StudentAppShell />} />
        <Route path="/student/*" element={<StudentAppShell />} />

        {/* Unified Office (Admin/Staff) Login */}
        <Route path="/office/login" element={<OfficeLoginWrapper />} />
        <Route path="/login" element={<OfficeLoginWrapper />} />

        {/* Executive Admin Dashboard */}
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminDashboard onLogout={() => window.location.replace('/office/login')} />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <AdminProtectedRoute>
              <AdminDashboard onLogout={() => window.location.replace('/office/login')} />
            </AdminProtectedRoute>
          }
        />

        {/* Department Staff Resolution Queue & Dashboard */}
        <Route
          path="/department/dashboard"
          element={
            <DepartmentProtectedRoute>
              <DepartmentPortal onLogout={() => window.location.replace('/office/login?type=staff')} />
            </DepartmentProtectedRoute>
          }
        />
        <Route
          path="/department"
          element={
            <DepartmentProtectedRoute>
              <DepartmentPortal onLogout={() => window.location.replace('/office/login?type=staff')} />
            </DepartmentProtectedRoute>
          }
        />
        <Route
          path="/department/*"
          element={
            <DepartmentProtectedRoute>
              <DepartmentPortal onLogout={() => window.location.replace('/office/login?type=staff')} />
            </DepartmentProtectedRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <DepartmentProtectedRoute>
              <DepartmentPortal onLogout={() => window.location.replace('/office/login?type=staff')} />
            </DepartmentProtectedRoute>
          }
        />
        <Route
          path="/staff/*"
          element={
            <DepartmentProtectedRoute>
              <DepartmentPortal onLogout={() => window.location.replace('/office/login?type=staff')} />
            </DepartmentProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
