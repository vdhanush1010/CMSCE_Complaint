import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const departmentHeadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: ''
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    password: {
      type: String,
      default: ''
    },
    assignedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const departmentSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
      enum: ['CANTEEN', 'TRANSPORT', 'HOSTEL', 'SPORTS', 'ACADEMIC', 'HOSPITALITY']
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    slaHours: {
      type: Number,
      default: 24,
      min: 1
    },
    description: {
      type: String,
      default: ''
    },
    icon: {
      type: String,
      default: 'Building2'
    },
    head: {
      type: departmentHeadSchema,
      default: () => ({})
    }
  },
  {
    collection: 'departments',
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        if (ret.head) {
          delete ret.head.password;
        }
        delete ret.__v;
        return ret;
      }
    }
  }
);

departmentSchema.pre('save', async function (next) {
  if (this.isModified('head.password') && this.head && this.head.password) {
    // If not already bcrypt hashed (bcrypt hashes start with $2a$, $2b$, $2y$)
    if (!/^\$2[aby]\$\d{2}\$[./0-9A-Za-z]{53}$/.test(this.head.password)) {
      const salt = await bcrypt.genSalt(10);
      this.head.password = await bcrypt.hash(this.head.password, salt);
    }
  }
  next();
});

departmentSchema.methods.matchHeadPassword = async function (enteredPassword) {
  if (!this.head || !this.head.password) return false;
  return await bcrypt.compare(enteredPassword, this.head.password);
};

export const Department = mongoose.model('Department', departmentSchema);
