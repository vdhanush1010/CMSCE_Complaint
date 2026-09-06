import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true
    },
    rollNo: {
      type: String,
      required: [true, 'Roll number is required'],
      unique: true,
      index: true,
      uppercase: true,
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Student email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      default: 'CSE'
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'students',
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        ret.full_name = ret.name;
        ret.roll_number = ret.rollNo;
        ret.role = 'STUDENT';
        delete ret.password;
        delete ret.__v;
        return ret;
      }
    }
  }
);

studentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

studentSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export const Student = mongoose.model('Student', studentSchema);
