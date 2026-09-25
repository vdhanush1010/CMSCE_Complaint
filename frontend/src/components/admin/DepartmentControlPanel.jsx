import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Award, 
  ArrowRightLeft, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Loader2, 
  Eye, 
  Download, 
  Paperclip, 
  Image as ImageIcon, 
  Lock, 
  ShieldAlert,
  ShieldCheck,
  Clock,
  RotateCcw,
  UploadCloud,
  Scale,
  Star,
  User,
  Calendar
} from 'lucide-react';
import { apiClient } from '../../api/client';
import SlaTimer from '../common/SlaTimer';

export const getRealResolutionProof = (comp) => {
  if (!comp) return null;
  const p = comp.resolutionProof;
  const u = comp.resolution_proof_url;
  if (p && typeof p === 'object') {
    const fileData = p.fileData || p.url || '';
    if (fileData && typeof fileData === 'string' && fileData.trim().length > 0) {
      return {
        fileName: p.fileName || 'Resolution Proof Photo',
        fileData: fileData.trim(),
        fileType: p.fileType || (fileData.startsWith('data:application/pdf') || p.fileName?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        fileSize: p.fileSize || 0
      };
    }
  }
  if (p && typeof p === 'string' && p.trim().length > 0) {
    return {
      fileName: 'Resolution Proof Photo',
      fileData: p.trim(),
      fileType: p.startsWith('data:application/pdf') || p.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      fileSize: 0
    };
  }
  if (u && typeof u === 'string' && u.trim().length > 0) {
    return {
      fileName: 'Resolution Proof Photo',
      fileData: u.trim(),
      fileType: u.startsWith('data:application/pdf') || u.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      fileSize: 0
    };
  }
  return null;
};

const STAGES_6 = [
  { key: 'SUBMITTED',            label: '1. Submitted' },
  { key: 'AI_ANALYSED',          label: '2. AI Analysed' },
  { key: 'ASSIGNED',             label: '3. Assigned' },
  { key: 'IN_PROGRESS',          label: '4. In Progress' },
  { key: 'PENDING_VERIFICATION', label: '5. Pending Verify' },
  { key: 'RESOLVED',             label: '6. Resolved' },
];

const NEXT_STAGE_MAP = {
  'SUBMITTED':            { next: 'AI_ANALYSED',          label: 'Confirm AI Analysis → Move to AI Analysed' },
  'AI_ANALYSED':          { next: 'ASSIGNED',             label: 'Assign Technician → Move to Assigned' },
  'ASSIGNED':             { next: 'IN_PROGRESS',          label: 'Start Work → Move to In Progress' },
  'IN_PROGRESS':          { next: 'PENDING_VERIFICATION', label: 'Work Finished → Move to Pending Verification' },
  'PENDING_VERIFICATION': { next: 'RESOLVED',             label: 'Verify & Mark as Resolved' },
};

const STATUS_STYLES = {
  'Submitted':                       'bg-slate-100 text-slate-700 border-slate-300',
  'SUBMITTED':                       'bg-slate-100 text-slate-700 border-slate-300',
  'AI Analysed':                     'bg-indigo-100 text-indigo-800 border-indigo-300',
  'AI_ANALYSED':                     'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Assigned':                        'bg-blue-100 text-blue-800 border-blue-300',
  'ASSIGNED':                        'bg-blue-100 text-blue-800 border-blue-300',
  'In Progress':                     'bg-amber-100 text-amber-800 border-amber-300',
  'IN_PROGRESS':                     'bg-amber-100 text-amber-800 border-amber-300',
  'Resolution Pending Verification': 'bg-orange-100 text-orange-800 border-orange-300',
  'PENDING_VERIFICATION':            'bg-orange-100 text-orange-800 border-orange-300',
  'Resolved':                        'bg-emerald-100 text-emerald-800 border-emerald-300',
  'RESOLVED':                        'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Closed':                          'bg-slate-200 text-slate-600 border-slate-400',
  'CLOSED':                          'bg-slate-200 text-slate-600 border-slate-400',
  'Reopened':                        'bg-rose-100 text-rose-800 border-rose-300',
  'REOPENED':                        'bg-rose-100 text-rose-800 border-rose-300',
  'APPEALED':                        'bg-amber-100 text-amber-900 border-amber-300 font-bold',
  'Appealed':                        'bg-amber-100 text-amber-900 border-amber-300 font-bold',
};

export default function DepartmentControlPanel({
  complaint,
  onClose,
  onUpdateComplaint,
  isStaffView = false,
}) {
  const [comment, setComment] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [pendingStatus, setPendingStatus] = useState(null);
  const [resolutionFile, setResolutionFile] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [apiError, setApiError] = useState('');
  const [apiSuccess, setApiSuccess] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [adminAction, setAdminAction] = useState(null); // 'CLOSE' | 'REOPEN' | null
  const [closeRemarks, setCloseRemarks] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [extensionHours, setExtensionHours] = useState(24);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (complaint) {
      setSelectedDept(complaint.assignedDept || complaint.department || '');
      setComment('');
      setPendingStatus(null);
      setResolutionFile(null);
      setResolutionNotes('');
      setApiError('');
      setApiSuccess('');
      setPreviewAttachment(null);
      setAdminAction(null);
      setCloseRemarks('');
      setReopenReason('');
      setExtensionHours(24);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [complaint?.id]);

  if (!complaint) return null;

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setApiError('File size exceeds 5MB limit. Please upload a smaller photo or document.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setResolutionFile({
        fileName: file.name,
        fileData: reader.result,
        fileType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        fileSize: file.size,
        isPendingUpload: true
      });
      setApiError('');
    };
    reader.onerror = () => {
      setApiError('Failed to read file from disk.');
    };
    reader.readAsDataURL(file);
  };

  const isAppealed = complaint.status === 'APPEALED' || complaint.status === 'Appealed';
  const appealCycle = complaint.appeal?.cycle || 
    (Array.isArray(complaint.appealHistory) ? complaint.appealHistory.length : 0) || 
    (isAppealed ? 1 : 0);

  // Canonical stage index for 6-step progress stepper
  const getStageIndex = (stage, status) => {
    if (status === 'APPEALED' || status === 'Appealed') {
      return 0; // Stepper visibly resets to Stage 1 on Appeal!
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

  const currentStageIndex = getStageIndex(complaint.stage, complaint.status);
  const currentStageKey = STAGES_6[currentStageIndex]?.key || 'SUBMITTED';
  const isResolved = ['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(complaint.status) || complaint.stage === 'RESOLVED';

  const now = new Date();
  const effectiveDeadline = complaint.slaExtendedUntil || complaint.slaDeadline || complaint.sla_deadline_at;
  const isSlaBreachedNow = !isResolved && Boolean(
    complaint.is_sla_breached ||
    complaint.isSlaBreached ||
    complaint.isSlaOverdue ||
    (effectiveDeadline && now > new Date(effectiveDeadline))
  );

  // Initial student attachments (only non-empty, non-resolutionProof)
  const initialStudentAttachments = (Array.isArray(complaint.attachments) ? complaint.attachments : [])
    .filter(a => a && (a.fileData || a.url || a.fileName))
    .filter(a => {
      const isResProof = complaint.resolutionProof && (
        a.fileName === complaint.resolutionProof?.fileName ||
        a.fileData === complaint.resolutionProof?.fileData ||
        a.fileData === complaint.resolution_proof_url
      );
      return !isResProof;
    });

  // Linear transition trigger
  const handleLinearStep = async (targetStage) => {
    setApiError('');
    setApiSuccess('');

    if (isStaffView && isSlaBreachedNow) {
      setApiError('SLA time expired. Action locked pending Admin intervention.');
      return;
    }

    // Mandatory Resolution Proof validation when transitioning to RESOLVED
    if (targetStage === 'RESOLVED') {
      const existingProof = getRealResolutionProof(complaint);
      const effectiveProof = resolutionFile || existingProof;

      if (!effectiveProof) {
        setApiError('Resolution proof photo is required to mark as Resolved.');
        setPendingStatus('RESOLVED');
        setTimeout(() => {
          fileInputRef.current?.click();
        }, 120);
        return;
      }

      await executeTransition(targetStage, effectiveProof, resolutionNotes);
      return;
    }

    await executeTransition(targetStage, null, '');
  };

  // Re-investigate workflow for appealed complaints
  const handleReinvestigate = async () => {
    setApiError('');
    setApiSuccess('');
    await executeTransition('IN_PROGRESS', null, '', 'Staff initiated re-investigation following student appeal.');
  };

  const executeTransition = async (targetStage, proof, notes, remarks) => {
    setIsTransitioning(true);
    setApiError('');
    setApiSuccess('');

    try {
      const targetId = complaint.db_id || complaint._id || complaint.id;
      const stageDisplayMap = {
        SUBMITTED: 'Submitted',
        AI_ANALYSED: 'AI Analysed',
        ASSIGNED: 'Assigned',
        IN_PROGRESS: 'In Progress',
        PENDING_VERIFICATION: 'Resolution Pending Verification',
        RESOLVED: 'Resolved'
      };
      const targetStatus = stageDisplayMap[targetStage] || targetStage;
      const body = {
        stage: targetStage,
        status: targetStatus,
        ...(proof ? { resolutionProof: proof } : {}),
        ...(notes ? { resolutionNotes: notes, resolution_notes: notes } : {}),
        ...(remarks ? { remarks } : {}),
      };

      const res = await apiClient.complaints.updateStatus(targetId, body);
      const serverComp = res.complaint || {};
      const updated = {
        ...complaint,
        ...serverComp,
        id: complaint.id || serverComp.ticket_id || serverComp.id,
        db_id: complaint.db_id || serverComp.id || serverComp._id,
        stage: targetStage,
        status: targetStatus,
        assignedDept: complaint.assignedDept || serverComp.assigned_department_code || serverComp.department,
        studentName: complaint.studentName || serverComp.student_name,
        studentRoll: complaint.studentRoll || serverComp.student_roll,
        slaHoursLeft: complaint.slaHoursLeft,
        isSlaOverdue: complaint.isSlaOverdue,
        resolutionProof: proof || serverComp.resolutionProof || complaint.resolutionProof,
        resolution_proof_url: (proof && typeof proof === 'string') ? proof : (serverComp.resolution_proof_url || complaint.resolution_proof_url),
        resolutionNotes: notes !== undefined ? notes : (serverComp.resolutionNotes || complaint.resolutionNotes),
        timeline: serverComp.timeline || complaint.timeline
      };

      if (onUpdateComplaint) {
        await onUpdateComplaint(updated);
      }

      setPendingStatus(null);
      setResolutionFile(null);
      setResolutionNotes('');
      setApiSuccess(`✓ Successfully moved complaint to "${targetStage}".`);
    } catch (err) {
      setApiError(err.message || 'Failed to update complaint stage.');
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleProofSubmit = (e) => {
    if (e) e.preventDefault();
    setApiError('');
    setApiSuccess('');
    const existingProof = getRealResolutionProof(complaint);
    const effectiveProof = resolutionFile || existingProof;
    if (!effectiveProof) {
      setApiError('Resolution proof photo is required to mark as Resolved.');
      fileInputRef.current?.click();
      return;
    }
    executeTransition(pendingStatus || 'RESOLVED', effectiveProof, resolutionNotes);
  };

  // Admin Governance Actions
  const handleAdminClose = async (e) => {
    e.preventDefault();
    setIsTransitioning(true);
    setApiError('');
    setApiSuccess('');
    try {
      const targetId = complaint.db_id || complaint._id || complaint.id;
      const res = await apiClient.complaints.close(targetId, { remarks: closeRemarks.trim() });
      const updated = res.complaint || { ...complaint, status: 'CLOSED' };
      if (onUpdateComplaint) {
        await onUpdateComplaint(updated);
      }
      setAdminAction(null);
      setCloseRemarks('');
      setApiSuccess('✓ Grievance officially marked CLOSED by Administrator.');
    } catch (err) {
      setApiError(err.message || 'Failed to close grievance.');
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleAdminReopen = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      setApiError('Reopening justification remarks are mandatory.');
      return;
    }
    setIsTransitioning(true);
    setApiError('');
    setApiSuccess('');
    try {
      const targetId = complaint.db_id || complaint._id || complaint.id;
      const res = await apiClient.complaints.reopen(targetId, {
        reopenReason: reopenReason.trim(),
        extensionHours: Number(extensionHours) || 24
      });
      const updated = res.complaint || { ...complaint, status: 'REOPENED', stage: 'IN_PROGRESS' };
      if (onUpdateComplaint) {
        await onUpdateComplaint(updated);
      }
      setAdminAction(null);
      setReopenReason('');
      setApiSuccess(`✓ Grievance re-opened with +${extensionHours}h extension by Administrator.`);
    } catch (err) {
      setApiError(err.message || 'Failed to re-open grievance.');
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    const updatedComments = [
      ...(complaint.adminComments || []),
      {
        author: isStaffView ? 'Department Staff' : 'Administrator',
        text: comment.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];

    if (onUpdateComplaint) {
      onUpdateComplaint({ ...complaint, adminComments: updatedComments, _needsApiCall: true });
    }
    setComment('');
  };

  const departments = [
    { code: 'CANTEEN', label: 'Canteen' },
    { code: 'TRANSPORT', label: 'Transport' },
    { code: 'HOSTEL', label: 'Hostel' },
    { code: 'SPORTS', label: 'Sports' },
    { code: 'ACADEMIC', label: 'Academic' },
    { code: 'HOSPITALITY', label: 'Hospitality' },
  ];

  const handleReRoute = (newDept) => {
    setSelectedDept(newDept);
    if (onUpdateComplaint) {
      onUpdateComplaint({
        ...complaint,
        department: newDept,
        assignedDept: newDept,
        routingReasoning: `Manually re-routed by Staff/Admin to ${departments.find((d) => d.code === newDept)?.label || newDept}.`,
        _needsApiCall: true
      });
    }
  };

  const nextTransitionInfo = !isAppealed && !isResolved ? NEXT_STAGE_MAP[currentStageKey] : null;
  const statusStyle = STATUS_STYLES[complaint.status] || 'bg-slate-100 text-slate-700 border-slate-300';

  return (
    <>
      {/* Spacious Full-Page Detailed Modal Backdrop */}
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Top Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-950 via-[#084325] to-emerald-900 text-white flex justify-between items-center flex-shrink-0 shadow-sm">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xs font-black bg-white/15 px-2.5 py-1 rounded-lg border border-white/20 text-brand-yellow">
                #{complaint.id || complaint.ticket_id}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${statusStyle}`}>
                {complaint.status}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${
                complaint.priority?.toUpperCase() === 'CRITICAL'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {complaint.priority?.toUpperCase() === 'CRITICAL' ? 'CRITICAL: 12 Hours' : 'HIGH / MEDIUM / LOW: 48 Hours'}
              </span>
              {appealCycle > 0 && (
                <span className="text-xs px-2.5 py-0.5 bg-amber-500 text-white font-black rounded-full flex items-center gap-1 shadow-xs">
                  <Scale className="w-3.5 h-3.5" /> Appeal Cycle #{appealCycle}
                </span>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Close Modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Banners: API feedback */}
            {apiError && (
              <div className="flex items-start gap-2 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-500" />
                <span>{apiError}</span>
              </div>
            )}
            {apiSuccess && (
              <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                <span>{apiSuccess}</span>
              </div>
            )}

            {/* Section 1: Student Details & Issue Description */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Student: <strong>{complaint.studentName}</strong> ({complaint.studentRoll || '2026-STU'})</span>
                  {(complaint.isAnonymous || complaint.is_anonymous || complaint.studentName === 'Anonymous Student') && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded-full border border-purple-200 shadow-2xs">
                      Anonymous Submission
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Assigned Unit: <strong>{complaint.assignedDept} Operations</strong></span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <SlaTimer complaint={complaint} />
                </div>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900 m-0">
                  {complaint.category}: {complaint.description ? complaint.description.slice(0, 70) + '...' : 'Grievance Ticket'}
                </h3>
                <div className="mt-2 p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                  {complaint.description}
                </div>
              </div>

              {/* AI Routing Reasoning Pill */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex items-start gap-2 text-xs text-indigo-950 font-medium">
                <Award className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-indigo-900 block text-[11px] uppercase tracking-wide">AI Triage Context:</span>
                  <p className="m-0 mt-0.5">{complaint.routingReasoning || 'AI Classifier routed ticket based on issue keywords.'}</p>
                </div>
              </div>
            </div>

            {/* Section 2: Initial Student Attachments (Strictly handled) */}
            <div className="border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 m-0">
                  <Paperclip className="h-4 w-4 text-slate-500" />
                  Initial Student Attachments
                </h4>
                {initialStudentAttachments.length > 0 && (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {initialStudentAttachments.length} Attachment(s)
                  </span>
                )}
              </div>

              {initialStudentAttachments.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-1 m-0">No attachment provided</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {initialStudentAttachments.map((item, idx) => {
                    const fileName = item.fileName || item.name || `Attachment_${idx + 1}`;
                    const fileData = item.fileData || item.url;
                    const isPdf = item.fileType?.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          {isPdf ? (
                            <FileText className="h-5 w-5 text-rose-600 flex-shrink-0" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate m-0">
                              {fileName}
                            </p>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              {isPdf ? 'PDF File' : 'Image'}
                            </span>
                          </div>
                        </div>

                        {fileData ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewAttachment({ fileName, fileData, isPdf })}
                              className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>View Attachment</span>
                            </button>
                            <a
                              href={fileData}
                              download={fileName}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                              title="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No URL</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 3: 6-Step Visual Timeline & Appeal History */}
            <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 m-0">
                  <ShieldAlert className="h-4 w-4 text-brand-green" />
                  6-Stage Visual Timeline
                </h4>
                {isAppealed ? (
                  <span className="text-[10px] font-black uppercase text-rose-800 bg-rose-100 border border-rose-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Scale className="w-3 h-3 text-rose-600" /> Appeal Cycle #{appealCycle} — Reset to Stage 1
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Current: Stage {currentStageIndex + 1} of 6
                  </span>
                )}
              </div>

              {/* Responsive 6-Step Stepper */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {STAGES_6.map((stage, idx) => {
                  const isCompleted = idx < currentStageIndex;
                  const isCurrent = idx === currentStageIndex;

                  let badgeStyle = 'bg-slate-50 text-slate-400 border-slate-200';
                  if (isCurrent) {
                    badgeStyle = isAppealed 
                      ? 'bg-rose-600 text-white font-black shadow-sm ring-2 ring-rose-300 border-rose-700'
                      : 'bg-emerald-600 text-white font-black shadow-sm ring-2 ring-emerald-300 border-emerald-700';
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
                          {isAppealed ? 'Re-opened' : 'Active'}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400">Pending</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Appeal History Log (if present) */}
              {Array.isArray(complaint.appealHistory) && complaint.appealHistory.length > 0 && (
                <div className="mt-4 p-4 bg-amber-50/80 border border-amber-300 rounded-xl space-y-2">
                  <span className="text-[11px] font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-amber-700" />
                    Appeal Cycles Record ({complaint.appealHistory.length}):
                  </span>
                  <div className="space-y-2">
                    {complaint.appealHistory.map((item, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-amber-200 text-xs">
                        <div className="flex justify-between items-center text-[10px] text-amber-900 font-bold mb-1">
                          <span>Cycle #{item.cycle || idx + 1}</span>
                          <span>{item.appealedAt ? new Date(item.appealedAt).toLocaleDateString() : 'Recorded'}</span>
                        </div>
                        <p className="text-slate-700 italic m-0">"{item.reason}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Action Controls (Role-Based: Department Linear Workflow vs Admin Governance) */}
            {isStaffView ? (
              /* DEPARTMENT WORKFLOW CONTROLS */
              <div className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 m-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Department Action Controls
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    Operational Execution
                  </span>
                </div>

                {/* SLA Breached Lock Alert Banner */}
                {isSlaBreachedNow && !isResolved && (
                  <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-xl space-y-1 shadow-xs animate-pulse">
                    <div className="flex items-center gap-2 text-rose-900">
                      <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                      <h5 className="text-xs font-black uppercase tracking-wider m-0">
                        SLA Breached — Locked. Awaiting Admin Reopen.
                      </h5>
                    </div>
                    <p className="text-xs text-rose-800 m-0 leading-relaxed pl-7 font-medium">
                      This ticket has exceeded its target resolution SLA. Department stage advancement has been locked by college policy pending College Administrator review and reopening.
                    </p>
                  </div>
                )}

                {/* Appeal Alert Banner & Re-investigate Button */}
                {isAppealed ? (
                  <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-amber-950">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <div>
                        <h5 className="text-xs font-black uppercase tracking-wider m-0">
                          Student Filed an Appeal (Cycle #{appealCycle})
                        </h5>
                        <p className="text-xs text-amber-900 mt-0.5 m-0">
                          The resolution was contested by the student. Advance to Re-investigation to resolve the issue.
                        </p>
                      </div>
                    </div>

                    {complaint.appeal?.reason && (
                      <div className="p-3 bg-white rounded-lg border border-amber-200 text-xs">
                        <span className="font-extrabold text-amber-900 block mb-0.5">Student's Appeal Reason:</span>
                        <p className="italic text-slate-800 m-0">"{complaint.appeal.reason}"</p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleReinvestigate}
                      disabled={isTransitioning}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isTransitioning ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Advancing to Re-investigation...</>
                      ) : (
                        <><RotateCcw className="w-4 h-4" /> Start Re-investigation (Move to In Progress)</>
                      )}
                    </button>
                  </div>
                ) : null}

                {/* Proof Upload & Verification Box (active on Stage 5 or when pending resolution) */}
                {(pendingStatus === 'RESOLVED' || currentStageKey === 'PENDING_VERIFICATION') && !isResolved && !isAppealed ? (
                  <form onSubmit={handleProofSubmit} className={`space-y-4 p-4 rounded-xl border transition shadow-xs ${apiError.includes('proof') ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-200' : 'bg-emerald-50/50 border-emerald-300'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5 m-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        Stage 6 Verification: Resolution Proof
                      </p>
                      {resolutionFile && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Photo Attached
                        </span>
                      )}
                    </div>

                    {/* Resolution Proof Upload / Preview Box */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                        Technician Resolution Proof Photo / Document <span className="text-rose-500">* (Mandatory)</span>
                      </label>

                      {!resolutionFile && !getRealResolutionProof(complaint) ? (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl bg-white transition cursor-pointer group ${apiError.includes('proof') ? 'border-rose-400 hover:border-rose-600 bg-rose-50/30' : 'border-emerald-300 hover:border-emerald-600 hover:bg-emerald-50/40'}`}
                        >
                          <UploadCloud className="w-8 h-8 text-emerald-600 group-hover:scale-110 transition mb-1.5" />
                          <span className="text-xs font-bold text-slate-800">
                            Click or drag & drop technician resolution proof photo
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            Mandatory JPG, PNG, or PDF (Up to 12MB)
                          </span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </div>
                      ) : (
                        (() => {
                          const displayProof = resolutionFile || getRealResolutionProof(complaint);
                          const isPdf = displayProof.fileType?.includes('pdf') || displayProof.fileName?.toLowerCase().endsWith('.pdf');
                          const isImage = !isPdf && displayProof.fileData;

                          return (
                            <div className="flex items-center justify-between p-3.5 bg-white border border-emerald-300 rounded-xl shadow-xs">
                              <div className="flex items-center gap-3 min-w-0 pr-2">
                                {isImage ? (
                                  <img
                                    src={displayProof.fileData}
                                    alt={displayProof.fileName}
                                    className="w-12 h-12 object-cover rounded-lg border border-emerald-200 shadow-xs flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0 text-rose-600">
                                    <FileText className="w-6 h-6" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate m-0">
                                    {displayProof.fileName}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase">
                                      {isPdf ? 'PDF Document' : 'Photo Proof'}
                                    </span>
                                    {displayProof.fileSize > 0 && (
                                      <span className="text-[10px] text-slate-400">
                                        • {(displayProof.fileSize / 1024).toFixed(1)} KB
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setPreviewAttachment({
                                    fileName: displayProof.fileName,
                                    fileData: displayProof.fileData,
                                    isPdf
                                  })}
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Proof</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResolutionFile(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                    setApiError('');
                                  }}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Remove selected proof"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Remove</span>
                                </button>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>

                    {/* Optional Resolution Notes */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                        Resolution Remarks / Notes <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Optional comments regarding corrective actions taken, technician details, or inspection notes..."
                        rows="2"
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-800 font-medium"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={isTransitioning || isSlaBreachedNow}
                        className="flex-1 py-3 px-4 bg-[#084325] hover:bg-[#06331c] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isTransitioning ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Verifying & Resolving...</>
                        ) : (
                          <><CheckCircle2 className="h-4 w-4 text-amber-300" /> Verify & Mark as Resolved</>
                        )}
                      </button>
                      {pendingStatus && (
                        <button
                          type="button"
                          onClick={() => { setPendingStatus(null); setApiError(''); }}
                          disabled={isTransitioning}
                          className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                ) : !isAppealed ? (
                  <div>
                    {nextTransitionInfo ? (
                      <div className="space-y-2">
                        <p className="text-[11px] text-slate-500 font-semibold uppercase">
                          Next Stage Action:
                        </p>
                        <button
                          type="button"
                          onClick={() => handleLinearStep(nextTransitionInfo.next)}
                          disabled={isTransitioning || isSlaBreachedNow}
                          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition shadow-sm flex items-center justify-between cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center gap-2">
                            {isTransitioning ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                            )}
                            <span>{isTransitioning ? 'Advancing stage...' : isSlaBreachedNow ? 'Stage Progression Locked (SLA Breached)' : nextTransitionInfo.label}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-emerald-200" />
                        </button>
                      </div>
                    ) : isResolved ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>This grievance has completed the 6-stage lifecycle and is marked Resolved.</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              /* ADMIN GOVERNANCE CONTROLS (READ-ONLY STAGES + SUPERVISORY CLOSE/REOPEN) */
              <div className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 m-0">
                    <ShieldCheck className="h-4 w-4 text-indigo-600" />
                    Administrative Supervisory Controls
                  </h4>
                  <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                    Executive Governance
                  </span>
                </div>

                <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold m-0 mb-0.5">Role Separation Policy Active</p>
                    <p className="text-slate-600 m-0 leading-relaxed text-[11px]">
                      Operational stage progression is managed exclusively by assigned Department staff. 
                      Administrators provide supervisory oversight, formal grievance closure, or emergency reopening with custom SLA extension.
                    </p>
                  </div>
                </div>

                {/* Close Complaint Form */}
                {adminAction === 'CLOSE' ? (
                  <form onSubmit={handleAdminClose} className="p-4 bg-white border border-slate-300 rounded-xl space-y-3 shadow-xs">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <Lock className="w-4 h-4 text-rose-600" />
                      <span>Formally Close Grievance #{complaint.id}</span>
                    </div>
                    <textarea
                      value={closeRemarks}
                      onChange={(e) => setCloseRemarks(e.target.value)}
                      placeholder="Enter administrative closure remarks or final arbitration notes..."
                      rows="3"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 text-slate-800"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isTransitioning}
                        className="py-2 px-4 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {isTransitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        <span>Confirm Formal Closure</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAdminAction(null); setCloseRemarks(''); }}
                        disabled={isTransitioning}
                        className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : adminAction === 'REOPEN' ? (
                  <form onSubmit={handleAdminReopen} className="p-4 bg-white border border-amber-300 rounded-xl space-y-3 shadow-xs">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                      <RotateCcw className="w-4 h-4 text-amber-600" />
                      <span>Administrative Reopen with Custom SLA Extension</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Reopening Justification <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        placeholder="State why this grievance is being reopened (e.g. incomplete work, student escalation)..."
                        rows="2"
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Additional SLA Extension (Hours)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="168"
                        value={extensionHours}
                        onChange={(e) => setExtensionHours(e.target.value)}
                        className="w-32 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={isTransitioning || !reopenReason.trim()}
                        className="py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {isTransitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        <span>Confirm Reopen Ticket</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAdminAction(null); setReopenReason(''); }}
                        disabled={isTransitioning}
                        className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {complaint.status !== 'CLOSED' && (
                      <button
                        type="button"
                        onClick={() => setAdminAction('CLOSE')}
                        className="py-2.5 px-4 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Lock className="w-4 h-4 text-rose-400" />
                        <span>Formally Close Grievance</span>
                      </button>
                    )}

                    {(isSlaBreachedNow || ['Resolved', 'Closed', 'RESOLVED', 'CLOSED', 'APPEALED'].includes(complaint.status) || complaint.isSlaOverdue) && (
                      <button
                        type="button"
                        onClick={() => setAdminAction('REOPEN')}
                        className={`py-2.5 px-4 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                          isSlaBreachedNow ? 'bg-rose-600 hover:bg-rose-700 ring-2 ring-rose-300 animate-pulse' : 'bg-amber-500 hover:bg-amber-600'
                        }`}
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Reopen & Extend SLA</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Section 5: Verified Resolution Report & Proof (only if resolved and genuine evidence exists) */}
            {isResolved && (getRealResolutionProof(complaint) || complaint.resolutionNotes || complaint.resolution_notes) && (
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                  <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wide flex items-center gap-1.5 m-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Technician Resolution Proof
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Verified Resolution Evidence
                  </span>
                </div>

                {(complaint.resolutionNotes || complaint.resolution_notes) && (
                  <div>
                    <span className="text-[11px] font-extrabold text-emerald-900 block mb-0.5">Staff Notes:</span>
                    <p className="text-xs text-slate-800 m-0 font-medium">
                      {complaint.resolutionNotes || complaint.resolution_notes}
                    </p>
                  </div>
                )}

                {(() => {
                  const proofObj = getRealResolutionProof(complaint);
                  if (!proofObj) return null;
                  const isPdf = proofObj.fileType?.includes('pdf') || proofObj.fileName?.toLowerCase().endsWith('.pdf');
                  const isImage = !isPdf && proofObj.fileData;

                  return (
                    <div>
                      <span className="text-[11px] font-extrabold text-slate-700 block mb-1.5">Attached Photo Proof:</span>
                      <div className="flex items-center justify-between p-3 bg-white border border-emerald-200 rounded-xl">
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          {isImage ? (
                            <img
                              src={proofObj.fileData}
                              alt={proofObj.fileName}
                              className="w-12 h-12 object-cover rounded-lg border border-emerald-200 shadow-xs flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0 text-rose-600">
                              <FileText className="w-6 h-6" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate m-0">{proofObj.fileName}</p>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">{isPdf ? 'PDF Document' : 'Photo Proof'} • Verified</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewAttachment({ fileName: proofObj.fileName, fileData: proofObj.fileData, isPdf })}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Proof</span>
                          </button>
                          {proofObj.fileData && (
                            <a
                              href={proofObj.fileData}
                              download={proofObj.fileName}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Section 6: Student Feedback Card (if resolved & feedback exists) */}
            {complaint.feedback && (complaint.feedback.rating > 0 || complaint.feedback.comments) && (
              <div className="bg-amber-50/70 border border-amber-300 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                  <h4 className="text-xs font-extrabold text-amber-950 uppercase tracking-wide flex items-center gap-1.5 m-0">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                    Student Resolution Feedback
                  </h4>
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full">
                    Student Rating Submitted
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= (complaint.feedback.rating || 0)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-extrabold text-slate-800">
                    {complaint.feedback.rating} / 5 Stars
                  </span>
                </div>

                {complaint.feedback.comments && (
                  <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs text-slate-800 leading-relaxed font-medium">
                    "{complaint.feedback.comments}"
                  </div>
                )}

                {complaint.feedback.submittedAt && (
                  <p className="text-[10px] text-slate-400 m-0">
                    Submitted on: {new Date(complaint.feedback.submittedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                )}
              </div>
            )}

            {/* Section 7: Activity Log & Notes */}
            <div className="border border-slate-200 rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 m-0">
                Activity Log & Department Notes
              </h4>

              <div className="space-y-2 max-h-[140px] overflow-y-auto">
                {complaint.adminComments && complaint.adminComments.length > 0 ? (
                  complaint.adminComments.map((c, i) => (
                    <div key={i} className="bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100">
                      <div className="flex justify-between text-[10px] text-slate-400 font-semibold mb-0.5">
                        <span>{c.author}</span>
                        <span>{c.timestamp}</span>
                      </div>
                      <p className="text-slate-700 font-medium m-0">{c.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-slate-400 italic py-1 m-0">No notes recorded yet.</p>
                )}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
                  placeholder="Add internal departmental note..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl cursor-pointer transition-colors flex items-center gap-1 text-xs font-bold"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>

          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
            <span>Ticket: <strong className="font-mono text-slate-700">{complaint.id || complaint.ticket_id}</strong></span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>

        </div>
      </div>

      {/* Full Resolution Attachment Preview Modal */}
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
                    PDF document uploaded by student/staff.
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
                <p className="text-xs text-slate-400 italic">No image preview data available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
