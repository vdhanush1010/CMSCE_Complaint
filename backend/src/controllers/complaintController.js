import mongoose from 'mongoose';
import { Complaint } from '../models/Complaint.js';
import { Department } from '../models/Department.js';
import { triageComplaint, getHeuristicTriage } from '../services/aiTriageService.js';
import { getSlaHours, calculateSlaDeadline } from '../services/slaService.js';

/**
 * Re-open an SLA breached or prematurely resolved grievance with custom SLA extension
 * POST /api/complaints/:id/reopen
 */
export async function reopenComplaint(req, res) {
  try {
    const { id } = req.params;
    const { reopenReason, extensionHours } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Ticket identifier is required.' });
    }

    if (!reopenReason || !reopenReason.trim()) {
      return res.status(400).json({ error: 'Reopening justification / remarks are mandatory.' });
    }

    // Role check: Only Administrators can reopen tickets under this workflow
    if (req.user && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Only College Administrators have authority to re-open grievances.' });
    }

    let complaint = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      complaint = await Complaint.findById(id);
    }
    if (!complaint) {
      complaint = await Complaint.findOne({ ticket_id: id.toUpperCase().trim() });
    }

    if (!complaint) {
      return res.status(404).json({ error: `Grievance ticket "${id}" not found.` });
    }

    const now = new Date();
    const isOverdue = Boolean(
      complaint.is_sla_breached ||
      complaint.isSlaBreached ||
      ((complaint.slaDeadline || complaint.sla_deadline_at || complaint.slaExtendedUntil) && now > new Date(complaint.slaExtendedUntil || complaint.slaDeadline || complaint.sla_deadline_at) && !['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(complaint.status))
    );
    const isResolved = ['Resolved', 'Closed', 'RESOLVED', 'CLOSED', 'APPEALED'].includes(complaint.status);

    // Validate that ticket is either SLA breached or resolved
    if (!isOverdue && !isResolved) {
      return res.status(400).json({
        error: 'Reopen restricted: Only SLA-breached (overdue) or resolved grievances can be reopened by Administration.'
      });
    }

    const extHours = Math.max(1, Number(extensionHours) || 24);
    const newDeadline = new Date(now.getTime() + extHours * 60 * 60 * 1000);
    const adminName = req.user?.name || req.user?.full_name || 'Dr. K. Ramanathan';
    const reasonText = reopenReason.trim();
    const oldStatus = complaint.status;

    // Update status and SLA tracking: reset to IN_PROGRESS and unlock workflow
    complaint.status = 'IN_PROGRESS';
    complaint.stage = 'IN_PROGRESS';
    complaint.isReopened = true;
    complaint.reopenReason = reasonText;
    complaint.is_sla_breached = false;
    complaint.isSlaBreached = false;
    complaint.sla_deadline_at = newDeadline;
    complaint.slaDeadline = newDeadline;
    complaint.slaExtendedUntil = newDeadline;
    complaint.sla_hours = extHours;

    if (!complaint.timeline) {
      complaint.timeline = [];
    }

    // Append audit entry into timeline with REOPENED_BY_ADMIN action
    complaint.timeline.push({
      action: 'REOPENED_BY_ADMIN',
      message: `Re-opened by Admin (+${extHours}h extension)`,
      status: 'IN_PROGRESS',
      changedBy: adminName,
      role: 'ADMIN',
      remarks: reasonText,
      timestamp: now
    });

    if (!complaint.history) {
      complaint.history = [];
    }

    // Append entry into history
    complaint.history.push({
      old_status: oldStatus,
      new_status: 'IN_PROGRESS',
      changed_by_name: adminName,
      remarks: `Re-opened by Admin (+${extHours}h SLA extension): ${reasonText}`,
      timestamp: now
    });

    if (!complaint.adminComments) {
      complaint.adminComments = [];
    }

    // Append to internal staff notes
    complaint.adminComments.push({
      author: `${adminName} (Administrator)`,
      text: `Reopened grievance with +${extHours}h SLA extension. Reason: ${reasonText}`,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    await complaint.save();

    return res.json({
      message: `Grievance #${complaint.ticket_id} successfully re-opened with +${extHours}h extension.`,
      complaint: complaint.toJSON()
    });
  } catch (err) {
    console.error('[Reopen Complaint Error]:', err);
    return res.status(500).json({ error: 'Failed to re-open grievance', detail: err.message });
  }
}

/**
 * List complaints with role-based scoping and unpolluted Admin visibility
 * GET /api/complaints/
 */
/**
 * Helper to generate human-readable unique ticket IDs like CMP-1045
 */
export async function generateUniqueTicketId() {
  const count = await Complaint.countDocuments();
  const seedNum = 1040 + count + 1;
  const candidate = `CMP-${seedNum}`;
  const exists = await Complaint.findOne({ ticket_id: candidate });
  if (exists) {
    return `CMP-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return candidate;
}

/**
 * Helper to format complaint output with SLA breach calculation and anonymous masking.
 * Ensures non-critical complaints always receive 48h target window.
 */
export function formatComplaintResponse(item, now = new Date(), maskAnonymous = false) {
  if (!item) return null;
  const raw = item.toJSON ? item.toJSON() : { ...item };
  const priority = (raw.priority || 'MEDIUM').toUpperCase().trim();
  const slaTargetHours = raw.slaTargetHours || (priority === 'CRITICAL' ? 12 : 48);

  // Compute effective deadline, correcting 12h bug if present on non-critical complaints
  let deadline = raw.slaExtendedUntil;
  if (!deadline) {
    const rawDeadline = raw.slaDeadline || raw.sla_deadline_at;
    const createdAt = raw.createdAt ? new Date(raw.createdAt) : null;
    if (rawDeadline && createdAt && priority !== 'CRITICAL') {
      const diffHours = (new Date(rawDeadline).getTime() - createdAt.getTime()) / (60 * 60 * 1000);
      if (diffHours < 24) {
        // Automatically restore 48h deadline for non-critical tickets
        deadline = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
      } else {
        deadline = rawDeadline;
      }
    } else if (rawDeadline) {
      deadline = rawDeadline;
    } else if (createdAt) {
      deadline = new Date(createdAt.getTime() + slaTargetHours * 60 * 60 * 1000);
    }
  }

  const isResolved = ['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(raw.status) || raw.stage === 'RESOLVED';
  const isBreached = deadline ? (now > new Date(deadline) && !isResolved) : false;
  const isAnon = Boolean(raw.isAnonymous || raw.is_anonymous);

  const resObj = {
    ...raw,
    id: raw._id || raw.id,
    priority: priority,
    sla_hours: slaTargetHours,
    slaTargetHours: slaTargetHours,
    isAnonymous: isAnon,
    is_anonymous: isAnon,
    slaDeadline: deadline,
    sla_deadline_at: deadline,
    is_sla_breached: isBreached,
    isSlaBreached: isBreached
  };

  if (maskAnonymous && isAnon) {
    resObj.studentName = 'Anonymous Student';
    resObj.student_name = 'Anonymous Student';
    resObj.studentEmail = 'Hidden';
    resObj.student_email = 'Hidden';
    resObj.rollNo = 'Hidden';
    resObj.studentRoll = 'Hidden';
    resObj.student_roll = 'Hidden';
    if (resObj.student && typeof resObj.student === 'object') {
      resObj.student = {
        ...resObj.student,
        name: 'Anonymous Student',
        full_name: 'Anonymous Student',
        email: 'Hidden',
        rollNo: 'Hidden',
        roll_number: 'Hidden'
      };
    }
  }

  return resObj;
}

/**
 * Submit a new grievance ticket with automatic AI triage and SLA deadline computation
 * POST /api/complaints/
 */
export async function createComplaint(req, res) {
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
      } catch (aiErr) {
        console.warn('[Complaint Create] AI triage error during complaint creation, falling back to heuristics:', aiErr.message);
        const fallback = getHeuristicTriage({ title, description, category_hint: category });
        finalDept = fallback.assigned_dept_code;
        finalDeptName = fallback.department_name;
        finalPriority = fallback.priority;
        finalCategory = finalCategory || fallback.category;
        finalConfidence = fallback.ai_confidence_score;
        finalReasoning = fallback.reasoning;
      }
    } else {
      const deptDoc = await Department.findOne({ code: finalDept.toUpperCase() });
      if (deptDoc) {
        finalDeptName = deptDoc.name;
      }
    }

    // Backend Deadline Calculation:
    // When creating a complaint, strictly calculate 12h for CRITICAL, 48h for all other priorities
    const normPriority = (req.body.priority || finalPriority || 'MEDIUM').toUpperCase().trim();
    const slaHours = (normPriority === 'CRITICAL') ? 12 : 48;
    const now = new Date();
    const slaDeadline = new Date(now.getTime() + slaHours * 60 * 60 * 1000);

    const ticket_id = await generateUniqueTicketId();

    const isAnonymous = Boolean(req.body.isAnonymous !== undefined ? req.body.isAnonymous : req.body.is_anonymous);
    const studentName = req.user ? (req.user.name || req.user.full_name || 'Student User') : 'Student User';
    const studentRoll = req.user ? (req.user.rollNo || req.user.roll_number || '2026-STU') : '2026-STU';
    const studentEmail = req.user ? (req.user.email || '') : '';

    const safeAttachments = Array.isArray(attachments) ? attachments : [];
    const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
    for (const a of safeAttachments) {
      if (a.fileSize && a.fileSize > MAX_ATTACHMENT_BYTES) {
        return res.status(400).json({ error: `Attachment "${a.fileName || 'file'}" exceeds maximum permitted 5MB limit.` });
      }
      if (typeof a.fileData === 'string' && a.fileData.length > MAX_ATTACHMENT_BYTES * 1.4) {
        return res.status(400).json({ error: `Attachment "${a.fileName || 'file'}" exceeds maximum permitted 5MB limit.` });
      }
    }

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
      priority: normPriority,
      status: initialStatus,
      stage: initialStage,
      is_anonymous: isAnonymous,
      isAnonymous: isAnonymous,
      student: req.user ? req.user._id : undefined,
      studentId: req.user ? req.user._id : undefined,
      student_name: studentName,
      studentName: studentName,
      student_roll: studentRoll,
      rollNo: studentRoll,
      student_email: studentEmail,
      studentEmail: studentEmail,
      ai_confidence_score: finalConfidence || 95.0,
      ai_routing_reasoning: finalReasoning || 'AI triage processed and assigned ticket.',
      sla_hours: slaHours,
      slaTargetHours: slaHours,
      sla_deadline_at: slaDeadline,
      slaDeadline: slaDeadline,
      is_sla_breached: false,
      isSlaBreached: false,
      attachments: safeAttachments,
      proofs: safeProofs,
      appealHistory: [],
      history: [
        {
          old_status: 'None',
          new_status: initialStatus,
          changed_by_name: studentName,
          remarks: 'Complaint filed via Student Desk',
          timestamp: now
        }
      ],
      timeline: [
        {
          status: initialStatus,
          changedBy: studentName,
          role: 'STUDENT',
          remarks: 'Complaint lodged by student',
          timestamp: now
        }
      ]
    });

    return res.status(201).json({
      message: 'Complaint lodged successfully',
      ticket_id: complaint.ticket_id,
      complaint: formatComplaintResponse(complaint, now, false)
    });
  } catch (err) {
    console.error('[Create Complaint Error]:', err);
    return res.status(500).json({ error: 'Failed to lodge complaint', detail: err.message });
  }
}

/**
 * List complaints with role-based scoping and unpolluted Admin visibility
 * Masks anonymous submission identity for Department Staff and College Admin
 * GET /api/complaints/
 */
export async function getComplaints(req, res) {
  try {
    const { department, status, stage, search, student_id } = req.query;
    const now = new Date();

    // Standardized memory-safe pagination with 50-record default limit (max 100)
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    // 1. Role is ADMIN: Admins see all complaints (with anonymous submissions masked)
    if (req.user && req.user.role === 'ADMIN') {
      const filter = (department && department !== 'ALL' && department !== 'all')
        ? {
            $or: [
              { department: department.toUpperCase() },
              { departmentCode: department.toUpperCase() },
              { assigned_department_code: department.toUpperCase() }
            ]
          }
        : {};

      if (status && status !== 'ALL' && status !== 'all') {
        filter.status = status;
      }
      if (stage && stage !== 'ALL' && stage !== 'all') {
        filter.stage = stage.toUpperCase();
      }

      if (search && search.trim()) {
        const q = search.trim();
        filter.$and = [
          {
            $or: [
              { ticket_id: { $regex: q, $options: 'i' } },
              { title: { $regex: q, $options: 'i' } },
              { description: { $regex: q, $options: 'i' } },
              { category: { $regex: q, $options: 'i' } }
            ]
          }
        ];
      }

      const complaints = await Complaint.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const formatted = complaints.map(c => formatComplaintResponse(c, now, true));
      return res.json({ success: true, count: formatted.length, page, limit, complaints: formatted });
    }

    // 2. Role is DEPARTMENT_HEAD / STAFF: Filter strictly by their assigned department (masked)
    if (req.user && (req.user.role === 'DEPARTMENT_HEAD' || req.user.role === 'DEPT_HEAD' || req.user.role === 'STAFF')) {
      const deptCode = (req.user.departmentCode || req.user.department || '').toUpperCase();
      const filter = {
        $or: [
          { department: deptCode },
          { departmentCode: deptCode },
          { assigned_department_code: deptCode }
        ]
      };

      if (status && status !== 'ALL' && status !== 'all') {
        filter.status = status;
      }
      if (stage && stage !== 'ALL' && stage !== 'all') {
        filter.stage = stage.toUpperCase();
      }

      if (search && search.trim()) {
        const q = search.trim();
        filter.$and = [
          {
            $or: [
              { ticket_id: { $regex: q, $options: 'i' } },
              { title: { $regex: q, $options: 'i' } },
              { description: { $regex: q, $options: 'i' } },
              { category: { $regex: q, $options: 'i' } }
            ]
          }
        ];
      }

      const complaints = await Complaint.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const formatted = complaints.map(c => formatComplaintResponse(c, now, true));
      return res.json({ success: true, count: formatted.length, page, limit, complaints: formatted });
    }

    // 3. Fallback / Public filtering (masks anonymous)
    const filter = {};
    if (req.user && req.user.role === 'STUDENT' && !department && !search) {
      filter.$or = [{ student: req.user._id }, { studentId: req.user._id }];
    } else if (department && department !== 'ALL' && department !== 'all') {
      filter.department = department.toUpperCase();
    }

    if (status && status !== 'ALL' && status !== 'all') {
      filter.status = status;
    }
    if (stage && stage !== 'ALL' && stage !== 'all') {
      filter.stage = stage.toUpperCase();
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { ticket_id: { $regex: q, $options: 'i' } },
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } }
      ];
    }

    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const isStudentOwn = Boolean(req.user && req.user.role === 'STUDENT' && !department);
    const formatted = complaints.map(c => formatComplaintResponse(c, now, !isStudentOwn));
    return res.json({ success: true, count: formatted.length, page, limit, complaints: formatted });
  } catch (err) {
    console.error('[Get Complaints Error]:', err);
    return res.status(500).json({ error: 'Failed to retrieve complaints', detail: err.message });
  }
}

/**
 * Logged-in Student Grievances: Does NOT mask student details
 * Returns original student information with isAnonymous: true so they can identify their submission
 * GET /api/complaints/my
 */
export async function getMyComplaints(req, res) {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: 'Authentication required to view your complaints.' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const complaints = await Complaint.find({
      $or: [{ student: req.user._id }, { studentId: req.user._id }]
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const now = new Date();
    // Do NOT mask: maskAnonymous = false
    const formatted = complaints.map(c => formatComplaintResponse(c, now, false));
    return res.json({ success: true, count: formatted.length, complaints: formatted });
  } catch (err) {
    console.error('[Get My Complaints Error]:', err);
    return res.status(500).json({ error: 'Failed to retrieve your complaints', detail: err.message });
  }
}

/**
 * File an official appeal against a resolved grievance
 * POST /api/complaints/:id/appeal
 */
export async function appealComplaint(req, res) {
  try {
    const { id } = req.params;
    const { appealReason, reason, proof } = req.body;
    const explanation = (appealReason || reason || '').trim();

    if (!id) {
      return res.status(400).json({ error: 'Ticket identifier is required.' });
    }

    if (!explanation) {
      return res.status(400).json({ error: 'Mandatory appeal justification remarks are required.' });
    }

    let complaint = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      complaint = await Complaint.findById(id);
    }
    if (!complaint) {
      complaint = await Complaint.findOne({ ticket_id: id.toUpperCase().trim() });
    }

    if (!complaint) {
      return res.status(404).json({ error: `Grievance ticket "${id}" not found.` });
    }

    // Allowed only when ticket is resolved
    const isResolved = ['Resolved', 'RESOLVED', 'Resolution Pending Verification', 'PENDING_VERIFICATION'].includes(complaint.status);
    if (!isResolved) {
      return res.status(400).json({
        error: `Cannot appeal grievance with status "${complaint.status}". Appeals are reserved exclusively for grievances marked as Resolved.`
      });
    }

    const studentName = req.user?.name || req.user?.full_name || complaint.student_name || 'Student';
    const oldStatus = complaint.status;
    const now = new Date();

    // Transition to APPEALED & reset stage to SUBMITTED
    const nextCycle = (Array.isArray(complaint.appealHistory) ? complaint.appealHistory.length : 0) + 1;
    const previousResolutionProof = complaint.resolutionProof || complaint.resolution_proof_url || null;

    complaint.status = 'APPEALED';
    complaint.stage = 'SUBMITTED';

    if (!complaint.appealHistory) complaint.appealHistory = [];
    complaint.appealHistory.push({
      reason: explanation,
      appealedAt: now,
      previousResolutionProof: previousResolutionProof,
      cycle: nextCycle
    });

    complaint.appeal = {
      isAppealed: true,
      reason: explanation,
      proof: proof || null,
      appealedAt: now,
      cycle: nextCycle
    };

    if (!complaint.timeline) complaint.timeline = [];
    complaint.timeline.push({
      status: 'APPEALED',
      changedBy: studentName,
      role: 'STUDENT',
      remarks: `Appeal Cycle #${nextCycle}: ${explanation}`,
      timestamp: now
    });

    if (!complaint.history) complaint.history = [];
    complaint.history.push({
      old_status: oldStatus,
      new_status: 'APPEALED',
      changed_by_name: studentName,
      remarks: `Official Appeal Filed (Cycle #${nextCycle}): ${explanation}`,
      timestamp: now
    });

    await complaint.save();

    return res.json({
      success: true,
      message: `Appeal (Cycle #${nextCycle}) for grievance #${complaint.ticket_id} submitted successfully.`,
      complaint: complaint.toJSON()
    });
  } catch (err) {
    console.error('[Appeal Complaint Error]:', err);
    return res.status(500).json({ error: 'Failed to submit appeal', detail: err.message });
  }
}

