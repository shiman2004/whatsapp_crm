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
  Tag,
  ExternalLink,
  Calendar,
  Users,
  Copy,
  Download,
  Share2,
  BadgeCheck,
  Sparkles
} from 'lucide-react';

export interface CourseExtendedMeta {
  brochureUrl?: string;
  intakeDate?: string;
  intakeDeadline?: string;
  intakeStatus?: 'open' | 'closing_soon' | 'waitlist' | 'closed';
  maxSeats?: number;
  qualificationLevel?: 'Fellowship' | 'Diploma' | 'Certificate' | 'Masterclass' | 'General';
  installmentPlan?: string;
  plainBenefits?: string;
}

export function parseCourseMetadata(c: Treatment): CourseExtendedMeta {
  const raw = c.benefits || '';
  if (raw.startsWith('META:::')) {
    try {
      const parsed = JSON.parse(raw.slice(7));
      return {
        qualificationLevel: parsed.qualificationLevel || 'General',
        brochureUrl: parsed.brochureUrl || '',
        intakeDate: parsed.intakeDate || 'Next Batch: Rolling',
        intakeDeadline: parsed.intakeDeadline || '',
        intakeStatus: parsed.intakeStatus || 'open',
        maxSeats: parsed.maxSeats || 30,
        installmentPlan: parsed.installmentPlan || '',
        plainBenefits: parsed.plainBenefits || '',
      };
    } catch {
      // fallback
    }
  }

  let detectedLevel: CourseExtendedMeta['qualificationLevel'] = 'General';
  if (/fellowship/i.test(c.name)) detectedLevel = 'Fellowship';
  else if (/diploma/i.test(c.name)) detectedLevel = 'Diploma';
  else if (/certificate/i.test(c.name)) detectedLevel = 'Certificate';
  else if (/masterclass/i.test(c.name)) detectedLevel = 'Masterclass';

  return {
    qualificationLevel: (c.qualificationLevel as any) || detectedLevel,
    brochureUrl: c.brochureUrl || '',
    intakeDate: c.intakeDate || 'Next Batch: Rolling Intake',
    intakeDeadline: c.intakeDeadline || '',
    intakeStatus: c.intakeStatus || 'open',
    maxSeats: c.maxSeats || 30,
    installmentPlan: '',
    plainBenefits: raw,
  };
}

export function serializeCourseMetadata(meta: CourseExtendedMeta): string {
  return `META:::${JSON.stringify(meta)}`;
}

