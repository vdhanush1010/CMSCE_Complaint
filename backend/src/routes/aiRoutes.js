import express from 'express';
import { triageComplaint, getHeuristicTriage } from '../services/aiTriageService.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/ai/analyse-complaint (and /api/ai/triage)
 * @desc    Exclusively calls live Google Gemini AI to analyze and triage grievances with Spam & Gibberish Filtering
 *          and resilient institutional heuristic fallback.
 */
router.post('/analyse-complaint', optionalAuth, async (req, res) => {
  const { title = '', description = '', text = '', category = '' } = req.body || {};
  const complaintText = description || text || title || '';

  if (!complaintText.trim()) {
    return res.status(400).json({
      isValid: false,
      error: 'Complaint text or description is required for analysis.'
    });
  }

  try {
    const triageResult = await triageComplaint({
      title: title || '',
      description: complaintText,
      category_hint: category || ''
    });

    if (triageResult.isValid === false) {
      return res.status(400).json({
        isValid: false,
        error: triageResult.reasoning || 'The provided text does not contain a coherent or actionable campus grievance. Please provide specific details.',
        reasoning: triageResult.reasoning,
        category: 'Invalid Submission',
        department: 'NONE',
        assigned_dept_code: 'NONE',
        priority: 'LOW',
        confidenceScore: 0.05,
        confidence_score: 0.05,
        ai_confidence_score: 5.0
      });
    }

    return res.json({
      isValid: true,
      category: triageResult.category,
      department: triageResult.assigned_dept_code,
      assigned_dept_code: triageResult.assigned_dept_code,
      department_code: triageResult.assigned_dept_code,
      department_name: triageResult.department_name,
      priority: triageResult.priority,
      confidenceScore: triageResult.confidenceScore,
      confidence_score: triageResult.confidence_score,
      ai_confidence_score: triageResult.ai_confidence_score,
      reasoning: triageResult.reasoning,
      ai_routing_reasoning: triageResult.reasoning,
      sla_hours: triageResult.sla_hours,
      is_fallback: Boolean(triageResult.is_fallback)
    });
  } catch (err) {
    console.warn('[AI Route Warning]: Handled unexpected triage error with heuristic fallback:', err.message);
    const fallback = getHeuristicTriage({ title, description: complaintText, category_hint: category });
    return res.json({
      isValid: true,
      category: fallback.category,
      department: fallback.assigned_dept_code,
      assigned_dept_code: fallback.assigned_dept_code,
      department_code: fallback.assigned_dept_code,
      department_name: fallback.department_name,
      priority: fallback.priority,
      confidenceScore: fallback.confidenceScore,
      confidence_score: fallback.confidence_score,
      ai_confidence_score: fallback.ai_confidence_score,
      reasoning: fallback.reasoning,
      ai_routing_reasoning: fallback.reasoning,
      sla_hours: fallback.sla_hours,
      is_fallback: true
    });
  }
});

// Alias for /triage
router.post('/triage', optionalAuth, async (req, res) => {
  req.url = '/analyse-complaint';
  return router.handle(req, res);
});

export default router;

