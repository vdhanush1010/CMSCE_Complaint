import React, { useState, useEffect } from 'react';
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
  Clock,
  RotateCcw,
  UploadCloud,
  Scale,
  XCircle
} from 'lucide-react';
import { apiClient } from '../../api/client';

const VALID_TRANSITIONS = {
  'Submitted':                       ['In Progress'],
  'AI Analysed':                     ['In Progress'],
  'Assigned':                        ['In Progress'],
  'In Progress':                     ['Resolved'],
  'Resolution Pending Verification': ['Resolved'],
  'Resolved':                        ['Closed', 'REOPENED'],
  'Reopened':                        ['Resolved'],
  'REOPENED':                        ['Resolved'],
  'IN_PROGRESS':                     ['Resolved'],
  'PENDING_VERIFICATION':            ['Resolved'],
  'RESOLVED':                        ['Closed', 'REOPENED'],
  'APPEALED':                        ['REOPENED', 'Closed'],
  'Appealed':                        ['REOPENED', 'Closed'],
  'Closed':                          [],
  'CLOSED':                          [],
};

const REQUIRES_PROOF = new Set([
  'Resolution Pending Verification', 
  'Resolved', 
  'PENDING_VERIFICATION', 
  'RESOLVED'
]);

const STATUS_STYLES = {
  'Submitted':                       'bg-slate-100 text-slate-700 border-slate-300',
  'AI Analysed':                     'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Assigned':                        'bg-blue-100 text-blue-800 border-blue-300',
  'In Progress':                     'bg-amber-100 text-amber-800 border-amber-300',
  'Resolution Pending Verification': 'bg-orange-100 text-orange-800 border-orange-300',
  'Resolved':                        'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Closed':                          'bg-slate-200 text-slate-600 border-slate-400',
  'CLOSED':                          'bg-slate-200 text-slate-600 border-slate-400',
  'Reopened':                        'bg-rose-100 text-rose-800 border-rose-300',
  'REOPENED':                        'bg-rose-100 text-rose-800 border-rose-300',
  'APPEALED':                        'bg-amber-100 text-amber-900 border-amber-300',
  'Appealed':                        'bg-amber-100 text-amber-900 border-amber-300',
  'IN_PROGRESS':                     'bg-amber-100 text-amber-800 border-amber-300',
  'PENDING_VERIFICATION':            'bg-orange-100 text-orange-800 border-orange-300',
  'RESOLVED':                        'bg-emerald-100 text-emerald-800 border-emerald-300',
};

