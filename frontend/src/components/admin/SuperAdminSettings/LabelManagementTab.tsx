import React, { useState } from 'react';
import { useCrm } from '../../../context/CrmContext';
import { ChatLabel } from '../../../types';
import {
  Tag,
  Plus,
  Search,
  Pencil,
  Power,
  Trash2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  X,
  Palette,
  ShieldCheck,
  Check,
  Building2,
  Users
} from 'lucide-react';

const PRESET_LABEL_COLORS = [
  { name: 'Amber (Warm VIP)', hex: '#f59e0b', dot: 'bg-amber-400', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { name: 'Rose (Hot Urgency)', hex: '#f43f5e', dot: 'bg-rose-400', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { name: 'Emerald (Booked/Won)', hex: '#10b981', dot: 'bg-emerald-400', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { name: 'Sky (Follow-up)', hex: '#0ea5e9', dot: 'bg-sky-400', bg: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  { name: 'Purple (Clinical/Prescription)', hex: '#8b5cf6', dot: 'bg-purple-400', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { name: 'Teal (Aesthetic/Consult)', hex: '#0d9488', dot: 'bg-teal-400', bg: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  { name: 'Indigo (Academic/CRAS)', hex: '#6366f1', dot: 'bg-indigo-400', bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  { name: 'Orange (Processing)', hex: '#f97316', dot: 'bg-orange-400', bg: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { name: 'Pink (Cosmetology)', hex: '#ec4899', dot: 'bg-pink-400', bg: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  { name: 'Cyan (Inquiry)', hex: '#06b6d4', dot: 'bg-cyan-400', bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { name: 'Red (High Priority)', hex: '#ef4444', dot: 'bg-red-400', bg: 'bg-red-500/20 text-red-300 border-red-500/30' },
  { name: 'Lime (Assessment)', hex: '#84cc16', dot: 'bg-lime-400', bg: 'bg-lime-500/20 text-lime-300 border-lime-500/30' }
];

const AVAILABLE_ROLES = [
  { id: 'super_admin', label: 'Super Admin' },
  { id: 'leads_officer', label: 'Inquiry Assigning Officer' },
  { id: 'coordinator', label: 'Coordinator' },
  { id: 'sales_coordinator', label: 'Sales Coordinator' },
  { id: 'clinical_nurse', label: 'Clinical Nurse' },
  { id: 'clinical_doctor', label: 'Clinical Doctor' },
  { id: 'exam_department_manager', label: 'Exam Dept Manager' },
  { id: 'marketing_officer', label: 'Marketing Officer' }
];

export const LabelManagementTab: React.FC = () => {
  const { chatLabels, addChatLabel, updateChatLabel, toggleChatLabelStatus, deleteChatLabel } = useCrm();

  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<'ALL' | 'RWC' | 'CRAS' | 'AHC'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Add Label Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [color, setColor] = useState('#f59e0b');
  const [description, setDescription] = useState('');
  const [company, setCompany] = useState<'ALL' | 'RWC' | 'CRAS' | 'AHC'>('ALL');
  const [allRolesAccess, setAllRolesAccess] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['super_admin', 'leads_officer', 'coordinator']);
  const [addError, setAddError] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit Label Modal State
  const [editingLabel, setEditingLabel] = useState<ChatLabel | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#f59e0b');
  const [editDescription, setEditDescription] = useState('');
  const [editCompany, setEditCompany] = useState<'ALL' | 'RWC' | 'CRAS' | 'AHC'>('ALL');
  const [editAllRolesAccess, setEditAllRolesAccess] = useState(true);
  const [editSelectedRoles, setEditSelectedRoles] = useState<string[]>([]);
  const [editError, setEditError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Toggle Confirm Modal State
  const [togglingLabel, setTogglingLabel] = useState<ChatLabel | null>(null);
  const [isSubmittingToggle, setIsSubmittingToggle] = useState(false);

  // Delete Confirm Modal State
  const [deletingLabel, setDeletingLabel] = useState<ChatLabel | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Filter labels
  const filteredLabels = chatLabels.filter((lbl) => {
    if (statusFilter === 'active' && lbl.isActive === false) return false;
    if (statusFilter === 'inactive' && lbl.isActive !== false) return false;
    if (companyFilter !== 'ALL' && lbl.company && lbl.company !== 'ALL' && lbl.company !== companyFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = lbl.name.toLowerCase().includes(q);
      const matchKey = lbl.key.toLowerCase().includes(q);
      const matchDesc = lbl.description ? lbl.description.toLowerCase().includes(q) : false;
      if (!matchName && !matchKey && !matchDesc) return false;
    }
    return true;
  });

  const totalCount = chatLabels.length;
  const activeCount = chatLabels.filter((l) => l.isActive !== false).length;
  const systemCount = chatLabels.filter((l) => l.isSystem).length;
  const customCount = totalCount - systemCount;

  // Handle open add modal
  const handleOpenAddModal = () => {
    setName('');
    setKey('');
    setColor('#f59e0b');
    setDescription('');
    setCompany('ALL');
    setAllRolesAccess(true);
    setSelectedRoles(['super_admin', 'leads_officer', 'coordinator']);
    setAddError('');
    setShowAddModal(true);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    const slug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 40);
    setKey(slug);
  };

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    const cleanName = name.trim();
    if (!cleanName) {
      setAddError('Label name is required.');
      return;
    }

    const cleanKey = key.trim() || cleanName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const existing = chatLabels.find(
      (l) => l.key.toLowerCase() === cleanKey.toLowerCase() || l.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      setAddError(`An assign label with name "${cleanName}" or key "${cleanKey}" already exists.`);
      return;
    }

    setIsSubmittingAdd(true);
    const matchedPreset = PRESET_LABEL_COLORS.find(p => p.hex.toLowerCase() === color.toLowerCase());

    const allowedRolesStr = allRolesAccess ? 'ALL' : JSON.stringify(selectedRoles);

    const res = await addChatLabel({
      key: cleanKey,
      name: cleanName,
      color,
      dotColor: matchedPreset?.dot || undefined,
      bgColor: matchedPreset?.bg || undefined,
      description: description.trim() || undefined,
      company,
      allowedRoles: allowedRolesStr,
      isActive: true
    });

    setIsSubmittingAdd(false);
    if (!res.success) {
      setAddError(res.error || 'Failed to create assign label');
    } else {
      setShowAddModal(false);
    }
  };

  const handleOpenEditModal = (lbl: ChatLabel) => {
    setEditingLabel(lbl);
    setEditName(lbl.name);
    setEditColor(lbl.color || '#f59e0b');
    setEditDescription(lbl.description || '');
    setEditCompany((lbl.company as any) || 'ALL');

    if (!lbl.allowedRoles || lbl.allowedRoles === 'ALL' || lbl.allowedRoles.includes('ALL')) {
      setEditAllRolesAccess(true);
      setEditSelectedRoles(['super_admin', 'leads_officer', 'coordinator']);
    } else {
      setEditAllRolesAccess(false);
      try {
        const parsed = JSON.parse(lbl.allowedRoles);
        setEditSelectedRoles(Array.isArray(parsed) ? parsed : [lbl.allowedRoles]);
      } catch {
        setEditSelectedRoles(lbl.allowedRoles.split(',').map(s => s.trim()));
      }
    }
    setEditError('');
  };

  const handleUpdateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLabel) return;
    setEditError('');

    const cleanName = editName.trim();
    if (!cleanName) {
      setEditError('Label name is required.');
      return;
    }

    setIsSubmittingEdit(true);
    const matchedPreset = PRESET_LABEL_COLORS.find(p => p.hex.toLowerCase() === editColor.toLowerCase());
    const allowedRolesStr = editAllRolesAccess ? 'ALL' : JSON.stringify(editSelectedRoles);

    const res = await updateChatLabel(editingLabel.id, {
      name: cleanName,
      color: editColor,
      dotColor: matchedPreset?.dot || undefined,
      bgColor: matchedPreset?.bg || undefined,
      description: editDescription.trim() || undefined,
      company: editCompany,
      allowedRoles: allowedRolesStr
    });

    setIsSubmittingEdit(false);
    if (!res.success) {
      setEditError(res.error || 'Failed to update assign label');
    } else {
      setEditingLabel(null);
    }
  };

  const handleConfirmToggle = async () => {
    if (!togglingLabel) return;
    setIsSubmittingToggle(true);
    const nextStatus = togglingLabel.isActive === false ? true : false;
    await toggleChatLabelStatus(togglingLabel.id, nextStatus);
    setIsSubmittingToggle(false);
    setTogglingLabel(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingLabel) return;
    setDeleteError('');
    setIsSubmittingDelete(true);
    const res = await deleteChatLabel(deletingLabel.id);
    setIsSubmittingDelete(false);
    if (!res.success) {
      setDeleteError(res.error || 'Failed to delete assign label');
    } else {
      setDeletingLabel(null);
    }
  };

  const toggleRoleSelection = (roleId: string, isEditing: boolean) => {
    if (isEditing) {
      setEditSelectedRoles(prev => 
        prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
      );
    } else {
      setSelectedRoles(prev => 
        prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
      );
    }
  };

  const formatRoleDisplay = (allowedRoles?: string) => {
    if (!allowedRoles || allowedRoles === 'ALL' || allowedRoles.includes('ALL')) {
      return 'All Staff (Everyone)';
    }
    try {
      const parsed = JSON.parse(allowedRoles);
      if (Array.isArray(parsed)) {
        return parsed.map(r => AVAILABLE_ROLES.find(ar => ar.id === r)?.label || r).join(', ');
      }
    } catch {}
    return allowedRoles;
  };

  return (
    <div className="space-y-6">
      {/* 1. Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Configured Labels</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active in WhatsApp</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">System Presets</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-mono mt-0.5">{systemCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Custom Added</p>
            <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 font-mono mt-0.5">{customCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. Search, Scope, Status Filters & Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search labels by name or key..."
              className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Company Scope Filters */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80">
            {(['ALL', 'RWC', 'CRAS', 'AHC'] as const).map((comp) => (
              <button
                key={comp}
                onClick={() => setCompanyFilter(comp)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  companyFilter === comp
                    ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {comp}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80">
            {(['all', 'active', 'inactive'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Add Assign Label Button */}
        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Assign Label</span>
        </button>
      </div>

      {/* 3. Labels List Table / Cards */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Live Preview</th>
                <th className="py-3 px-4">Label Name & Key</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Company Scope</th>
                <th className="py-3 px-4">Role Access (Permissions)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredLabels.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No assign labels match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredLabels.map((lbl) => {
                  const isCustomColor = !lbl.bgColor && lbl.color;
                  return (
                    <tr
                      key={lbl.id || lbl.key}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Live Badge Preview */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            lbl.bgColor || 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}
                          style={isCustomColor ? { backgroundColor: `${lbl.color}20`, color: lbl.color, borderColor: `${lbl.color}40` } : undefined}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${lbl.dotColor || 'bg-amber-400'}`}
                            style={isCustomColor ? { backgroundColor: lbl.color } : undefined}
                          />
                          <span>{lbl.name}</span>
                        </span>
                      </td>

                      {/* Name & Key */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{lbl.name}</span>
                          {lbl.isSystem && (
                            <span
                              title="System Preset Label (Protected)"
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase"
                            >
                              Preset
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">key: {lbl.key}</span>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 max-w-xs text-slate-500 dark:text-slate-400 truncate">
                        {lbl.description || '—'}
                      </td>

                      {/* Company Scope */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider border uppercase bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700">
                          {lbl.company || 'ALL'}
                        </span>
                      </td>

                      {/* Role Access / Permissions */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 truncate">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{formatRoleDisplay(lbl.allowedRoles)}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {lbl.isActive !== false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit button */}
                          <button
                            onClick={() => handleOpenEditModal(lbl)}
                            title="Edit Label & Role Permissions"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {/* Toggle Active / Inactive */}
                          <button
                            onClick={() => setTogglingLabel(lbl)}
                            title={lbl.isActive !== false ? 'Deactivate Label' : 'Activate Label'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              lbl.isActive !== false
                                ? 'text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                                : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                            }`}
                          >
                            <Power className="w-4 h-4" />
                          </button>

                          {/* Delete button (Custom labels only) */}
                          {!lbl.isSystem ? (
                            <button
                              onClick={() => {
                                setDeletingLabel(lbl);
                                setDeleteError('');
                              }}
                              title="Delete Custom Label"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span title="Preset labels cannot be deleted" className="p-1.5 text-slate-300 dark:text-slate-700 cursor-not-allowed">
                              <Lock className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. Add Assign Label Modal */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500 border border-amber-200 dark:border-amber-500/20">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-serif">
                    Add New Assign Label
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Create dynamic WhatsApp chat label synced to Supabase
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateLabel} className="space-y-4">
              {/* Label Name & Key */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Label Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Deposit Paid"
                    className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    System Key / Slug
                  </label>
                  <input
                    type="text"
                    required
                    value={key}
                    onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    placeholder="e.g. deposit_paid"
                    className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Color Swatches */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Select Badge & Dot Color
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_LABEL_COLORS.map((p) => {
                    const isSelected = color.toLowerCase() === p.hex.toLowerCase();
                    return (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => setColor(p.hex)}
                        title={p.name}
                        className={`h-8 rounded-xl flex items-center justify-center transition-all ${
                          isSelected ? 'ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-slate-900 scale-105' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: p.hex }}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Preview In WhatsApp:</span>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
                  style={{ backgroundColor: `${color}20`, color: color, borderColor: `${color}40` }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span>{name.trim() || 'Label Preview'}</span>
                </span>
              </div>

              {/* Company Scope & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Company Scope
                  </label>
                  <select
                    value={company}
                    onChange={(e) => setCompany(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="ALL">ALL (RWC, CRAS, AHC)</option>
                    <option value="RWC">RWC (Royal Wellness)</option>
                    <option value="CRAS">CRAS (Academic)</option>
                    <option value="AHC">AHC (Alpha Health)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Usage Note / Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description for staff"
                    className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Role Permissions Access Box */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Give Access / Role Permissions
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allRolesAccess}
                      onChange={(e) => setAllRolesAccess(e.target.checked)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="font-semibold">All Roles (Everyone)</span>
                  </label>
                </div>

                {!allRolesAccess && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/80">
                    {AVAILABLE_ROLES.map((role) => {
                      const isChecked = selectedRoles.includes(role.id);
                      return (
                        <label
                          key={role.id}
                          className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:border-amber-500/50"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRoleSelection(role.id, false)}
                            className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                          />
                          <span className="truncate">{role.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingAdd ? (
                    <span>Saving to Supabase...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Save & Sync to Supabase</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. Edit Assign Label Modal */}
      {/* ========================================================================= */}
      {editingLabel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500 border border-amber-200 dark:border-amber-500/20">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-serif">
                    Edit Assign Label
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    key: {editingLabel.key} {editingLabel.isSystem && '(Preset Protected)'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingLabel(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateLabel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Label Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Color Swatches */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Select Badge & Dot Color
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_LABEL_COLORS.map((p) => {
                    const isSelected = editColor.toLowerCase() === p.hex.toLowerCase();
                    return (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => setEditColor(p.hex)}
                        title={p.name}
                        className={`h-8 rounded-xl flex items-center justify-center transition-all ${
                          isSelected ? 'ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-slate-900 scale-105' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: p.hex }}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Live Preview:</span>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
                  style={{ backgroundColor: `${editColor}20`, color: editColor, borderColor: `${editColor}40` }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: editColor }} />
                  <span>{editName.trim() || 'Label Preview'}</span>
                </span>
              </div>

              {/* Scope & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Company Scope
                  </label>
                  <select
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="ALL">ALL (RWC, CRAS, AHC)</option>
                    <option value="RWC">RWC (Royal Wellness)</option>
                    <option value="CRAS">CRAS (Academic)</option>
                    <option value="AHC">AHC (Alpha Health)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Usage Note / Description
                  </label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Short description for staff"
                    className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Role Permissions Access Box */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Give Access / Role Permissions
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editAllRolesAccess}
                      onChange={(e) => setEditAllRolesAccess(e.target.checked)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="font-semibold">All Roles (Everyone)</span>
                  </label>
                </div>

                {!editAllRolesAccess && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/80">
                    {AVAILABLE_ROLES.map((role) => {
                      const isChecked = editSelectedRoles.includes(role.id);
                      return (
                        <label
                          key={role.id}
                          className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:border-amber-500/50"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRoleSelection(role.id, true)}
                            className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                          />
                          <span className="truncate">{role.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLabel(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingEdit ? (
                    <span>Saving to Supabase...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Update in Supabase</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. Toggle Status Confirm Modal */}
      {/* ========================================================================= */}
      {togglingLabel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
              <Power className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-serif">
                {togglingLabel.isActive !== false ? 'Deactivate Label?' : 'Activate Label?'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {togglingLabel.isActive !== false
                  ? `"${togglingLabel.name}" will be hidden from the WhatsApp context menu for staff.`
                  : `"${togglingLabel.name}" will become immediately available for staff to assign.`}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTogglingLabel(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggle}
                disabled={isSubmittingToggle}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmittingToggle ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. Delete Confirm Modal */}
      {/* ========================================================================= */}
      {deletingLabel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-serif">
                Delete Assign Label?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to permanently delete "{deletingLabel.name}" from Supabase? Existing chat assignments with this label will also be unlinked.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingLabel(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmittingDelete}
                className="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmittingDelete ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

