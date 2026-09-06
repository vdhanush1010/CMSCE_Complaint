import jwt from 'jsonwebtoken';
import { Student } from '../models/Student.js';
import { Admin } from '../models/Admin.js';
import { Department } from '../models/Department.js';

/**
 * Resolve user entity based on decoded JWT payload
 */
async function resolvePrincipal(decoded) {
  if (!decoded || !decoded.id) {
    if (decoded && decoded.departmentCode) {
      const dept = await Department.findOne({ code: decoded.departmentCode.toUpperCase() });
      if (dept) {
        return {
          _id: dept._id,
          id: dept._id,
          name: dept.head?.name || `${dept.name} Head`,
          email: dept.head?.email || '',
          phone: dept.head?.phone || '',
          role: 'DEPT_HEAD',
          department: dept.code,
          department_name: dept.name
        };
      }
    }
    return null;
  }

  // 1. Role is explicitly ADMIN
  if (decoded.role === 'ADMIN') {
    const admin = await Admin.findById(decoded.id).select('-password');
    if (admin) {
      const plain = admin.toJSON();
      plain._id = admin._id;
      plain.id = admin._id;
      plain.role = 'ADMIN';
      return plain;
    }
  }

  // 2. Role is explicitly DEPT_HEAD or DEPARTMENT_HEAD
  if (decoded.role === 'DEPT_HEAD' || decoded.role === 'DEPARTMENT_HEAD' || decoded.role === 'STAFF') {
    const dept = decoded.departmentCode
      ? await Department.findOne({ code: decoded.departmentCode.toUpperCase() })
      : await Department.findById(decoded.id);

    if (dept) {
      return {
        _id: dept._id,
        id: dept._id,
        name: dept.head?.name || `${dept.name} Head`,
        email: dept.head?.email || '',
        phone: dept.head?.phone || '',
        role: 'DEPARTMENT_HEAD',
        department: dept.code,
        departmentCode: dept.code,
        department_name: dept.name
      };
    }
  }

  // 3. Role is explicitly STUDENT
  if (decoded.role === 'STUDENT') {
    const student = await Student.findById(decoded.id).select('-password');
    if (student) {
      const plain = student.toJSON();
      plain._id = student._id;
      plain.id = student._id;
      plain.role = 'STUDENT';
      return plain;
    }
  }

  // Fallback checks for older or generic tokens
  const adminDoc = await Admin.findById(decoded.id).select('-password');
  if (adminDoc) {
    const plain = adminDoc.toJSON();
    plain._id = adminDoc._id;
    plain.role = 'ADMIN';
    return plain;
  }

  const studentDoc = await Student.findById(decoded.id).select('-password');
  if (studentDoc) {
    const plain = studentDoc.toJSON();
    plain._id = studentDoc._id;
    plain.role = 'STUDENT';
    return plain;
  }

  const deptDoc = await Department.findById(decoded.id);
  if (deptDoc) {
    return {
      _id: deptDoc._id,
      id: deptDoc._id,
      name: deptDoc.head?.name || `${deptDoc.name} Head`,
      email: deptDoc.head?.email || '',
      phone: deptDoc.head?.phone || '',
      role: 'DEPARTMENT_HEAD',
      department: deptDoc.code,
      departmentCode: deptDoc.code,
      department_name: deptDoc.name
    };
  }

  return null;
}

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers.authorization) {
    token = req.headers.authorization;
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cmsce_super_secret_jwt_key_2026_production');
    const principal = await resolvePrincipal(decoded);
    if (!principal) {
      return res.status(401).json({ error: 'User not found or token invalid' });
    }
    req.user = principal;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Not authorized, token validation failed' });
  }
};

export const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers.authorization) {
    token = req.headers.authorization;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cmsce_super_secret_jwt_key_2026_production');
      req.user = await resolvePrincipal(decoded);
    } catch (_) {}
  }
  next();
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    const isAllowed = roles.includes(userRole) || 
      (roles.includes('DEPT_HEAD') && userRole === 'DEPARTMENT_HEAD') ||
      (roles.includes('DEPARTMENT_HEAD') && userRole === 'DEPT_HEAD');
    if (!req.user || !isAllowed) {
      return res.status(403).json({
        error: `Access denied. Requires one of: ${roles.join(', ')}.`
      });
    }
    next();
  };
};
