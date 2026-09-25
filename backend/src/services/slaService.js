/**
 * Centralized SLA Duration & Deadline Management Service
 * Strict SLA mapping:
 * - CRITICAL: 12 Hours
 * - HIGH: 48 Hours
 * - MEDIUM: 48 Hours
 * - LOW: 48 Hours
 */

import cron from 'node-cron';
import { Complaint } from '../models/Complaint.js';

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

/**
 * Database-level atomic SLA breach updater.
 * Operates purely via MongoDB query without loading heavy Mongoose documents into RAM.
 */
export async function checkAndMarkSlaBreaches() {
  try {
    const now = new Date();

    // 1. One-pass query-level correction: Fix any open non-critical tickets whose deadline was set < 24h from creation
    const openNonCriticals = await Complaint.find(
      {
        status: { $nin: ['Resolved', 'Closed', 'RESOLVED', 'CLOSED'] },
        stage: { $ne: 'RESOLVED' },
        priority: { $nin: ['CRITICAL', 'Critical', 'critical'] },
        slaExtendedUntil: { $in: [null, undefined] }
      },
      'createdAt slaDeadline sla_deadline_at'
    ).lean();

    if (openNonCriticals && openNonCriticals.length > 0) {
      const correctionUpdates = [];
      for (const ticket of openNonCriticals) {
        const createdMs = new Date(ticket.createdAt).getTime();
        const currentMs = new Date(ticket.slaDeadline || ticket.sla_deadline_at).getTime();
        if (currentMs - createdMs < 24 * 60 * 60 * 1000) {
          const correctDeadline = new Date(createdMs + 48 * 60 * 60 * 1000);
          correctionUpdates.push(
            Complaint.updateOne(
              { _id: ticket._id },
              {
                $set: {
                  slaDeadline: correctDeadline,
                  sla_deadline_at: correctDeadline,
                  slaTargetHours: 48,
                  sla_hours: 48,
                  is_sla_breached: now > correctDeadline,
                  isSlaBreached: now > correctDeadline
                }
              }
            )
          );
        }
      }
      if (correctionUpdates.length > 0) {
        await Promise.all(correctionUpdates);
        console.log(`[SLA Scheduler] Corrected ${correctionUpdates.length} non-critical ticket(s) with 12h deadline bug to 48h.`);
      }
    }

    // 2. Mark breached tickets
    const result = await Complaint.updateMany(
      {
        status: { $nin: ['Resolved', 'Closed', 'RESOLVED', 'CLOSED'] },
        stage: { $ne: 'RESOLVED' },
        is_sla_breached: false,
        $or: [
          { slaExtendedUntil: { $exists: true, $ne: null, $lt: now } },
          { slaDeadline: { $exists: true, $ne: null, $lt: now } },
          { sla_deadline_at: { $exists: true, $ne: null, $lt: now } }
        ]
      },
      {
        $set: {
          is_sla_breached: true,
          isSlaBreached: true
        }
      }
    );
    if (result && result.modifiedCount > 0) {
      console.log(`[SLA Scheduler] Marked ${result.modifiedCount} ticket(s) as SLA breached.`);
    }
    return result;
  } catch (err) {
    console.error('[SLA Scheduler Error]:', err.message);
  }
}

let slaCronTask = null;
let initialTimeoutHandle = null;

/**
 * Initializes a lightweight scheduled SLA checker (every 15 mins by default)
 * preventing high CPU/memory consumption.
 */
export function initSlaCronJob(cronExpression = '*/15 * * * *') {
  if (slaCronTask) {
    return slaCronTask;
  }

  // Initial check after 5s to allow DB connection to stabilize
  initialTimeoutHandle = setTimeout(() => {
    checkAndMarkSlaBreaches().catch(() => {});
    initialTimeoutHandle = null;
  }, 5000);

  slaCronTask = cron.schedule(cronExpression, async () => {
    await checkAndMarkSlaBreaches();
  });

  console.log(`[SLA Service] Scheduled lightweight SLA checker (${cronExpression}).`);
  return slaCronTask;
}

/**
 * Clears active cron schedule and pending timeouts for graceful shutdown.
 */
export function stopSlaCronJob() {
  if (initialTimeoutHandle) {
    clearTimeout(initialTimeoutHandle);
    initialTimeoutHandle = null;
  }
  if (slaCronTask) {
    slaCronTask.stop();
    slaCronTask = null;
    console.log('[SLA Service] Stopped SLA checker cron schedule.');
  }
}

export default {
  PRIORITY_SLA_HOURS,
  getSlaHours,
  calculateSlaDeadline,
  getSlaDetails,
  checkAndMarkSlaBreaches,
  initSlaCronJob,
  stopSlaCronJob
};

