import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Mail, IdCard, Phone, User, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import apiClient from '../../api/client';

export default function AdminProfileModal({ isOpen, onClose, currentUser, onAdminUpdated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('CMSCE-ADM-001');
  const [role, setRole] = useState('Administrator');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMsg('');
      setPassword('');
      setConfirmPassword('');

      // Populate initial values from current user or fetch from backend
      if (currentUser) {
        setName(currentUser.name || currentUser.full_name || 'Dr. K. Ramanathan');
        setEmail(currentUser.email || 'admin@cmsce.edu');
        setPhone(currentUser.phone || '+91 98765 43210');
        setEmployeeId(currentUser.employeeId || 'CMSCE-ADM-001');
        setRole(currentUser.role === 'ADMIN' ? 'System Administrator' : currentUser.role || 'Administrator');
      }

      // Fetch fresh profile from API
      apiClient.admin.getProfile()
        .then((res) => {
          if (res && res.admin) {
            const adm = res.admin;
            setName(adm.name || adm.full_name || 'Dr. K. Ramanathan');
            setEmail(adm.email || 'admin@cmsce.edu');
            setPhone(adm.phone || '');
            setEmployeeId(adm.employeeId || 'CMSCE-ADM-001');
            setRole(adm.role === 'ADMIN' ? 'System Administrator' : adm.role || 'Administrator');
          }
        })
        .catch((err) => {
          console.warn('Failed to fetch admin profile:', err.message);
        });
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!name.trim()) {
      setError('Admin name is required.');
      return;
    }

    if (password) {
      if (password.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter.');
        return;
      }
    }

    try {
      setLoading(true);
      const payload = {
        name: name.trim(),
        phone: phone.trim()
      };

      if (password && password.trim()) {
        payload.password = password.trim();
      }

      const res = await apiClient.admin.updateProfile(payload);
      const updatedAdmin = res.admin || { ...currentUser, name: payload.name, phone: payload.phone };

      setSuccessMsg('Profile updated successfully!');
      setPassword('');
      setConfirmPassword('');

      if (onAdminUpdated) {
        onAdminUpdated(updatedAdmin);
      }

      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to update admin profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 my-8">
          
          {/* Header */}
          <div className="bg-brand-green text-white p-6 flex justify-between items-center relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-800/90 border border-emerald-500/40 flex items-center justify-center text-brand-yellow shadow-inner">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold m-0 text-white leading-tight">
                  Admin Profile & Settings
                </h2>
                <p className="text-xs text-brand-yellow font-medium m-0 mt-0.5">
                  CMSCE Central Administration Credential Manager
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            
            {/* Notifications / Alerts */}
            {error && (
              <div className="flex items-center gap-2 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="flex items-center gap-2 p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Read-only Identity Badges */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  <IdCard className="h-3.5 w-3.5 text-slate-400" />
                  <span>Employee ID</span>
                </div>
                <div className="font-mono text-xs font-bold text-slate-800 bg-white px-2.5 py-1.5 rounded-md border border-slate-200">
                  {employeeId}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>System Role</span>
                </div>
                <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-md border border-emerald-200 truncate">
                  {role}
                </div>
              </div>

              <div className="col-span-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span>Official Institutional Email</span>
                </div>
                <div className="text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 flex justify-between items-center">
                  <span>{email}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-mono">Managed by IT</span>
                </div>
              </div>
            </div>

            {/* Editable Profile Information */}
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Admin Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    required
                    className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green text-slate-800 transition-all font-medium"
                    placeholder="e.g. Dr. K. Ramanathan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

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
                    placeholder="e.g. +91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Password Reset Section */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                  <Lock className="h-3.5 w-3.5 text-slate-600" />
                  Reset Admin Password
                </label>
                <span className="text-[11px] text-slate-400">Leave blank to keep unchanged</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green text-slate-800 transition-all"
                      placeholder="Min. 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green text-slate-800 transition-all"
                      placeholder="Re-type new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-sm transition-colors cursor-pointer font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-brand-green hover:bg-brand-green-hover text-white rounded-lg text-sm transition-colors cursor-pointer font-semibold shadow-sm flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Save Profile Changes</span>
              </button>
            </div>

          </form>

        </div>
      </div>
    </>
  );
}
