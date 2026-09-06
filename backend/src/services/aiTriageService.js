import { GoogleGenAI } from '@google/genai';

const DEPARTMENT_METADATA = {
  CANTEEN: { name: 'Canteen Operations', defaultSla: 4 },
  TRANSPORT: { name: 'Transport Management', defaultSla: 12 },
  HOSTEL: { name: 'Hostel Maintenance', defaultSla: 24 },
  ACADEMIC: { name: 'Academic Affairs', defaultSla: 24 },
  SPORTS: { name: 'Sports & Facilities', defaultSla: 48 },
  HOSPITALITY: { name: 'Campus Hospitality & Security', defaultSla: 24 }
};

const VALID_DEPARTMENTS = ['CANTEEN', 'TRANSPORT', 'HOSTEL', 'SPORTS', 'ACADEMIC', 'HOSPITALITY'];
const VALID_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const CANDIDATE_MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];

/**
 * Intelligent Google Gemini AI Triage Service with Spam & Gibberish Filtering.
 * Evaluates grievance coherence and relevance before classification.
 */
export async function triageComplaint({ title = '', description = '', category_hint = '' }) {
  console.log('[Gemini AI] Live triage requested for:', title || 'Untitled grievance');

  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';

  if (!apiKey || apiKey.length < 10) {
    console.error('[Gemini AI] Missing or invalid GEMINI_API_KEY in environment.');
    const err = new Error('Gemini AI Analysis Service Unavailable: Missing GEMINI_API_KEY');
    err.status = 500;
    throw err;
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are the chief AI triage officer for CMS College of Engineering (CMSCE).
Evaluate the following student complaint text for relevance, coherence, and institutional validity:
Title: ${title}
Description: ${description}
${category_hint ? `Category Hint: ${category_hint}` : ''}

Strict Evaluation Rules:
1. FIRST, evaluate whether the complaint text represents a coherent, legitimate campus-related problem or inquiry.
2. If the text is keyboard mash (e.g., "asdfghjk", "qwertyyy", "zxcvbnm"), random letters, nonsense strings, test submissions (e.g., "test 123", "hello test"), offensive spam, or completely unrelated to college affairs:
   Return ONLY:
   {
     "isValid": false,
     "department": "NONE",
     "category": "Invalid Submission",
     "priority": "LOW",
     "confidenceScore": 0.05,
     "reasoning": "The provided text does not contain a coherent or actionable campus grievance. Please provide specific details."
   }

3. If it IS a coherent, legitimate campus grievance:
   - "isValid": true
   - "department": Choose the exact matching department from: ["CANTEEN", "TRANSPORT", "HOSTEL", "SPORTS", "ACADEMIC", "HOSPITALITY"].
     * CANTEEN: Food quality, mess hygiene, kitchen contamination, dining hall amenities.
     * TRANSPORT: College bus fleet, route delays, driver conduct, boarding points.
     * HOSTEL: Room facilities, plumbing, electricity, washrooms, water heaters/geysers, cleanliness.
     * ACADEMIC: Examinations, grading, classroom audio-visuals, professors, lectures, syllabus.
     * SPORTS: Athletic grounds, gymnasium, sports equipment, indoor stadium.
     * HOSPITALITY: Campus safety, visitor services, perimeter security, general maintenance.
   - "priority": Choose one of: ["CRITICAL", "HIGH", "MEDIUM", "LOW"].
     * CRITICAL: Immediate physical danger, severe health risks, contamination in food/water, electrical hazard.
     * HIGH: Urgent service breakdown (geysers, leaking pipes, broken buses before exams).
     * MEDIUM: Routine operational delays, minor quality degradation, normal maintenance.
     * LOW: Non-urgent equipment replenishment, cosmetic issues.
   - "category": Concise descriptive category name (e.g., "Food Safety & Quality", "Hostel Infrastructure", "Transit Delay").
   - "confidenceScore": Dynamic float between 0.75 and 0.99 reflecting the clarity and specificity of the grievance.
   - "reasoning": Exactly 1 to 2 short, punchy, contextual sentences explaining why this specific problem was routed to that department. Do NOT use generic templates.

Return ONLY a strict JSON object matching the schema above.`;

  let lastError = null;
  let rawResponseText = null;

  // Attempt generation with available Gemini models in candidate order with retry on 503
  for (const modelName of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });

        if (response && response.text) {
          rawResponseText = response.text.trim();
          break;
        }
      } catch (modelErr) {
        lastError = modelErr;
        console.warn(`[Gemini AI] Model ${modelName} (attempt ${attempt + 1}) failed:`, modelErr.message);
        if (attempt === 0 && modelErr.status === 503) {
          // Brief pause on 503 transient spike
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }
    if (rawResponseText) break;
  }

  if (!rawResponseText) {
    console.error('[Gemini AI] All Gemini candidate models failed to produce a response:', lastError?.message);
    const err = new Error(`Gemini AI Analysis Service Unavailable: ${lastError?.message || 'API generation failed'}`);
    err.status = 500;
    throw err;
  }

  // Log live raw Gemini response to console
  console.log('[Gemini AI] Live Raw Gemini Response:', rawResponseText);

  let parsed = null;
  try {
    parsed = JSON.parse(rawResponseText);
  } catch (parseErr) {
    const cleaned = rawResponseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  }

  // Handle Gibberish / Non-Grievance submissions
  const isSubmissionValid = parsed.isValid !== false && (parsed.department || '').toUpperCase().trim() !== 'NONE';

  if (!isSubmissionValid) {
    return {
      isValid: false,
      department: 'NONE',
      assigned_dept_code: 'NONE',
      department_name: 'Unassigned',
      category: parsed.category || 'Invalid Submission',
      priority: 'LOW',
      confidenceScore: 0.05,
      confidence_score: 0.05,
      ai_confidence_score: 5.0,
      reasoning: parsed.reasoning || 'The provided text does not contain a coherent or actionable campus grievance. Please provide specific details.',
      sla_hours: 24
    };
  }

  // Valid grievance processing
  const deptCode = (parsed.department || parsed.assigned_dept_code || 'CANTEEN').toUpperCase().trim();
  const validDept = VALID_DEPARTMENTS.includes(deptCode) ? deptCode : 'CANTEEN';
  const priority = (parsed.priority || 'MEDIUM').toUpperCase().trim();
  const validPriority = VALID_PRIORITIES.includes(priority) ? priority : 'MEDIUM';

  const rawScore = Number(parsed.confidenceScore ?? parsed.ai_confidence_score);
  const normalizedDecimalScore = !isNaN(rawScore)
    ? (rawScore > 1 ? Number((rawScore / 100).toFixed(2)) : Number(rawScore.toFixed(2)))
    : 0.95;
  const normalizedPercentageScore = Number((normalizedDecimalScore * 100).toFixed(1));

  const slaHours = validPriority === 'CRITICAL'
    ? 4
    : (DEPARTMENT_METADATA[validDept]?.defaultSla || 24);

  return {
    isValid: true,
    category: parsed.category || 'Institutional Grievance',
    assigned_dept_code: validDept,
    department: validDept,
    department_name: DEPARTMENT_METADATA[validDept].name,
    priority: validPriority,
    confidenceScore: normalizedDecimalScore,
    confidence_score: normalizedDecimalScore,
    ai_confidence_score: normalizedPercentageScore,
    reasoning: parsed.reasoning ? parsed.reasoning.trim() : 'AI triage categorized the grievance based on severity and operational scope.',
    sla_hours: slaHours
  };
}
