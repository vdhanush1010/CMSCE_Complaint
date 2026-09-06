import { Announcement } from '../models/Announcement.js';

/**
 * GET /api/announcements/student
 * Return strictly notices intended for students
 */
export async function getStudentAnnouncements(req, res) {
  try {
    const notices = await Announcement.find({
      $or: [
        { targetAudience: 'ALL_STUDENTS' },
        { targetAudience: { $exists: false }, target_role: { $in: ['STUDENT', 'ALL'] } }
      ]
    }).sort({ createdAt: -1 });

    return res.json(notices.map((n) => n.toJSON()));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve student announcements', detail: err.message });
  }
}

/**
 * GET /api/announcements/department/:deptCode
 * Return notices intended for all departments or specifically for the given department
 */
export async function getDepartmentAnnouncements(req, res) {
  try {
    const { deptCode } = req.params;
    if (!deptCode) {
      return res.status(400).json({ error: 'Department code is required' });
    }

    const code = deptCode.toUpperCase().trim();

    const notices = await Announcement.find({
      $or: [
        { targetAudience: 'ALL_DEPTS' },
        { targetAudience: 'SPECIFIC_DEPT', targetDepartment: code },
        { departmentCode: code }
      ]
    }).sort({ createdAt: -1 });

    return res.json(notices.map((n) => n.toJSON()));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve department announcements', detail: err.message });
  }
}

/**
 * GET /api/announcements/admin
 * Return all announcements with full metadata
 */
export async function getAdminAnnouncements(req, res) {
  try {
    const notices = await Announcement.find().sort({ createdAt: -1 });
    return res.json(notices.map((n) => n.toJSON()));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve admin announcements', detail: err.message });
  }
}

/**
 * POST /api/announcements
 * Create an announcement with audience and department isolation
 */
export async function createAnnouncement(req, res) {
  try {
    const { 
      title, 
      message, 
      content, 
      targetAudience, 
      targetDepartment, 
      priority, 
      authorRole, 
      author_name,
      departmentCode,
      expires_at 
    } = req.body;

    const bodyMessage = (message || content || '').trim();
    const bodyTitle = (title || 'Campus Announcement').trim();

    if (!bodyMessage) {
      return res.status(400).json({ error: 'Announcement message is required.' });
    }

    // Determine normalized audience
    let audience = targetAudience || 'ALL_STUDENTS';
    if (req.body.audience) {
      if (req.body.audience.includes('Student')) audience = 'ALL_STUDENTS';
      else if (req.body.audience.includes('Head') || req.body.audience.includes('All Dept')) audience = 'ALL_DEPTS';
      else if (req.body.audience.includes('Member') || req.body.audience.includes('Specific')) audience = 'SPECIFIC_DEPT';
    }

    const deptTarget = targetDepartment || departmentCode || null;

    const authRole = authorRole || (req.user?.role === 'DEPT_HEAD' ? 'DEPT_HEAD' : 'ADMIN');
    const authName = author_name || req.user?.name || (authRole === 'DEPT_HEAD' ? 'Department Head' : 'Campus Administration');

    const announcement = await Announcement.create({
      title: bodyTitle,
      message: bodyMessage,
      content: bodyMessage,
      targetAudience: audience,
      targetDepartment: deptTarget ? deptTarget.toUpperCase().trim() : null,
      departmentCode: deptTarget ? deptTarget.toUpperCase().trim() : '',
      priority: priority || (req.body.isUrgent ? 'URGENT' : 'NORMAL'),
      authorRole: authRole,
      author_name: authName,
      expires_at: expires_at ? new Date(expires_at) : undefined
    });

    return res.status(201).json(announcement.toJSON());
  } catch (err) {
    console.error('[Create Announcement Error]:', err);
    return res.status(500).json({ error: 'Failed to create announcement', detail: err.message });
  }
}

/**
 * DELETE /api/announcements/:id
 */
export async function deleteAnnouncement(req, res) {
  try {
    const deleted = await Announcement.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    return res.json({ message: 'Announcement deleted successfully', id: req.params.id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete announcement', detail: err.message });
  }
}