const LIFECYCLE_STAGES = [
  { id: 'Submitted', label: '1. Submitted' },
  { id: 'In Progress', label: '2. In Progress' },
  { id: 'Pending Verification', label: '3. Pending Verify', matches: ['Resolution Pending Verification'] },
  { id: 'Resolved', label: '4. Resolved', matches: ['Resolved', 'Closed'] }
];

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

  // Attachment preview modal state
  const [previewAttachment, setPreviewAttachment] = useState(null);

  // SLA Reopen Modal state (Admin Exclusive)
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [extensionHours, setExtensionHours] = useState(24);
  const [isReopening, setIsReopening] = useState(false);
  const [reopenError, setReopenError] = useState('');

  useEffect(() => {
    if (complaint) {
      setSelectedDept(complaint.assignedDept || '');
      setComment('');
      setPendingStatus(null);
      setResolutionFile(null);
      setResolutionNotes('');
      setApiError('');
      setApiSuccess('');
      setPreviewAttachment(null);
      setIsReopenModalOpen(false);
      setReopenReason('');
      setExtensionHours(24);
      setReopenError('');
    }
  }, [complaint?.id]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      setApiError('File size exceeds 12MB limit. Please upload a smaller document.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setResolutionFile({
        fileName: file.name,
        fileData: reader.result,
        fileType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        fileSize: file.size
      });
      setApiError('');
    };
    reader.onerror = () => {
      setApiError('Failed to read file from disk.');
    };
    reader.readAsDataURL(file);
  };

  if (!complaint) return null;

  const [isClosing, setIsClosing] = useState(false);

  const handleAdminClose = async (remarks) => {
    setIsClosing(true);
    setApiError('');
    try {
      const targetId = complaint.db_id || complaint._id || complaint.id;
      const res = await apiClient.complaints.close(targetId, {
        remarks: remarks || 'Grievance permanently closed by College Administrator.'
      });
      const updated = res.complaint || {
        ...complaint,
        status: 'CLOSED'
      };
      if (onUpdateComplaint) {
        await onUpdateComplaint(updated);
      }
      setApiSuccess(`✓ Grievance #${complaint.ticketId || complaint.id} has been permanently closed.`);
    } catch (err) {
      setApiError(err.message || 'Failed to close grievance.');
    } finally {
      setIsClosing(false);
    }
  };

  const isOverdue = Boolean(
    complaint.isSlaOverdue || 
    complaint.is_sla_breached || 
    complaint.isSlaBreached || 
    (complaint.slaHoursLeft !== undefined && complaint.slaHoursLeft < 0)
  );
  const isResolved = ['Resolved', 'Closed', 'RESOLVED', 'CLOSED', 'closed', 'resolved'].includes(complaint.status);
  const isAppealed = ['APPEALED', 'Appealed'].includes(complaint.status);
  const isReopened = Boolean(
    complaint.isReopened || 
    complaint.status === 'REOPENED' || 
    complaint.status === 'Reopened'
  );
  const canReopen = !isStaffView && (isOverdue || isResolved || isReopened || isAppealed);

  const handleReopenSubmit = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      setReopenError('Mandatory administrative justification is required to re-open.');
      return;
    }

    setIsReopening(true);
    setReopenError('');

    try {
      const targetId = complaint.db_id || complaint._id || complaint.id;
      const res = await apiClient.complaints.reopen(targetId, {
        reopenReason: reopenReason.trim(),
        extensionHours: Number(extensionHours) || 24,
      });

      const updated = res?.complaint || {
        ...complaint,
        status: 'REOPENED',
        isReopened: true,
        isSlaBreached: false,
        isSlaOverdue: false,
        slaHoursLeft: Number(extensionHours) || 24,
        sla_deadline_at: new Date(Date.now() + (Number(extensionHours) || 24) * 3600000).toISOString(),
        slaExtendedUntil: new Date(Date.now() + (Number(extensionHours) || 24) * 3600000).toISOString(),
        reopenReason: reopenReason.trim(),
      };

      if (onUpdateComplaint) {
        await onUpdateComplaint(updated);
      }

      setIsReopenModalOpen(false);
      setReopenReason('');
      setExtensionHours(24);
      setApiSuccess(`✓ Grievance #${complaint.ticketId || complaint.id} re-opened with +${extensionHours}h SLA extension.`);
    } catch (err) {
      setReopenError(err.message || 'Failed to re-open grievance.');
    } finally {
      setIsReopening(false);
    }
  };

  const departments = [
    { code: 'CANTEEN', label: 'Canteen' },
    { code: 'TRANSPORT', label: 'Transport' },
    { code: 'HOSTEL', label: 'Hostel' },
    { code: 'SPORTS', label: 'Sports' },
    { code: 'ACADEMIC', label: 'Academic' },
    { code: 'HOSPITALITY', label: 'Hospitality' },
  ];

  const initiateTransition = (newStatus) => {
    setApiError('');
    setApiSuccess('');
    if (REQUIRES_PROOF.has(newStatus)) {
      setPendingStatus(newStatus);
      setResolutionFile(null);
      setResolutionNotes('');
    } else {
      executeTransition(newStatus, null, null);
    }
  };

  const executeTransition = async (newStatus, proof, notes) => {
    setIsTransitioning(true);
    setApiError('');
    setApiSuccess('');

    const updatedComplaint = {
      ...complaint,
      status: newStatus,
      ...(proof ? { 
        resolutionProof: proof, 
        resolution_proof_url: proof.fileData || proof.fileName 
      } : {}),
      ...(notes ? { resolution_notes: notes } : {}),
    };

    const result = await onUpdateComplaint(updatedComplaint);

    setIsTransitioning(false);

    if (result?.success) {
      setApiSuccess(`✓ Status updated to "${newStatus}" successfully.`);
      setPendingStatus(null);
      setResolutionFile(null);
      setResolutionNotes('');
    } else {
      setApiError(result?.error || 'Transition failed. Check server logs.');
    }
  };

  const handleProofSubmit = (e) => {
    e.preventDefault();
    if (!resolutionFile) {
      setApiError('Resolution proof document (Photo or PDF) is required.');
      return;
    }
    if (!resolutionNotes.trim()) {
      setApiError('Resolution notes / corrective actions taken are required.');
      return;
    }
    executeTransition(pendingStatus, resolutionFile, resolutionNotes.trim());
  };

  const cancelProofForm = () => {
    setPendingStatus(null);
    setResolutionFile(null);
    setResolutionNotes('');
    setApiError('');
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

    onUpdateComplaint({ ...complaint, adminComments: updatedComments });
    setComment('');
  };

  const handleReRoute = (newDept) => {
    setSelectedDept(newDept);
    onUpdateComplaint({
      ...complaint,
      department: newDept,
      assignedDept: newDept,
      routingReasoning: `Manually re-routed by Admin to ${departments.find((d) => d.code === newDept)?.label || newDept}.`,
    });
  };

  // Compile combined attachments from attachments array, proofs, and resolutionProof
  const attachmentsList = [
    ...(complaint.attachments || []),
    ...((complaint.proofs || []).filter(p => !complaint.attachments?.some(a => a.fileName === p.fileName))),
    ...(complaint.resolutionProof ? [complaint.resolutionProof] : []),
    ...(complaint.resolution_proof_url && !complaint.attachments?.some(a => a.fileName === complaint.resolution_proof_url)
      ? [{ fileName: 'Resolution Proof Document', fileData: complaint.resolution_proof_url, url: complaint.resolution_proof_url }] 
      : [])
  ];

  let validNextStatuses = [];
  if (isStaffView) {
    if (['In Progress', 'IN_PROGRESS', 'Reopened', 'REOPENED'].includes(complaint.status)) {
      validNextStatuses = ['Resolved'];
    } else if (['Submitted', 'SUBMITTED', 'AI Analysed', 'Assigned'].includes(complaint.status)) {
      validNextStatuses = ['In Progress'];
    } else {
      validNextStatuses = [];
    }
  } else {
    validNextStatuses = VALID_TRANSITIONS[complaint.status] || [];
  }

  const statusStyle = STATUS_STYLES[complaint.status] || 'bg-slate-100 text-slate-700 border-slate-300';

  const isCurrentStage = (stage) => {
    if (stage.id === complaint.status) return true;
    if (stage.matches && stage.matches.includes(complaint.status)) return true;
    return false;
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-lg flex flex-col h-[calc(100vh-220px)] sticky top-28 overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Panel Header */}
        <div className="p-4 bg-brand-green text-white flex justify-between items-center flex-shrink-0">
          <div>
            <h3 className="font-bold text-sm text-white m-0">Department Control Panel</h3>
            <p className="text-[10px] text-brand-yellow font-medium m-0">
              {isStaffView ? 'Department Head Execution & Resolution Console' : 'Administrative Monitor & Governance Drawer'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-emerald-800 rounded-md transition-colors cursor-pointer text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Ticket Summary */}
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-xs text-slate-500 font-bold">{complaint.id}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusStyle}`}>
                {complaint.status}
              </span>
            </div>
            <h4 className="font-bold text-slate-800 text-sm leading-tight">{complaint.category}</h4>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{complaint.description}</p>
            <p className="text-[10px] text-slate-400 mt-3 font-semibold">Student: {complaint.studentName} ({complaint.studentRoll || '2026-STU'})</p>
          </div>

          {/* API Feedback Banners */}
          {apiError && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-500" />
              <span>{apiError}</span>
            </div>
          )}
          {apiSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-medium">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span>{apiSuccess}</span>
            </div>
          )}

          {/* AI Routing Reasoning */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3">
            <h5 className="text-[11px] font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
              <Award className="h-3.5 w-3.5 text-indigo-700" />
              AI Routing Reasoning
            </h5>
            <p className="text-xs text-indigo-800 leading-relaxed bg-white/70 p-2.5 rounded border border-indigo-50/50 font-medium">
              {complaint.routingReasoning || 'AI Classifier analyzed keywords and urgency.'}
            </p>
          </div>

          {/* Proof Attachments (Part 2: Dynamic Pills & Modal Preview) */}
          <div className="border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5 m-0">
                <Paperclip className="h-3.5 w-3.5 text-slate-500" />
                Proof Attachments ({attachmentsList.length})
              </h5>
              {attachmentsList.length > 0 && (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  Student Proof Submitted
                </span>
              )}
            </div>

            {attachmentsList.length > 0 ? (
              <div className="space-y-2 pt-1">
                {attachmentsList.map((item, idx) => {
                  const fileName = item.fileName || item.name || `Proof_Attachment_${idx + 1}`;
                  const fileData = item.fileData || item.url || item.fileName;
                  const isPdf = item.fileType?.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');

                  return (
                    <div 
                      key={idx}
                      className="flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 p-2.5 rounded-lg border border-slate-200 transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        {isPdf ? (
                          <FileText className="h-4 w-4 text-rose-600 flex-shrink-0" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-slate-800 truncate" title={fileName}>
                          {fileName}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200 uppercase flex-shrink-0">
                          {isPdf ? 'PDF' : 'IMAGE'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment({ ...item, fileName, fileData, isPdf })}
                          className="p-1.5 bg-white hover:bg-emerald-50 hover:text-brand-green text-slate-600 border border-slate-200 rounded-md transition-colors cursor-pointer text-xs flex items-center gap-1 font-semibold"
                          title="View Full Resolution"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View</span>
                        </button>

                        <a
                          href={fileData}
                          download={fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md transition-colors cursor-pointer"
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-1 m-0">No attachments submitted by student.</p>
            )}
          </div>

          {/* Part 3: Workflow Actions OR Read-Only Lifecycle Status Monitor */}
          {!isStaffView ? (
            /* Admin View: Read-Only Lifecycle Status Monitor (Role Demotion) */
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 m-0">
                  <ShieldAlert className="h-3.5 w-3.5 text-brand-green" />
                  Lifecycle Status Monitor
                </h5>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${statusStyle}`}>
                  {complaint.status}
                </span>
              </div>

              {/* Progress Stepper */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-semibold">
                  {LIFECYCLE_STAGES.map((stage) => {
                    const active = isCurrentStage(stage);
                    return (
                      <div 
                        key={stage.id}
                        className={`py-1 px-1 rounded transition-colors ${
                          active 
                            ? 'bg-emerald-600 text-white font-bold shadow-xs' 
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {stage.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Update Details */}
              <div className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-semibold">Supervised By:</span>
                  <span className="font-semibold text-slate-800">Updated by Department Staff</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-semibold">Assigned Unit:</span>
                  <span className="font-mono font-bold text-slate-700">{complaint.assignedDept} Operations</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-semibold">SLA Countdown:</span>
                  <span className={complaint.isSlaOverdue ? 'text-rose-600 font-bold' : 'text-slate-700 font-medium'}>
                    {complaint.isSlaOverdue ? `Overdue (${Math.abs(complaint.slaHoursLeft)}h)` : `${complaint.slaHoursLeft}h remaining`}
                  </span>
                </div>
              </div>

              {/* Explicit Advisory Notice */}
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-amber-900">
                <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] font-semibold leading-tight m-0">
                  Status transitions managed exclusively by Department Heads.
                </p>
              </div>

              {/* Reopened Banner Notice (if already escalated) */}
              {isReopened && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-tight space-y-0.5">
                    <span className="font-bold">Escalated Grievance (Re-opened): </span>
                    <span className="text-rose-800">
                      {complaint.reopenReason ? `"${complaint.reopenReason}"` : "Re-opened by Admin for immediate departmental compliance."}
                    </span>
                  </div>
                </div>
              )}

              {/* Official Student Appeal Arbitration Panel (Part 3) */}
              {isAppealed && (
                <div className="p-3.5 bg-amber-50 border-2 border-amber-400 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-950">
                    <Scale className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <h6 className="text-xs font-black uppercase tracking-wider m-0">
                      Student Filed an Appeal: Resolution Disputed
                    </h6>
                  </div>
                  <p className="text-xs text-amber-900 leading-snug m-0">
                    The student has officially challenged this grievance resolution. Review the student's appeal remarks alongside the department's resolution proof to arbitrate.
                  </p>

                  {/* Side-by-Side Comparison */}
                  <div className="space-y-2 bg-white p-3 rounded-lg border border-amber-200 text-xs">
                    <div>
                      <span className="font-extrabold text-amber-950 block text-[11px] uppercase tracking-wide">
                        Student's Appeal Grounds:
                      </span>
                      <p className="text-slate-800 italic mt-0.5 m-0 bg-slate-50 p-2 rounded border border-slate-200 font-medium">
                        "{complaint.appeal?.reason || 'Student stated the issue was unresolved.'}"
                      </p>
                    </div>
                    {complaint.resolution_notes && (
                      <div>
                        <span className="font-extrabold text-emerald-950 block text-[11px] uppercase tracking-wide">
                          Department's Corrective Action Notes:
                        </span>
                        <p className="text-slate-800 mt-0.5 m-0 bg-emerald-50/50 p-2 rounded border border-emerald-200 font-medium">
                          {complaint.resolution_notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Arbitration Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setReopenError('');
                        setIsReopenModalOpen(true);
                      }}
                      disabled={isClosing}
                      className="py-2 px-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Re-open Grievance</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAdminClose('Appeal evaluated and rejected. Department resolution confirmed by Administration.')}
                      disabled={isClosing}
                      className="py-2 px-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isClosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                      <span>Reject Appeal & Close</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Resolved / Overdue Admin Actions */}
              {!isAppealed && canReopen && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReopenError('');
                        setIsReopenModalOpen(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all shadow-xs border border-amber-500 bg-amber-50 hover:bg-amber-100 text-amber-900 hover:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                      <span>Re-open Grievance</span>
                    </button>

                    {['Resolved', 'RESOLVED'].includes(complaint.status) && (
                      <button
                        type="button"
                        onClick={() => handleAdminClose('Grievance confirmed resolved. Formally closed by College Administrator.')}
                        disabled={isClosing}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition bg-slate-800 hover:bg-slate-900 text-white shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {isClosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5 text-slate-300" />}
                        <span>Close Ticket</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 text-center m-0">
                    {isOverdue 
                      ? "SLA breach detected. Admin may grant extension with audit justification."
                      : "Grievance resolved. Admin may re-open with directive or permanently close."}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Staff View: Interactive Workflow Transitions */
            <div className="border border-slate-150 rounded-lg p-3 space-y-3">
              <h5 className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />
                Workflow Actions
              </h5>

              {validNextStatuses.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No further transitions available. Status is <strong>{complaint.status}</strong>.
                </p>
              ) : (
                <>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">
                    Valid Next Step(s) from <span className="text-slate-600">"{complaint.status}"</span>:
                  </p>

                  {pendingStatus ? (
                    <form onSubmit={handleProofSubmit} className="space-y-3 p-3.5 bg-amber-50/80 border border-amber-300 rounded-xl shadow-xs">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-extrabold text-amber-950 uppercase tracking-wide flex items-center gap-1.5 m-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          Resolution Verification: "{pendingStatus}"
                        </p>
                      </div>

                      {/* Native File Upload Component (Part 3) */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                          Upload Resolution Proof / Document (Photo or PDF) <span className="text-rose-500">*</span>
                        </label>
                        
                        {!resolutionFile ? (
                          <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-amber-300 hover:border-emerald-600 rounded-xl bg-white hover:bg-emerald-50/40 transition cursor-pointer group">
                            <UploadCloud className="w-7 h-7 text-amber-600 group-hover:text-emerald-700 transition mb-1" />
                            <span className="text-xs font-bold text-slate-800">
                              Click to select resolution proof document
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              Supports JPG, PNG, PDF (Up to 12MB)
                            </span>
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png,.pdf"
                              onChange={handleFileSelect}
                              required
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <div className="flex items-center justify-between p-2.5 bg-white border border-emerald-300 rounded-xl shadow-xs">
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              {resolutionFile.fileType?.includes('pdf') || resolutionFile.fileName?.toLowerCase().endsWith('.pdf') ? (
                                <FileText className="w-5 h-5 text-rose-600 flex-shrink-0" />
                              ) : (
                                <ImageIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate m-0">
                                  {resolutionFile.fileName}
                                </p>
                                <span className="text-[10px] text-slate-400 font-semibold">
                                  {(resolutionFile.fileSize / 1024).toFixed(1)} KB • Document Attached
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setResolutionFile(null)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition cursor-pointer"
                              title="Remove and re-upload"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Resolution Notes / Corrective Actions */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                          Resolution Notes / Corrective Actions Taken <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="Describe the corrective action taken, inspection results, or repairs performed..."
                          rows="3"
                          required
                          className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#084325] text-slate-800"
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={isTransitioning}
                          className="flex-1 py-2 px-3 bg-[#084325] hover:bg-[#06331c] disabled:opacity-50 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {isTransitioning ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving Verification...</>
                          ) : (
                            <><CheckCircle2 className="h-3.5 w-3.5 text-amber-300" /> Confirm Verification & Mark Resolved</>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={cancelProofForm}
                          disabled={isTransitioning}
                          className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5">
                      {validNextStatuses.map((nextStatus) => {
                        const isResolveAction = nextStatus === 'Resolved' || nextStatus === 'RESOLVED';
                        const buttonLabel = isResolveAction ? 'Mark as Resolved' : `Move to "${nextStatus}"`;

                        return (
                          <button
                            key={nextStatus}
                            onClick={() => initiateTransition(nextStatus)}
                            disabled={isTransitioning}
                            className={`w-full text-left flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                              STATUS_STYLES[nextStatus] || 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            } hover:brightness-95`}
                          >
                            <div className="flex items-center gap-2">
                              {isResolveAction ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : null}
                              <span>{buttonLabel}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {REQUIRES_PROOF.has(nextStatus) && (
                                <span className="text-[9px] font-semibold text-slate-600 bg-white/70 px-1.5 py-0.5 rounded border border-current/20 flex-shrink-0">
                                  Proof & Notes Required
                                </span>
                              )}
                              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Quick Priority buttons — Admin only (Retained) */}
          {!isStaffView && (
            <div className="border border-slate-150 rounded-lg p-3 space-y-2">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase">Modify Priority</label>
              <div className="flex gap-1.5">
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((pr) => (
                  <button
                    key={pr}
                    onClick={() => onUpdateComplaint({ ...complaint, priority: pr })}
                    className={`flex-1 text-[10px] font-bold py-1 rounded transition-colors cursor-pointer ${
                      complaint.priority === pr
                        ? 'bg-slate-900 text-white border border-slate-900'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {pr}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Re-route Department Dropdown — Admin only (Retained) */}
          {!isStaffView && (
            <div className="border border-slate-150 rounded-lg p-3 space-y-2">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3" /> Re-route Department
              </label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-green text-slate-700 transition-all cursor-pointer font-medium"
                value={selectedDept}
                onChange={(e) => handleReRoute(e.target.value)}
              >
                {departments.map((dept) => (
                  <option key={dept.code} value={dept.code}>{dept.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Activity Log & Comment form (Retained for both) */}
          <div className="border border-slate-150 rounded-lg p-3 space-y-3">
            <h5 className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
              Activity Log & Notes
            </h5>

            <div className="space-y-2 max-h-[140px] overflow-y-auto">
              {complaint.adminComments && complaint.adminComments.length > 0 ? (
                complaint.adminComments.map((c, i) => (
                  <div key={i} className="bg-slate-50 p-2 rounded text-xs border border-slate-100">
                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold mb-0.5">
                      <span>{c.author}</span>
                      <span>{c.timestamp}</span>
                    </div>
                    <p className="text-slate-600 font-medium">{c.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-400 italic">No notes recorded yet.</p>
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-green text-slate-800"
                placeholder="Add internal notes..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                type="submit"
                className="bg-brand-green hover:bg-brand-green-hover text-white p-2 rounded cursor-pointer transition-colors"
              >
                <Send className="h-3 w-3" />
              </button>
            </form>
          </div>

        </div>
      </div>

      {/* Full Resolution Attachment Preview Modal */}
      {previewAttachment && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewAttachment(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200"
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
                <a
                  href={previewAttachment.fileData}
                  download={previewAttachment.fileName}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
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
                    PDF document uploaded by student as grievance proof.
                  </p>
                  <div className="flex justify-center gap-3">
                    <a
                      href={previewAttachment.fileData}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-brand-green text-white rounded-lg text-xs font-bold hover:bg-brand-green-hover transition"
                    >
                      Open in New Tab
                    </a>
                    <a
                      href={previewAttachment.fileData}
                      download={previewAttachment.fileName}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition"
                    >
                      Download File
                    </a>
                  </div>
                </div>
              ) : (
                <img
                  src={previewAttachment.fileData}
                  alt={previewAttachment.fileName}
                  className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm border border-slate-200 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Re-open Grievance & Extend SLA Modal (Admin Exclusive) */}
      {isReopenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-[#084325] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/10 rounded-lg">
                  <RotateCcw className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white m-0">Re-open Grievance & Extend SLA</h4>
                  <p className="text-[11px] text-emerald-100 m-0">Administrative override & compliance workflow</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(false)}
                className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleReopenSubmit} className="p-5 space-y-4">
              {reopenError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{reopenError}</span>
                </div>
              )}

              {/* Ticket Details Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Grievance Ticket:</span>
                  <span className="font-mono font-bold text-slate-800">{complaint.ticketId || complaint.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Department:</span>
                  <span className="font-semibold text-slate-800">{complaint.assignedDept} Operations</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Current Status:</span>
                  <span className="font-bold text-amber-700">{complaint.status}</span>
                </div>
                {isOverdue && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>SLA Status:</span>
                    <span>Lapsed / Breached</span>
                  </div>
                )}
              </div>

              {/* Extension Duration Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Select SLA Extension Window <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { hours: 12, label: '+12 Hours', desc: 'Urgent' },
                    { hours: 24, label: '+24 Hours', desc: 'Standard' },
                    { hours: 48, label: '+48 Hours', desc: 'Complex' },
                  ].map(option => (
                    <button
                      key={option.hours}
                      type="button"
                      onClick={() => setExtensionHours(option.hours)}
                      className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                        extensionHours === option.hours
                          ? 'border-[#084325] bg-emerald-50 text-[#084325] ring-2 ring-[#084325]/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{option.label}</div>
                      <div className="text-[10px] text-slate-500">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mandatory Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Mandatory Administrative Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="State the administrative rationale for re-opening this ticket and granting extended SLA (e.g., Unresolved core issue, vendor delay, inspection required)..."
                  rows={4}
                  required
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084325] focus:border-[#084325] text-slate-800 bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-1 m-0">
                  This directive will be stamped in the timeline and displayed on the student tracker.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReopenModalOpen(false)}
                  disabled={isReopening}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReopening}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#084325] hover:bg-[#06331c] rounded-lg shadow-xs transition-all focus:ring-2 focus:ring-emerald-600 disabled:opacity-50 cursor-pointer"
                >
                  {isReopening ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Re-opening...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Confirm & Re-open Grievance</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
