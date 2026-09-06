import mongoose from 'mongoose';
import { Complaint } from '../models/Complaint.js';

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
      (complaint.sla_deadline_at && now > new Date(complaint.sla_deadline_at) && !['Resolved', 'Closed', 'RESOLVED'].includes(complaint.status))
    );
    const isResolved = ['Resolved', 'Closed', 'RESOLVED'].includes(complaint.status);

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

    // Update status and SLA tracking
    complaint.status = 'REOPENED';
    complaint.isReopened = true;
    complaint.reopenReason = reasonText;
    complaint.is_sla_breached = false;
    complaint.isSlaBreached = false;
    complaint.sla_deadline_at = newDeadline;
    complaint.slaExtendedUntil = newDeadline;
    complaint.sla_hours = extHours;

    if (!complaint.timeline) {
      complaint.timeline = [];
    }

    // Append entry into timeline
    complaint.timeline.push({
      status: 'REOPENED',
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
      new_status: 'REOPENED',
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
export async function getComplaints(req, res) {
  try {
    const { department, status, search, student_id } = req.query;

    const mapComplaint = (item, now) => {
      const deadline = item.slaExtendedUntil || item.sla_deadline_at;
      const isBreached = deadline 
        ? now > new Date(deadline) && !['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(item.status)
        : false;
      return {
        ...item.toJSON(),
        id: item._id,
        is_sla_breached: isBreached
      };
    };

    // 1. Role is ADMIN: Admins MUST see all complaints unconditionally
    // Ignore any lingering department context or req.user.department
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

      const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
      const now = new Date();
      const formatted = complaints.map(c => mapComplaint(c, now));
      return res.json({ success: true, complaints: formatted });
    }

    // 2. Role is DEPARTMENT_HEAD: Filter strictly by their assigned department
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

      const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
      const now = new Date();
      const formatted = complaints.map(c => mapComplaint(c, now));
      return res.json({ success: true, complaints: formatted });
    }

    // 3. Role is STUDENT or fallback unauthenticated
    const filter = {};
    if (req.user && req.user.role === 'STUDENT' && !department && !search) {
      filter.$or = [{ student: req.user._id }, { studentId: req.user._id }];
    } else if (department && department !== 'ALL' && department !== 'all') {
      filter.department = department.toUpperCase();
    }

    if (status && status !== 'ALL' && status !== 'all') {
      filter.status = status;
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

    const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
    const now = new Date();
    const formatted = complaints.map(c => mapComplaint(c, now));
    return res.json({ success: true, complaints: formatted });
  } catch (err) {
    console.error('[Get Complaints Error]:', err);
    return res.status(500).json({ error: 'Failed to retrieve complaints', detail: err.message });
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

    // Transition to APPEALED
    complaint.status = 'APPEALED';
    complaint.appeal = {
      isAppealed: true,
      reason: explanation,
      proof: proof || null,
      appealedAt: now
    };

    if (!complaint.timeline) complaint.timeline = [];
    complaint.timeline.push({
      status: 'APPEALED',
      changedBy: studentName,
      role: 'STUDENT',
      remarks: explanation,
      timestamp: now
    });

    if (!complaint.history) complaint.history = [];
    complaint.history.push({
      old_status: oldStatus,
      new_status: 'APPEALED',
      changed_by_name: studentName,
      remarks: `Official Appeal Filed: ${explanation}`,
      timestamp: now
    });

    await complaint.save();

    return res.json({
      success: true,
      message: `Appeal for grievance #${complaint.ticket_id} submitted successfully to College Administration for arbitration.`,
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
