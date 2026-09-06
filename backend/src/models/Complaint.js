import mongoose from 'mongoose';

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
      enum: ['CANTEEN', 'TRANSPORT', 'HOSTEL', 'SPORTS', 'ACADEMIC', 'HOSPITALITY'],
      default: function () {
        return this.department;
      }
    },
    assigned_department_code: {
      type: String,
      uppercase: true,
      default: function () {
        return this.departmentCode || this.department;
      }
    },
    assigned_department_name: {
      type: String,
      default: 'Canteen Operations'
    },
    priority: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM'
    },
    status: {
      type: String,
      enum: [
        'Submitted',
        'AI Analysed',
        'Assigned',
        'In Progress',
        'Resolution Pending Verification',
        'Resolved',
        'Closed',
        'Reopened',
        'REOPENED',
        'SUBMITTED',
        'IN_PROGRESS',
        'PENDING_VERIFICATION',
        'RESOLVED',
        'APPEALED',
        'Appealed',
        'CLOSED'
      ],
      default: 'Submitted'
    },
    is_anonymous: {
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
    student_roll: {
      type: String,
      default: '2026-STU'
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
      default: 24
    },
    sla_deadline_at: {
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
        fileName: { type: String, trim: true },
        fileData: { type: String },
        fileType: { type: String, trim: true },
        fileSize: { type: Number },
        uploadedAt: { type: Date, default: Date.now }
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
      fileName: { type: String, trim: true },
      fileData: { type: String },
      fileType: { type: String, trim: true },
      fileSize: { type: Number },
      uploadedAt: { type: Date, default: Date.now }
    },
    resolution_proof_url: {
      type: String,
      default: ''
    },
    resolution_notes: {
      type: String,
      default: ''
    },
    timeline: [
      {
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
      rating: { type: Number, min: 0, max: 5, default: 0 },
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
    }
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

// Pre-save SLA deadline, breach computation, and departmentCode sync
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
  if (!this.sla_deadline_at && this.sla_hours) {
    const deadline = new Date(this.createdAt || Date.now());
    deadline.setHours(deadline.getHours() + this.sla_hours);
    this.sla_deadline_at = deadline;
  }
  if (this.slaExtendedUntil && !this.sla_deadline_at) {
    this.sla_deadline_at = this.slaExtendedUntil;
  }
  if (this.sla_deadline_at && !this.slaExtendedUntil) {
    this.slaExtendedUntil = this.sla_deadline_at;
  }
  if (this.sla_deadline_at) {
    const isPast = new Date() > new Date(this.sla_deadline_at) && !['Resolved', 'Closed', 'RESOLVED'].includes(this.status);
    this.is_sla_breached = isPast;
    this.isSlaBreached = isPast;
  }
  next();
});

export const Complaint = mongoose.model('Complaint', complaintSchema);
