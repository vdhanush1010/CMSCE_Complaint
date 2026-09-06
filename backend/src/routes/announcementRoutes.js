import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import {
  getStudentAnnouncements,
  getDepartmentAnnouncements,
  getAdminAnnouncements,
  createAnnouncement,
  deleteAnnouncement
} from '../controllers/announcementController.js';

const router = express.Router();

/**
 * @route   GET /api/announcements/student
 * @desc    Get announcements targeted strictly to students
 */
router.get('/student', getStudentAnnouncements);

/**
 * @route   GET /api/announcements/department/:deptCode
 * @desc    Get announcements targeted to all departments or a specific department
 */
router.get('/department/:deptCode', getDepartmentAnnouncements);

/**
 * @route   GET /api/announcements/admin
 * @desc    Get all announcements with full metadata for admin oversight
 */
router.get('/admin', getAdminAnnouncements);

/**
 * @route   GET /api/announcements
 * @desc    Default announcement listing (falls back to admin or public view)
 */
router.get('/', async (req, res) => {
  return getAdminAnnouncements(req, res);
});

/**
 * @route   POST /api/announcements
 * @desc    Create and publish a targeted announcement
 */
router.post('/', optionalAuth, createAnnouncement);

/**
 * @route   DELETE /api/announcements/:id
 * @desc    Delete an announcement
 */
router.delete('/:id', optionalAuth, deleteAnnouncement);

export default router;
