import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  ShieldAlert, 
  CheckCircle, 
  CheckCircle2, 
  ArrowLeft, 
  RefreshCw, 
  AlertTriangle, 
  RotateCcw,
  FileText,
  Image as ImageIcon,
  Eye,
  Download,
  Scale,
  Paperclip,
  X
} from 'lucide-react';
import FeedbackCard from './FeedbackCard';
import apiClient from '../../api/client';

const STAGES_6 = [
  { key: 'SUBMITTED',            label: '1. Submitted' },
  { key: 'AI_ANALYSED',          label: '2. AI Analysed' },
  { key: 'ASSIGNED',             label: '3. Assigned' },
  { key: 'IN_PROGRESS',          label: '4. In Progress' },
  { key: 'PENDING_VERIFICATION', label: '5. Pending Verify' },
  { key: 'RESOLVED',             label: '6. Resolved' },
];

export default function TicketTracker({ ticketId = '', onBack }) {
  const [complaint, setComplaint] = useState(null);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, isExpired: false });
  const [loading, setLoading] = useState(false);
  const [isAppealModalOpen, setIsAppealModalOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);
  const [appealError, setAppealError] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const fetchTrackerData = async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const data = await apiClient.complaints.track(ticketId);
      setComplaint(data);
    } catch (err) {
      console.warn('API track failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppealSubmit = async (e) => {
    e.preventDefault();
    if (!appealReason.trim()) {
      setAppealError('Please provide detailed remarks explaining why the resolution is unsatisfactory.');
      return;
    }
    setIsSubmittingAppeal(true);
    setAppealError('');
    try {
      const targetId = complaint.id || complaint._id || complaint.ticket_id;
      await apiClient.complaints.appeal(targetId, {
        appealReason: appealReason.trim()
      });
      setIsAppealModalOpen(false);
      setAppealReason('');
      await fetchTrackerData();
    } catch (err) {
      setAppealError(err.message || 'Failed to submit appeal. Please try again.');
    } finally {
      setIsSubmittingAppeal(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      fetchTrackerData();
    }
  }, [ticketId]);

  // Live SLA Countdown decrement (supports original and extended SLA deadline)
  useEffect(() => {
    const deadline = complaint?.slaExtendedUntil || complaint?.sla_deadline_at;
    if (!deadline) return;

    const updateCountdown = () => {
      const target = new Date(deadline).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds, isExpired: false });
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [complaint?.slaExtendedUntil, complaint?.sla_deadline_at]);

  const isReopenedTicket = Boolean(
    complaint?.isReopened ||
    complaint?.status === 'REOPENED' ||
    complaint?.status === 'Reopened'
  );

  const isAppealed = Boolean(
    complaint?.appeal?.isAppealed ||
    complaint?.status === 'APPEALED' ||
    complaint?.status === 'Appealed'
  );

  const appealCycle = complaint?.appeal?.cycle || 
    (Array.isArray(complaint?.appealHistory) ? complaint.appealHistory.length : 0) || 
    (isAppealed ? 1 : 0);

  const getStageIndex = (stage, status) => {
    // If ticket is appealed, stepper resets to Stage 1 (index 0)
    if (status === 'APPEALED' || status === 'Appealed') {
      return 0;
    }
    const target = (stage || status || '').toUpperCase();
    if (target.includes('SUBMIT')) return 0;
    if (target.includes('AI') || target.includes('ANALYSE')) return 1;
    if (target.includes('ASSIGN')) return 2;
    if (target.includes('IN_PROGRESS') || target === 'IN PROGRESS') return 3;
    if (target.includes('VERIF') || target.includes('PENDING')) return 4;
    if (target.includes('RESOLV') || target.includes('CLOSE')) return 5;
    return 0;
  };

  if (!ticketId) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 flex flex-col items-center justify-center gap-4 min-h-[40vh]">
        <button
          onClick={onBack}
          className="self-start flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Desk
        </button>
        <p className="text-sm font-medium text-slate-500">No ticket selected to track. Submit a grievance from the Complaint Desk.</p>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 flex flex-col items-center justify-center gap-4 min-h-[40vh]">
        <button
          onClick={onBack}
          className="self-start flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Desk
        </button>
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm font-medium">Loading ticket {ticketId}...</p>
        </div>
      </div>
    );
  }

  const currentStep = getStageIndex(complaint.stage, complaint.status);
  const isResolved = ['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(complaint.status) || complaint.stage === 'RESOLVED';

  const confidenceScore = complaint.ai_confidence_score || complaint.confidence_score || 95;
  const displayScore = Math.round(confidenceScore > 1 ? confidenceScore : confidenceScore * 100);

  // Extract initial student attachments (excluding resolution proof)
  const validInitialAttachments = (Array.isArray(complaint.attachments) ? complaint.attachments : [])
    .filter(a => a && (a.fileData || a.url || a.fileName))
    .filter(a => {
      const isResProof = complaint.resolutionProof && (
        a.fileName === complaint.resolutionProof?.fileName ||
        a.fileData === complaint.resolutionProof?.fileData ||
        a.fileData === complaint.resolution_proof_url
      );
      return !isResProof;
    });

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">

      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Desk
        </button>

        <button
          onClick={fetchTrackerData}
          disabled={loading}
          className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
          title="Refresh Status"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Official Appeal Under Administrative Arbitration Callout Banner */}
      {isAppealed && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-5 mb-6 text-amber-950 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs flex-shrink-0 mt-0.5">
              <Scale className="w-5 h-5" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2.5 py-1 rounded-lg border border-amber-300 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5" /> Appeal Cycle #{appealCycle} — Resolution Disputed
                </span>
                {complaint.appeal?.appealedAt && (
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5 bg-white/90 px-2.5 py-1 rounded-lg border border-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Appealed On: {new Date(complaint.appeal.appealedAt).toLocaleDateString()} {new Date(complaint.appeal.appealedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm font-bold text-amber-950 leading-relaxed m-0">
                Notice: You have officially contested this department resolution. The grievance workflow has reset to Stage 1 for re-investigation and arbitration.
              </p>

              {complaint.appeal?.reason && (
                <div className="mt-2 p-3 bg-white rounded-xl border border-amber-200 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900 mb-1">
                    <Scale className="w-3.5 h-3.5 text-amber-600" />
                    Your Registered Appeal Remarks:
                  </div>
                  <p className="text-xs text-slate-800 italic leading-normal m-0 pl-5 font-medium">
                    "{complaint.appeal.reason}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Ticket Tracker Header */}
      <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Ticket #{complaint.ticket_id}
              </span>
              <span className="px-2.5 py-1 bg-rose-600 text-white text-xs font-black rounded-full uppercase tracking-wider">
                {complaint.priority} Priority
              </span>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${
                isAppealed
                  ? 'bg-amber-100 text-amber-900 border-amber-300 font-black'
                  : isReopenedTicket 
                  ? 'bg-rose-100 text-rose-800 border-rose-300' 
                  : isResolved
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-blue-50 text-blue-800 border-blue-100'
              }`}>
                {complaint.status}
              </span>

              {appealCycle > 0 && (
                <span className="px-2.5 py-1 bg-amber-500 text-white text-xs font-black rounded-full shadow-xs flex items-center gap-1">
                  <Scale className="w-3 h-3" /> Appeal Cycle #{appealCycle}
                </span>
              )}
            </div>
            <h1 className="text-xl font-black text-slate-900 mt-2">
              "{complaint.title}"
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Category: {complaint.category} • Department: {complaint.assigned_department_name || complaint.department || 'Pending Assignment'}
            </p>
          </div>

          {/* Real-time Live SLA Countdown */}
          <div className={`p-4 rounded-xl shadow-lg border min-w-[210px] text-center ${
            isAppealed
              ? 'bg-amber-950 text-amber-100 border-amber-800/80'
              : isReopenedTicket
              ? 'bg-amber-950 text-amber-100 border-amber-800/80'
              : 'bg-slate-900 text-white border-slate-800'
          }`}>
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1 text-amber-400">
              <Clock className="w-4 h-4 animate-pulse" /> 
              {isAppealed ? 'Appeal Re-investigation SLA' : isReopenedTicket ? 'Extended SLA Countdown' : 'Live SLA Countdown'}
            </div>
            <div className="font-mono text-2xl font-black text-white">
              {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
            </div>
            <span className="text-[10px] text-slate-300 block mt-0.5">
              {timeLeft.isExpired 
                ? 'SLA Deadline Expired' 
                : 'SLA Target Window'}
            </span>
          </div>
        </div>

        {/* 6-Stage Progress Stepper */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            6-Stage Resolution Lifecycle Progression
          </h3>
          {isAppealed ? (
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Scale className="w-3 h-3 text-amber-700" /> Stepper Reset to Stage 1 (Appeal Active)
            </span>
          ) : (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Stage {currentStep + 1} of 6
            </span>
          )}
        </div>

        {/* 6-Step Stepper Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-6">
          {STAGES_6.map((stage, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;

            let badgeStyle = 'bg-slate-50 text-slate-400 border-slate-200';
            if (isCurrent) {
              badgeStyle = isAppealed
                ? 'bg-amber-600 text-white font-black shadow-md border-amber-700 ring-2 ring-amber-300'
                : 'bg-emerald-600 text-white font-black shadow-md border-emerald-700 ring-2 ring-emerald-300';
            } else if (isCompleted) {
              badgeStyle = 'bg-emerald-50 text-emerald-800 font-bold border-emerald-200';
            }

            return (
              <div
                key={stage.key}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${badgeStyle}`}
              >
                <span className="text-[11px] font-extrabold leading-tight">{stage.label}</span>
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : isCurrent ? (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-white/20 px-1.5 py-0.2 rounded text-white">
                    {isAppealed ? 'Re-Opened' : 'Active'}
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-400">Pending</span>
                )}
              </div>
            );
          })}
        </div>

        {/* AI Routing Reasoning Notice */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold block text-emerald-950">AI Routing Decision ({displayScore}% Match):</span>
            <p className="mt-0.5">{complaint.ai_routing_reasoning || 'AI routing engine processed ticket.'}</p>
          </div>
        </div>
      </div>

      {/* Initial Student Attachments Section (Part 2.A: Strict optional & No empty links) */}
      <div className="bg-white rounded-2xl p-6 shadow border border-slate-100 mb-6">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-3">
          <Paperclip className="w-4 h-4 text-slate-500" />
          Initial Student Attachments
        </h3>

        {validInitialAttachments.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-1 m-0">No attachment provided</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {validInitialAttachments.map((att, idx) => {
              const fileName = att.fileName || att.name || `Attachment_${idx + 1}`;
              const fileData = att.fileData || att.url;
              const isPdf = att.fileType?.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    {isPdf ? (
                      <FileText className="w-5 h-5 text-rose-600 flex-shrink-0" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate m-0">
                        {fileName}
                      </p>
                      <span className="text-[10px] text-slate-400 uppercase">
                        {isPdf ? 'PDF File' : 'Image'}
                      </span>
                    </div>
                  </div>

                  {fileData ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewAttachment({ fileName, fileData, isPdf })}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Attachment</span>
                      </button>
                      <a
                        href={fileData}
                        download={fileName}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">No link available</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History & Escalation Timeline Log */}
      {((complaint.timeline && complaint.timeline.length > 0) || (complaint.history && complaint.history.length > 0)) && (
        <div className="bg-white rounded-2xl p-6 shadow border border-slate-100 mb-6">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">Audit & Escalation History</h3>
          <div className="space-y-2">
            {complaint.timeline && complaint.timeline.length > 0 ? (
              complaint.timeline.map((t, idx) => {
                const isAppealItem = t.status === 'APPEALED' || t.status === 'Appealed';
                const isReopenItem = t.status === 'REOPENED' || t.status === 'Reopened';
                return (
                  <div 
                    key={`timeline-${idx}`} 
                    className={`flex items-start gap-3 text-xs p-3 rounded-xl border ${
                      isAppealItem
                        ? 'bg-amber-50/70 border-amber-300'
                        : isReopenItem 
                        ? 'bg-rose-50/70 border-rose-200' 
                        : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    {isAppealItem ? (
                      <Scale className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    ) : isReopenItem ? (
                      <RotateCcw className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">Status: {t.status}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold uppercase">
                          {t.role || 'System'}
                        </span>
                      </div>
                      {t.remarks && <p className="text-slate-600 mt-0.5 font-medium">{t.remarks}</p>}
                      {t.timestamp && (
                        <p className="text-slate-400 text-[10px] mt-0.5">
                          {new Date(t.timestamp).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              complaint.history.map((h, idx) => (
                <div key={`history-${idx}`} className="flex items-start gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800">{h.old_status} → {h.new_status}</span>
                    {h.remarks && <p className="text-slate-500 mt-0.5">{h.remarks}</p>}
                    {h.timestamp && <p className="text-slate-400 text-[10px] mt-0.5">{new Date(h.timestamp).toLocaleString()}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Official Department Resolution Report & Proof */}
      {(complaint.resolutionProof || complaint.resolutionNotes || complaint.resolution_notes || complaint.resolution_proof_url) && (
        <div className="bg-white rounded-2xl p-6 shadow-md border border-emerald-200 mb-6">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-150">
            <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-2 m-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Department Resolution Report & Photo Proof
            </h3>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
              Verified Resolution Proof
            </span>
          </div>

          {(complaint.resolutionNotes || complaint.resolution_notes) && (
            <div className="mb-4 bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-150">
              <span className="text-[11px] font-extrabold text-emerald-900 block mb-1">
                Technician / Staff Remarks:
              </span>
              <p className="text-xs text-slate-800 leading-relaxed m-0 font-medium">
                {complaint.resolutionNotes || complaint.resolution_notes}
              </p>
            </div>
          )}

          {(complaint.resolutionProof || complaint.resolution_proof_url) && (
            <div>
              <span className="text-[11px] font-extrabold text-slate-700 block mb-2">
                Mandatory Resolution Proof Photo / Document:
              </span>
              {(() => {
                const proofObj = typeof complaint.resolutionProof === 'object' && complaint.resolutionProof !== null
                  ? complaint.resolutionProof
                  : {};
                const fileData = proofObj.fileData || complaint.resolution_proof_url || proofObj.url || (typeof complaint.resolutionProof === 'string' ? complaint.resolutionProof : '');
                const fileName = proofObj.fileName || 'Resolution_Proof_Photo';
                const isPdf = proofObj.fileType?.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');

                return (
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      {isPdf ? (
                        <FileText className="w-6 h-6 text-rose-600 flex-shrink-0" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate m-0">
                          {fileName}
                        </p>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">
                          {isPdf ? 'PDF Document' : 'Photo Proof'} • Department Verified
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewAttachment({ fileName, fileData, isPdf })}
                        className="px-3 py-1.5 bg-[#084325] hover:bg-[#06331c] text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Proof</span>
                      </button>
                      {fileData && (
                        <a
                          href={fileData}
                          download={fileName}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer border border-slate-200"
                          title="Download Document"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Student Appeal Action CTA */}
          {isResolved && !isAppealed && !['Closed', 'CLOSED'].includes(complaint.status) && (
            <div className="mt-4 pt-4 border-t border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/40 p-3.5 rounded-xl">
              <div>
                <h4 className="text-xs font-extrabold text-slate-900">Are you dissatisfied with this resolution?</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  If the issue persists or the proof photo does not reflect work completed, file an official appeal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAppealModalOpen(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Appeal / Not Satisfied</span>
              </button>
            </div>
          )}

          {isAppealed && (
            <div className="mt-4 pt-3 border-t border-amber-200 flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-50/80 p-3 rounded-xl">
              <Scale className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Appeal Cycle #{appealCycle} filed. Department re-investigation in progress.</span>
            </div>
          )}
        </div>
      )}

      {/* Resolution Feedback Card */}
      <FeedbackCard
        key={complaint.ticket_id}
        complaintId={complaint.id || complaint._id}
        ticketId={complaint.ticket_id}
        isLocked={!isResolved || isAppealed}
        existingFeedback={complaint.feedback}
        onFeedbackSubmitted={fetchTrackerData}
      />

      {/* Student Appeal Modal Dialog */}
      {isAppealModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-[#084325] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  File Resolution Appeal (Cycle #{appealCycle + 1})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAppealModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAppealSubmit} className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-900 text-xs">
                <p className="font-bold mb-1">Appeal Policy Notice:</p>
                <p className="leading-relaxed">
                  Appealing will reset the grievance progression stepper back to Stage 1 and alert department staff with an active Appeal flag for mandatory re-investigation.
                </p>
              </div>

              {appealError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                  {appealError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reason for Appeal / Unresolved Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder="Explain clearly why the resolution was insufficient, the work was not completed, or why the proof photo is inadequate..."
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAppealModalOpen(false)}
                  disabled={isSubmittingAppeal}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAppeal || !appealReason.trim()}
                  className="px-5 py-2 text-xs font-black text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingAppeal ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Submitting Appeal...
                    </>
                  ) : (
                    <>
                      <Scale className="w-3.5 h-3.5" />
                      Confirm Appeal & Reset Stage
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewAttachment(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 relative z-[10000]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 truncate pr-2">
                {previewAttachment.isPdf ? (
                  <FileText className="w-5 h-5 text-rose-400 flex-shrink-0" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                )}
                <span className="text-sm font-bold truncate">
                  {previewAttachment.fileName}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {previewAttachment.fileData && (
                  <a
                    href={previewAttachment.fileData}
                    download={previewAttachment.fileName}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 flex items-center justify-center bg-slate-100/60 min-h-[300px]">
              {previewAttachment.isPdf ? (
                <div className="text-center p-8 bg-white rounded-xl border border-slate-200 shadow-sm max-w-md">
                  <FileText className="w-16 h-16 text-rose-500 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-slate-800 mb-1">
                    {previewAttachment.fileName}
                  </h4>
                  <p className="text-xs text-slate-500 mb-4">
                    PDF document preview.
                  </p>
                  <div className="flex justify-center gap-3">
                    <a
                      href={previewAttachment.fileData}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
                    >
                      Open in New Tab
                    </a>
                  </div>
                </div>
              ) : previewAttachment.fileData ? (
                <img
                  src={previewAttachment.fileData}
                  alt={previewAttachment.fileName}
                  className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm border border-slate-200 bg-white"
                />
              ) : (
                <p className="text-xs text-slate-400 italic">No valid image preview available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
