import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Copy, Check } from 'lucide-react';

export default function AddDepartmentHeadModal({ isOpen, onClose, onSave }) {
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('CANTEEN');
  const [emailId, setEmailId] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const role = 'Department Head';

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
    let pass = 'CMS-';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPassword(pass);
    setCopied(false);
  };

  useEffect(() => {
    if (isOpen) {
      generatePassword();
    }
  }, [isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fullName || !emailId) {
      alert('Please fill out all required fields.');
      return;
    }
    onSave({
      fullName,
      role,
      department,
      emailId,
      tempPassword
    });
    setFullName('');
    setEmailId('');
    onClose();
  };

  if (!isOpen) return null;

  const departments = [
    { code: 'CANTEEN', label: 'Canteen' },
    { code: 'TRANSPORT', label: 'Transport' },
    { code: 'HOSTEL', label: 'Hostel' },
    { code: 'SPORTS', label: 'Sports' },
    { code: 'ACADEMIC', label: 'Academic' },
    { code: 'HOSPITALITY', label: 'Hospitality' }
  ];

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
          
          <div className="bg-brand-green text-white p-6 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold m-0 text-white">Add Department Head</h2>
              <p className="text-xs text-brand-yellow font-medium m-0 mt-1">Configure credentials and permissions</p>
            </div>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-emerald-800 rounded-md transition-colors cursor-pointer text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green text-slate-800 transition-all"
                placeholder="e.g. Dr. Rajesh Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                Staff ID / Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green text-slate-800 transition-all"
                placeholder="e.g. rajesh@cmsce.edu"
                value={emailId}
                onChange={(e) => setEmailId(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                Role
              </label>
              <input
                type="text"
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 shadow-sm focus:outline-none cursor-not-allowed"
                value={role}
                readOnly
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                Department
              </label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green text-slate-800 transition-all cursor-pointer"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                {departments.map((dept) => (
                  <option key={dept.code} value={dept.code}>
                    {dept.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                Temporary Password
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-600 shadow-sm focus:outline-none"
                  value={tempPassword}
                />
                
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer text-slate-600 relative group"
                  title="Copy password"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={generatePassword}
                  className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer text-slate-600"
                  title="Regenerate password"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Auto-generated credential for initial staff provisioning.</p>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-sm transition-colors cursor-pointer font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-brand-green hover:bg-brand-green-hover text-white rounded-lg text-sm transition-colors cursor-pointer font-semibold shadow-sm"
              >
                Add Member
              </button>
            </div>

          </form>

        </div>
      </div>
    </>
  );
}
