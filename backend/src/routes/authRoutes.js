import express from 'express';
import jwt from 'jsonwebtoken';
import { Student } from '../models/Student.js';
import { Admin } from '../models/Admin.js';
import { Department } from '../models/Department.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'cmsce_super_secret_jwt_key_2026_production';

const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d'
  });
};

/**
 * @route   POST /api/auth/student/register
 * @desc    Register a new student directly into `students` collection
 */
router.post('/student/register', async (req, res) => {
  try {
    const { name, full_name, email, password, rollNo, roll_number, department } = req.body;
    const studentName = name || full_name;
    const studentRoll = rollNo || roll_number;

    if (!email || !password || !studentName || !studentRoll) {
      return res.status(400).json({ error: 'Name, Roll Number, Email, and Password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanRoll = studentRoll.toUpperCase().trim();

    // Validate uniqueness of email and rollNo
    const existingEmail = await Student.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(400).json({ error: 'Student with this email already exists.' });
    }

    const existingRoll = await Student.findOne({ rollNo: cleanRoll });
    if (existingRoll) {
      return res.status(400).json({ error: 'Student with this roll number already exists.' });
    }

    // Accept free-text student branch/department (e.g. CSE, Mechanical, AI&DS, ECE)
    const deptCode = department && department.trim() ? department.trim() : 'CSE';

    const student = await Student.create({
      name: studentName.trim(),
      rollNo: cleanRoll,
      email: cleanEmail,
      department: deptCode,
      password
    });

    const token = generateToken({
      id: student._id,
      role: 'STUDENT',
      rollNo: student.rollNo
    });

    return res.status(201).json({
      message: 'Student registered successfully',
      access: token,
      token: token,
      refresh: token,
      user: {
        id: student._id,
        email: student.email,
        full_name: student.name,
        name: student.name,
        role: 'STUDENT',
        department: student.department,
        rollNo: student.rollNo,
        roll_number: student.rollNo
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error during student registration.' });
  }
});

/**
 * @route   POST /api/auth/student/login
 * @desc    Authenticate student credentials against `students` collection
 */
router.post('/student/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide roll number / email and password.' });
    }

    const cleanInput = email.toLowerCase().trim();
    const upperInput = email.toUpperCase().trim();

    // Query students collection by email or rollNo
    const student = await Student.findOne({
      $or: [
        { email: cleanInput },
        { rollNo: upperInput },
        { email: `${cleanInput}@cmsce.edu` }
      ]
    });

    if (!student || !(await student.matchPassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials. Please verify your student email/roll number and password.' });
    }

    const token = generateToken({
      id: student._id,
      role: 'STUDENT',
      rollNo: student.rollNo
    });

    return res.json({
      access: token,
      token: token,
      refresh: token,
      user: {
        id: student._id,
        email: student.email,
        full_name: student.name,
        name: student.name,
        role: 'STUDENT',
        department: student.department,
        rollNo: student.rollNo,
        roll_number: student.rollNo
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error during student login.' });
  }
});

/**
 * @route   POST /api/auth/office/login
 * @desc    Authenticate administrative personnel: checks `admins` first, then `departments.head`
 */
router.post('/office/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide administrator/staff ID and password.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Check `admins` collection first
    const admin = await Admin.findOne({
      $or: [
        { email: cleanEmail },
        { email: `${cleanEmail}@cmsce.edu` }
      ]
    });

    if (admin && (await admin.matchPassword(password))) {
      const token = generateToken({
        id: admin._id,
        role: 'ADMIN'
      });

      return res.json({
        access: token,
        token: token,
        refresh: token,
        user: {
          id: admin._id,
          email: admin.email,
          full_name: admin.name,
          name: admin.name,
          role: 'ADMIN',
          phone: admin.phone || ''
        }
      });
    }

    // 2. Query `departments` by head.email
    const dept = await Department.findOne({
      $or: [
        { 'head.email': cleanEmail },
        { 'head.email': `${cleanEmail}@cmsce.edu` },
        { code: cleanEmail.toUpperCase() }
      ]
    });

    if (dept && (await dept.matchHeadPassword(password))) {
      const token = generateToken({
        id: dept._id,
        role: 'DEPARTMENT_HEAD',
        departmentCode: dept.code
      });

      return res.json({
        access: token,
        token: token,
        refresh: token,
        user: {
          id: dept._id,
          email: dept.head?.email || `${dept.code.toLowerCase()}@cmsce.edu`,
          full_name: dept.head?.name || `${dept.name} Head`,
          name: dept.head?.name || `${dept.name} Head`,
          role: 'DEPARTMENT_HEAD',
          department: dept.code,
          departmentCode: dept.code,
          department_name: dept.name,
          phone: dept.head?.phone || ''
        }
      });
    }

    return res.status(401).json({
      error: 'Invalid credentials. No matching Admin or Department Head account found.'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error during office login.' });
  }
});

/**
 * Backward-compatible /api/auth/register delegating to student registration
 */
router.post('/register', async (req, res) => {
  req.url = '/student/register';
  return router.handle(req, res);
});

/**
 * Backward-compatible /api/auth/login routing:
 * Checks office credentials first, if none matches, checks student credentials.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide credentials.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check admin
    const admin = await Admin.findOne({
      $or: [{ email: cleanEmail }, { email: `${cleanEmail}@cmsce.edu` }]
    });
    if (admin && (await admin.matchPassword(password))) {
      const token = generateToken({ id: admin._id, role: 'ADMIN' });
      return res.json({
        access: token,
        token: token,
        refresh: token,
        user: {
          id: admin._id,
          email: admin.email,
          full_name: admin.name,
          name: admin.name,
          role: 'ADMIN',
          phone: admin.phone || ''
        }
      });
    }

    // Check department head
    const dept = await Department.findOne({
      $or: [
        { 'head.email': cleanEmail },
        { 'head.email': `${cleanEmail}@cmsce.edu` },
        { code: cleanEmail.toUpperCase() }
      ]
    });
    if (dept && (await dept.matchHeadPassword(password))) {
      const token = generateToken({
        id: dept._id,
        role: 'DEPARTMENT_HEAD',
        departmentCode: dept.code
      });
      return res.json({
        access: token,
        token: token,
        refresh: token,
        user: {
          id: dept._id,
          email: dept.head?.email || `${dept.code.toLowerCase()}@cmsce.edu`,
          full_name: dept.head?.name || `${dept.name} Head`,
          name: dept.head?.name || `${dept.name} Head`,
          role: 'DEPARTMENT_HEAD',
          department: dept.code,
          departmentCode: dept.code,
          department_name: dept.name,
          phone: dept.head?.phone || ''
        }
      });
    }

    // Check student
    const student = await Student.findOne({
      $or: [
        { email: cleanEmail },
        { rollNo: cleanEmail.toUpperCase() },
        { email: `${cleanEmail}@cmsce.edu` }
      ]
    });
    if (student && (await student.matchPassword(password))) {
      const token = generateToken({
        id: student._id,
        role: 'STUDENT',
        rollNo: student.rollNo
      });
      return res.json({
        access: token,
        token: token,
        refresh: token,
        user: {
          id: student._id,
          email: student.email,
          full_name: student.name,
          name: student.name,
          role: 'STUDENT',
          department: student.department,
          rollNo: student.rollNo,
          roll_number: student.rollNo
        }
      });
    }

    return res.status(401).json({ error: 'Invalid credentials. Please verify your account details.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error during login.' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated principal profile
 */
router.get('/me', protect, async (req, res) => {
  return res.json({
    user: req.user
  });
});

export default router;
