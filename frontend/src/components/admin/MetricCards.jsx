import React, { useState, useEffect } from 'react';
import { Ticket, AlertTriangle, Clock, Activity, ArrowUp, ArrowDown, CheckCircle } from 'lucide-react';
import apiClient from '../../api/client';

export default function MetricCards({ token, activeKpiFilter = null, onSelectKpiFilter }) {
  const [metrics, setMetrics] = useState({
    total_open_tickets: 0,
    critical_escalations: 0,
    sla_breaches: 0,
    avg_resolution_time_hours: 4.2
  });
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const data = await apiClient.admin.getDashboardMetrics();
      if (data) {
        setMetrics(data);
      }
    } catch (err) {
      console.warn('Metrics fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, [token]);

  const handleCardClick = (filterType) => {
    if (!onSelectKpiFilter) return;
    // Toggle filter: if already active, clear; otherwise select
    if (activeKpiFilter === filterType) {
      onSelectKpiFilter(null);
    } else {
      onSelectKpiFilter(filterType);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1600px] mx-auto px-6 py-6">
      
      {/* 1. Total Open Tickets (Filter: OPEN) */}
      <div 
        onClick={() => handleCardClick('OPEN')}
        role="button"
        tabIndex={0}
        aria-pressed={activeKpiFilter === 'OPEN'}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick('OPEN'); } }}
        className={`bg-white rounded-xl border p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer select-none group relative overflow-hidden ${
          activeKpiFilter === 'OPEN'
            ? 'ring-2 ring-brand-green ring-offset-2 border-brand-green shadow-md bg-emerald-50/30 -translate-y-0.5'
            : 'border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 hover:-translate-y-0.5'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-600 uppercase tracking-wider group-hover:text-emerald-800 transition-colors">
              Total Open Tickets
            </span>
          </div>
          <div className={`p-2 rounded-lg transition-colors ${activeKpiFilter === 'OPEN' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
            <Ticket className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {loading ? '...' : metrics.total_open_tickets}
            </span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              <ArrowUp className="h-3 w-3" />
              Live DB
            </span>
          </div>

          {activeKpiFilter === 'OPEN' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-green bg-emerald-100/90 px-2 py-0.5 rounded-full">
              <CheckCircle className="h-3 w-3" />
              Filter Active
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 group-hover:text-emerald-700 transition-colors font-medium">
              Click to filter
            </span>
          )}
        </div>
      </div>

      {/* 2. Critical Escalations (Filter: CRITICAL) */}
      <div 
        onClick={() => handleCardClick('CRITICAL')}
        role="button"
        tabIndex={0}
        aria-pressed={activeKpiFilter === 'CRITICAL'}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick('CRITICAL'); } }}
        className={`bg-white rounded-xl border p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer select-none group relative overflow-hidden border-l-4 border-l-rose-600 ${
          activeKpiFilter === 'CRITICAL'
            ? 'ring-2 ring-rose-600 ring-offset-2 border-rose-600 shadow-md bg-rose-50/30 -translate-y-0.5'
            : 'border-slate-200 shadow-sm hover:shadow-md hover:border-rose-300 hover:-translate-y-0.5'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-600 uppercase tracking-wider group-hover:text-rose-700 transition-colors">
            Critical Escalations
          </span>
          <div className={`p-2 rounded-lg transition-colors ${activeKpiFilter === 'CRITICAL' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600'}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <div>
            <span className="text-3xl font-extrabold text-slate-900">
              {loading ? '...' : metrics.critical_escalations}
            </span>
            <p className="text-xs font-medium text-rose-600 mt-1 flex items-center gap-1">
              Requires immediate action
            </p>
          </div>

          {activeKpiFilter === 'CRITICAL' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full self-end">
              <CheckCircle className="h-3 w-3" />
              Filter Active
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 group-hover:text-rose-600 transition-colors font-medium self-end">
              Click to filter
            </span>
          )}
        </div>
      </div>

      {/* 3. SLA Breaches (Filter: BREACHED) */}
      <div 
        onClick={() => handleCardClick('BREACHED')}
        role="button"
        tabIndex={0}
        aria-pressed={activeKpiFilter === 'BREACHED'}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick('BREACHED'); } }}
        className={`bg-white rounded-xl border p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer select-none group relative overflow-hidden border-l-4 border-l-amber-500 ${
          activeKpiFilter === 'BREACHED'
            ? 'ring-2 ring-amber-500 ring-offset-2 border-amber-500 shadow-md bg-amber-50/30 -translate-y-0.5'
            : 'border-slate-200 shadow-sm hover:shadow-md hover:border-amber-300 hover:-translate-y-0.5'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-600 uppercase tracking-wider group-hover:text-amber-700 transition-colors">
            SLA Breaches
          </span>
          <div className={`p-2 rounded-lg transition-colors ${activeKpiFilter === 'BREACHED' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600'}`}>
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <div>
            <span className="text-3xl font-extrabold text-slate-900">
              {loading ? '...' : metrics.sla_breaches}
            </span>
            <p className="text-xs font-medium text-amber-600 mt-1">
              Overdue tickets
            </p>
          </div>

          {activeKpiFilter === 'BREACHED' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full self-end">
              <CheckCircle className="h-3 w-3" />
              Filter Active
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 group-hover:text-amber-600 transition-colors font-medium self-end">
              Click to filter
            </span>
          )}
        </div>
      </div>

      {/* 4. Avg. Resolution Time (Filter: RESOLVED) */}
      <div 
        onClick={() => handleCardClick('RESOLVED')}
        role="button"
        tabIndex={0}
        aria-pressed={activeKpiFilter === 'RESOLVED'}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick('RESOLVED'); } }}
        className={`bg-white rounded-xl border p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer select-none group relative overflow-hidden ${
          activeKpiFilter === 'RESOLVED'
            ? 'ring-2 ring-blue-600 ring-offset-2 border-blue-600 shadow-md bg-blue-50/30 -translate-y-0.5'
            : 'border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 hover:-translate-y-0.5'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-600 uppercase tracking-wider group-hover:text-blue-700 transition-colors">
            Avg. Resolution Time
          </span>
          <div className={`p-2 rounded-lg transition-colors ${activeKpiFilter === 'RESOLVED' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'}`}>
            <Activity className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {loading ? '...' : `${metrics.avg_resolution_time_hours}h`}
            </span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
              <ArrowDown className="h-3 w-3" />
              Resolved
            </span>
          </div>

          {activeKpiFilter === 'RESOLVED' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
              <CheckCircle className="h-3 w-3" />
              Filter Active
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 group-hover:text-blue-700 transition-colors font-medium">
              Click to filter
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
