import { GoogleGenAI } from '@google/genai';
import { getSlaHours } from './slaService.js';

const DEPARTMENT_METADATA = {
  CANTEEN: { name: 'Canteen Operations', defaultSla: 4, category: 'Food Safety & Mess Facilities' },
  TRANSPORT: { name: 'Transport Management', defaultSla: 12, category: 'Transit & Bus Fleet' },
  HOSTEL: { name: 'Hostel Maintenance', defaultSla: 24, category: 'Hostel Facilities & Infrastructure' },
  ACADEMIC: { name: 'Academic Affairs', defaultSla: 24, category: 'Academic Operations & Curriculum' },
  SPORTS: { name: 'Sports & Facilities', defaultSla: 48, category: 'Sports & Athletic Facilities' },
  HOSPITALITY: { name: 'Campus Hospitality & Security', defaultSla: 24, category: 'Campus Security & General Services' }
};

const VALID_DEPARTMENTS = ['CANTEEN', 'TRANSPORT', 'HOSTEL', 'SPORTS', 'ACADEMIC', 'HOSPITALITY'];
const VALID_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// Models ordered with working latest endpoints first
const CANDIDATE_MODELS = [
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-flash-lite-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
];

const DEPT_KEYWORDS = {
  CANTEEN: [
    'food', 'mess', 'canteen', 'lunch', 'dinner', 'breakfast', 'meal', 'meals', 'snack', 'snacks',
    'tea', 'coffee', 'curry', 'rice', 'roti', 'chapati', 'dosa', 'sambar', 'dining', 'kitchen',
    'hygiene', 'caterer', 'catering', 'tiffin', 'taste', 'stale', 'spoiled', 'insect', 'cockroach',
    'hair', 'uncooked', 'raw', 'utensil', 'plate', 'drinking water', 'dirty water', 'water cooler', 'menu'
  ],
  TRANSPORT: [
    'bus', 'buses', 'transport', 'route', 'driver', 'conductor', 'van', 'shuttle', 'pickup',
    'drop', 'trip', 'commute', 'boarding', 'bus stop', 'stop', 'fare', 'punctual', 'punctuality',
    'rash driving', 'speeding', 'breakdown', 'bus pass', 'seat', 'traffic', 'vehicle', 'late bus', 'driver conduct'
  ],
  HOSTEL: [
    'hostel', 'room', 'warden', 'dorm', 'dormitory', 'plumbing', 'tap', 'pipe', 'water',
    'washroom', 'bathroom', 'toilet', 'geyser', 'hot water', 'cold water', 'leakage', 'leak',
    'seepage', 'fan', 'tubelight', 'light', 'socket', 'switch', 'power cut', 'electricity',
    'bed', 'cot', 'mattress', 'cupboard', 'wardrobe', 'roommate', 'block', 'wing',
    'cleanliness', 'cleaning', 'dustbin', 'pest', 'mosquito', 'heater'
  ],
  ACADEMIC: [
    'exam', 'examination', 'marks', 'grade', 'grading', 'internal', 'internals', 'semester',
    'result', 'results', 'professor', 'faculty', 'hod', 'teacher', 'staff', 'lecture', 'class',
    'period', 'syllabus', 'curriculum', 'attendance', 'hall ticket', 'lab', 'laboratory',
    'practical', 'computer', 'projector', 'course', 'assignment', 'revaluation', 'timetable'
  ],
  SPORTS: [
    'sport', 'sports', 'gym', 'gymnasium', 'fitness', 'cricket', 'football', 'volleyball',
    'basketball', 'badminton', 'tennis', 'table tennis', 'ground', 'court', 'field', 'track',
    'athletics', 'tournament', 'match', 'kit', 'jersey', 'coach', 'ball', 'balls', 'equipment', 'stadium'
  ],
  HOSPITALITY: [
    'hospitality', 'security', 'guard', 'guards', 'gate', 'main gate', 'visitor', 'visitors',
    'guest', 'parking', 'id card', 'lost', 'found', 'theft', 'stolen', 'camera', 'cctv',
    'campus safety', 'night', 'lighting', 'streetlight', 'perimeter', 'fence', 'harassment',
    'cleanliness', 'trash', 'gardening', 'safety', 'restroom', 'sanitation'
  ]
};

const CRITICAL_KEYWORDS = [
  'danger', 'dangerous', 'emergency', 'electric shock', 'sparking', 'short circuit',
  'fire', 'gas leak', 'poison', 'poisoning', 'food poisoning', 'contaminated',
  'hospital', 'hospitalized', 'injury', 'injured', 'bleeding', 'severe hazard', 'life threatening'
];

const HIGH_KEYWORDS = [
  'urgent', 'urgently', 'immediately', 'broken', 'overflowing', 'burst',
  'no water', 'power outage', 'blackout', 'exam tomorrow', 'delay', 'delayed',
  'rash driving', 'threat', 'harassment', 'stuck', 'failure', 'spoiled', 'not working'
];

const LOW_KEYWORDS = [
  'cosmetic', 'minor', 'request', 'suggestion', 'inquiry', 'slow', 'feedback', 'update'
];

/**
 * Intelligent Rule-Based Fallback Classifier
 * Evaluates grievance keywords to guarantee triage never fails even if Gemini is down.
 */
