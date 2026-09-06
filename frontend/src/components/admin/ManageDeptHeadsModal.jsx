import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Edit3, 
  Mail, 
  Phone, 
  User, 
  Key, 
  RefreshCw, 
  Copy, 
  Check, 
  Building2, 
  Utensils, 
  Bus, 
  Trophy, 
  GraduationCap, 
  ShieldCheck, 
  ChevronLeft, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import apiClient from '../../api/client';

export default function ManageDeptHeadsModal({ isOpen, onClose }) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingDept, setEditingDept] = useState(null); // When set, shows edit sub-panel or inline form

  // Form states for editing department head
  const [headName, setHeadName] = useState('');
  const [headEmail, setHeadEmail] = useState('');
  const [headPhone, setHeadPhone] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fixedDeptCodes = ['CANTEEN', 'TRANSPORT', 'HOSTEL', 'SPORTS', 'ACADEMIC', 'HOSPITALITY'];

  const getDeptIcon = (code) => {
    switch (code) {
      case 'CANTEEN': return <Utensils className="h-5 w-5 text-orange-600" />;
      case 'TRANSPORT': return <Bus className="h-5 w-5 text-sky-600" />;
      case 'HOSTEL': return <Building2 className="h-5 w-5 text-purple-600" />;
      case 'SPORTS': return <Trophy className="h-5 w-5 text-amber-600" />;
      case 'ACADEMIC': return <GraduationCap className="h-5 w-5 text-emerald-600" />;
      case 'HOSPITALITY': return <ShieldCheck className="h-5 w-5 text-indigo-600" />;
      default: return <Building2 className="h-5 w-5 text-slate-600" />;
    }
  };

  const getDeptColorBadge = (code) => {
    switch (code) {
      case 'CANTEEN': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'TRANSPORT': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'HOSTEL': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'SPORTS': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'ACADEMIC': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'HOSPITALITY': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const data = await apiClient.departments.list();
      if (Array.isArray(data)) {
        // Sort according to standard fixed departments order
        const sorted = [...data].sort((a, b) => {
          const idxA = fixedDeptCodes.indexOf(a.code);
          const idxB = fixedDeptCodes.indexOf(b.code);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          return a.code.localeCompare(b.code);
        });
        setDepartments(sorted);
      }
    } catch (err) {
      console.warn('Error loading departments:', err.message);
      setError('Could not load department records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMsg('');
      setEditingDept(null);
      loadDepartments();
    }
  }, [isOpen]);

  const generatePassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
    let pass = 'Dept#';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPassword(pass);
    setCopied(false);
  };

  const handleStartEdit = (dept) => {
    setEditingDept(dept);
    setError('');
    setSuccessMsg('');
    setHeadName(dept.head?.name || '');
    setHeadEmail(dept.head?.email || `${dept.code.toLowerCase()}@cmsce.edu`);
    setHeadPhone(dept.head?.phone || '');
    setTempPassword('');
  };

  const handleCopy = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingDept) return;
    setError('');
    setSuccessMsg('');

    if (!headName.trim() || !headEmail.trim()) {
      setError('Head Name and Official Email are required.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        id: editingDept._id || editingDept.id,
        code: editingDept.code,
        headName: headName.trim(),
        headEmail: headEmail.toLowerCase().trim(),
        headPhone: headPhone.trim(),
        ...(tempPassword.trim() ? { tempPassword: tempPassword.trim() } : {})
      };

      const res = await apiClient.departments.update(editingDept.code, payload);
      
      setSuccessMsg(`Credentials for ${editingDept.name || editingDept.code} successfully saved!`);
      
      // Refresh list
      await loadDepartments();

      setTimeout(() => {
        setSuccessMsg('');
        setEditingDept(null);
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to update department head.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 my-8 flex flex-col max-h-[90vh]">
          
          {/* Modal Header */}
          <div className="bg-brand-green text-white p-6 flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-800/90 border border-emerald-500/40 flex items-center justify-center text-brand-yellow shadow-inner">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold m-0 text-white leading-tight">
                  Manage Department Heads
                </h2>
                <p className="text-xs text-brand-yellow font-medium m-0 mt-0.5">
                  6 Core College Operations & Escalation Unit Directory
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer text-white/80 hover:text-white"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto flex-1">
            
            {/* Feedback messages */}
            {error && (
              <div className="flex items-center gap-2 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg mb-4">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="flex items-center gap-2 p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg mb-4">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* View 1: Edit Form Subpanel */}
            {editingDept ? (
              <div className="animate-in fade-in-50 duration-200">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDept(null);
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-green cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Back to All Departments</span>
                  </button>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getDeptColorBadge(editingDept.code)}`}>
                    {editingDept.code}
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 flex items-center gap-3">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                    {getDeptIcon(editingDept.code)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 m-0">
                      {editingDept.name || editingDept.code}
                    </h3>
                    <p className="text-xs text-slate-500 m-0 mt-0.5">
                      Target SLA: <strong className="text-slate-700">{editingDept.slaHours || 24} hours</strong> • Role: <span className="font-semibold text-emerald-700">Department Head</span>
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Head Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Assigned Head Full Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <User className="h-4 w-4" />
                        </span>
                        <input
                          type="text"
                          required
                          className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green text-slate-800 transition-all font-medium"
                          placeholder="e.g. Dr. Rajesh Kumar"
                          value={headName}
                          onChange={(e) => setHeadName(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Official Email / Login ID */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Official Email / Login ID <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Mail className="h-4 w-4" />
                        </span>
                        <input
                          type="email"
                          required
                          className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green text-slate-800 transition-all font-medium"
                          placeholder="e.g. canteen@cmsce.edu"
                          value={headEmail}
                          onChange={(e) => setHeadEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Official Phone / Extension
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Phone className="h-4 w-4" />
                        </span>
                        <input
                          type="text"
                          className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green text-slate-800 transition-all font-medium"
                          placeholder="e.g. +91 94441 12233"
                          value={headPhone}
                          onChange={(e) => setHeadPhone(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Fixed Role */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        System Authority Role
                      </label>
                      <input
                        type="text"
                        readOnly
                        className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 font-semibold cursor-not-allowed"
                        value="Department Head"
                      />
                    </div>
                  </div>

                  {/* Temporary Password Reset Section */}
                  <div className="pt-3 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-800 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-slate-600" />
                      Reset Temporary Password
                    </label>
                    <p className="text-xs text-slate-500 mb-2">
                      Leave blank to preserve existing password. Setting a value immediately updates staff credentials.
                    </p>

                    <div className="flex gap-2 max-w-md">
                      <input
                        type="text"
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
                        placeholder="Click generate or type password"
                        value={tempPassword}
                        onChange={(e) => setTempPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={generatePassword}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Generate secure password"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Generate</span>
                      </button>
                      {tempPassword && (
                        <button
                          type="button"
                          onClick={handleCopy}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                          title="Copy to clipboard"
                        >
                          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex gap-3 pt-4 border-t border-slate-200 justify-end">
                    <button
                      type="button"
                      onClick={() => setEditingDept(null)}
                      disabled={saving}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-sm transition-colors cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2 bg-brand-green hover:bg-brand-green-hover text-white rounded-lg text-sm transition-colors cursor-pointer font-semibold shadow-sm flex items-center gap-2"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      <Save className="h-4 w-4" />
                      <span>Save Department Head</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* View 2: All 6 Departments Table */
              <div>
                {loading ? (
                  <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
                    <span className="text-xs font-medium">Loading department records...</span>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                          <th className="px-5 py-3.5">Department</th>
                          <th className="px-5 py-3.5">Assigned Head</th>
                          <th className="px-5 py-3.5">Official Email / ID</th>
                          <th className="px-5 py-3.5">Phone</th>
                          <th className="px-5 py-3.5">Role</th>
                          <th className="px-5 py-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {departments.map((dept) => {
                          const head = dept.head || {};
                          return (
                            <tr key={dept.code} className="hover:bg-slate-50/80 transition-colors">
                              
                              {/* Department Title & Code */}
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-slate-100 border border-slate-200/80">
                                    {getDeptIcon(dept.code)}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 leading-tight">
                                      {dept.name}
                                    </div>
                                    <span className={`inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-bold border uppercase tracking-wider ${getDeptColorBadge(dept.code)}`}>
                                      {dept.code}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Head Name */}
                              <td className="px-5 py-4">
                                <div className="font-semibold text-slate-800">
                                  {head.name || <span className="text-slate-400 italic">Not Assigned</span>}
                                </div>
                              </td>

                              {/* Official Email / Login ID */}
                              <td className="px-5 py-4">
                                <div className="text-xs text-slate-600 font-mono flex items-center gap-1.5">
                                  <Mail className="h-3 w-3 text-slate-400" />
                                  <span>{head.email || `${dept.code.toLowerCase()}@cmsce.edu`}</span>
                                </div>
                              </td>

                              {/* Phone */}
                              <td className="px-5 py-4 text-xs text-slate-600">
                                {head.phone ? (
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="h-3 w-3 text-slate-400" />
                                    <span>{head.phone}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              {/* Role */}
                              <td className="px-5 py-4">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Department Head
                                </span>
                              </td>

                              {/* Action: Edit button */}
                              <td className="px-5 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(dept)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-brand-green hover:text-white text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-sm border border-slate-200 hover:border-brand-green"
                                  title={`Edit head details for ${dept.code}`}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  <span>Edit</span>
                                </button>
                              </td>

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Modal Footer */}
          <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 flex-shrink-0">
            <span>6 Dedicated Grievance Units Enforced</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
