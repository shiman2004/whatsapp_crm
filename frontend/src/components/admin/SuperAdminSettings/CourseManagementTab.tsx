import React, { useState } from 'react';
import { useCrm } from '../../../context/CrmContext';
import { Treatment } from '../../../types';
import {
  GraduationCap,
  Plus,
  Search,
  Pencil,
  Power,
  CheckCircle2,
  AlertTriangle,
  X,
  BookOpen,
  DollarSign,
  Clock,
  Tag
} from 'lucide-react';

export const CourseManagementTab: React.FC = () => {
  const { courses, addCourse, updateCourse, toggleCourseStatus } = useCrm();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Add Course Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [description, setDescription] = useState('');
  const [benefits, setBenefits] = useState('');
  const [addError, setAddError] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit Course Modal State
  const [editingCourse, setEditingCourse] = useState<Treatment | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editStartingPrice, setEditStartingPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBenefits, setEditBenefits] = useState('');
  const [editError, setEditError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Toggle Confirm Modal State
  const [togglingCourse, setTogglingCourse] = useState<Treatment | null>(null);
  const [isSubmittingToggle, setIsSubmittingToggle] = useState(false);

  const filteredCourses = courses.filter((c) => {
    if (statusFilter === 'active' && c.active === false) return false;
    if (statusFilter === 'inactive' && c.active !== false) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = c.name.toLowerCase().includes(q);
      const matchCode = c.code ? c.code.toLowerCase().includes(q) : false;
      if (!matchName && !matchCode) return false;
    }
    return true;
  });

  const totalCount = courses.length;
  const activeCount = courses.filter((c) => c.active !== false).length;
  const inactiveCount = totalCount - activeCount;

  // Handle Add Course
  const handleOpenAddModal = () => {
    setCode('');
    setName('');
    setDuration('');
    setStartingPrice('');
    setDescription('');
    setBenefits('');
    setAddError('');
    setShowAddModal(true);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode) {
      setAddError('Course Code is required (e.g. FAM, FAC).');
      return;
    }
    if (!cleanName) {
      setAddError('Course Name is required.');
      return;
    }

    // Check duplicate locally
    const duplicate = courses.find(
      (c) =>
        (c.code && c.code.toUpperCase() === cleanCode) ||
        c.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      setAddError(
        `Duplicate detected: A course with code "${cleanCode}" or name "${cleanName}" already exists.`
      );
      return;
    }

    setIsSubmittingAdd(true);
    const parsedPrice = startingPrice.trim() ? parseFloat(startingPrice) : undefined;

    const res = await addCourse({
      code: cleanCode,
      name: cleanName,
      company: 'CRAS',
      categoryId: 'cat-cras-courses',
      duration: duration.trim() || undefined,
      startingPrice: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : undefined,
      description: description.trim() || undefined,
      benefits: benefits.trim() || undefined,
      active: true,
    });

    setIsSubmittingAdd(false);
    if (!res.success) {
      setAddError(res.error || 'Failed to create course');
    } else {
      setShowAddModal(false);
    }
  };

  // Handle Edit Course
  const handleOpenEditModal = (c: Treatment) => {
    setEditingCourse(c);
    setEditCode(c.code || '');
    setEditName(c.name || '');
    setEditDuration(c.duration || '');
    setEditStartingPrice(c.startingPrice ? String(c.startingPrice) : '');
    setEditDescription(c.description || '');
    setEditBenefits(c.benefits || '');
    setEditError('');
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    setEditError('');

    const cleanCode = editCode.trim().toUpperCase();
    const cleanName = editName.trim();

    if (!cleanCode) {
      setEditError('Course Code is required.');
      return;
    }
    if (!cleanName) {
      setEditError('Course Name is required.');
      return;
    }

    // Check duplicate excluding self
    const duplicate = courses.find(
      (c) =>
        c.id !== editingCourse.id &&
        ((c.code && c.code.toUpperCase() === cleanCode) ||
          c.name.toLowerCase() === cleanName.toLowerCase())
    );
    if (duplicate) {
      setEditError(`A course with code "${cleanCode}" or name "${cleanName}" already exists.`);
      return;
    }

    setIsSubmittingEdit(true);
    const parsedPrice = editStartingPrice.trim() ? parseFloat(editStartingPrice) : undefined;

    const res = await updateCourse(editingCourse.id, {
      code: cleanCode,
      name: cleanName,
      duration: editDuration.trim() || undefined,
      startingPrice: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : undefined,
      description: editDescription.trim() || undefined,
      benefits: editBenefits.trim() || undefined,
    });

    setIsSubmittingEdit(false);
    if (!res.success) {
      setEditError(res.error || 'Failed to update course');
    } else {
      setEditingCourse(null);
    }
  };

  // Handle Toggle Status
  const handleConfirmToggle = async () => {
    if (!togglingCourse) return;
    setIsSubmittingToggle(true);
    const nextStatus = !(togglingCourse.active !== false);
    await toggleCourseStatus(togglingCourse.id, nextStatus);
    setIsSubmittingToggle(false);
    setTogglingCourse(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total CRAS Courses</p>
            <p className="text-2xl font-bold text-slate-100 font-mono mt-0.5">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Courses</p>
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

      {/* Control Bar: Search, Filters, Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses by code or title..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
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
          className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/40 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Course</span>
        </button>
      </div>

      {/* Courses Management Table */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Course Name & Syllabus</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Fee / Starting Price</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <GraduationCap className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    No courses found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredCourses.map((c) => {
                  const isActive = c.active !== false;
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Code Badge */}
                      <td className="py-3.5 px-4 font-mono font-bold text-rose-400">
                        <span className="px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/20">
                          {c.code || 'CRS'}
                        </span>
                      </td>

                      {/* Name & Details */}
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-slate-100 text-sm">{c.name}</p>
                          {c.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {c.description}
                            </p>
                          )}
                          {c.benefits && (
                            <p className="text-[10px] text-rose-400/80 line-clamp-1 mt-0.5 italic">
                              {c.benefits}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{c.duration || 'Flexible'}</span>
                        </div>
                      </td>

                      {/* Fee */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                        {c.startingPrice ? (
                          <span>LKR {Number(c.startingPrice).toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-500 italic">Admissions Inquiry</span>
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
                            onClick={() => handleOpenEditModal(c)}
                            title="Edit Course Details"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setTogglingCourse(c)}
                            title={isActive ? 'Deactivate Course' : 'Activate Course'}
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
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">Historical Record Protection: </span>
          Deactivating a course hides it from new student inquiry dropdowns while preserving
          historical references, reports, and previous student chats with 100% integrity.
        </div>
      </div>

      {/* Modal: Add New Course */}
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
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Add New CRAS Course</h3>
                <p className="text-xs text-slate-400">Create an accredited curriculum entry for admissions</p>
              </div>
            </div>

            {addError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Course Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. FAM"
                    maxLength={10}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-rose-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Unique 2-5 letter identifier</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 6 Months / 1 Year"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Course Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fellowship in Aesthetic Medicine"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tuition Fee / Starting Price (LKR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={startingPrice}
                  onChange={(e) => setStartingPrice(e.target.value)}
                  placeholder="e.g. 250000"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Overview
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Comprehensive clinical and hands-on training module..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Key Certification / Benefits
                </label>
                <input
                  type="text"
                  value={benefits}
                  onChange={(e) => setBenefits(e.target.value)}
                  placeholder="e.g. International CPD Certification & Live Patient Hands-on"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
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
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-950/50 transition-colors disabled:opacity-50"
                >
                  {isSubmittingAdd ? 'Creating...' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Course */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setEditingCourse(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Edit Course Details</h3>
                <p className="text-xs text-slate-400">Updating {editingCourse.name}</p>
              </div>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateCourse} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Course Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    placeholder="e.g. 6 Months"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Course Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tuition Fee / Starting Price (LKR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={editStartingPrice}
                  onChange={(e) => setEditStartingPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Overview
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Key Certification / Benefits
                </label>
                <input
                  type="text"
                  value={editBenefits}
                  onChange={(e) => setEditBenefits(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-950/50 transition-colors disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Activate / Deactivate */}
      {togglingCourse && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  togglingCourse.active !== false
                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                }`}
              >
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {togglingCourse.active !== false ? 'Deactivate Course' : 'Activate Course'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to {togglingCourse.active !== false ? 'deactivate' : 'activate'}{' '}
                  <span className="font-semibold text-slate-200">"{togglingCourse.name}"</span>?
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-6 bg-slate-950 p-3 rounded-xl border border-slate-800">
              {togglingCourse.active !== false
                ? 'Deactivating will hide this course from student inquiry intake dropdowns. Existing leads and admissions records will remain intact.'
                : 'Activating will immediately enable this course in the CRAS admissions catalog for counsellors and students.'}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTogglingCourse(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingToggle}
                onClick={handleConfirmToggle}
                className={`px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-colors disabled:opacity-50 ${
                  togglingCourse.active !== false
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                }`}
              >
                {isSubmittingToggle
                  ? 'Updating...'
                  : togglingCourse.active !== false
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