/**
 * Permanently close a grievance or reject an appeal (Admin Exclusive)
 * POST /api/complaints/:id/close
 */
export async function closeComplaint(req, res) {
  try {
    const { id } = req.params;
    const { remarks, reason } = req.body;
    const decisionNotes = (remarks || reason || '').trim();

    if (!id) {
      return res.status(400).json({ error: 'Ticket identifier is required.' });
    }

    // Role check: Only Administrators can close/reject appeals
    if (req.user && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Only College Administrators have authority to arbitrate and close grievances.' });
    }

    let complaint = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      complaint = await Complaint.findById(id);
    }
    if (!complaint) {
      complaint = await Complaint.findOne({ ticket_id: id.toUpperCase().trim() });
    }

    if (!complaint) {
      return res.status(404).json({ error: `Grievance ticket "${id}" not found.` });
    }

    const adminName = req.user?.name || req.user?.full_name || 'Dr. K. Ramanathan';
    const oldStatus = complaint.status;
    const now = new Date();
    const finalRemarks = decisionNotes || (oldStatus === 'APPEALED' ? 'Appeal rejected and grievance confirmed resolved. Formally closed by Administrator.' : 'Grievance permanently closed by College Administrator.');

    complaint.status = 'CLOSED';

    if (!complaint.timeline) complaint.timeline = [];
    complaint.timeline.push({
      status: 'CLOSED',
      changedBy: adminName,
      role: 'ADMIN',
      remarks: finalRemarks,
      timestamp: now
    });

    if (!complaint.history) complaint.history = [];
    complaint.history.push({
      old_status: oldStatus,
      new_status: 'CLOSED',
      changed_by_name: adminName,
      remarks: finalRemarks,
      timestamp: now
    });

    await complaint.save();

    return res.json({
      success: true,
      message: `Grievance #${complaint.ticket_id} has been permanently closed.`,
      complaint: complaint.toJSON()
    });
  } catch (err) {
    console.error('[Close Complaint Error]:', err);
    return res.status(500).json({ error: 'Failed to close grievance', detail: err.message });
  }
}

