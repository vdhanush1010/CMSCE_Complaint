import multer from 'multer';

// Strict 5MB size limit to prevent Render 512MB RAM OOM crashes
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Allowed MIME types for grievance attachments & proofs
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

// Memory storage engine with strict limits
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      new Error(`Unsupported file type: ${file.mimetype}. Allowed types: JPG, PNG, WEBP, PDF.`),
      false
    );
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 5 // Maximum 5 files per request
  },
  fileFilter
});

/**
 * Express error handling wrapper for Multer file uploads
 */
export function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File size exceeds maximum permitted limit of 5MB.',
        code: 'FILE_TOO_LARGE'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files uploaded. Maximum 5 files allowed.',
        code: 'TOO_MANY_FILES'
      });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}`, code: err.code });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
}

/**
 * Utility to immediately clear memory buffers from request object
 * to assist V8 garbage collector in reclaiming RAM quickly.
 */
export function clearFileBuffers(req) {
  if (req.file && req.file.buffer) {
    req.file.buffer = null;
  }
  if (Array.isArray(req.files)) {
    req.files.forEach((f) => {
      if (f && f.buffer) {
        f.buffer = null;
      }
    });
  }
}

export default {
  upload,
  handleUploadErrors,
  clearFileBuffers,
  MAX_FILE_SIZE_BYTES
};
