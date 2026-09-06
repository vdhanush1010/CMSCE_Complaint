import { Admin } from '../models/Admin.js';

/**
 * Get current admin profile
 * GET /api/admin/profile
 */
export async function getAdminProfile(req, res) {
  try {
    let admin = null;
    if (req.user && req.user.role === 'ADMIN') {
      admin = await Admin.findById(req.user._id || req.user.id);
    }
    
    if (!admin) {
      admin = await Admin.findOne();
    }

    if (!admin) {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    return res.json({ admin: admin.toJSON() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch admin profile', detail: err.message });
  }
}

/**
 * Update admin profile (name, phone, password)
 * PUT /api/admin/profile
 */
export async function updateAdminProfile(req, res) {
  try {
    const { name, phone, password } = req.body;

    let admin = null;
    if (req.user && req.user.role === 'ADMIN') {
      admin = await Admin.findById(req.user._id || req.user.id);
    }
    
    if (!admin) {
      admin = await Admin.findOne();
    }

    if (!admin) {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    if (name && name.trim()) {
      admin.name = name.trim();
    }

    if (phone !== undefined) {
      admin.phone = phone.trim();
    }

    if (password && password.trim()) {
      if (password.trim().length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }
      admin.password = password.trim();
    }

    await admin.save();

    return res.json({
      message: 'Admin profile updated successfully.',
      admin: admin.toJSON()
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update admin profile', detail: err.message });
  }
}
