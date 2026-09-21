/**
 * Centralized SLA Duration & Deadline Management Service
 * Strict SLA mapping:
 * - CRITICAL: 12 Hours
 * - HIGH: 48 Hours
 * - MEDIUM: 48 Hours
 * - LOW: 48 Hours
 */

export const PRIORITY_SLA_HOURS = {
  CRITICAL: 12,
  HIGH: 48,
  MEDIUM: 48,
  LOW: 48
};

/**
 * Returns the exact SLA hours for a given complaint priority.
 * @param {string} priority - 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
 * @returns {number} 12 for CRITICAL, 48 for all other priorities
 */
export function getSlaHours(priority = 'MEDIUM') {
  const p = (priority || 'MEDIUM').toUpperCase().trim();
  return p === 'CRITICAL' ? PRIORITY_SLA_HOURS.CRITICAL : PRIORITY_SLA_HOURS.MEDIUM;
}

/**
 * Calculates the exact SLA deadline date.
 * Timestamp = new Date(Date.now() + hours * 60 * 60 * 1000)
 * @param {number} hours - SLA duration in hours
 * @param {Date|number|string} [baseTime=Date.now()] - Base start timestamp
 * @returns {Date}
 */
export function calculateSlaDeadline(hours, baseTime = Date.now()) {
  const startTime = baseTime ? new Date(baseTime).getTime() : Date.now();
  return new Date(startTime + hours * 60 * 60 * 1000);
}

/**
 * Computes both SLA hours and deadline for a complaint.
 * @param {string} priority - Grievance priority
 * @param {Date|number|string} [baseTime=Date.now()]
 * @returns {{ hours: number, slaDeadline: Date }}
 */
export function getSlaDetails(priority = 'MEDIUM', baseTime = Date.now()) {
  const hours = getSlaHours(priority);
  const slaDeadline = calculateSlaDeadline(hours, baseTime);
  return { hours, slaDeadline };
}

export default {
  PRIORITY_SLA_HOURS,
  getSlaHours,
  calculateSlaDeadline,
  getSlaDetails
};