export function getHeuristicTriage({ title = '', description = '', category_hint = '' }) {
  const combined = `${title} ${description} ${category_hint}`.toLowerCase().trim();

  // Basic Gibberish / Incoherence Detection
  const cleanedText = combined.replace(/[^a-z0-9]/gi, '');
  const hasRepeatingLetters = /(.)\1{4,}/.test(cleanedText);
  const isKeyboardMash = /^[bcdfghjklmnpqrstvwxyz]{6,}$/i.test(cleanedText);
  const isTooShort = combined.length < 5;

  if (isTooShort || hasRepeatingLetters || isKeyboardMash) {
    return {
      isValid: false,
      department: 'NONE',
      assigned_dept_code: 'NONE',
      department_name: 'Unassigned',
      category: 'Invalid Submission',
      priority: 'LOW',
      confidenceScore: 0.10,
      confidence_score: 0.10,
      ai_confidence_score: 10.0,
      reasoning: 'The text does not contain sufficient details or coherent information regarding a campus grievance. Please describe the specific issue.',
      sla_hours: 24,
      is_fallback: true
    };
  }

  // Check Category Hint first
  let assignedDept = null;
  const hintUpper = (category_hint || '').toUpperCase();
  for (const dept of VALID_DEPARTMENTS) {
    if (hintUpper.includes(dept)) {
      assignedDept = dept;
      break;
    }
  }

  // Score departments by keyword occurrences
  if (!assignedDept) {
    let highestScore = 0;
    let bestDept = 'CANTEEN';

    for (const [dept, keywords] of Object.entries(DEPT_KEYWORDS)) {
      let score = 0;
      const lowerTitle = title.toLowerCase();
      const lowerDesc = description.toLowerCase();

      for (const kw of keywords) {
        if (lowerTitle.includes(kw)) score += 3; // Title match has high weight
        if (lowerDesc.includes(kw)) score += 1;
      }

      if (score > highestScore) {
        highestScore = score;
        bestDept = dept;
      }
    }

    // Default to best match or fallback to general department
    assignedDept = highestScore > 0 ? bestDept : 'HOSPITALITY';
  }

  // Priority Evaluation
  let priority = 'MEDIUM';
  if (CRITICAL_KEYWORDS.some((kw) => combined.includes(kw))) {
    priority = 'CRITICAL';
  } else if (HIGH_KEYWORDS.some((kw) => combined.includes(kw))) {
    priority = 'HIGH';
  } else if (LOW_KEYWORDS.some((kw) => combined.includes(kw))) {
    priority = 'LOW';
  }

  const deptMeta = DEPARTMENT_METADATA[assignedDept] || DEPARTMENT_METADATA.HOSPITALITY;
  const slaHours = getSlaHours(priority);

  return {
    isValid: true,
    category: deptMeta.category || 'Institutional Grievance',
    assigned_dept_code: assignedDept,
    department: assignedDept,
    department_code: assignedDept,
    department_name: deptMeta.name,
    priority: priority,
    confidenceScore: 0.88,
    confidence_score: 0.88,
    ai_confidence_score: 88.0,
    reasoning: `Routed to ${deptMeta.name} (${priority} Priority) via institutional triage heuristics.`,
    ai_routing_reasoning: `Routed to ${deptMeta.name} (${priority} Priority) via institutional triage heuristics.`,
    sla_hours: slaHours,
    is_fallback: true
  };
}

/**
 * Intelligent Google Gemini AI Triage Service with Spam & Gibberish Filtering.
 * Evaluates grievance coherence and relevance before classification.
 * Always falls back gracefully to rule-based heuristics if Gemini encounters errors.
 */
export async function triageComplaint({ title = '', description = '', category_hint = '' }) {
  console.log('[Gemini AI] Live triage requested for:', title || 'Untitled grievance');

  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';

  // If no API key or key is invalid, seamlessly fallback to rule-based triage
  if (!apiKey || apiKey.length < 10) {
    console.warn('[Gemini AI] GEMINI_API_KEY missing or inactive. Falling back to institutional heuristics.');
    return getHeuristicTriage({ title, description, category_hint });
  }

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

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Attempt generation with available Gemini models in candidate order
    for (const modelName of CANDIDATE_MODELS) {
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
          console.log(`[Gemini AI] Successfully triaged using model ${modelName}`);
          break;
        }
      } catch (modelErr) {
        lastError = modelErr;
        console.warn(`[Gemini AI] Model ${modelName} call failed:`, modelErr.message?.slice(0, 120));
      }
    }
  } catch (initErr) {
    lastError = initErr;
    console.warn('[Gemini AI] Client initialization error:', initErr.message);
  }

  // Graceful Fallback if all Gemini models fail or response is empty
  if (!rawResponseText) {
    console.warn('[Gemini AI] All candidate models failed or unavailable. Falling back to rule-based triage classifier:', lastError?.message);
    return getHeuristicTriage({ title, description, category_hint });
  }

  // Parse response
  let parsed = null;
  try {
    parsed = JSON.parse(rawResponseText);
  } catch (parseErr) {
    try {
      const cleaned = rawResponseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (_) {
      console.warn('[Gemini AI] JSON parse failed, utilizing heuristic classifier.');
      return getHeuristicTriage({ title, description, category_hint });
    }
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

  const slaHours = getSlaHours(validPriority);

  return {
    isValid: true,
    category: parsed.category || DEPARTMENT_METADATA[validDept]?.category || 'Institutional Grievance',
    assigned_dept_code: validDept,
    department: validDept,
    department_code: validDept,
    department_name: DEPARTMENT_METADATA[validDept]?.name || validDept,
    priority: validPriority,
    confidenceScore: normalizedDecimalScore,
    confidence_score: normalizedDecimalScore,
    ai_confidence_score: normalizedPercentageScore,
    reasoning: parsed.reasoning ? parsed.reasoning.trim() : `AI triage categorized the grievance under ${DEPARTMENT_METADATA[validDept]?.name}.`,
    ai_routing_reasoning: parsed.reasoning ? parsed.reasoning.trim() : `AI triage categorized the grievance under ${DEPARTMENT_METADATA[validDept]?.name}.`,
    sla_hours: slaHours,
    is_fallback: false
  };
}

