const rawUrl = import.meta.env.VITE_API_BASE_URL || 'https://cmsce-complaint.onrender.com';
const BASE_URL = rawUrl.replace(/\/api\/?$/, '');

function getAuthToken() {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname || '';
  if (path.startsWith('/admin')) {
    return localStorage.getItem('admin_token') || localStorage.getItem('dept_token');
  }
  if (path.startsWith('/staff') || path.startsWith('/department')) {
    return localStorage.getItem('dept_token') || localStorage.getItem('admin_token');
  }
  if (path.startsWith('/office')) {
    try {
      const adminUser = JSON.parse(localStorage.getItem('admin_user') || 'null');
      if (adminUser?.role === 'ADMIN') return localStorage.getItem('admin_token');
      const deptUser = JSON.parse(localStorage.getItem('dept_user') || 'null');
      if (deptUser) return localStorage.getItem('dept_token');
    } catch (_) {}
    return localStorage.getItem('dept_token') || localStorage.getItem('admin_token');
  }

  const deptToken = localStorage.getItem('dept_token');
  const adminToken = localStorage.getItem('admin_token');
  const studentToken = localStorage.getItem('cmsce_student_token');

  if (deptToken && !studentToken && !adminToken) return deptToken;
  if (adminToken && !studentToken) return adminToken;
  return studentToken || deptToken || adminToken;
}

/**
 * Universal fetch wrapper that handles JSON headers, auth tokens, and errors
 */
async function request(endpoint, options = {}) {
  const token = options.token || getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  // Support leading slashes or full URLs
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.replace('/api', '');
  }

  let url = endpoint.startsWith('http')
    ? endpoint
    : `${BASE_URL}/api${cleanEndpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers
    });

    // Automatically clear token on 401 Unauthorized
    if (res.status === 401) {
      if (
        !endpoint.includes('/auth/login') &&
        !endpoint.includes('/auth/register') &&
        !endpoint.includes('/auth/student/') &&
        !endpoint.includes('/auth/office/')
      ) {
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        if (path.startsWith('/admin')) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
        } else if (path.startsWith('/staff') || path.startsWith('/department')) {
          localStorage.removeItem('dept_token');
          localStorage.removeItem('dept_user');
        } else if (path.startsWith('/office')) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
          localStorage.removeItem('dept_token');
          localStorage.removeItem('dept_user');
        } else {
          localStorage.removeItem('cmsce_student_token');
          localStorage.removeItem('cmsce_student_user');
        }
      }
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data.error || data.detail || data.message || `Request failed with status ${res.status}`;
      const error = new Error(errorMsg);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    throw err;
  }
}

export const apiClient = {
  get: (endpoint, options) => request(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (endpoint, body, options) => request(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),
  patch: (endpoint, body, options) => request(endpoint, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options }),

  // ── Specific Module Methods ──

  // Auth Endpoints
  auth: {
    // Dedicated Student Endpoints
    registerStudent: (data) => apiClient.post('/api/auth/student/register', data),
    loginStudent: (email, password) => apiClient.post('/api/auth/student/login', { email, password }),

    // Dedicated Office (Admin & Dept Head) Login
    loginOffice: (email, password) => apiClient.post('/api/auth/office/login', { email, password }),

    // Backwards-compatible generic endpoints
    login: (email, password) => apiClient.post('/api/auth/login', { email, password }),
    register: (data) => apiClient.post('/api/auth/student/register', data),
    me: () => apiClient.get('/api/auth/me')
  },

  // AI Triage
  ai: {
    analyseComplaint: (payload) => apiClient.post('/api/ai/analyse-complaint', payload)
  },

  // Complaints
  complaints: {
    list: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      const res = await apiClient.get(`/api/complaints${query ? `?${query}` : ''}`);
      return Array.isArray(res) ? res : (res.complaints || []);
    },
    track: (ticketId) => apiClient.get(`/api/complaints/track/${ticketId}`),
    create: (data) => apiClient.post('/api/complaints', data),
    updateStatus: (id, payload, options = {}) => {
      const token = options.token || localStorage.getItem('dept_token') || localStorage.getItem('admin_token') || getAuthToken();
      return apiClient.patch(`/api/complaints/${id}/status`, payload, { token, ...options });
    },
    submitFeedback: (id, payload, options = {}) => {
      const token = options.token || localStorage.getItem('cmsce_student_token') || getAuthToken();
      return apiClient.post(`/api/complaints/${id}/feedback`, payload, { token, ...options });
    },
    reopen: (id, payload, options = {}) => {
      const token = options.token || localStorage.getItem('admin_token') || getAuthToken();
      return apiClient.post(`/api/complaints/${id}/reopen`, payload, { token, ...options });
    },
    appeal: (id, payload, options = {}) => {
      const token = options.token || localStorage.getItem('cmsce_student_token') || getAuthToken();
      return apiClient.post(`/api/complaints/${id}/appeal`, payload, { token, ...options });
    },
    close: (id, payload, options = {}) => {
      const token = options.token || localStorage.getItem('admin_token') || getAuthToken();
      return apiClient.post(`/api/complaints/${id}/close`, payload, { token, ...options });
    }
  },

  // Departments
  departments: {
    list: () => apiClient.get('/api/departments'),
    get: (code) => apiClient.get(`/api/departments/${code}`),
    updateHead: (code, data) => apiClient.put(`/api/departments/${code}/head`, data),
    update: (id, data) => apiClient.put(`/api/departments/${id}`, data),
    updateGeneral: (data) => apiClient.put('/api/departments/update', data)
  },

  // Announcements
  announcements: {
    list: () => apiClient.get('/api/announcements'),
    getForStudents: () => apiClient.get('/api/announcements/student'),
    getForDepartment: (deptCode) => apiClient.get(`/api/announcements/department/${deptCode}`),
    getForAdmin: () => apiClient.get('/api/announcements/admin'),
    create: (data) => apiClient.post('/api/announcements', data),
    delete: (id) => apiClient.delete(`/api/announcements/${id}`)
  },

  // Admin Management
  admin: {
    getDashboardMetrics: () => apiClient.get('/api/admin/dashboard'),
    getProfile: () => apiClient.get('/api/admin/profile'),
    updateProfile: (data) => apiClient.put('/api/admin/profile', data),
    createStaff: (data) => apiClient.put(`/api/departments/${data.department}/head`, {
      full_name: data.full_name || data.name,
      email: data.email,
      phone: data.phone,
      tempPassword: data.tempPassword || data.password
    }),
    getAnnouncements: () => apiClient.get('/api/announcements'),
    createAnnouncement: (data) => apiClient.post('/api/announcements', data),
    deleteAnnouncement: (id) => apiClient.delete(`/api/announcements/${id}`)
  }
};

export default apiClient;
