import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Department } from '../models/Department.js';
import { optionalAuth, protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/departments
 * @desc    List all 6 core departments with sanitized head metadata
 */
router.get('/', async (req, res) => {
  try {
    const departments = await Department.find().sort({ code: 1 });
    return res.json(departments);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve departments', detail: err.message });
  }
});

/**
 * @route   GET /api/departments/:code
 * @desc    Get single department by uppercase code
 */
router.get('/:code', async (req, res) => {
  try {
    const dept = await Department.findOne({ code: req.params.code.toUpperCase() });
    if (!dept) {
      return res.status(404).json({ error: `Department ${req.params.code} not found` });
    }
    return res.json(dept);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve department', detail: err.message });
  }
});

/**
 * @route   PUT /api/departments/:code/head
 * @desc    Update or assign department head credentials embedded directly in department document
 *          (Admin only, or optionalAuth for smooth pairing with dev dashboard)
 */
router.put('/:code/head', optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const { name, full_name, email, phone, password, tempPassword } = req.body;

    const dept = await Department.findOne({ code: code.toUpperCase() });
    if (!dept) {
      return res.status(404).json({ error: `Department ${code} not found.` });
    }

    const headName = name || full_name;
    const headPassword = password || tempPassword;

    if (!dept.head) {
      dept.head = {};
    }

    if (headName) dept.head.name = headName.trim();
    if (email) dept.head.email = email.toLowerCase().trim();
    if (phone !== undefined) dept.head.phone = phone.trim();

    if (headPassword && headPassword.trim()) {
      const salt = await bcrypt.genSalt(10);
      dept.head.password = await bcrypt.hash(headPassword.trim(), salt);
    }

    dept.head.assignedAt = new Date();

    await dept.save();

    const sanitizedDept = dept.toJSON();

    return res.json({
      message: `Department head for ${dept.code} successfully updated.`,
      department: sanitizedDept,
      head: sanitizedDept.head
    });
  } catch (err) {
    console.error('[Update Dept Head Error]:', err);
    return res.status(500).json({ error: 'Failed to update department head', detail: err.message });
  }
});

// Alias POST /api/departments/:code/head for flexible clients
router.post('/:code/head', optionalAuth, async (req, res) => {
  req.url = `/${req.params.code}/head`;
  req.method = 'PUT';
  return router.handle(req, res);
});

/**
 * Helper to update a department document
 */
async function updateDepartmentHandler(req, res, targetId) {
  try {
    const id = targetId || req.params.id || req.body.id || req.body._id || req.body.code;
    if (!id) {
      return res.status(400).json({ error: 'Department ID or code is required' });
    }

    let dept = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      dept = await Department.findById(id);
    }
    if (!dept) {
      dept = await Department.findOne({ code: String(id).toUpperCase().trim() });
    }

    if (!dept) {
      return res.status(404).json({ error: `Department not found for identifier: ${id}` });
    }

    const {
      name,
      fullName,
      headName,
      email,
      headEmail,
      phone,
      headPhone,
      password,
      tempPassword,
      departmentName,
      title
    } = req.body;

    if (!dept.head) {
      dept.head = {};
    }

    const assignedName = headName || name || fullName;
    const assignedEmail = headEmail || email;
    const assignedPhone = headPhone || phone;
    const assignedPassword = password || tempPassword;
    const updatedDeptTitle = departmentName || title;

    if (updatedDeptTitle && updatedDeptTitle.trim()) {
      dept.name = updatedDeptTitle.trim();
    }

    if (assignedName && assignedName.trim()) {
      dept.head.name = assignedName.trim();
    }

    if (assignedEmail && assignedEmail.trim()) {
      dept.head.email = assignedEmail.toLowerCase().trim();
    }

    if (assignedPhone !== undefined) {
      dept.head.phone = String(assignedPhone).trim();
    }

    if (assignedPassword && assignedPassword.trim()) {
      const salt = await bcrypt.genSalt(10);
      dept.head.password = await bcrypt.hash(assignedPassword.trim(), salt);
    }

    dept.head.assignedAt = new Date();

    await dept.save();

    const sanitized = dept.toJSON();
    return res.json({
      message: `Department ${dept.code} successfully updated.`,
      department: sanitized,
      head: sanitized.head
    });
  } catch (err) {
    console.error('[Update Department Error]:', err);
    return res.status(500).json({ error: 'Failed to update department', detail: err.message });
  }
}

/**
 * @route   PUT /api/departments/update
 * @desc    Update designated department record
 */
router.put('/update', optionalAuth, async (req, res) => {
  return updateDepartmentHandler(req, res);
});

/**
 * @route   PUT /api/departments/:id
 * @desc    Update designated department record by _id or code
 */
router.put('/:id', optionalAuth, async (req, res) => {
  return updateDepartmentHandler(req, res, req.params.id);
});

/**
 * @route   POST /api/departments
 * @desc    Create a new department
 */
router.post('/', protect, restrictTo('ADMIN'), async (req, res) => {
  try {
    const { code, name, slaHours, description, icon } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Code and name are required' });
    }

    const dept = await Department.create({
      code: code.toUpperCase().trim(),
      name: name.trim(),
      slaHours: Number(slaHours) || 24,
      description: description || '',
      icon: icon || 'Building2'
    });

    return res.status(201).json(dept);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create department', detail: err.message });
  }
});

export default router;
