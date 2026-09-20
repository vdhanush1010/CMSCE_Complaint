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
      sla_hours: finalSlaHours || 24,
      sla_deadline_at: deadline,
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
    if (complaint.sla_deadline_at) {
      complaint.is_sla_breached = now > new Date(complaint.sla_deadline_at) && !['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(complaint.status);
    }

    return res.json(complaint.toJSON());
  } catch (err) {
    return res.status(500).json({ error: 'Failed to track ticket', detail: err.message });
  }
});

// Linear 6-stage sequence & transitions
const STAGE_ORDER = [
  'SUBMITTED',
  'AI_ANALYSED',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING_VERIFICATION',
  'RESOLVED'
];

const STAGE_DISPLAY_STATUS = {
  'SUBMITTED': 'Submitted',
  'AI_ANALYSED': 'AI Analysed',
  'ASSIGNED': 'Assigned',
  'IN_PROGRESS': 'In Progress',
  'PENDING_VERIFICATION': 'Resolution Pending Verification',
  'RESOLVED': 'Resolved'
};

const STATUS_TO_CANONICAL_STAGE = {
  'Submitted': 'SUBMITTED',
  'SUBMITTED': 'SUBMITTED',
  'AI Analysed': 'AI_ANALYSED',
  'AI_ANALYSED': 'AI_ANALYSED',
  'Assigned': 'ASSIGNED',
  'ASSIGNED': 'ASSIGNED',
  'In Progress': 'IN_PROGRESS',
  'IN_PROGRESS': 'IN_PROGRESS',
  'Resolution Pending Verification': 'PENDING_VERIFICATION',
  'PENDING_VERIFICATION': 'PENDING_VERIFICATION',
  'Resolved': 'RESOLVED',
  'RESOLVED': 'RESOLVED',
  'Reopened': 'IN_PROGRESS',
  'REOPENED': 'IN_PROGRESS'
};

