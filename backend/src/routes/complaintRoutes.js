import express from 'express';
import { Complaint } from '../models/Complaint.js';
import { Department } from '../models/Department.js';
import { triageComplaint, getHeuristicTriage } from '../services/aiTriageService.js';
import { getSlaHours, calculateSlaDeadline } from '../services/slaService.js';
import { optionalAuth, protect, verifyAdmin } from '../middleware/auth.js';
import {
  reopenComplaint,
  getComplaints,
  getMyComplaints,
  appealComplaint,
  closeComplaint,
  updateStatus,
  createComplaint,
  formatComplaintResponse
} from '../controllers/complaintController.js';

const router = express.Router();

// @route   POST /api/complaints/triage
// @desc    Live Gemini AI triage endpoint with heuristic fallback
router.post('/triage', optionalAuth, async (req, res) => {
  const { title = '', description = '', text = '', category = '' } = req.body || {};
  const complaintText = description || text || title || '';
  if (!complaintText.trim()) {
    return res.status(400).json({ error: 'Complaint title or description is required for triage.' });
  }

  try {
    const triageResult = await triageComplaint({
      title: title || '',
      description: complaintText,
      category_hint: category || ''
    });

    if (triageResult.isValid === false) {
      return res.status(400).json({
        isValid: false,
        error: triageResult.reasoning || 'The provided text does not contain a coherent or actionable campus grievance. Please provide specific details.',
        detail: 'Invalid or non-grievance text detected.'
      });
    }

    return res.json(triageResult);
  } catch (err) {
    console.warn('[Complaints Triage Warning]: Falling back to heuristic triage:', err.message);
    const fallback = getHeuristicTriage({ title, description: complaintText, category_hint: category });
    return res.json(fallback);
  }
});

// @route   GET /api/complaints/
// @desc    List all complaints (filtered by role, dept, search) with clean Admin isolation
router.get('/', optionalAuth, getComplaints);

// @route   GET /api/complaints/my
// @desc    Logged-in student retrieves their own complaints with unmasked info & anonymous badge
router.get('/my', protect, getMyComplaints);

// @route   GET /api/complaints/department/complaints
// @desc    Department staff retrieves complaints assigned to their department (masked)
router.get('/department/complaints', protect, getComplaints);

// @route   POST /api/complaints/
// @desc    Submit a new complaint with automatic AI triage and SLA deadline computation
router.post('/', optionalAuth, createComplaint);

// @route   GET /api/complaints/track/:ticketId
// @desc    Track single complaint by ticket_id or database _id
router.get('/track/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    let complaint = await Complaint.findOne({
      $or: [{ ticket_id: ticketId.toUpperCase() }, { _id: ticketId.match(/^[0-9a-fA-F]{24}$/) ? ticketId : null }]
    });

    if (!complaint) {
      return res.status(404).json({ error: `Complaint ticket ${ticketId} not found` });
    }

    const formatted = formatComplaintResponse(complaint, new Date(), false);
    return res.json(formatted);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to track ticket', detail: err.message });
  }
});

// @route   PATCH /api/complaints/:id/status
// @desc    Update complaint status/stage with linear step validation & resolution proof check
router.patch('/:id/status', optionalAuth, updateStatus);

// Also support direct PATCH /api/complaints/:id
router.patch('/:id', optionalAuth, updateStatus);

// @route   POST /api/complaints/:id/feedback
// @desc    Submit 1-5 star resolution feedback
router.post('/:id/feedback', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comments, selected_tags, reopen_requested } = req.body;

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Valid rating between 1 and 5 stars is required.' });
    }

    const complaint = await Complaint.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { ticket_id: id.toUpperCase() }]
    });

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    complaint.feedback = {
      rating: numRating,
      comments: (comments || '').trim(),
      selected_tags: selected_tags || [],
      reopen_requested: Boolean(reopen_requested),
      submittedAt: new Date()
    };

    const studentName = req.user ? (req.user.name || req.user.full_name) : (complaint.student_name || 'Student');

    if (reopen_requested) {
      const oldStatus = complaint.status;
      complaint.status = 'Reopened';
      complaint.stage = 'IN_PROGRESS';
      complaint.history.push({
        old_status: oldStatus,
        new_status: 'Reopened',
        changed_by_name: studentName,
        remarks: `Student requested ticket reopening: "${comments || 'Issue persists'}"`,
        timestamp: new Date()
      });
    } else {
      complaint.history.push({
        old_status: complaint.status,
        new_status: complaint.status,
        changed_by_name: studentName,
        remarks: `Student submitted feedback: ${numRating} Stars${comments ? ` - "${comments}"` : ''}`,
        timestamp: new Date()
      });
    }

    await complaint.save();

    return res.json({
      success: true,
      message: reopen_requested ? 'Ticket reopened' : 'Feedback submitted successfully',
      feedback: complaint.feedback,
      complaint: complaint.toJSON()
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to record feedback', detail: err.message });
  }
});

// @route   POST /api/complaints/:id/reopen
// @desc    Admin SLA Overdue Ticket Reopening with extended SLA window (Admin Exclusive)
router.post('/:id/reopen', protect, verifyAdmin, reopenComplaint);
router.post('/reopen', protect, verifyAdmin, reopenComplaint);

// @route   POST /api/complaints/:id/appeal
// @desc    Student official appeal against resolution
router.post('/:id/appeal', optionalAuth, appealComplaint);
router.post('/appeal', optionalAuth, appealComplaint);

// @route   POST /api/complaints/:id/close
// @desc    Admin arbitration permanent close / reject appeal
router.post('/:id/close', optionalAuth, closeComplaint);
router.post('/close', optionalAuth, closeComplaint);

export default router;
