import React, { useState, useRef } from 'react';
import { Send, Sparkles, AlertTriangle, ShieldCheck, Paperclip, UploadCloud, X, FileText, Image as ImageIcon } from 'lucide-react';
import AIRoutingModal from './AIRoutingModal';
import apiClient from '../../api/client';

export default function ComplaintDesk({ user, onTicketCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Proof Attachments state
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      // Check file type: jpg, jpeg, png, pdf
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      const isExtValid = /\.(jpe?g|png|pdf)$/i.test(file.name);

      if (!validTypes.includes(file.type) && !isExtValid) {
        setErrorMsg(`Unsupported file type: ${file.name}. Only .jpg, .jpeg, .png, and .pdf are accepted.`);
        return;
      }

      // 8MB max size check per file
      if (file.size > 8 * 1024 * 1024) {
        setErrorMsg(`File ${file.name} is too large. Maximum size allowed is 8MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const fileData = reader.result;
        setAttachments((prev) => [
          ...prev,
          {
            fileName: file.name,
            fileData: fileData,
            fileType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
            fileSize: file.size
          }
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (indexToRemove) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAnalyseComplaint = async (e) => {
    e.preventDefault();
    if (analyzing || isSubmitting) return;
    setErrorMsg('');

    if (!title.trim() || !description.trim()) {
      setErrorMsg('Please enter both a title and description before analyzing.');
      return;
    }

    setAnalyzing(true);

    try {
      const data = await apiClient.ai.analyseComplaint({
        title: title.trim(),
        description: description.trim()
      });

      if (data.isValid === false) {
        setErrorMsg(data.reasoning || data.error || 'The provided text does not contain a coherent or actionable campus grievance. Please provide specific details.');
        return;
      }

      setAiResult(data);
      setIsModalOpen(true);
    } catch (err) {
      console.error('[Gemini AI] Analysis error:', err);
      setErrorMsg(err.message || 'The provided text does not contain a coherent or actionable campus grievance. Please provide specific details.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const data = await apiClient.complaints.create({
        title: title.trim(),
        description: description.trim(),
        is_anonymous: isAnonymous,
        category: aiResult?.category,
        department: aiResult?.assigned_dept_code,
        priority: aiResult?.priority,
        ai_confidence_score: aiResult?.ai_confidence_score,
        ai_routing_reasoning: aiResult?.reasoning,
        sla_hours: aiResult?.sla_hours,
        attachments: attachments
      });

      setIsModalOpen(false);
      setAttachments([]);
      if (data && data.ticket_id) {
        onTicketCreated(data.ticket_id);
      } else {
        setErrorMsg('Complaint created but failed to get ticket ID.');
      }
    } catch (err) {
      console.error('Submit complaint error:', err);
      setIsModalOpen(false);
      setErrorMsg(err.message || 'Failed to persist complaint to database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">

      {/* Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl mb-8 border border-slate-800 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold mb-3 border border-emerald-500/30">
            <Sparkles className="w-4 h-4" /> AI Neural Priority Engine Active
          </div>
          <h1 className="text-2xl font-black tracking-tight">Student Complaint Desk</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Describe your complaint in natural language. Our AI engine will automatically evaluate priority, detect safety hazards, and assign the appropriate department.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Complaint Desk Form */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
        <form onSubmit={handleAnalyseComplaint} className="space-y-5">

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Complaint Subject / Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Route 4 college bus delayed again"
              className="w-full p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Detailed Description (Natural Language)
            </label>
            <textarea
              rows="4"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the issue clearly..."
              className="w-full p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            ></textarea>
          </div>

          {/* Attach Proof / Image (Optional) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-slate-500" />
              Attach Proof / Image (Optional)
            </label>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,image/jpg,application/pdf"
              className="hidden"
            />

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-emerald-50/30 group"
            >
              <div className="flex flex-col items-center justify-center gap-1.5">
                <UploadCloud className="w-7 h-7 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                <span className="text-xs font-semibold text-slate-600 group-hover:text-emerald-700">
                  Click to upload or drag & drop proof files
                </span>
                <span className="text-[10px] text-slate-400">
                  Supports Images (.jpg, .jpeg, .png) and PDF documents (max 8MB each)
                </span>
              </div>
            </div>

            {/* Selected Attachment Pills / Previews */}
            {attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map((file, idx) => {
                  const isPdf = file.fileType?.includes('pdf') || file.fileName?.endsWith('.pdf');
                  return (
                    <div 
                      key={idx}
                      className="flex items-center gap-2 bg-slate-100 border border-slate-200 pl-2.5 pr-2 py-1.5 rounded-lg text-xs"
                    >
                      {isPdf ? (
                        <FileText className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      )}
                      
                      <div className="max-w-[160px] truncate">
                        <span className="font-semibold text-slate-700 truncate block">
                          {file.fileName}
                        </span>
                        {file.fileSize && (
                          <span className="text-[9px] text-slate-400 block leading-tight">
                            {formatFileSize(file.fileSize)}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveAttachment(idx);
                        }}
                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer ml-1"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Anonymous Checkbox */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-slate-600" />
              <div>
                <span className="text-xs font-bold text-slate-800 block">File Anonymously</span>
                <span className="text-[10px] text-slate-500 block">Hide your student identity from staff</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          <button
            type="submit"
            disabled={analyzing || isSubmitting}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <span>Analyzing Text with AI...</span>
            ) : (
              <>
                <Sparkles className="w-5 h-5" /> Analyze with AI & Route Ticket
              </>
            )}
          </button>

        </form>
      </div>

      {/* AI Routing Classification Modal */}
      <AIRoutingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        aiResult={aiResult}
        onConfirmSubmit={handleConfirmSubmit}
        isSubmitting={isSubmitting}
      />

    </div>
  );
}
