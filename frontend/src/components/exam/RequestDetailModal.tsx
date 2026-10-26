import React, { useState } from 'react';
import { X, CheckCircle2, Clock, AlertTriangle, XCircle, User, Phone, Calendar, BookOpen, Trash2 } from 'lucide-react';
import { ExamMaterialRequest } from '../../services/examService';

interface RequestDetailModalProps {
  request: ExamMaterialRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (id: string, newStatus: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  request,
  isOpen,
  onClose,
  onStatusChange,
  onDelete,
}) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !request) return null;

  const handleUpdate = async (status: string) => {
    try {
      setLoading(true);
      await onStatusChange(request.id, status);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this material request?')) {
      try {
        setLoading(true);
        await onDelete(request.id);
        onClose();
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#111b21] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#111b21]/80">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-blue-400 uppercase">
              {request.requestNumber || 'REQUEST DETAILS'}
            </span>
            <h2 className="text-base font-bold text-white tracking-wide">{request.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#202c33]/50 border border-slate-800/80 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Category</span>
              <p className="text-xs font-bold text-white mt-0.5">{request.categoryName || 'DHA'}</p>
            </div>
            <div className="bg-[#202c33]/50 border border-slate-800/80 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Material Type</span>
              <p className="text-xs font-bold text-white mt-0.5">{request.type}</p>
            </div>
            <div className="bg-[#202c33]/50 border border-slate-800/80 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Requested By</span>
              <p className="text-xs font-bold text-white mt-0.5">{request.requestedBy}</p>
            </div>
            <div className="bg-[#202c33]/50 border border-slate-800/80 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Current Status</span>
              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                request.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                request.status === 'In Progress' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                request.status === 'Rejected' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {request.status}
              </span>
            </div>
          </div>

          {/* Candidate Info */}
          {(request.candidateName || request.candidatePhone) && (
            <div className="bg-[#202c33]/30 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Candidate</span>
              <div className="flex items-center gap-4 text-xs text-white">
                {request.candidateName && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{request.candidateName}</span>
                  </div>
                )}
                {request.candidatePhone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono text-[11px] text-slate-300">{request.candidatePhone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {request.notes && (
            <div>
              <span className="text-xs font-semibold text-slate-300 block mb-1">Notes & Specifications</span>
              <p className="text-xs text-slate-300 bg-[#202c33]/50 border border-slate-800 rounded-xl p-3 leading-relaxed">
                {request.notes}
              </p>
            </div>
          )}

          {/* Status Change Buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">Update Status</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={loading || request.status === 'Approved'}
                onClick={() => handleUpdate('Approved')}
                className="py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 text-emerald-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve
              </button>

              <button
                type="button"
                disabled={loading || request.status === 'In Progress'}
                onClick={() => handleUpdate('In Progress')}
                className="py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-500 text-blue-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Clock className="w-3.5 h-3.5" />
                In Progress
              </button>

              <button
                type="button"
                disabled={loading || request.status === 'Rejected'}
                onClick={() => handleUpdate('Rejected')}
                className="py-2 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-500 text-rose-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#202c33]/40 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Request
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
