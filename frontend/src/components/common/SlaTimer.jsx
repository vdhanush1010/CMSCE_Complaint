import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

/**
 * Real-Time Live SLA Countdown Timer
 * SLA Rules:
 * - CRITICAL: 12 Hours
 * - HIGH / MEDIUM / LOW: 48 Hours
 * Target timestamp: slaDeadline = new Date(createdAt.getTime() + targetHours * 3600000)
 */
export default function SlaTimer({
  complaint,
  deadline: explicitDeadline,
  createdAt: explicitCreatedAt,
  priority: explicitPriority,
  status: explicitStatus,
  compact = false,
  showSeconds = false,
  onBreachStateChange
}) {
  const comp = complaint || {};
  const status = (comp.status || explicitStatus || '').toUpperCase();
  const priority = (comp.priority || explicitPriority || 'MEDIUM').toUpperCase();
  const isResolved = status === 'RESOLVED' || comp.stage === 'RESOLVED';
  const isClosed = status === 'CLOSED';

  // SLA duration determination: Strictly 12h for CRITICAL, 48h for all other priorities
  const targetHours = priority === 'CRITICAL' ? 12 : 48;

  // Resolve target deadline timestamp
  const getTargetDeadline = () => {
    if (explicitDeadline) return new Date(explicitDeadline).getTime();
    if (comp.slaExtendedUntil) return new Date(comp.slaExtendedUntil).getTime();
    if (comp.slaDeadline) return new Date(comp.slaDeadline).getTime();
    if (comp.sla_deadline_at) return new Date(comp.sla_deadline_at).getTime();

    const createdTime = explicitCreatedAt || comp.createdAt;
    if (createdTime) {
      return new Date(createdTime).getTime() + targetHours * 3600000;
    }
    return Date.now() + targetHours * 3600000;
  };

  const [timeState, setTimeState] = useState(() => {
    const target = getTargetDeadline();
    const now = Date.now();
    const diff = target - now;
    return {
      diff,
      isBreached: diff < 0 && !isResolved && !isClosed,
      hours: Math.floor(Math.abs(diff) / 3600000),
      minutes: Math.floor((Math.abs(diff) % 3600000) / 60000),
      seconds: Math.floor((Math.abs(diff) % 60000) / 1000)
    };
  });

  useEffect(() => {
    // If ticket is already resolved or closed, freeze timer
    if (isResolved || isClosed) return;

    const calculateTime = () => {
      const target = getTargetDeadline();
      const now = Date.now();
      const diff = target - now;
      const breached = diff < 0;

      const newState = {
        diff,
        isBreached: breached,
        hours: Math.floor(Math.abs(diff) / 3600000),
        minutes: Math.floor((Math.abs(diff) % 3600000) / 60000),
        seconds: Math.floor((Math.abs(diff) % 60000) / 1000)
      };

      setTimeState(newState);

      if (onBreachStateChange) {
        onBreachStateChange(breached);
      }
    };

    calculateTime();
    // Update every 1 second for live real-time countdown precision
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [
    explicitDeadline,
    comp.slaExtendedUntil,
    comp.slaDeadline,
    comp.sla_deadline_at,
    comp.createdAt,
    explicitCreatedAt,
    status,
    isResolved,
    isClosed
  ]);

  // 1. If RESOLVED: Freeze timer & render "Resolved within SLA"
  if (isResolved) {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
          <span>Resolved within SLA</span>
        </span>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black shadow-xs">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <span>Resolved within SLA</span>
      </div>
    );
  }

  // 2. If CLOSED: Freeze timer & render "Closed"
  if (isClosed) {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
          <Lock className="w-3 h-3 text-slate-500 flex-shrink-0" />
          <span>Closed</span>
        </span>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-black">
        <Lock className="w-4 h-4 text-slate-500" />
        <span>Grievance Closed</span>
      </div>
    );
  }

  // 3. If Overdue / Breached: Flashing Red badge: SLA BREACHED (-Xh Xm)
  if (timeState.isBreached) {
    const overdueLabel = `-${timeState.hours}h ${timeState.minutes}m`;

    if (compact) {
      return (
        <div className="flex flex-col">
          <span 
            className="inline-flex items-center gap-1 text-[11px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-md shadow-xs animate-pulse border border-rose-700"
            title={`SLA Target Breached by ${timeState.hours}h ${timeState.minutes}m`}
          >
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            <span>SLA BREACHED ({overdueLabel})</span>
          </span>
          <span className="text-[9px] text-rose-600 font-bold mt-0.5">
            {priority === 'CRITICAL' ? '12h Target Expired' : '48h Target Expired'}
          </span>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-rose-600 text-white border-2 border-rose-700 rounded-xl text-xs font-black shadow-md animate-pulse">
        <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0" />
        <span>SLA BREACHED ({overdueLabel})</span>
        <span className="text-[10px] opacity-80 pl-1 border-l border-white/30 font-semibold">
          {priority === 'CRITICAL' ? '12h Max' : '48h Max'}
        </span>
      </div>
    );
  }

  // 4. Active & In-Progress: Dynamic remaining countdown
  const isWarning = timeState.hours <= 3;
  const timeDisplay = showSeconds
    ? `${timeState.hours}h ${timeState.minutes}m ${timeState.seconds}s`
    : `${timeState.hours}h ${timeState.minutes}m left`;

  if (compact) {
    return (
      <div className="flex flex-col">
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
          isWarning
            ? 'bg-amber-50 text-amber-800 border-amber-300'
            : 'bg-slate-50 text-slate-700 border-slate-200'
        }`}>
          <Clock className={`w-3 h-3 ${isWarning ? 'text-amber-600 animate-pulse' : 'text-slate-500'}`} />
          <span>{timeDisplay}</span>
        </span>
        <span className="text-[9px] text-slate-400 font-medium mt-0.5">
          {priority === 'CRITICAL' ? '12h SLA Window' : '48h SLA Window'}
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black border shadow-xs ${
      isWarning
        ? 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-200'
        : 'bg-emerald-50 text-emerald-900 border-emerald-200'
    }`}>
      <Clock className={`w-4 h-4 ${isWarning ? 'text-amber-600 animate-pulse' : 'text-emerald-600'}`} />
      <span>{timeDisplay}</span>
      <span className="text-[10px] text-slate-500 font-semibold pl-1.5 border-l border-slate-300">
        {priority === 'CRITICAL' ? '12h Target' : '48h Target'}
      </span>
    </div>
  );
}
