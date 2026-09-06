import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Admin name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Admin email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6
    },
    role: {
      type: String,
      default: 'ADMIN',
      enum: ['ADMIN']
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    employeeId: {
      type: String,
      trim: true,
      default: 'CMSCE-ADM-001'
    }
  },
  {
    collection: 'admins',
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        ret.full_name = ret.name;
        ret.employeeId = ret.employeeId || 'CMSCE-ADM-001';
        delete ret.password;
        delete ret.__v;
        return ret;
      }
    }
  }
);

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

adminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export const Admin = mongoose.model('Admin', adminSchema);