export const CourseManagementTab: React.FC = () => {
  const { courses, addCourse, updateCourse, toggleCourseStatus, notify } = useCrm() as any;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add Course Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [description, setDescription] = useState('');
  const [plainBenefits, setPlainBenefits] = useState('');
  const [qualificationLevel, setQualificationLevel] = useState<CourseExtendedMeta['qualificationLevel']>('Fellowship');
  const [intakeDate, setIntakeDate] = useState('January 15, 2027');
  const [intakeDeadline, setIntakeDeadline] = useState('');
  const [intakeStatus, setIntakeStatus] = useState<CourseExtendedMeta['intakeStatus']>('open');
  const [maxSeats, setMaxSeats] = useState<number>(30);
  const [brochureUrl, setBrochureUrl] = useState('');
  const [installmentPlan, setInstallmentPlan] = useState('');
  const [addError, setAddError] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit Course Modal State
  const [editingCourse, setEditingCourse] = useState<Treatment | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editStartingPrice, setEditStartingPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPlainBenefits, setEditPlainBenefits] = useState('');
  const [editQualificationLevel, setEditQualificationLevel] = useState<CourseExtendedMeta['qualificationLevel']>('Fellowship');
  const [editIntakeDate, setEditIntakeDate] = useState('');
  const [editIntakeDeadline, setEditIntakeDeadline] = useState('');
  const [editIntakeStatus, setEditIntakeStatus] = useState<CourseExtendedMeta['intakeStatus']>('open');
  const [editMaxSeats, setEditMaxSeats] = useState<number>(30);
  const [editBrochureUrl, setEditBrochureUrl] = useState('');
  const [editInstallmentPlan, setEditInstallmentPlan] = useState('');
  const [editError, setEditError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Toggle Confirm Modal State
  const [togglingCourse, setTogglingCourse] = useState<Treatment | null>(null);
  const [isSubmittingToggle, setIsSubmittingToggle] = useState(false);

  const filteredCourses = courses.filter((c: Treatment) => {
    if (statusFilter === 'active' && c.active === false) return false;
    if (statusFilter === 'inactive' && c.active !== false) return false;

    const meta = parseCourseMetadata(c);
    if (levelFilter !== 'all' && meta.qualificationLevel !== levelFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = c.name.toLowerCase().includes(q);
      const matchCode = c.code ? c.code.toLowerCase().includes(q) : false;
      const matchDesc = c.description ? c.description.toLowerCase().includes(q) : false;
      if (!matchName && !matchCode && !matchDesc) return false;
    }
    return true;
  });

  const totalCount = courses.length;
  const activeCount = courses.filter((c: Treatment) => c.active !== false).length;
  const inactiveCount = totalCount - activeCount;

  // Handle Add Course
  const handleOpenAddModal = () => {
    setCode('');
    setName('');
    setDuration('6 Months');
    setStartingPrice('');
    setDescription('');
    setPlainBenefits('Accredited CPD certification, clinical mentorship & hands-on practicals');
    setQualificationLevel('Fellowship');
    setIntakeDate('January 15, 2027');
    setIntakeDeadline('');
    setIntakeStatus('open');
    setMaxSeats(30);
    setBrochureUrl('');
    setInstallmentPlan('3 Installments available');
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
      (c: Treatment) =>
        (c.code && c.code.toUpperCase() === cleanCode) ||
        c.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      setAddError(`Duplicate detected: A course with code "${cleanCode}" or name "${cleanName}" already exists.`);
      return;
    }

    setIsSubmittingAdd(true);
    const parsedPrice = startingPrice.trim() ? parseFloat(startingPrice) : undefined;

    const serializedBenefits = serializeCourseMetadata({
      qualificationLevel,
      intakeDate: intakeDate.trim(),
      intakeDeadline: intakeDeadline.trim(),
      intakeStatus,
      maxSeats: Number(maxSeats) || 30,
      brochureUrl: brochureUrl.trim(),
      installmentPlan: installmentPlan.trim(),
      plainBenefits: plainBenefits.trim(),
    });

    const res = await addCourse({
      code: cleanCode,
      name: cleanName,
      company: 'CRAS',
      categoryId: 'cat-cras-courses',
      duration: duration.trim() || undefined,
      startingPrice: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : undefined,
      description: description.trim() || undefined,
      benefits: serializedBenefits,
      active: true,
    });

    setIsSubmittingAdd(false);
    if (!res.success) {
      setAddError(res.error || 'Failed to create course');
    } else {
      setShowAddModal(false);
      notify?.('Course Added', `Course ${cleanCode} created successfully!`, 'success');
    }
  };

  // Handle Edit Course
  const handleOpenEditModal = (c: Treatment) => {
    const meta = parseCourseMetadata(c);
    setEditingCourse(c);
    setEditCode(c.code || '');
    setEditName(c.name || '');
    setEditDuration(c.duration || '');
    setEditStartingPrice(c.startingPrice ? String(c.startingPrice) : '');
    setEditDescription(c.description || '');
    setEditPlainBenefits(meta.plainBenefits || '');
    setEditQualificationLevel(meta.qualificationLevel || 'Fellowship');
    setEditIntakeDate(meta.intakeDate || '');
    setEditIntakeDeadline(meta.intakeDeadline || '');
    setEditIntakeStatus(meta.intakeStatus || 'open');
    setEditMaxSeats(meta.maxSeats || 30);
    setEditBrochureUrl(meta.brochureUrl || '');
    setEditInstallmentPlan(meta.installmentPlan || '');
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

    const duplicate = courses.find(
      (c: Treatment) =>
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

    const serializedBenefits = serializeCourseMetadata({
      qualificationLevel: editQualificationLevel,
      intakeDate: editIntakeDate.trim(),
      intakeDeadline: editIntakeDeadline.trim(),
      intakeStatus: editIntakeStatus,
      maxSeats: Number(editMaxSeats) || 30,
      brochureUrl: editBrochureUrl.trim(),
      installmentPlan: editInstallmentPlan.trim(),
      plainBenefits: editPlainBenefits.trim(),
    });

    const res = await updateCourse(editingCourse.id, {
      code: cleanCode,
      name: cleanName,
      duration: editDuration.trim() || undefined,
      startingPrice: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : undefined,
      description: editDescription.trim() || undefined,
      benefits: serializedBenefits,
    });

    setIsSubmittingEdit(false);
    if (!res.success) {
      setEditError(res.error || 'Failed to update course');
    } else {
      setEditingCourse(null);
      notify?.('Course Updated', `Course ${cleanCode} updated successfully.`, 'success');
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

  // Copy WhatsApp prospectus text
  const handleCopyWhatsApp = (c: Treatment) => {
    const meta = parseCourseMetadata(c);
    const statusLabel =
      meta.intakeStatus === 'open'
        ? '🟢 Admissions Open'
        : meta.intakeStatus === 'closing_soon'
        ? '🟡 Closing Soon'
        : meta.intakeStatus === 'waitlist'
        ? '🟠 Waitlist Only'
        : '🔴 Closed';

    const text = [
      `🎓 *${c.name}* (${c.code || 'CRAS'})`,
      `📚 *Level:* ${meta.qualificationLevel || 'Professional Program'}`,
      `⏳ *Duration:* ${c.duration || 'Flexible'}`,
      `💰 *Tuition Fee:* ${c.startingPrice ? `LKR ${Number(c.startingPrice).toLocaleString()}` : 'Admissions Inquiry'}`,
      meta.installmentPlan ? `💳 *Payment Options:* ${meta.installmentPlan}` : null,
      `📅 *Next Intake:* ${meta.intakeDate || 'Rolling Intake'} (${statusLabel})`,
      meta.maxSeats ? `👥 *Batch Size:* Strictly capped at ${meta.maxSeats} students` : null,
      meta.brochureUrl ? `📥 *Curriculum Brochure:* ${meta.brochureUrl}` : null,
      c.description ? `\n📖 *Syllabus Overview:* ${c.description}` : null,
      meta.plainBenefits ? `✨ *Key Benefits:* ${meta.plainBenefits}` : null,
      `\nReply to this message with any questions or to receive our formal enrollment registration form!`
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 2500);
    notify?.('Prospectus Copied', `WhatsApp details for ${c.code} copied to clipboard!`, 'success');
  };

  // Export Course Catalog CSV
  const handleExportCsv = () => {
    const headers = [
      'Code',
      'Course Name',
      'Level',
      'Duration',
      'Tuition_Fee_LKR',
      'Status',
      'Next_Intake',
      'Intake_Status',
      'Max_Seats',
      'Brochure_URL',
      'Installment_Plan',
      'Overview'
    ];
    const rows = filteredCourses.map((c: Treatment) => {
      const meta = parseCourseMetadata(c);
      return [
        `"${c.code || ''}"`,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${meta.qualificationLevel || 'General'}"`,
        `"${c.duration || 'Flexible'}"`,
        c.startingPrice || 0,
        c.active !== false ? 'Active' : 'Inactive',
        `"${meta.intakeDate || ''}"`,
        `"${meta.intakeStatus || 'open'}"`,
        meta.maxSeats || 30,
        `"${meta.brochureUrl || ''}"`,
        `"${meta.installmentPlan || ''}"`,
        `"${(c.description || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cras-courses-catalog-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify?.('CSV Exported', 'CRAS course catalog downloaded successfully.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total CRAS Courses</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active Courses</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Deactivated</p>
            <p className="text-2xl font-bold text-slate-400 dark:text-slate-500 font-mono mt-0.5">{inactiveCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400">
            <Power className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar / Search / Filters / Actions */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses by code, title, or syllabus..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Inactive ({inactiveCount})
            </button>
          </div>

          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-rose-500"
          >
            <option value="all">All Levels</option>
            <option value="Fellowship">Fellowships</option>
            <option value="Diploma">Diplomas</option>
            <option value="Certificate">Certificates</option>
            <option value="Masterclass">Masterclasses</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <button
            onClick={handleExportCsv}
            title="Download Course Catalog CSV"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md dark:shadow-lg dark:shadow-rose-950/40 transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Course</span>
          </button>
        </div>
      </div>

      {/* Courses Management Table */}
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">Code & Level</th>
                <th className="py-3 px-4">Course Name & Syllabus</th>
                <th className="py-3 px-4">Intake & Capacity</th>
                <th className="py-3 px-4">Duration & Fee</th>
                <th className="py-3 px-4">Brochure</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <GraduationCap className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                    No courses found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredCourses.map((c: Treatment) => {
                  const isActive = c.active !== false;
                  const meta = parseCourseMetadata(c);

                  const intakeBadgeColor =
                    meta.intakeStatus === 'open'
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                      : meta.intakeStatus === 'closing_soon'
                      ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                      : meta.intakeStatus === 'waitlist'
                      ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30'
                      : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30';

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Code Badge & Level */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs">
                            {c.code || 'CRS'}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            {meta.qualificationLevel || 'Course'}
                          </span>
                        </div>
                      </td>

                      {/* Name & Details */}
                      <td className="py-3.5 px-4 max-w-xs md:max-w-md">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">{c.name}</p>
                          {c.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {c.description}
                            </p>
                          )}
                          {meta.plainBenefits && (
                            <p className="text-[10px] text-rose-600 dark:text-rose-400/80 line-clamp-1 mt-0.5 italic flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 shrink-0" />
                              <span>{meta.plainBenefits}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Intake & Capacity */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${intakeBadgeColor}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5"></span>
                            {meta.intakeStatus?.replace('_', ' ') || 'Open'}
                          </span>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{meta.intakeDate || 'Rolling Intake'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>Cap: {meta.maxSeats || 30} seats</span>
                          </div>
                        </div>
                      </td>

                      {/* Duration & Fee */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 text-xs">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{c.duration || 'Flexible'}</span>
                          </div>
                          <p className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                            {c.startingPrice ? (
                              <span>LKR {Number(c.startingPrice).toLocaleString()}</span>
                            ) : (
                              <span className="text-slate-400 italic font-normal">Admissions Inquiry</span>
                            )}
                          </p>
                          {meta.installmentPlan && (
                            <p className="text-[9.5px] text-teal-600 dark:text-teal-400 truncate">
                              {meta.installmentPlan}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Brochure Link */}
                      <td className="py-3.5 px-4">
                        {meta.brochureUrl ? (
                          <a
                            href={meta.brochureUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700 transition-colors"
                            title="Open curriculum brochure in new tab"
                          >
                            <span>Brochure</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-600 italic">None attached</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mr-1.5"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 mr-1.5"></span>
                            Deactivated
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleCopyWhatsApp(c)}
                            title="Copy WhatsApp Prospectus & Fees Message"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                          >
                            {copiedId === c.id ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(c)}
                            title="Edit Course Details"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setTogglingCourse(c)}
                            title={isActive ? 'Deactivate Course' : 'Activate Course'}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isActive
                                ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                                : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
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
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 flex items-start gap-3 text-xs text-slate-500 dark:text-slate-400">
        <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800 dark:text-slate-200">Historical Record Protection: </span>
          Deactivating a course hides it from new student inquiry dropdowns while preserving
          historical references, reports, and previous student chats with 100% integrity.
        </div>
      </div>

      {/* Modal: Add New Course */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150 my-8">
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

            <form onSubmit={handleCreateCourse} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-3 gap-3">
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
                  <p className="text-[10px] text-slate-500 mt-1">e.g. FAM, FAC, CAD</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Level
                  </label>
                  <select
                    value={qualificationLevel}
                    onChange={(e) => setQualificationLevel(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                  >
                    <option value="Fellowship">Fellowship</option>
                    <option value="Diploma">Diploma</option>
                    <option value="Certificate">Certificate</option>
                    <option value="Masterclass">Masterclass</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fellowship in Aesthetic Medicine"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tuition Fee (LKR)
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
                    Installment Plan
                  </label>
                  <input
                    type="text"
                    value={installmentPlan}
                    onChange={(e) => setInstallmentPlan(e.target.value)}
                    placeholder="e.g. 3 Installments of LKR 85,000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Intake & Capacity */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Admissions & Intake Parameters</span>
                </p>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Next Intake Date
                    </label>
                    <input
                      type="text"
                      value={intakeDate}
                      onChange={(e) => setIntakeDate(e.target.value)}
                      placeholder="e.g. 15 Jan 2027"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Intake Status
                    </label>
                    <select
                      value={intakeStatus}
                      onChange={(e) => setIntakeStatus(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                    >
                      <option value="open">Open (Accepting)</option>
                      <option value="closing_soon">Closing Soon</option>
                      <option value="waitlist">Waitlist</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Max Batch Seats
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxSeats}
                      onChange={(e) => setMaxSeats(parseInt(e.target.value, 10) || 30)}
                      placeholder="e.g. 30"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Curriculum Brochure URL (PDF Link)
                  </label>
                  <input
                    type="url"
                    value={brochureUrl}
                    onChange={(e) => setBrochureUrl(e.target.value)}
                    placeholder="https://cras.edu.lk/brochures/fam-syllabus.pdf"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Google Drive, Cloudinary, or website direct PDF link</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Syllabus Overview / Modules
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Comprehensive clinical and hands-on training module covering..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Key Certification / Benefits
                </label>
                <input
                  type="text"
                  value={plainBenefits}
                  onChange={(e) => setPlainBenefits(e.target.value)}
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150 my-8">
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

            <form onSubmit={handleUpdateCourse} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-3 gap-3">
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
                    Level
                  </label>
                  <select
                    value={editQualificationLevel}
                    onChange={(e) => setEditQualificationLevel(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                  >
                    <option value="Fellowship">Fellowship</option>
                    <option value="Diploma">Diploma</option>
                    <option value="Certificate">Certificate</option>
                    <option value="Masterclass">Masterclass</option>
                    <option value="General">General</option>
                  </select>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tuition Fee (LKR)
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
                    Installment Plan
                  </label>
                  <input
                    type="text"
                    value={editInstallmentPlan}
                    onChange={(e) => setEditInstallmentPlan(e.target.value)}
                    placeholder="e.g. 3 Installments of LKR 85,000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Intake & Capacity */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Admissions & Intake Parameters</span>
                </p>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Next Intake Date
                    </label>
                    <input
                      type="text"
                      value={editIntakeDate}
                      onChange={(e) => setEditIntakeDate(e.target.value)}
                      placeholder="e.g. 15 Jan 2027"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Intake Status
                    </label>
                    <select
                      value={editIntakeStatus}
                      onChange={(e) => setEditIntakeStatus(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                    >
                      <option value="open">Open (Accepting)</option>
                      <option value="closing_soon">Closing Soon</option>
                      <option value="waitlist">Waitlist</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Max Batch Seats
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editMaxSeats}
                      onChange={(e) => setEditMaxSeats(parseInt(e.target.value, 10) || 30)}
                      placeholder="e.g. 30"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Curriculum Brochure URL (PDF Link)
                  </label>
                  <input
                    type="url"
                    value={editBrochureUrl}
                    onChange={(e) => setEditBrochureUrl(e.target.value)}
                    placeholder="https://cras.edu.lk/brochures/fam-syllabus.pdf"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Google Drive, Cloudinary, or website direct PDF link</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Syllabus Overview / Modules
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
                  value={editPlainBenefits}
                  onChange={(e) => setEditPlainBenefits(e.target.value)}
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
