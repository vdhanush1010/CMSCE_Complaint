import express from 'express';
import { Complaint } from '../models/Complaint.js';
import { Admin } from '../models/Admin.js';
import { Department } from '../models/Department.js';
import { Announcement } from '../models/Announcement.js';
import { optionalAuth, protect, restrictTo } from '../middleware/auth.js';

import { getAdminProfile, updateAdminProfile } from '../controllers/adminController.js';
import { getAdminAnnouncements, createAnnouncement, deleteAnnouncement } from '../controllers/announcementController.js';

const router = express.Router();

// ── Admin Dashboard Metrics ──

/**
 * @route   GET /api/admin/dashboard
 * @desc    Retrieve executive analytics metrics for MetricCards
 */
router.get('/dashboard', optionalAuth, async (req, res) => {
  try {
    const allComplaints = await Complaint.find();
    const now = new Date();

    let totalOpen = 0;
    let criticalEscalations = 0;
    let slaBreaches = 0;
    let resolvedCount = 0;
    let totalResolutionHours = 0;

    allComplaints.forEach((c) => {
      const isResolved = ['Resolved', 'Closed'].includes(c.status);
      const isBreached = c.sla_deadline_at ? now > new Date(c.sla_deadline_at) && !isResolved : false;

      if (!isResolved) {
        totalOpen++;
        if (c.priority === 'CRITICAL') {
          criticalEscalations++;
        }
        if (isBreached || c.is_sla_breached) {
          slaBreaches++;
        }
      } else {
        resolvedCount++;
        const resolvedLog = (c.history || []).find((h) => ['Resolved', 'Closed'].includes(h.new_status));
        const resolvedTime = resolvedLog ? new Date(resolvedLog.timestamp) : new Date(c.updatedAt);
        const hours = Math.max(0.5, (resolvedTime - new Date(c.createdAt)) / (1000 * 60 * 60));
        totalResolutionHours += hours;
      }
    });

    const avgResolutionTime = resolvedCount > 0 ? (totalResolutionHours / resolvedCount).toFixed(1) : '4.2';

    return res.json({
      total_open_tickets: totalOpen,
      critical_escalations: criticalEscalations,
      sla_breaches: slaBreaches,
      avg_resolution_time_hours: Number(avgResolutionTime) || 4.2
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to compute metrics', detail: err.message });
  }
});

// ── Admin Profile Management ──

/**
 * @route   GET /api/admin/profile
 * @desc    Get currently logged in admin's profile
 */
router.get('/profile', optionalAuth, getAdminProfile);

/**
 * @route   PUT /api/admin/profile
 * @desc    Allows admin to update their name, email, phone, and password in `admins`
 */
router.put('/profile', optionalAuth, updateAdminProfile);

// ── Department Head Provisioning / Assignment Delegation ──

/**
 * @route   POST /api/admin/staff
 * @desc    Provision or update department head directly into target department document
 */
router.post('/staff', optionalAuth, async (req, res) => {
  try {
    const { email, full_name, name, department, tempPassword } = req.body;
    const staffName = name || full_name;

    if (!email || !staffName || !department) {
      return res.status(400).json({ error: 'Email, name, and department are required' });
    }

    const deptCode = department.toUpperCase().trim();
    const dept = await Department.findOne({ code: deptCode });
    if (!dept) {
      return res.status(404).json({ error: `Department ${deptCode} not found.` });
    }

    const assignedPassword = tempPassword || `Staff#${Math.floor(1000 + Math.random() * 9000)}`;

    dept.head = {
      name: staffName.trim(),
      email: email.toLowerCase().trim(),
      phone: dept.head?.phone || '',
      password: assignedPassword,
      assignedAt: new Date()
    };

    await dept.save();

    return res.status(201).json({
      message: `Department head for ${dept.code} created and assigned successfully.`,
      user: {
        id: dept._id,
        email: dept.head.email,
        full_name: dept.head.name,
        role: 'DEPT_HEAD',
        department: dept.code
      },
      temporary_password: assignedPassword
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to assign department head', detail: err.message });
  }
});

// ── Campus Announcements Endpoints ──

router.get('/announcements', getAdminAnnouncements);
router.post('/announcements', optionalAuth, createAnnouncement);
router.delete('/announcements/:id', optionalAuth, deleteAnnouncement);

export default router;
