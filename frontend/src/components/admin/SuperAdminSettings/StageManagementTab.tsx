import React, { useState } from 'react';
import { useCrm } from '../../../context/CrmContext';
import { LeadStageConfig } from '../../../types';
import {
  KanbanSquare,
  Plus,
  ArrowUp,
  ArrowDown,
  Pencil,
  Power,
  Lock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  X,
  Palette,
  Layers,
  HelpCircle
} from 'lucide-react';

const PRESET_COLORS = [
  '#f43f5e', // Rose
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#a855f7', // Purple
  '#0ea5e9', // Sky
  '#64748b', // Slate
  '#71717a', // Zinc
  '#14b8a6', // Teal
  '#ef4444', // Red
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#f97316', // Orange
];

export const StageManagementTab: React.FC = () => {
  const { stages, addStage, updateStage, reorderStages, toggleStageStatus } = useCrm();

  // Add Stage Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [addError, setAddError] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit Stage Modal State
  const [editingStage, setEditingStage] = useState<LeadStageConfig | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('#6366f1');
  const [editError, setEditError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Toggle Confirm Modal State
  const [togglingStage, setTogglingStage] = useState<LeadStageConfig | null>(null);
  const [toggleError, setToggleError] = useState('');
  const [isSubmittingToggle, setIsSubmittingToggle] = useState(false);

  // Sorted stages by orderIndex
  const sortedStages = [...stages].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  const totalCount = stages.length;
  const activeCount = stages.filter((s) => s.isActive !== false).length;
  const systemCount = stages.filter((s) => s.isSystem).length;

  const isSystemStage = (stage: LeadStageConfig) => {
    return Boolean(
      stage.isSystem ||
      ['new', 'converted', 'lost'].includes(stage.key.toLowerCase())
    );
  };

  // Reorder up
  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const current = sortedStages[index];
    const prev = sortedStages[index - 1];

    const newOrder = sortedStages.map((s, idx) => {
      if (idx === index - 1) return { id: current.id, orderIndex: idx };
      if (idx === index) return { id: prev.id, orderIndex: idx };
      return { id: s.id, orderIndex: idx };
    });

    await reorderStages(newOrder);
  };

  // Reorder down
  const handleMoveDown = async (index: number) => {
    if (index >= sortedStages.length - 1) return;
    const current = sortedStages[index];
    const next = sortedStages[index + 1];

    const newOrder = sortedStages.map((s, idx) => {
      if (idx === index) return { id: next.id, orderIndex: idx };
      if (idx === index + 1) return { id: current.id, orderIndex: idx };
      return { id: s.id, orderIndex: idx };
    });

    await reorderStages(newOrder);
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setKey('');
    setLabel('');
    setDescription('');
    setColor(PRESET_COLORS[9]); // Indigo
    setAddError('');
    setShowAddModal(true);
  };

  const handleCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const cleanLabel = label.trim();

    if (!cleanKey) {
      setAddError('Stage identifier key is required (e.g. appointment_booked).');
      return;
    }
    if (!cleanLabel) {
      setAddError('Stage label is required.');
      return;
    }

    // Check duplicate key or label
    const duplicate = stages.find(
      (s) =>
        s.key.toLowerCase() === cleanKey ||
        s.label.toLowerCase() === cleanLabel.toLowerCase()
    );
    if (duplicate) {
      setAddError(`A stage with key "${cleanKey}" or label "${cleanLabel}" already exists.`);
      return;
    }

    setIsSubmittingAdd(true);
    const maxOrder = sortedStages.reduce((max, s) => Math.max(max, s.orderIndex ?? 0), 0);

    const res = await addStage({
      key: cleanKey,
      label: cleanLabel,
      description: description.trim() || undefined,
      color,
      orderIndex: maxOrder + 1,
    });

    setIsSubmittingAdd(false);
    if (!res.success) {
      setAddError(res.error || 'Failed to create stage');
    } else {
      setShowAddModal(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (s: LeadStageConfig) => {
    setEditingStage(s);
    setEditLabel(s.label);
    setEditDescription(s.description || '');
    setEditColor(s.color || '#6366f1');
    setEditError('');
  };

  const handleUpdateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStage) return;
    setEditError('');

    const cleanLabel = editLabel.trim();
    if (!cleanLabel) {
      setEditError('Stage label is required.');
      return;
    }

    // Check duplicate label excluding self
    const duplicate = stages.find(
      (s) => s.id !== editingStage.id && s.label.toLowerCase() === cleanLabel.toLowerCase()
    );
    if (duplicate) {
      setEditError(`A stage with label "${cleanLabel}" already exists.`);
      return;
    }

    setIsSubmittingEdit(true);
    const res = await updateStage(editingStage.id, {
      label: cleanLabel,
      description: editDescription.trim() || undefined,
      color: editColor,
    });

    setIsSubmittingEdit(false);
    if (!res.success) {
      setEditError(res.error || 'Failed to update stage');
    } else {
      setEditingStage(null);
    }
  };

  // Toggle Confirm
  const handleConfirmToggle = async () => {
    if (!togglingStage) return;
    setToggleError('');

    if (isSystemStage(togglingStage) && togglingStage.isActive) {
      setToggleError('System stages (New, Converted, Lost) cannot be deactivated.');
      return;
    }

    setIsSubmittingToggle(true);
    const nextStatus = !togglingStage.isActive;
    const res = await toggleStageStatus(togglingStage.id, nextStatus);

    setIsSubmittingToggle(false);
    if (!res.success) {
      setToggleError(res.error || 'Failed to toggle stage status');
    } else {
      setTogglingStage(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Configured Pipeline Stages</p>
            <p className="text-2xl font-bold text-slate-100 font-mono mt-0.5">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <KanbanSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Active In Kanban</p>
            <p className="text-2xl font-bold text-emerald-400 font-mono mt-0.5">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Protected System Stages</p>
            <p className="text-2xl font-bold text-amber-400 font-mono mt-0.5">{systemCount || 3}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar: Title & Add Button */}
      <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-200">
            Pipeline Column Display Sequence (Ordered Left to Right)
          </span>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-950/40 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Stage</span>
        </button>
      </div>

      {/* Ordered Stages Table / List */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4 w-16 text-center">Order</th>
                <th className="py-3 px-4">Stage Label & Key</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Color Tag</th>
                <th className="py-3 px-4">System Guard</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sortedStages.map((stage, idx) => {
                const isSystem = isSystemStage(stage);
                const isActive = stage.isActive !== false;
                const isFirst = idx === 0;
                const isLast = idx === sortedStages.length - 1;

                return (
                  <tr
                    key={stage.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Order Controls */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          disabled={isFirst}
                          onClick={() => handleMoveUp(idx)}
                          title="Move Left / Earlier"
                          className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 rounded transition-colors"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-bold text-slate-400 w-5 text-center">
                          {idx + 1}
                        </span>
                        <button
                          disabled={isLast}
                          onClick={() => handleMoveDown(idx)}
                          title="Move Right / Later"
                          className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 rounded transition-colors"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Label & Key */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-white/20 shadow-sm"
                          style={{ backgroundColor: stage.color || '#6366f1' }}
                        />
                        <div>
                          <p className="font-bold text-slate-100 text-sm">{stage.label}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{stage.key}</p>
                        </div>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                      {stage.description || (
                        <span className="text-slate-600 italic">No description</span>
                      )}
                    </td>

                    {/* Color Tag */}
                    <td className="py-3.5 px-4">
                      <span
                        className="px-2 py-0.5 rounded font-mono text-[10px] font-semibold border border-white/10"
                        style={{
                          backgroundColor: `${stage.color || '#6366f1'}20`,
                          color: stage.color || '#a5b4fc',
                        }}
                      >
                        {stage.color || '#6366f1'}
                      </span>
                    </td>

                    {/* System Guard */}
                    <td className="py-3.5 px-4">
                      {isSystem ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <Lock className="w-2.5 h-2.5" />
                          System Stage
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Custom Stage</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5"></span>
                          Deactivated
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(stage)}
                          title="Edit Stage Label & Color"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {isSystem ? (
                          <div
                            title="System stages (New, Converted, Lost) are required by CRM core logic and cannot be deactivated."
                            className="p-1.5 bg-slate-900/80 text-slate-600 rounded-lg border border-slate-800 cursor-not-allowed"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setTogglingStage(stage);
                              setToggleError('');
                            }}
                            title={isActive ? 'Deactivate Stage' : 'Activate Stage'}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isActive
                                ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border-rose-800/60'
                                : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border-emerald-800/60'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Integrity & Reorder Info Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-3 text-xs text-slate-400">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-200">System Protection Rules: </span>
            Stages designated as <span className="text-amber-400 font-semibold">System Stage</span> (New, Converted, Lost) are protected against deactivation and key modification to prevent orphaned leads, automated trigger failure, or broken reporting.
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-3 text-xs text-slate-400">
          <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-200">Dynamic Board Reflection: </span>
            Reordering stages updates the column layout of the Leads Pipeline Kanban board immediately for all team members via live synchronization.
          </div>
        </div>
      </div>

      {/* Modal: Add Custom Stage */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <KanbanSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Add Custom Pipeline Stage</h3>
                <p className="text-xs text-slate-400">Introduce a new milestone in lead nurturing</p>
              </div>
            </div>

            {addError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStage} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Stage Display Label <span className="text-indigo-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    if (!key) {
                      setKey(
                        e.target.value
                          .toLowerCase()
                          .trim()
                          .replace(/[^a-z0-9_]/g, '_')
                      );
                    }
                  }}
                  placeholder="e.g. Appointment Scheduled"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Stage Identifier Key <span className="text-indigo-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={key}
                  onChange={(e) =>
                    setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
                  }
                  placeholder="e.g. appointment_scheduled"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Unique programmatic slug (lowercase letters, numbers, and underscores)
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Qualification Criteria
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Leads that have confirmed a clinical visit or campus tour..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Color Picker Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Stage Color Theme
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-xl transition-all border ${
                        color === c
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 border-white'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-950/50 transition-colors disabled:opacity-50"
                >
                  {isSubmittingAdd ? 'Creating...' : 'Create Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Stage */}
      {editingStage && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setEditingStage(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Edit Pipeline Stage</h3>
                <p className="text-xs text-slate-400">Key: <span className="font-mono text-slate-200">{editingStage.key}</span></p>
              </div>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateStage} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Display Label <span className="text-indigo-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Color Picker Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Theme Color
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`w-7 h-7 rounded-xl transition-all border ${
                        editColor === c
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 border-white'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStage(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-950/50 transition-colors disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Activate / Deactivate */}
      {togglingStage && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  togglingStage.isActive
                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                }`}
              >
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {togglingStage.isActive ? 'Deactivate Stage' : 'Activate Stage'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to {togglingStage.isActive ? 'deactivate' : 'activate'}{' '}
                  <span className="font-semibold text-slate-200">"{togglingStage.label}"</span>?
                </p>
              </div>
            </div>

            {toggleError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{toggleError}</span>
              </div>
            )}

            <p className="text-xs text-slate-400 mb-6 bg-slate-950 p-3 rounded-xl border border-slate-800">
              {togglingStage.isActive
                ? 'Deactivating will remove this column from the active Kanban board and filters. Existing leads with this stage will preserve their history.'
                : 'Activating will immediately reintroduce this column into the active Kanban pipeline.'}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTogglingStage(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingToggle}
                onClick={handleConfirmToggle}
                className={`px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-colors disabled:opacity-50 ${
                  togglingStage.isActive
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                }`}
              >
                {isSubmittingToggle
                  ? 'Updating...'
                  : togglingStage.isActive
                  ? 'Confirm Deactivation'
                  : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
