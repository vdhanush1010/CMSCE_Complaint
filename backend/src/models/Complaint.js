import mongoose from 'mongoose';
import { getSlaHours, calculateSlaDeadline } from '../services/slaService.js';

const complaintSchema = new mongoose.Schema(
  {
    ticket_id: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      default: 'General'
    },
    department: {
      type: String,
      required: true,
      uppercase: true,
      default: 'CANTEEN'
    },
    departmentCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: function () {
        return this.department;
      }
    },
    assigned_department_code: {
      type: String,
      uppercase: true,
      trim: true,
      default: function () {
        return this.departmentCode || this.department;
      }
    },
    assigned_department_name: {
      type: String,
      default: 'Department Operations'
    },
    priority: {
      type: String,
      uppercase: true,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'Critical', 'High', 'Medium', 'Low', 'critical', 'high', 'medium', 'low'],
      default: 'MEDIUM'
    },
    status: {
      type: String,
      enum: [
        'Submitted',
        'SUBMITTED',
        'AI Analysed',
        'AI_ANALYSED',
        'Assigned',
        'ASSIGNED',
        'In Progress',
        'IN_PROGRESS',
        'Resolution Pending Verification',
        'PENDING_VERIFICATION',
        'Pending Verification',
        'Resolved',
        'RESOLVED',
        'Closed',
        'CLOSED',
        'Reopened',
        'REOPENED',
        'Appealed',
        'APPEALED'
      ],
      default: 'Submitted'
    },
    stage: {
      type: String,
      enum: ['SUBMITTED', 'AI_ANALYSED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'RESOLVED'],
      default: 'SUBMITTED',
      uppercase: true,
      trim: true
    },
    is_anonymous: {
      type: Boolean,
      default: false
    },
    isAnonymous: {
      type: Boolean,
      default: false
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    },
    student_name: {
      type: String,
      default: 'Student'
    },
    studentName: {
      type: String,
      default: 'Student'
    },
    student_roll: {
      type: String,
      default: '2026-STU'
    },
    rollNo: {
      type: String,
      default: '2026-STU'
    },
    student_email: {
      type: String,
      default: ''
    },
    studentEmail: {
      type: String,
      default: ''
    },
    ai_confidence_score: {
      type: Number,
      default: 94.0
    },
    ai_routing_reasoning: {
      type: String,
      default: 'AI routing engine processed ticket.'
    },
    sla_hours: {
      type: Number,
      default: 48
    },
    sla_deadline_at: {
      type: Date
    },
    slaDeadline: {
      type: Date
    },
    slaExtendedUntil: {
      type: Date
    },
    is_sla_breached: {
      type: Boolean,
      default: false
    },
    isSlaBreached: {
      type: Boolean,
      default: false
    },
    isReopened: {
      type: Boolean,
      default: false
    },
    reopenReason: {
      type: String,
      default: ''
    },
    attachments: [
      {
        type: mongoose.Schema.Types.Mixed
      }
    ],
    proofs: [
      {
        fileName: String,
        url: String,
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    resolutionProof: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    resolution_proof_url: {
      type: String,
      default: ''
    },
    resolutionNotes: {
      type: String,
      default: ''
    },
    resolution_notes: {
      type: String,
      default: ''
    },
    timeline: [
      {
        action: { type: String, default: 'STATUS_UPDATED' },
        message: { type: String, default: '' },
        status: { type: String },
        changedBy: { type: String },
        role: { type: String },
        timestamp: { type: Date, default: Date.now },
        remarks: { type: String, default: '' }
      }
    ],
    history: [
      {
        old_status: String,
        new_status: String,
        changed_by_name: String,
        remarks: String,
        timestamp: { type: mongoose.Schema.Types.Mixed, default: Date.now }
      }
    ],
    adminComments: [
      {
        author: String,
        text: String,
        timestamp: { type: mongoose.Schema.Types.Mixed, default: Date.now }
      }
    ],
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      comments: { type: String, default: '' },
      selected_tags: [String],
      reopen_requested: { type: Boolean, default: false },
      submittedAt: Date
    },
    appeal: {
      isAppealed: { type: Boolean, default: false },
      reason: { type: String, default: '' },
      proof: {
        fileName: String,
        fileData: String,
        fileType: String
      },
      appealedAt: { type: Date }
    },
    appealHistory: [
      {
        reason: { type: String, required: true },
        appealedAt: { type: Date, default: Date.now },
        previousResolutionProof: { type: mongoose.Schema.Types.Mixed },
        cycle: { type: Number, default: 1 }
      }
    ]
  },
  {
    collection: 'complaints',
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Helper to map status to 6-stage format
const STATUS_TO_STAGE = {
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

const STAGE_TO_STATUS = {
  'SUBMITTED': 'Submitted',
  'AI_ANALYSED': 'AI Analysed',
  'ASSIGNED': 'Assigned',
  'IN_PROGRESS': 'In Progress',
  'PENDING_VERIFICATION': 'Resolution Pending Verification',
  'RESOLVED': 'Resolved'
};

// Pre-save SLA deadline, breach computation, departmentCode sync, and stage-status sync
complaintSchema.pre('save', function (next) {
  if (this.department && !this.departmentCode) {
    this.departmentCode = this.department;
  }
  if (!this.studentId && this.student) {
    this.studentId = this.student;
  }
  if (!this.student && this.studentId) {
    this.student = this.studentId;
  }

  // Synchronize anonymous flags
  if (this.isAnonymous !== undefined && this.is_anonymous === undefined) {
    this.is_anonymous = Boolean(this.isAnonymous);
  } else if (this.is_anonymous !== undefined && this.isAnonymous === undefined) {
    this.isAnonymous = Boolean(this.is_anonymous);
  } else if (this.isAnonymous !== undefined) {
    this.is_anonymous = Boolean(this.isAnonymous);
  }

  // Synchronize student display names and rolls
  if (this.studentName && !this.student_name) {
    this.student_name = this.studentName;
  } else if (this.student_name && !this.studentName) {
    this.studentName = this.student_name;
  }

  if (this.rollNo && !this.student_roll) {
    this.student_roll = this.rollNo;
  } else if (this.student_roll && !this.rollNo) {
    this.rollNo = this.student_roll;
  }

  if (this.studentEmail && !this.student_email) {
    this.student_email = this.studentEmail;
  } else if (this.student_email && !this.studentEmail) {
    this.studentEmail = this.student_email;
  }

  // Synchronize resolutionNotes and resolution_notes
  if (this.resolutionNotes && !this.resolution_notes) {
    this.resolution_notes = this.resolutionNotes;
  } else if (this.resolution_notes && !this.resolutionNotes) {
    this.resolutionNotes = this.resolution_notes;
  }

  // Synchronize stage and status
  if (!this.stage && this.status) {
    this.stage = STATUS_TO_STAGE[this.status] || 'SUBMITTED';
  } else if (this.stage && !this.status) {
    this.status = STAGE_TO_STATUS[this.stage] || 'Submitted';
  }

  // SLA hour mapping & deadline calculation:
  // Strictly: CRITICAL = 12h, all other priorities (HIGH, MEDIUM, LOW) = 48h
  const targetSlaHours = getSlaHours(this.priority);
  if (!this.sla_hours || this.isModified('priority')) {
    this.sla_hours = targetSlaHours;
  }

  // Calculate slaDeadline: new Date(baseTime + hours * 60 * 60 * 1000)
  if ((!this.sla_deadline_at && !this.slaDeadline) || this.isModified('priority')) {
    const baseTime = this.createdAt || Date.now();
    const deadline = calculateSlaDeadline(this.sla_hours, baseTime);
    this.slaDeadline = deadline;
    this.sla_deadline_at = deadline;
  } else {
    // Keep slaDeadline and sla_deadline_at synchronized
    if (this.sla_deadline_at && !this.slaDeadline) {
      this.slaDeadline = this.sla_deadline_at;
    } else if (this.slaDeadline && !this.sla_deadline_at) {
      this.sla_deadline_at = this.slaDeadline;
    }
  }

  if (this.slaExtendedUntil) {
    if (!this.sla_deadline_at || this.sla_deadline_at < this.slaExtendedUntil) {
      this.sla_deadline_at = this.slaExtendedUntil;
      this.slaDeadline = this.slaExtendedUntil;
    }
  }

  const effectiveDeadline = this.slaDeadline || this.sla_deadline_at;
  if (effectiveDeadline) {
    const isPast = new Date() > new Date(effectiveDeadline) && !['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(this.status);
    this.is_sla_breached = isPast;
    this.isSlaBreached = isPast;
  }
  next();
});

export const Complaint = mongoose.model('Complaint', complaintSchema);
export default Complaint;
