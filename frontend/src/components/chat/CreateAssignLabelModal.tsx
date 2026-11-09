import React, { useState } from 'react';
import { Tag, X, Check, Loader2, Sparkles, Building2 } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

export interface CreateAssignLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLeadId?: string | null;
  onLabelCreated?: (labelId: string) => void;
}

const PRESET_COLORS = [
  { name: 'Amber', hex: '#f59e0b', dot: 'bg-amber-400' },
  { name: 'Rose', hex: '#f43f5e', dot: 'bg-rose-400' },
  { name: 'Emerald', hex: '#10b981', dot: 'bg-emerald-400' },
  { name: 'Sky', hex: '#0ea5e9', dot: 'bg-sky-400' },
  { name: 'Purple', hex: '#8b5cf6', dot: 'bg-purple-400' },
  { name: 'Teal', hex: '#0d9488', dot: 'bg-teal-400' },
  { name: 'Indigo', hex: '#6366f1', dot: 'bg-indigo-400' },
  { name: 'Orange', hex: '#f97316', dot: 'bg-orange-400' },
  { name: 'Pink', hex: '#ec4899', dot: 'bg-pink-400' },
  { name: 'Cyan', hex: '#06b6d4', dot: 'bg-cyan-400' },
  { name: 'Red', hex: '#ef4444', dot: 'bg-red-400' },
  { name: 'Lime', hex: '#84cc16', dot: 'bg-lime-400' },
];

export const CreateAssignLabelModal: React.FC<CreateAssignLabelModalProps> = ({
  isOpen,
  onClose,
  targetLeadId,
  onLabelCreated
}) => {
  const { addChatLabel, toggleLeadLabel, notify } = useCrm();

  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#f59e0b');
  const [description, setDescription] = useState('');
  const [company, setCompany] = useState<'ALL' | 'RWC' | 'CRAS' | 'AHC'>('ALL');
  const [assignImmediately, setAssignImmediately] = useState<boolean>(Boolean(targetLeadId));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a label name.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await addChatLabel({
        name: trimmedName,
        color: selectedColor,
        description: description.trim() || undefined,
        company: company,
        allowedRoles: 'ALL'
      });

      if (!result.success) {
        setError(result.error || 'Failed to create assign label');
        setIsSubmitting(false);
        return;
      }

      const createdLabelId = result.label?.id || result.label?.key || trimmedName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

      // If targetLeadId and assignImmediately are true, assign right away
      if (targetLeadId && assignImmediately && createdLabelId) {
        await toggleLeadLabel(targetLeadId, createdLabelId);
      }

      if (onLabelCreated && createdLabelId) {
        onLabelCreated(createdLabelId);
      }

      // Reset & Close
      setName('');
      setDescription('');
      setSelectedColor('#f59e0b');
      setCompany('ALL');
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#1f2c34] text-[#d1d7db] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between bg-[#111b21]/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Add New Assign Label</h3>
              <p className="text-[11px] text-[#8696a0]">Create a custom label synced with Supabase</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8696a0] hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Label Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8696a0] flex items-center justify-between">
              <span>Label Name <span className="text-rose-400">*</span></span>
              <span className="text-[10px] text-slate-500 font-normal">e.g. VIP Patient, Hot Lead</span>
            </label>
            <div className="relative flex items-center">
              <span
                className="absolute left-3 w-3 h-3 rounded-full transition-transform duration-150"
                style={{ backgroundColor: selectedColor }}
              />
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter assign label name..."
                autoFocus
                className="w-full pl-8 pr-3 py-2 bg-[#111b21] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          {/* Color Palette */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#8696a0] flex items-center justify-between">
              <span>Color Tag</span>
              <span className="text-[11px] font-mono text-slate-400 uppercase">{selectedColor}</span>
            </label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((c) => {
                const isSelected = selectedColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setSelectedColor(c.hex)}
                    title={c.name}
                    className={`h-8 rounded-lg flex items-center justify-center transition-all ${
                      isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1f2c34] scale-105' : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3] drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Company Scope Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8696a0] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>Company Scope</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5 bg-[#111b21] p-1 rounded-xl border border-slate-700">
              {(['ALL', 'RWC', 'CRAS', 'AHC'] as const).map((comp) => (
                <button
                  key={comp}
                  type="button"
                  onClick={() => setCompany(comp)}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    company === comp
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-[#8696a0] hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {comp === 'ALL' ? 'Both' : comp}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8696a0]">
              Description <span className="text-[10px] text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this label used for?"
              className="w-full px-3 py-2 bg-[#111b21] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          {/* Live Preview Card */}
          <div className="p-3 rounded-xl bg-[#111b21] border border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-[#8696a0]">Live Preview:</span>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border"
              style={{
                backgroundColor: `${selectedColor}20`,
                color: selectedColor,
                borderColor: `${selectedColor}40`
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: selectedColor }}
              />
              <span>{name.trim() || 'Label Preview'}</span>
            </span>
          </div>

          {/* Assign Immediately Toggle (if target lead exists) */}
          {targetLeadId && (
            <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={assignImmediately}
                onChange={(e) => setAssignImmediately(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-teal-600 focus:ring-0 focus:ring-offset-0 bg-[#111b21]"
              />
              <span className="text-xs text-slate-300">
                Assign immediately to the selected chat
              </span>
            </label>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-[#8696a0] hover:text-white rounded-xl hover:bg-slate-700/40 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-lg shadow-teal-900/30 flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create Label</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
