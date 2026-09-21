import express from 'express';
import { Complaint } from '../models/Complaint.js';
import { Department } from '../models/Department.js';
import { triageComplaint, getHeuristicTriage } from '../services/aiTriageService.js';
import { getSlaHours, calculateSlaDeadline } from '../services/slaService.js';
import { optionalAuth, protect } from '../middleware/auth.js';
import { reopenComplaint, getComplaints, appealComplaint, closeComplaint, updateStatus } from '../controllers/complaintController.js';

const router = express.Router();

/**
 * Generate human-readable ticket ID like CMP-1042
 */
async function generateUniqueTicketId() {
  const count = await Complaint.countDocuments();
  const seedNum = 1040 + count + 1;
  const candidate = `CMP-${seedNum}`;
  const exists = await Complaint.findOne({ ticket_id: candidate });
  if (exists) {
    return `CMP-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return candidate;
}

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

// @route   POST /api/complaints/
// @desc    Submit a new complaint with automatic AI triage
router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      department,
      priority,
      is_anonymous,
      ai_confidence_score,
      ai_routing_reasoning,
      sla_hours,
      proofs,
      attachments
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    // Run AI triage if department or priority are not finalized
    let finalDept = department;
    let finalDeptName = 'Canteen Operations';
    let finalPriority = priority;
    let finalCategory = category;
    let finalConfidence = ai_confidence_score;
    let finalReasoning = ai_routing_reasoning;
    let finalSlaHours = sla_hours;

    if (!finalDept || !finalPriority) {
      try {
        const aiResult = await triageComplaint({ title, description, category_hint: category });
        if (aiResult.isValid === false) {
          return res.status(400).json({
            isValid: false,
            error: aiResult.reasoning || 'The provided text does not contain a coherent or actionable campus grievance. Please provide specific details.',
            detail: 'Invalid or non-grievance text detected.'
          });
        }
        finalDept = aiResult.assigned_dept_code;
        finalDeptName = aiResult.department_name;
        finalPriority = aiResult.priority;
        finalCategory = finalCategory || aiResult.category;
        finalConfidence = aiResult.ai_confidence_score;
        finalReasoning = aiResult.reasoning;
        finalSlaHours = aiResult.sla_hours;
      } catch (aiErr) {
        console.warn('[Complaint Create] AI triage error during complaint creation, falling back to heuristics:', aiErr.message);
        const fallback = getHeuristicTriage({ title, description, category_hint: category });
        finalDept = fallback.assigned_dept_code;
        finalDeptName = fallback.department_name;
        finalPriority = fallback.priority;
        finalCategory = finalCategory || fallback.category;
        finalConfidence = fallback.ai_confidence_score;
        finalReasoning = fallback.reasoning;
        finalSlaHours = fallback.sla_hours;
      }
    } else {
    // Calculate priority SLA: Strictly 12 hours for CRITICAL and 48 hours for HIGH / MEDIUM / LOW
    finalPriority = (finalPriority || 'MEDIUM').toUpperCase();
    finalSlaHours = getSlaHours(finalPriority);

    const ticket_id = await generateUniqueTicketId();

    const now = new Date();
    const deadline = calculateSlaDeadline(finalSlaHours, now);

    const studentName = is_anonymous ? 'Anonymous' : req.user ? req.user.name : 'Student User';
    const studentRoll = req.user ? req.user.roll_number || '2026-STU' : '2026-STU';

    const safeAttachments = Array.isArray(attachments) ? attachments : [];
    const safeProofs = (Array.isArray(proofs) && proofs.length > 0)
      ? proofs
      : safeAttachments.map((a) => ({ fileName: a.fileName || a.name || 'Attachment', url: a.fileData || a.url || '' }));

    const initialStage = finalDept ? 'AI_ANALYSED' : 'SUBMITTED';
    const initialStatus = initialStage === 'AI_ANALYSED' ? 'AI Analysed' : 'Submitted';

    const complaint = await Complaint.create({
      ticket_id,
      title: title.trim(),
      description: description.trim(),
      category: finalCategory || 'General Grievance',
      department: finalDept.toUpperCase(),
      departmentCode: finalDept.toUpperCase(),
      assigned_department_code: finalDept.toUpperCase(),
      assigned_department_name: finalDeptName,
      priority: finalPriority || 'MEDIUM',
      status: initialStatus,
      stage: initialStage,
      is_anonymous: Boolean(is_anonymous),
      student: req.user ? req.user._id : undefined,
      studentId: req.user ? req.user._id : undefined,
      student_name: studentName,
      student_roll: studentRoll,
      ai_confidence_score: finalConfidence || 95.0,
      ai_routing_reasoning: finalReasoning || 'AI triage processed and assigned ticket.',
      sla_hours: finalSlaHours,
      sla_deadline_at: deadline,
      slaDeadline: deadline,
      is_sla_breached: false,
      attachments: safeAttachments,
      proofs: safeProofs,
      appealHistory: [],
      history: [
        {
          old_status: 'None',
          new_status: initialStatus,
          changed_by_name: studentName,
          remarks: 'Complaint filed via Student Desk',
          timestamp: new Date()
        }
      ],
      timeline: [
        {
          status: initialStatus,
          changedBy: studentName,
          role: 'STUDENT',
          remarks: 'Complaint lodged by student',
          timestamp: new Date()
        }
      ]
    });

    return res.status(201).json({
      message: 'Complaint lodged successfully',
      ticket_id: complaint.ticket_id,
      complaint: complaint.toJSON()
    });
  } catch (err) {
    console.error('[Create Complaint Error]:', err);
    return res.status(500).json({ error: 'Failed to lodge complaint', detail: err.message });
  }
});

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

    const now = new Date();
    const effectiveDeadline = complaint.slaDeadline || complaint.sla_deadline_at;
    if (effectiveDeadline) {
      complaint.is_sla_breached = now > new Date(effectiveDeadline) && !['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(complaint.status);
      complaint.isSlaBreached = complaint.is_sla_breached;
    }

    return res.json(complaint.toJSON());
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
// @desc    Admin SLA Overdue Ticket Reopening with extended SLA window
router.post('/:id/reopen', optionalAuth, reopenComplaint);
router.post('/reopen', optionalAuth, reopenComplaint);

// @route   POST /api/complaints/:id/appeal
// @desc    Student official appeal against resolution
router.post('/:id/appeal', optionalAuth, appealComplaint);
router.post('/appeal', optionalAuth, appealComplaint);

// @route   POST /api/complaints/:id/close
// @desc    Admin arbitration permanent close / reject appeal
router.post('/:id/close', optionalAuth, closeComplaint);
router.post('/close', optionalAuth, closeComplaint);

export default router;
