import React, { useState } from 'react';
import { Megaphone, Users, Trash2, Clock, AlertCircle } from 'lucide-react';

export default function BroadcastSystem({ onPublishAnnouncement, publishedAnnouncements = [], onDeleteAnnouncement }) {
  const [audience, setAudience] = useState('ALL_STUDENTS');
  const [specificDept, setSpecificDept] = useState('CANTEEN');
  const [isUrgent, setIsUrgent] = useState(false);
  const [message, setMessage] = useState('');

  const departments = [
    { code: 'CANTEEN', label: 'Canteen' },
    { code: 'TRANSPORT', label: 'Transport' },
    { code: 'HOSTEL', label: 'Hostel' },
    { code: 'SPORTS', label: 'Sports' },
    { code: 'ACADEMIC', label: 'Academic' },
    { code: 'HOSPITALITY', label: 'Hospitality' }
  ];

  const getTargetBadgeLabel = (bc) => {
    const aud = bc.targetAudience || bc.audience;
    const dept = bc.targetDepartment || bc.departmentCode;

    if (aud === 'ALL_STUDENTS' || aud === 'All Students') {
      return 'All Students';
    }
    if (aud === 'ALL_DEPTS' || aud === 'ALL_DEPT_HEADS' || aud === 'All Department Heads' || aud === 'All Dept Heads') {
      return 'All Dept Heads';
    }
    if (aud === 'SPECIFIC_DEPT' || dept) {
      const found = departments.find(d => d.code === (dept || '').toUpperCase());
      return `${found ? found.label : (dept || 'Dept')} Only`;
    }
    return 'All Students';
  };

  const getTargetBadgeColor = (bc) => {
    const aud = bc.targetAudience || bc.audience;
    if (aud === 'ALL_STUDENTS' || aud === 'All Students') {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    if (aud === 'ALL_DEPTS' || aud === 'ALL_DEPT_HEADS' || aud === 'All Department Heads') {
      return 'bg-blue-50 text-blue-800 border-blue-200';
    }
    return 'bg-purple-50 text-purple-800 border-purple-200';
  };

  const getFormattedDate = (bc) => {
    const raw = bc.createdAt || bc.created_at || bc.timestamp;
    if (!raw) return 'Recently';
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return String(raw);
      return d.toLocaleString([], {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return 'Recently';
    }
  };

  const handlePublish = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    onPublishAnnouncement({
      title: 'CMS Portal Broadcast Notice',
      message: message.trim(),
      content: message.trim(),
      targetAudience: audience,
      targetDepartment: audience === 'SPECIFIC_DEPT' ? specificDept : null,
      departmentCode: audience === 'SPECIFIC_DEPT' ? specificDept : '',
      priority: isUrgent ? 'URGENT' : 'NORMAL'
    });

    setMessage('');
  };

  const currentPreviewTarget = audience === 'ALL_STUDENTS' 
    ? 'All Students' 
    : audience === 'ALL_DEPTS' 
      ? 'All Dept Heads' 
      : `${departments.find(d => d.code === specificDept)?.label || specificDept} Only`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-[1600px] mx-auto px-6 py-6 animate-in fade-in duration-300">
      
      {/* Left Column: Compose Broadcast */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <Megaphone className="h-6 w-6 text-brand-green" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 m-0">Compose Broadcast Notice</h2>
            <p className="text-xs text-slate-500 m-0">Send isolated campus notices to students, all departments, or a specific unit.</p>
          </div>
        </div>

        <form onSubmit={handlePublish} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              Target Audience
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green text-slate-800 transition-all cursor-pointer"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="ALL_STUDENTS">All Students</option>
              <option value="ALL_DEPTS">All Dept Heads</option>
              <option value="SPECIFIC_DEPT">Specific Department</option>
            </select>
          </div>

          {audience === 'SPECIFIC_DEPT' && (
            <div className="animate-in slide-in-from-top duration-200">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                Select Department
              </label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green text-slate-800 transition-all cursor-pointer"
                value={specificDept}
                onChange={(e) => setSpecificDept(e.target.value)}
              >
                {departments.map((dept) => (
                  <option key={dept.code} value={dept.code}>
                    {dept.label} ({dept.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              Priority Level
            </label>
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setIsUrgent(false)}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  !isUrgent 
                    ? 'bg-white text-brand-green shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                NORMAL
              </button>
              <button
                type="button"
                onClick={() => setIsUrgent(true)}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  isUrgent 
                    ? 'bg-rose-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                URGENT / CRITICAL
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              Broadcast Message
            </label>
            <textarea
              required
              rows="5"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green text-slate-800 transition-all"
              placeholder="Type announcement notice description..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={!message.trim()}
            className="w-full bg-brand-green hover:bg-brand-green-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition-colors shadow-sm cursor-pointer"
          >
            Publish Broadcast Notice
          </button>

        </form>
      </div>

      {/* Right Column: Live Preview & Broadcast History */}
      <div className="space-y-6">
        
        {/* Live Preview Card */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider m-0">Live Preview</h3>
          
          <div className={`bg-white rounded-xl border p-5 shadow-sm space-y-3 transition-all relative ${
            isUrgent ? 'border-rose-300 ring-2 ring-rose-500/20' : 'border-slate-200'
          }`}>
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-700">
                  Target: <span className="text-brand-green font-extrabold">{currentPreviewTarget}</span>
                </span>
              </div>
              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                isUrgent 
                  ? 'bg-rose-100 text-rose-800 border-rose-200 animate-pulse' 
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {isUrgent ? 'URGENT / CRITICAL' : 'NORMAL'}
              </span>
            </div>
            
            <h4 className="text-slate-800 font-bold text-sm m-0 flex items-center gap-1.5">
              <Megaphone className="h-4 w-4 text-brand-green" />
              CMS Portal Broadcast Notice
            </h4>
            
            <p className="text-sm text-slate-600 font-medium whitespace-pre-wrap leading-relaxed min-h-[50px]">
              {message.trim() || 'Type your message in the compose box to preview...'}
            </p>
            
            <div className="text-[10px] text-slate-400 font-semibold border-t border-slate-100 pt-2 flex items-center justify-between">
              <span>Author: Campus Administration</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date().toLocaleString([], { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Sent / Broadcast History Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 max-h-[420px] flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider m-0">
              Broadcast History ({publishedAnnouncements.length})
            </h3>
            <span className="text-[10px] text-slate-400 font-semibold">Strict Role Isolation Active</span>
          </div>
          
          {publishedAnnouncements.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-8 text-center">No broadcasts published yet.</p>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {publishedAnnouncements.map((bc) => {
                const isItemUrgent = bc.priority === 'URGENT' || bc.priority === 'CRITICAL' || bc.isUrgent;
                const targetText = getTargetBadgeLabel(bc);
                const targetColor = getTargetBadgeColor(bc);
                const formattedTime = getFormattedDate(bc);

                return (
                  <div 
                    key={bc.id || bc._id} 
                    className="p-3.5 border border-slate-200 rounded-xl flex justify-between items-start gap-4 hover:bg-slate-50 transition-colors bg-white shadow-xs"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Badges: Target Badge & Priority Badge */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${targetColor}`}>
                          Target: {targetText}
                        </span>
                        
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                          isItemUrgent 
                            ? 'bg-rose-100 text-rose-800 border-rose-200' 
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {isItemUrgent ? 'URGENT / CRITICAL' : 'NORMAL'}
                        </span>
                      </div>

                      {/* Message Content */}
                      <p className="text-xs text-slate-700 font-medium leading-relaxed break-words">
                        {bc.message || bc.content}
                      </p>

                      {/* Formatted Date & Time */}
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                        <Clock className="h-3 w-3" />
                        <span>{formattedTime}</span>
                      </div>
                    </div>

                    {/* Delete announcement action button */}
                    <button
                      type="button"
                      onClick={() => onDeleteAnnouncement(bc.id || bc._id)}
                      className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer flex-shrink-0"
                      title="Delete announcement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
