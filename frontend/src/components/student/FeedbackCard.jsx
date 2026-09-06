import React, { useState, useEffect } from 'react';
import { Star, Lock, CheckCircle2, RotateCcw, Send } from 'lucide-react';
import apiClient from '../../api/client';

export default function FeedbackCard({ complaintId, ticketId, isLocked = true, existingFeedback = null, onFeedbackSubmitted }) {
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [reopenRequested, setReopenRequested] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (existingFeedback && (existingFeedback.rating > 0 || existingFeedback.comments)) {
      setRating(existingFeedback.rating || 0);
      setComments(existingFeedback.comments || '');
      setSelectedTags(existingFeedback.selected_tags || []);
      setReopenRequested(existingFeedback.reopen_requested || false);
      setSubmitted(true);
      setToastMsg('Feedback already submitted for this ticket.');
    }
  }, [existingFeedback]);

  const tagsList = [
    'Prompt Resolution',
    'Fair Communication',
    'High Food Safety',
    'Professional Staff',
    'Quality Improvement'
  ];

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setToastMsg('');

    if (rating === 0) {
      setErrorMsg('Please select a star rating before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await apiClient.complaints.submitFeedback(complaintId || ticketId, {
        rating,
        comments,
        selected_tags: selectedTags,
        reopen_requested: reopenRequested
      });

      setSubmitted(true);
      setToastMsg(reopenRequested ? 'Feedback submitted — issue Reopened!' : 'Feedback submitted successfully!');
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(data);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error — could not submit feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLocked) {
    return (
      <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 text-center opacity-75 relative">
        <div className="flex flex-col items-center justify-center py-4">
          <div className="p-3 bg-slate-200 rounded-full text-slate-500 mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Resolution Feedback Card Locked</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1">
            Feedback and rating options unlock automatically once the department updates ticket status to <strong>Resolved</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-xl border border-emerald-200 relative">

      {toastMsg && (
        <div className="mb-4 p-3 bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          {toastMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-2 border border-rose-200">
          {errorMsg}
        </div>
      )}

      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
        <div>
          <h3 className="text-lg font-black text-slate-900">Resolution Quality Feedback</h3>
          <p className="text-xs text-slate-500 font-medium">Rate your experience for Ticket #{ticketId}</p>
        </div>
        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
          {submitted ? 'Submitted' : 'Unlocked'}
        </span>
      </div>

      <form onSubmit={handleSubmitFeedback} className="space-y-4">

        {/* Star Rating */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Star Rating (1–5) {rating === 0 && <span className="text-rose-500 font-normal normal-case">— required</span>}
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => !submitted && setRating(star)}
                disabled={submitted}
                className="p-1 text-amber-400 hover:scale-110 transition cursor-pointer disabled:cursor-default"
              >
                <Star className={`w-8 h-8 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
              </button>
            ))}
            <span className="ml-2 font-bold text-sm text-slate-700">
              {rating === 0 ? 'No rating selected' : `${rating} / 5 Stars`}
            </span>
          </div>
        </div>

        {/* Tag Chips */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Feedback Tags</label>
          <div className="flex flex-wrap gap-2">
            {tagsList.map((tag) => {
              const isSel = selectedTags.includes(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  onClick={() => !submitted && toggleTag(tag)}
                  disabled={submitted}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer disabled:cursor-default ${
                    isSel
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Comments Box */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Detailed Comments</label>
          <textarea
            rows="3"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            disabled={submitted}
            placeholder="Share your experience regarding the resolution..."
            className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-50 disabled:text-slate-400"
          ></textarea>
        </div>

        {/* Reopen Request Toggle */}
        {!submitted && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-amber-950 block">Reopen Issue Request</span>
              <span className="text-[11px] text-amber-800 block">Check if problem was not fully fixed</span>
            </div>
            <input
              type="checkbox"
              checked={reopenRequested}
              onChange={(e) => setReopenRequested(e.target.checked)}
              className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
            />
          </div>
        )}

        {/* Submit Actions */}
        {!submitted && (
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>

            {reopenRequested && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" /> Reopen Ticket
              </button>
            )}
          </div>
        )}

      </form>
    </div>
  );
}
