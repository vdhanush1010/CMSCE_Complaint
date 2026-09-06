import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      trim: true,
      default: function () {
        return this.message;
      }
    },
    targetAudience: {
      type: String,
      enum: ['ALL_STUDENTS', 'ALL_DEPTS', 'SPECIFIC_DEPT'],
      default: 'ALL_STUDENTS'
    },
    targetDepartment: {
      type: String,
      uppercase: true,
      trim: true,
      default: null
    },
    priority: {
      type: String,
      enum: ['NORMAL', 'URGENT', 'CRITICAL'],
      default: 'NORMAL'
    },
    authorRole: {
      type: String,
      enum: ['ADMIN', 'DEPT_HEAD'],
      default: 'ADMIN'
    },
    author_name: {
      type: String,
      default: 'Campus Administration'
    },
    departmentCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: ''
    },
    target_role: {
      type: String,
      default: 'ALL'
    },
    expires_at: {
      type: Date
    }
  },
  {
    collection: 'announcements',
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        if (!ret.content && ret.message) {
          ret.content = ret.message;
        }
        if (!ret.message && ret.content) {
          ret.message = ret.content;
        }
        // Normalize audience for frontend consumption
        if (!ret.targetAudience) {
          if (ret.target_role === 'STUDENT' || ret.target_role === 'ALL') {
            ret.targetAudience = 'ALL_STUDENTS';
          } else if (ret.departmentCode) {
            ret.targetAudience = 'SPECIFIC_DEPT';
            ret.targetDepartment = ret.departmentCode;
          } else {
            ret.targetAudience = 'ALL_DEPTS';
          }
        }
        delete ret.__v;
        return ret;
      }
    }
  }
);

announcementSchema.pre('save', function (next) {
  if (!this.content && this.message) {
    this.content = this.message;
  }
  if (!this.message && this.content) {
    this.message = this.content;
  }
  // Sync targetDepartment with departmentCode if one is missing
  if (this.targetAudience === 'SPECIFIC_DEPT' && this.targetDepartment && !this.departmentCode) {
    this.departmentCode = this.targetDepartment;
  }
  if (this.departmentCode && !this.targetDepartment && this.targetAudience === 'SPECIFIC_DEPT') {
    this.targetDepartment = this.departmentCode;
  }
  next();
});

export const Announcement = mongoose.model('Announcement', announcementSchema);