// @route   PATCH /api/complaints/:id/status
// @desc    Update complaint status/stage with linear step validation & resolution proof check
router.patch('/:id/status', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      stage,
      resolutionProof,
      resolution_proof_url,
      resolutionNotes,
      resolution_notes,
      priority,
      department,
      adminComments,
      remarks
    } = req.body;

    const complaint = await Complaint.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { ticket_id: id.toUpperCase() }]
    });

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Role check for staff: must belong to same department
    if (req.user && (req.user.role === 'DEPT_HEAD' || req.user.role === 'STAFF')) {
      const userDept = (req.user.department || req.user.departmentCode || '').toUpperCase();
      const compDept = (complaint.department || complaint.departmentCode || '').toUpperCase();
      if (userDept && compDept && userDept !== compDept) {
        return res.status(403).json({ error: 'Cannot modify complaints assigned to another department' });
      }
    }

    const changerName = req.user ? (req.user.name || req.user.full_name) : 'Department Staff';
    const changerRole = req.user?.role || 'STAFF';

    // Target stage determination
    let targetStage = stage ? stage.toUpperCase().trim() : null;
    let targetStatus = status ? status.trim() : null;

    if (!targetStage && targetStatus) {
      targetStage = STATUS_TO_CANONICAL_STAGE[targetStatus] || null;
    }
    if (targetStage && !targetStatus) {
      targetStatus = STAGE_DISPLAY_STATUS[targetStage] || targetStage;
    }

    // Check if transitioning stage/status
    const currentStage = complaint.stage || STATUS_TO_CANONICAL_STAGE[complaint.status] || 'SUBMITTED';
    const isAppealed = complaint.status === 'APPEALED' || complaint.status === 'Appealed';

    if (targetStage && targetStage !== currentStage) {
      const currentStageIndex = STAGE_ORDER.indexOf(currentStage);
      const targetStageIndex = STAGE_ORDER.indexOf(targetStage);

      // Validate linear transitions for staff
      const isAdmin = req.user && req.user.role === 'ADMIN';

      if (!isAdmin) {
        if (isAppealed) {
          // Re-investigate workflow: from APPEALED, staff can transition to IN_PROGRESS or ASSIGNED
          const allowedReinvestigate = ['ASSIGNED', 'IN_PROGRESS'];
          if (!allowedReinvestigate.includes(targetStage)) {
            return res.status(400).json({
              error: `For appealed grievances, you must choose "Re-investigate" to transition to Assigned or In Progress before further stages.`
            });
          }
        } else {
          // Enforce strictly linear stage transitions (cannot skip steps)
          if (targetStageIndex === -1 || targetStageIndex !== currentStageIndex + 1) {
            return res.status(400).json({
              error: `Invalid stage transition. You cannot skip stages. Expected next stage: "${STAGE_ORDER[currentStageIndex + 1] || 'None'}" (current: "${currentStage}").`
            });
          }
        }
      }

      // Mandatory Resolution Proof check on RESOLVED
      if (targetStage === 'RESOLVED' || ['Resolved', 'RESOLVED'].includes(targetStatus)) {
        const hasIncomingProof = resolutionProof && (
          (typeof resolutionProof === 'string' && resolutionProof.trim()) ||
          (resolutionProof.fileData && resolutionProof.fileData.trim()) ||
          (resolutionProof.url && resolutionProof.url.trim()) ||
          (resolutionProof.fileName && resolutionProof.fileName.trim())
        );
        const hasExistingProof = complaint.resolutionProof && (
          (typeof complaint.resolutionProof === 'string' && complaint.resolutionProof.trim()) ||
          (complaint.resolutionProof.fileData && complaint.resolutionProof.fileData.trim()) ||
          (complaint.resolutionProof.url && complaint.resolutionProof.url.trim())
        );
        const hasProofUrl = (resolution_proof_url && resolution_proof_url.trim()) ||
          (complaint.resolution_proof_url && complaint.resolution_proof_url.trim());

        if (!hasIncomingProof && !hasExistingProof && !hasProofUrl) {
          return res.status(400).json({
            error: 'Mandatory resolution proof photo/document is required when resolving a complaint.'
          });
        }
      }

      const oldStatus = complaint.status;
      complaint.status = targetStatus || STAGE_DISPLAY_STATUS[targetStage] || targetStage;
      complaint.stage = targetStage;

      // Handle proof upload
      if (resolutionProof) {
        complaint.resolutionProof = resolutionProof;
        const proofUrl = typeof resolutionProof === 'string'
          ? resolutionProof
          : (resolutionProof.fileData || resolutionProof.url || resolutionProof.fileName || '');
        complaint.resolution_proof_url = proofUrl;

        if (!complaint.proofs) complaint.proofs = [];
        complaint.proofs.push({
          fileName: resolutionProof.fileName || 'Resolution_Proof',
          url: proofUrl,
          uploadedAt: new Date()
        });

        if (!complaint.attachments) complaint.attachments = [];
        complaint.attachments.push({
          fileName: resolutionProof.fileName || 'Resolution_Proof',
          fileData: proofUrl,
          fileType: resolutionProof.fileType || 'image/jpeg',
          fileSize: resolutionProof.fileSize || 0,
          uploadedAt: new Date()
        });
      } else if (resolution_proof_url) {
        complaint.resolution_proof_url = resolution_proof_url;
      }

      // Handle resolution notes (optional)
      const notes = resolutionNotes !== undefined ? resolutionNotes : resolution_notes;
      if (notes !== undefined) {
        complaint.resolutionNotes = notes;
        complaint.resolution_notes = notes;
      }

      const noteText = remarks || notes || `Stage updated: ${currentStage} → ${targetStage}`;

      if (!complaint.history) complaint.history = [];
      complaint.history.push({
        old_status: oldStatus,
        new_status: complaint.status,
        changed_by_name: changerName,
        remarks: noteText,
        timestamp: new Date()
      });

      if (!complaint.timeline) complaint.timeline = [];
      complaint.timeline.push({
        status: complaint.status,
        changedBy: changerName,
        role: changerRole,
        remarks: noteText,
        timestamp: new Date()
      });
    } else {
      // Non-stage updates (proof, notes, priority, routing)
      if (resolutionProof) {
        complaint.resolutionProof = resolutionProof;
        const proofUrl = typeof resolutionProof === 'string'
          ? resolutionProof
          : (resolutionProof.fileData || resolutionProof.url || resolutionProof.fileName || '');
        complaint.resolution_proof_url = proofUrl;
      }
      const notes = resolutionNotes !== undefined ? resolutionNotes : resolution_notes;
      if (notes !== undefined) {
        complaint.resolutionNotes = notes;
        complaint.resolution_notes = notes;
      }
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