// Linear 6-stage sequence & transitions
export const STAGE_ORDER = [
  'SUBMITTED',
  'AI_ANALYSED',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING_VERIFICATION',
  'RESOLVED'
];

export const STAGE_DISPLAY_STATUS = {
  'SUBMITTED': 'Submitted',
  'AI_ANALYSED': 'AI Analysed',
  'ASSIGNED': 'Assigned',
  'IN_PROGRESS': 'In Progress',
  'PENDING_VERIFICATION': 'Resolution Pending Verification',
  'RESOLVED': 'Resolved'
};

export const STATUS_TO_CANONICAL_STAGE = {
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
  'Closed': 'RESOLVED',
  'CLOSED': 'RESOLVED',
  'Reopened': 'IN_PROGRESS',
  'REOPENED': 'IN_PROGRESS',
  'APPEALED': 'SUBMITTED',
  'Appealed': 'SUBMITTED'
};

/**
 * Update complaint status and linear stage progression with proof check
 * PATCH /api/complaints/:id/status
 */
export async function updateStatus(req, res) {
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

    if (!id) {
      return res.status(400).json({ success: false, message: 'Complaint identifier is required.' });
    }

    let complaint = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      complaint = await Complaint.findById(id);
    }
    if (!complaint) {
      complaint = await Complaint.findOne({ ticket_id: id.toUpperCase().trim() });
    }

    if (!complaint) {
      return res.status(404).json({ success: false, message: `Complaint ticket "${id}" not found.` });
    }

    // Role check for department staff: must belong to the same department
    if (req.user && (req.user.role === 'DEPT_HEAD' || req.user.role === 'DEPARTMENT_HEAD' || req.user.role === 'STAFF')) {
      const userDept = (req.user.department || req.user.departmentCode || '').toUpperCase();
      const compDept = (complaint.department || complaint.departmentCode || complaint.assigned_department_code || '').toUpperCase();
      if (userDept && compDept && userDept !== compDept) {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot modify complaints assigned to another department.' });
      }
    }

    const changerName = req.user?.name || req.user?.email || 'Department Staff';
    const changerRole = req.user?.role || 'STAFF';
    const isAdmin = req.user && req.user.role === 'ADMIN';

    // SLA Expiry Lock: When a ticket breaches SLA (new Date() > complaint.slaDeadline and status !== 'RESOLVED'),
    // lock department staff progression: return 403 Forbidden: "SLA time expired. Action locked pending Admin intervention."
    const now = new Date();
    const effectiveDeadline = complaint.slaExtendedUntil || complaint.slaDeadline || complaint.sla_deadline_at;
    const isResolved = ['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(complaint.status) || complaint.stage === 'RESOLVED';
    const isOverdue = effectiveDeadline ? (now > new Date(effectiveDeadline) && !isResolved) : false;
    const isBreached = Boolean(complaint.is_sla_breached || complaint.isSlaBreached || isOverdue);

    if (!isAdmin && isBreached) {
      return res.status(403).json({
        success: false,
        error: 'SLA time expired. Action locked pending Admin intervention.',
        message: 'SLA time expired. Action locked pending Admin intervention.'
      });
    }


    // Normalize target stage & status interchangeably
    const rawInput = (stage || status || '').trim();
    let targetStage = stage ? stage.toUpperCase().trim() : null;
    let targetStatus = status ? status.trim() : null;

    if (!targetStage && rawInput) {
      targetStage = STATUS_TO_CANONICAL_STAGE[rawInput] || rawInput.toUpperCase().replace(/\s+/g, '_');
    }
    if (targetStage && !targetStatus) {
      targetStatus = STAGE_DISPLAY_STATUS[targetStage] || targetStage;
    }
    if (targetStage === 'RESOLVED' || (targetStatus && targetStatus.toUpperCase() === 'RESOLVED')) {
      targetStage = 'RESOLVED';
      targetStatus = 'Resolved';
    }

    const currentStage = complaint.stage || STATUS_TO_CANONICAL_STAGE[complaint.status] || 'SUBMITTED';
    const isAppealed = complaint.status === 'APPEALED' || complaint.status === 'Appealed';
    const oldStatus = complaint.status || 'Submitted';

    // Linear progression and appeal re-investigation rules
    if (targetStage && (targetStage !== currentStage || isAppealed)) {
      const currentStageIndex = STAGE_ORDER.indexOf(currentStage);
      const targetStageIndex = STAGE_ORDER.indexOf(targetStage);

      if (!isAdmin) {
        if (isAppealed) {
          // Re-investigation workflow from APPEALED: staff can transition to IN_PROGRESS or ASSIGNED
          const allowedReinvestigate = ['ASSIGNED', 'IN_PROGRESS'];
          if (!allowedReinvestigate.includes(targetStage)) {
            return res.status(400).json({
              success: false,
              message: `For appealed grievances, you must click "Start Re-investigation" to transition to Assigned or In Progress before subsequent stages.`
            });
          }
        } else {
          // Strictly sequential progression: cannot skip intermediate stages
          if (targetStageIndex === -1 || targetStageIndex !== currentStageIndex + 1) {
            return res.status(400).json({
              success: false,
              message: `Invalid stage transition. You cannot skip stages. Expected next stage: "${STAGE_ORDER[currentStageIndex + 1] || 'None'}" (current: "${currentStage}").`
            });
          }
        }
      }

      // Mandatory Resolution Proof check when resolving
      if (targetStage === 'RESOLVED' || ['Resolved', 'RESOLVED'].includes(targetStatus)) {
        if (resolutionProof && typeof resolutionProof === 'object') {
          if (resolutionProof.fileSize && resolutionProof.fileSize > 5 * 1024 * 1024) {
            return res.status(400).json({ success: false, message: 'Resolution proof photo exceeds maximum permitted 5MB limit.' });
          }
          if (typeof resolutionProof.fileData === 'string' && resolutionProof.fileData.length > 5 * 1024 * 1024 * 1.4) {
            return res.status(400).json({ success: false, message: 'Resolution proof photo exceeds maximum permitted 5MB limit.' });
          }
        }

        const hasIncomingProof = resolutionProof && (
          (typeof resolutionProof === 'string' && resolutionProof.trim().length > 0) ||
          (typeof resolutionProof === 'object' && resolutionProof.fileData && typeof resolutionProof.fileData === 'string' && resolutionProof.fileData.trim().length > 0) ||
          (typeof resolutionProof === 'object' && resolutionProof.url && typeof resolutionProof.url === 'string' && resolutionProof.url.trim().length > 0)
        );
        const hasExistingProof = complaint.resolutionProof && (
          (typeof complaint.resolutionProof === 'string' && complaint.resolutionProof.trim().length > 0) ||
          (typeof complaint.resolutionProof === 'object' && complaint.resolutionProof.fileData && typeof complaint.resolutionProof.fileData === 'string' && complaint.resolutionProof.fileData.trim().length > 0) ||
          (typeof complaint.resolutionProof === 'object' && complaint.resolutionProof.url && typeof complaint.resolutionProof.url === 'string' && complaint.resolutionProof.url.trim().length > 0)
        );
        const hasProofUrl = (resolution_proof_url && typeof resolution_proof_url === 'string' && resolution_proof_url.trim().length > 0) ||
          (complaint.resolution_proof_url && typeof complaint.resolution_proof_url === 'string' && complaint.resolution_proof_url.trim().length > 0);

        if (!hasIncomingProof && !hasExistingProof && !hasProofUrl) {
          return res.status(400).json({
            success: false,
            message: 'Resolution proof photo is mandatory'
          });
        }
      }

      // Synchronously apply stage and status
      const nextStage = targetStage;
      complaint.stage = targetStage;
      complaint.status = targetStatus || STAGE_DISPLAY_STATUS[targetStage] || targetStage;

      // Attach resolution proof if provided
      if (resolutionProof) {
        complaint.resolutionProof = resolutionProof;
        const proofUrl = typeof resolutionProof === 'string'
          ? resolutionProof
          : (resolutionProof.fileData || resolutionProof.url || '');
        complaint.resolution_proof_url = proofUrl;

        if (proofUrl) {
          complaint.proofs = complaint.proofs || [];
          complaint.proofs.push({
            fileName: resolutionProof.fileName || 'Resolution_Proof_Photo.jpg',
            url: proofUrl,
            uploadedAt: new Date()
          });

          complaint.attachments = complaint.attachments || [];
          complaint.attachments.push({
            fileName: resolutionProof.fileName || 'Resolution_Proof_Photo.jpg',
            fileData: proofUrl,
            fileType: resolutionProof.fileType || 'image/jpeg',
            fileSize: resolutionProof.fileSize || 0,
            uploadedAt: new Date()
          });
        }
      } else if (resolution_proof_url) {
        complaint.resolution_proof_url = resolution_proof_url;
      }

      // Resolution notes (optional)
      const notes = resolutionNotes !== undefined ? resolutionNotes : resolution_notes;
      if (notes !== undefined) {
        complaint.resolutionNotes = notes;
        complaint.resolution_notes = notes;
      }

      const noteText = remarks || notes || (isAppealed ? `Re-investigation initiated: Stage moved to ${nextStage}` : `Stage transitioned to ${nextStage}`);

      // Push timeline entry safely
      complaint.timeline = complaint.timeline || [];
      complaint.timeline.push({
        action: 'STAGE_UPDATED',
        message: `Stage transitioned to ${nextStage}`,
        status: complaint.status,
        timestamp: new Date(),
        changedBy: changerName,
        role: changerRole,
        remarks: noteText
      });

      // Push history entry safely
      complaint.history = complaint.history || [];
      complaint.history.push({
        old_status: oldStatus,
        new_status: complaint.status,
        changed_by_name: changerName,
        remarks: noteText,
        timestamp: new Date()
      });
    } else {
      // Non-stage updates (proof, notes, remarks)
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

    // Optional Priority update
    if (priority && priority !== complaint.priority) {
      complaint.priority = priority;
      complaint.history = complaint.history || [];
      complaint.history.push({
        old_status: complaint.status,
        new_status: complaint.status,
        changed_by_name: changerName,
        remarks: `Priority updated to ${priority}`,
        timestamp: new Date()
      });
    }

    // Optional Department re-routing
    if (department && department !== complaint.department) {
      const oldDept = complaint.department;
      complaint.department = department.toUpperCase();
      complaint.assigned_department_code = department.toUpperCase();
      const deptDoc = await Department.findOne({ code: department.toUpperCase() });
      if (deptDoc) {
        complaint.assigned_department_name = deptDoc.name;
      }
      complaint.ai_routing_reasoning = `Manually re-routed from ${oldDept} to ${complaint.assigned_department_name || complaint.department} by ${changerName}.`;
      complaint.history = complaint.history || [];
      complaint.history.push({
        old_status: complaint.status,
        new_status: complaint.status,
        changed_by_name: changerName,
        remarks: `Re-routed to ${complaint.assigned_department_name || complaint.department}`,
        timestamp: new Date()
      });
    }

    // Optional Admin Comments
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
      message: `Complaint moved to ${complaint.stage || targetStage || complaint.status}`,
      complaint: complaint.toJSON()
    });
  } catch (err) {
    console.error('[Update Complaint Status Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to update complaint status', error: err.message, detail: err.message });
  }
}

