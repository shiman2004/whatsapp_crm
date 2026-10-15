import React, { useState } from 'react';
import { useCrm } from '../../../context/CrmContext';
import { Treatment, TreatmentCategory } from '../../../types';
import {
  Sparkles,
  Plus,
  Search,
  Pencil,
  Power,
  CheckCircle2,
  AlertTriangle,
  X,
  Clock,
  Layers,
  Filter
} from 'lucide-react';

export const TreatmentManagementTab: React.FC = () => {
  const { treatments, categories, addTreatment, updateTreatment, toggleTreatmentStatus } = useCrm();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Add Treatment Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [duration, setDuration] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [description, setDescription] = useState('');
  const [benefits, setBenefits] = useState('');
  const [addError, setAddError] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit Treatment Modal State
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editStartingPrice, setEditStartingPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBenefits, setEditBenefits] = useState('');
  const [editError, setEditError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Toggle Confirm Modal State
  const [togglingTreatment, setTogglingTreatment] = useState<Treatment | null>(null);
  const [isSubmittingToggle, setIsSubmittingToggle] = useState(false);

  // Only RWC treatments (company !== 'CRAS' or undefined)
  const rwcTreatments = treatments.filter((t) => t.company !== 'CRAS');
  const rwcCategories = categories.filter((c) => c.id !== 'cat-cras-courses');

  const filteredTreatments = rwcTreatments.filter((t) => {
    if (statusFilter === 'active' && t.active === false) return false;
    if (statusFilter === 'inactive' && t.active !== false) return false;
    if (selectedCatFilter !== 'all' && t.categoryId !== selectedCatFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = t.name.toLowerCase().includes(q);
      const matchCode = t.code ? t.code.toLowerCase().includes(q) : false;
      if (!matchName && !matchCode) return false;
    }
    return true;
  });

  const totalCount = rwcTreatments.length;
  const activeCount = rwcTreatments.filter((t) => t.active !== false).length;
  const inactiveCount = totalCount - activeCount;

  // Handle Open Add Modal
  const handleOpenAddModal = () => {
    setCode('');
    setName('');
    setCategoryId(rwcCategories[0]?.id || 'cat-hair-care');
    setDuration('45 mins');
    setStartingPrice('');
    setDescription('');
    setBenefits('');
    setAddError('');
    setShowAddModal(true);
  };

  const handleCreateTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode) {
      setAddError('Treatment Code is required (e.g. HTP, PRP).');
      return;
    }
    if (!cleanName) {
      setAddError('Treatment Name is required.');
      return;
    }
    if (!categoryId) {
      setAddError('Please select a clinical category.');
      return;
    }

    // Duplicate check
    const duplicate = rwcTreatments.find(
      (t) =>
        (t.code && t.code.toUpperCase() === cleanCode) ||
        t.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      setAddError(
        `Duplicate detected: A treatment with code "${cleanCode}" or name "${cleanName}" already exists.`
      );
      return;
    }

    setIsSubmittingAdd(true);
    const parsedPrice = startingPrice.trim() ? parseFloat(startingPrice) : undefined;

    const res = await addTreatment({
      code: cleanCode,
      name: cleanName,
      company: 'RWC',
      categoryId,
      duration: duration.trim() || '45 mins',
      startingPrice: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : undefined,
      description: description.trim() || undefined,
      benefits: benefits.trim() || undefined,
      active: true,
    } as any);

    setIsSubmittingAdd(false);
    if (res && res.success === false) {
      setAddError(res.error || 'Failed to create treatment');
    } else {
      setShowAddModal(false);
    }
  };

  // Handle Edit Treatment
  const handleOpenEditModal = (t: Treatment) => {
    setEditingTreatment(t);
    setEditCode(t.code || '');
    setEditName(t.name || '');
    setEditCategoryId(t.categoryId || rwcCategories[0]?.id || '');
    setEditDuration(t.duration || '');
    setEditStartingPrice(t.startingPrice ? String(t.startingPrice) : '');
    setEditDescription(t.description || '');
    setEditBenefits(t.benefits || '');
    setEditError('');
  };

  const handleUpdateTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTreatment) return;
    setEditError('');

    const cleanCode = editCode.trim().toUpperCase();
    const cleanName = editName.trim();

    if (!cleanCode) {
      setEditError('Treatment Code is required.');
      return;
    }
    if (!cleanName) {
      setEditError('Treatment Name is required.');
      return;
    }

    // Duplicate check excluding self
    const duplicate = rwcTreatments.find(
      (t) =>
        t.id !== editingTreatment.id &&
        ((t.code && t.code.toUpperCase() === cleanCode) ||
          t.name.toLowerCase() === cleanName.toLowerCase())
    );
    if (duplicate) {
      setEditError(
        `A treatment with code "${cleanCode}" or name "${cleanName}" already exists.`
      );
      return;
    }

    setIsSubmittingEdit(true);
    const parsedPrice = editStartingPrice.trim() ? parseFloat(editStartingPrice) : undefined;

    const res = await updateTreatment(editingTreatment.id, {
      code: cleanCode,
      name: cleanName,
      categoryId: editCategoryId,
      duration: editDuration.trim() || undefined,
      startingPrice: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : undefined,
      description: editDescription.trim() || undefined,
      benefits: editBenefits.trim() || undefined,
    } as any);

    setIsSubmittingEdit(false);
    if (res && (res as any).success === false) {
      setEditError((res as any).error || 'Failed to update treatment');
    } else {
      setEditingTreatment(null);
    }
  };

  // Handle Toggle Status
  const handleConfirmToggle = async () => {
    if (!togglingTreatment) return;
    setIsSubmittingToggle(true);
    const nextStatus = !(togglingTreatment.active !== false);
    await toggleTreatmentStatus(togglingTreatment.id, nextStatus);
    setIsSubmittingToggle(false);
    setTogglingTreatment(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total RWC Treatments</p>
            <p className="text-2xl font-bold text-slate-100 font-mono mt-0.5">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Treatments</p>
            <p className="text-2xl font-bold text-emerald-400 font-mono mt-0.5">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Deactivated</p>
            <p className="text-2xl font-bold text-slate-400 font-mono mt-0.5">{inactiveCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <Power className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Category Filter, Status Filter, Add Button */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search treatments by code or name..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            <select
              value={selectedCatFilter}
              onChange={(e) => setSelectedCatFilter(e.target.value)}
              className="bg-transparent text-slate-300 text-xs outline-none cursor-pointer max-w-[160px] truncate"
            >
              <option value="all">All Categories</option>
              {rwcCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Segmented Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-slate-700 text-slate-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Inactive ({inactiveCount})
            </button>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-teal-950/40 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Treatment</span>
        </button>
      </div>

      {/* Treatments Table */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Treatment / Clinical Service</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Starting Price</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTreatments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    No treatments found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredTreatments.map((t) => {
                  const isActive = t.active !== false;
                  const category = categories.find((c) => c.id === t.categoryId);
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-teal-400">
                        <span className="px-2 py-1 rounded-md bg-teal-500/10 border border-teal-500/20">
                          {t.code || 'TRT'}
                        </span>
                      </td>

                      {/* Name & Details */}
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-slate-100 text-sm">{t.name}</p>
                          {t.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {t.description}
                            </p>
                          )}
                          {t.benefits && (
                            <p className="text-[10px] text-teal-400/80 line-clamp-1 mt-0.5 italic">
                              {t.benefits}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                          {category?.name || 'Clinical Care'}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{t.duration || '45 mins'}</span>
                        </div>
                      </td>

                      {/* Starting Price */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                        {t.startingPrice ? (
                          <span>LKR {Number(t.startingPrice).toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-500 italic">Consultation Required</span>
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
                            onClick={() => handleOpenEditModal(t)}
                            title="Edit Treatment Details"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setTogglingTreatment(t)}
                            title={isActive ? 'Deactivate Treatment' : 'Activate Treatment'}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isActive
                                ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border-rose-800/60'
                                : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border-emerald-800/60'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
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

      {/* Historical Integrity Note */}
      <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-3 text-xs text-slate-400">
        <AlertTriangle className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">Patient Historical Record Safety: </span>
          Deactivating a clinical treatment immediately hides it from new WhatsApp routing menus
          while retaining past patient treatments, notes, and medical records intact.
        </div>
      </div>

      {/* Modal: Add New Treatment */}
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
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Add New Clinical Treatment</h3>
                <p className="text-xs text-slate-400">Publish a new medical or wellness service for RWC</p>
              </div>
            </div>

            {addError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTreatment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Treatment Code <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. PRP"
                    maxLength={10}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Used in serial generation (e.g. PRP-001)</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Clinical Category <span className="text-teal-400">*</span>
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  >
                    {rwcCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Treatment Title <span className="text-teal-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Platelet Rich Plasma (PRP) Therapy"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 45 mins"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Starting Price (LKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Clinical Overview
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Clinical procedure description..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Key Benefits & Outcomes
                </label>
                <input
                  type="text"
                  value={benefits}
                  onChange={(e) => setBenefits(e.target.value)}
                  placeholder="e.g. Stimulates hair follicle regeneration and thickness"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
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
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-teal-950/50 transition-colors disabled:opacity-50"
                >
                  {isSubmittingAdd ? 'Creating...' : 'Create Treatment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Treatment */}
      {editingTreatment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setEditingTreatment(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Edit Treatment Details</h3>
                <p className="text-xs text-slate-400">Updating {editingTreatment.name}</p>
              </div>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateTreatment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Treatment Code <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category <span className="text-teal-400">*</span>
                  </label>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  >
                    {rwcCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Treatment Title <span className="text-teal-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Starting Price (LKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={editStartingPrice}
                    onChange={(e) => setEditStartingPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Clinical Overview
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Key Benefits & Outcomes
                </label>
                <input
                  type="text"
                  value={editBenefits}
                  onChange={(e) => setEditBenefits(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTreatment(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-teal-950/50 transition-colors disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Activate / Deactivate */}
      {togglingTreatment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  togglingTreatment.active !== false
                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                }`}
              >
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {togglingTreatment.active !== false
                    ? 'Deactivate Treatment'
                    : 'Activate Treatment'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to{' '}
                  {togglingTreatment.active !== false ? 'deactivate' : 'activate'}{' '}
                  <span className="font-semibold text-slate-200">
                    "{togglingTreatment.name}"
                  </span>
                  ?
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-6 bg-slate-950 p-3 rounded-xl border border-slate-800">
              {togglingTreatment.active !== false
                ? 'Deactivating will hide this treatment from new patient inquiries and onboarding menus. All existing records and past treatments remain preserved.'
                : 'Activating will immediately make this service selectable across all patient assignment and routing views.'}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTogglingTreatment(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingToggle}
                onClick={handleConfirmToggle}
                className={`px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-colors disabled:opacity-50 ${
                  togglingTreatment.active !== false
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                }`}
              >
                {isSubmittingToggle
                  ? 'Updating...'
                  : togglingTreatment.active !== false
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
