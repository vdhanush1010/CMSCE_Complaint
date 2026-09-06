import express from 'express';
import { Complaint } from '../models/Complaint.js';
import { Department } from '../models/Department.js';
import { triageComplaint } from '../services/aiTriageService.js';
import { optionalAuth, protect } from '../middleware/auth.js';
import { reopenComplaint, getComplaints, appealComplaint, closeComplaint } from '../controllers/complaintController.js';

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
// @desc    Live Gemini AI triage endpoint
router.post('/triage', optionalAuth, async (req, res) => {
  try {
    const { title, description, text, category } = req.body;
    const complaintText = description || text || title || '';
    if (!complaintText.trim()) {
      return res.status(400).json({ error: 'Complaint title or description is required for triage.' });
    }
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
    console.error('[Complaints Triage Error]:', err.message);
    return res.status(err.status || 500).json({
      error: 'Gemini AI Analysis Service Unavailable',
      detail: err.message
    });
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
    } else {
      const deptDoc = await Department.findOne({ code: finalDept.toUpperCase() });
      if (deptDoc) {
        finalDeptName = deptDoc.name;
        if (!finalSlaHours) finalSlaHours = deptDoc.slaHours;
      }
    }

    const ticket_id = await generateUniqueTicketId();

    const now = new Date();
    const deadline = new Date(now.getTime() + (finalSlaHours || 24) * 60 * 60 * 1000);

    const studentName = is_anonymous ? 'Anonymous' : req.user ? req.user.name : 'Student User';
    const studentRoll = req.user ? req.user.roll_number || '2026-STU' : '2026-STU';

    const safeAttachments = Array.isArray(attachments) ? attachments : [];
    const safeProofs = (Array.isArray(proofs) && proofs.length > 0)
      ? proofs
      : safeAttachments.map((a) => ({ fileName: a.fileName, url: a.fileData }));

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
      status: 'Submitted',
      is_anonymous: Boolean(is_anonymous),
      student: req.user ? req.user._id : undefined,
      studentId: req.user ? req.user._id : undefined,
      student_name: studentName,
      student_roll: studentRoll,
      ai_confidence_score: finalConfidence || 95.0,
      ai_routing_reasoning: finalReasoning || 'AI triage processed and assigned ticket.',
      sla_hours: finalSlaHours || 24,
      sla_deadline_at: deadline,
      is_sla_breached: false,
      attachments: safeAttachments,
      proofs: safeProofs,
      history: [
        {
          old_status: 'None',
          new_status: 'Submitted',
          changed_by_name: studentName,
          remarks: 'Complaint filed via Student Desk',
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
    if (complaint.sla_deadline_at) {
      complaint.is_sla_breached = now > new Date(complaint.sla_deadline_at) && !['Resolved', 'Closed'].includes(complaint.status);
    }

    return res.json(complaint.toJSON());
  } catch (err) {
    return res.status(500).json({ error: 'Failed to track ticket', detail: err.message });
  }
});

// @route   PATCH /api/complaints/:id/status
// @desc    Update complaint status, re-route department, modify priority, or add admin comment
router.patch('/:id/status', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionProof, resolution_proof_url, resolution_notes, priority, department, adminComments, remarks } = req.body;

    const complaint = await Complaint.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { ticket_id: id.toUpperCase() }]
    });

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Role check for staff: must belong to same department
    if (req.user && (req.user.role === 'DEPT_HEAD' || req.user.role === 'STAFF')) {
      if (complaint.department !== req.user.department) {
        return res.status(403).json({ error: 'Cannot modify complaints assigned to another department' });
      }
    }

    const changerName = req.user ? req.user.name : 'System Administrator';

    // Status transition
    if (status && status !== complaint.status) {
      const oldStatus = complaint.status;
      complaint.status = status;

      // When moving from REOPENED to In Progress, mark breach reset
      if (['REOPENED', 'Reopened'].includes(oldStatus)) {
        if (['In Progress', 'IN_PROGRESS'].includes(status)) {
          complaint.is_sla_breached = false;
          complaint.isSlaBreached = false;
        }
      }

      if (resolutionProof) {
        complaint.resolutionProof = resolutionProof;
        complaint.resolution_proof_url = resolutionProof.fileData || resolutionProof.fileName || '';
        if (!complaint.proofs) complaint.proofs = [];
        complaint.proofs.push({
          fileName: resolutionProof.fileName || 'Resolution_Proof',
          url: resolutionProof.fileData || '',
          uploadedAt: new Date()
        });
        if (!complaint.attachments) complaint.attachments = [];
        complaint.attachments.push({
          fileName: resolutionProof.fileName || 'Resolution_Proof',
          fileData: resolutionProof.fileData || '',
          fileType: resolutionProof.fileType || '',
          fileSize: resolutionProof.fileSize || 0,
          uploadedAt: new Date()
        });
      } else if (resolution_proof_url) {
        complaint.resolution_proof_url = resolution_proof_url;
      }
      if (resolution_notes) {
        complaint.resolution_notes = resolution_notes;
      }

      const noteText = remarks || resolution_notes || `Status updated from ${oldStatus} to ${status}`;

      complaint.history.push({
        old_status: oldStatus,
        new_status: status,
        changed_by_name: changerName,
        remarks: noteText,
        timestamp: new Date()
      });

      if (!complaint.timeline) complaint.timeline = [];
      complaint.timeline.push({
        status: status,
        changedBy: changerName,
        role: req.user?.role || 'STAFF',
        remarks: noteText,
        timestamp: new Date()
      });
    }

    // Priority update
    if (priority && priority !== complaint.priority) {
      complaint.priority = priority;
      complaint.history.push({
        old_status: complaint.status,
        new_status: complaint.status,
        changed_by_name: changerName,
        remarks: `Priority updated to ${priority}`,
        timestamp: new Date()
      });
    }

    // Department re-routing
    if (department && department !== complaint.department) {
      const oldDept = complaint.department;
      complaint.department = department.toUpperCase();
      complaint.assigned_department_code = department.toUpperCase();
      const deptDoc = await Department.findOne({ code: department.toUpperCase() });
      if (deptDoc) {
        complaint.assigned_department_name = deptDoc.name;
      }
      complaint.ai_routing_reasoning = `Manually re-routed from ${oldDept} to ${complaint.assigned_department_name} by ${changerName}.`;
      complaint.history.push({
        old_status: complaint.status,
        new_status: complaint.status,
        changed_by_name: changerName,
        remarks: `Re-routed to ${complaint.assigned_department_name}`,
        timestamp: new Date()
      });
    }

    // Internal admin comments
    if (adminComments && Array.isArray(adminComments)) {
      complaint.adminComments = adminComments.map((c) => ({
        author: c.author || changerName,
        text: c.text || '',
        timestamp: c.timestamp || new Date()
      }));
    }

    await complaint.save();

    return res.json({
      success: true,
      message: 'Complaint updated successfully',
      complaint: complaint.toJSON()
    });
  } catch (err) {
    console.error('[Update Complaint Error]:', err);
    return res.status(500).json({ error: 'Failed to update complaint', detail: err.message });
  }
});

// Also support direct PATCH /api/complaints/:id
router.patch('/:id', optionalAuth, async (req, res) => {
  req.url = `/${req.params.id}/status`;
  return router.handle(req, res);
});

// @route   POST /api/complaints/:id/feedback
// @desc    Submit 5-star resolution feedback or reopen request
router.post('/:id/feedback', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comments, selected_tags, reopen_requested } = req.body;

    const complaint = await Complaint.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { ticket_id: id.toUpperCase() }]
    });

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    complaint.feedback = {
      rating: Number(rating) || 5,
      comments: comments || '',
      selected_tags: selected_tags || [],
      reopen_requested: Boolean(reopen_requested),
      submittedAt: new Date()
    };

    const studentName = req.user ? req.user.name : complaint.student_name || 'Student';

    if (reopen_requested) {
      const oldStatus = complaint.status;
      complaint.status = 'Reopened';
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
        remarks: `Student rated resolution: ${rating} Stars.`,
        timestamp: new Date()
      });
    }

    await complaint.save();

    return res.json({
      success: true,
      message: reopen_requested ? 'Ticket reopened' : 'Feedback submitted successfully',
      feedback: complaint.feedback,
      status: complaint.status
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
