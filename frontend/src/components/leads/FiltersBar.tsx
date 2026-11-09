import React from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  LayoutGrid, 
  Table as TableIcon,
  Globe,
  Sparkles,
  UserCheck,
  GraduationCap,
  UserPlus,
  RotateCcw
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { AppDatePicker } from '../common';

interface FiltersBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  selectedCoordinator: string;
  setSelectedCoordinator: (coord: string) => void;
  dateFrom: string;
  setDateFrom: (date: string) => void;
  dateTo: string;
  setDateTo: (date: string) => void;
  selectedStage: string;
  setSelectedStage: (stage: string) => void;
  viewMode: 'kanban' | 'table';
  setViewMode: (mode: 'kanban' | 'table') => void;
  onExportCsv: () => void;
  onAddContact: () => void;
  company?: 'RWC' | 'CRAS' | 'AHC' | 'ALL';
}

export const FiltersBar: React.FC<FiltersBarProps> = ({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  selectedLanguage,
  setSelectedLanguage,
  selectedCoordinator,
  setSelectedCoordinator,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  selectedStage,
  setSelectedStage,
  viewMode,
  setViewMode,
  onExportCsv,
  onAddContact,
  company = 'RWC'
}) => {
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const { categories, treatments, users, stages, isSuperAdmin, isLeadsOfficer, leads, recallLeadsBulk } = useCrm();

  const isCras = company === 'CRAS';
  const isRwc = company === 'RWC';

  // Filter coordinators strictly according to company pipeline
  const allCoordinators = users.filter(u => u.role === 'coordinator');
  const relevantCoordinators = allCoordinators.filter(u => {
    if (isCras) return u.company === 'CRAS';
    if (isRwc) return u.company === 'RWC' || !u.company;
    return true;
  });

  // Filter categories / courses strictly according to company pipeline
  const rwcCategories = categories.filter(c => c.id !== 'cat-cras-courses');
  const crasCourses = treatments.filter(t => t.company === 'CRAS');
  const rwcTreatments = treatments.filter(t => t.company !== 'CRAS');

  const searchPlaceholder = isCras 
    ? "Search by student name, phone (+94), serial..." 
    : isRwc 
    ? "Search by patient name, phone (+94), serial..." 
    : "Search by name, phone (+94), serial...";

  const [datePreset, setDatePreset] = React.useState<string>(() => {
    if (dateFrom && dateTo && dateFrom === dateTo) return 'today';
    if (dateFrom || dateTo) return 'custom';
    return 'all';
  });
  const [isCustomDateOpen, setIsCustomDateOpen] = React.useState(false);

  const formatDateYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
      setIsCustomDateOpen(false);
    } else if (preset === 'today') {
      const todayStr = formatDateYMD(now);
      setDateFrom(todayStr);
      setDateTo(todayStr);
      setIsCustomDateOpen(false);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yesterdayStr = formatDateYMD(y);
      setDateFrom(yesterdayStr);
      setDateTo(yesterdayStr);
      setIsCustomDateOpen(false);
    } else if (preset === 'last7days') {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      setDateFrom(formatDateYMD(d7));
      setDateTo(formatDateYMD(now));
      setIsCustomDateOpen(false);
    } else if (preset === 'last30days') {
      const d30 = new Date();
      d30.setDate(d30.getDate() - 29);
      setDateFrom(formatDateYMD(d30));
      setDateTo(formatDateYMD(now));
      setIsCustomDateOpen(false);
    } else if (preset === 'this_month') {
      const m1 = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(formatDateYMD(m1));
      setDateTo(formatDateYMD(now));
      setIsCustomDateOpen(false);
    } else if (preset === 'custom') {
      setIsCustomDateOpen(true);
    }
  };

  const hasDateFilter = Boolean(dateFrom || dateTo || datePreset !== 'all');
  const activeFilterCount = Number(hasDateFilter) + Number(Boolean(selectedStage));

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedLanguage('all');
    setSelectedCoordinator('all');
    setDateFrom('');
    setDateTo('');
    setDatePreset('all');
    setSelectedStage('');
    setIsCustomDateOpen(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900/80 backdrop-blur-md p-3 sm:px-4 rounded-[10px] border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex flex-wrap xl:flex-nowrap items-center gap-2">
      {/* Left: Search input */}
      <div className="flex items-center flex-1 min-w-[min(100%,240px)] xl:flex-none xl:w-[240px]">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className={`h-9 w-full bg-slate-50 dark:bg-slate-950/80 border rounded-lg pl-9 pr-3 text-[13px] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors ${
              isCras 
                ? 'border-rose-200 dark:border-rose-500/30 focus:border-rose-500' 
                : 'border-slate-200 dark:border-slate-700/80 focus:border-teal-500'
            }`}
          />
        </div>
      </div>

      {/* Middle: Filter Dropdowns */}
      <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 flex-1 min-w-0">
        {/* Date Filter Dropdown */}
        <div className="relative">
          <div className={`h-9 flex items-center gap-1.5 px-2.5 rounded-lg border text-[13px] transition-colors ${
            hasDateFilter
              ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-300 dark:border-teal-500/40 text-teal-700 dark:text-teal-300 font-medium'
              : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}>
            <Calendar className={`w-3.5 h-3.5 shrink-0 ${hasDateFilter ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
              aria-label="Filter leads by date"
              className="min-w-0 bg-transparent text-slate-700 dark:text-slate-300 text-[13px] outline-none cursor-pointer max-w-[110px] lg:max-w-[125px] truncate"
            >
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">All Dates</option>
              <option value="today" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Today</option>
              <option value="yesterday" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Yesterday</option>
              <option value="last7days" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Last 7 Days</option>
              <option value="last30days" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Last 30 Days</option>
              <option value="this_month" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">This Month</option>
              <option value="custom" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Custom Range...</option>
            </select>
            {hasDateFilter && (
              <button
                type="button"
                onClick={() => handleDatePresetChange('all')}
                title="Clear date filter"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-0.5 text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Custom Date Range Popover */}
          {isCustomDateOpen && (
            <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Custom Date Range</p>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                      setDatePreset('all');
                      setIsCustomDateOpen(false);
                    }}
                    className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">From</span>
                  <div className="mt-1">
                    <AppDatePicker
                      value={dateFrom}
                      maxDate={dateTo || undefined}
                      onChange={(val) => {
                        setDateFrom(val);
                        setDatePreset('custom');
                      }}
                      placeholder="Start date"
                      inputClassName="py-1.5 text-xs"
                      clearable={true}
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">To</span>
                  <div className="mt-1">
                    <AppDatePicker
                      value={dateTo}
                      minDate={dateFrom || undefined}
                      onChange={(val) => {
                        setDateTo(val);
                        setDatePreset('custom');
                      }}
                      placeholder="End date"
                      inputClassName="py-1.5 text-xs"
                      clearable={true}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsCustomDateOpen(false)}
                  className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Lead Stage Filter */}
        <div className="h-9 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950/60 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[13px]">
          <Filter className={`w-3.5 h-3.5 ${selectedStage ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            aria-label="Filter by lead stage"
            className="min-w-0 bg-transparent text-slate-700 dark:text-slate-300 text-[13px] outline-none cursor-pointer max-w-[100px] lg:max-w-[100px] truncate"
          >
            <option value="" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">All Lead Stages</option>
            {stages.filter((stage) => stage.isActive).sort((a, b) => a.orderIndex - b.orderIndex).map((stage) => (
              <option key={stage.id} value={stage.key} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                {stage.label}
              </option>
            ))}
          </select>
        </div>
        {/* Category / Course Filter */}
        <div className="h-9 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950/60 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[13px]">
          {isCras ? (
            <GraduationCap className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          )}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="min-w-0 bg-transparent text-slate-700 dark:text-slate-300 text-[13px] outline-none cursor-pointer max-w-[125px] lg:max-w-[125px] truncate"
          >
            {isCras ? (
              <>
                <option value="all" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">All Academic Courses ({crasCourses.length})</option>
                {crasCourses.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                    {c.code ? `[${c.code}] ` : ''}{c.name}
                  </option>
                ))}
              </>
            ) : isRwc ? (
              <>
                <option value="all" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">All Treatments & Clinics</option>
                <optgroup label="Clinical Departments" className="bg-slate-100 dark:bg-slate-900 font-semibold text-teal-600 dark:text-teal-400">
                  {rwcCategories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                      📂 {c.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Specific Treatments" className="bg-slate-100 dark:bg-slate-900 font-semibold text-teal-600 dark:text-teal-400">
                  {rwcTreatments.map((t) => (
                    <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                      ✦ {t.name}
                    </option>
                  ))}
                </optgroup>
              </>
            ) : (
              <>
                <option value="all" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">All Treatments & Courses</option>
                <optgroup label="CRAS Academic Courses" className="bg-slate-100 dark:bg-slate-900 font-semibold text-rose-600 dark:text-rose-400">
                  {crasCourses.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                      🎓 {c.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="RWC Clinical Treatments" className="bg-slate-100 dark:bg-slate-900 font-semibold text-teal-600 dark:text-teal-400">
                  {rwcCategories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                      🌿 {c.name}
                    </option>
                  ))}
                </optgroup>
              </>
            )}
          </select>
        </div>

        {/* Language Filter */}
        <div className="h-9 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950/60 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[13px]">
          <Globe className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="bg-transparent text-slate-700 dark:text-slate-300 text-[13px] outline-none cursor-pointer"
          >
            <option value="all" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">All Languages</option>
            <option value="en" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">🇬🇧 English</option>
            <option value="si" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">🇱🇰 සිංහල (Sinhala)</option>
            <option value="ta" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">🇱🇰 தமிழ் (Tamil)</option>
          </select>
        </div>

        {/* Coordinator / Counsellor Filter (Super Admin & Leads Officer) */}
        {(isSuperAdmin || isLeadsOfficer) && (
          <div className="h-9 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950/60 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[13px] max-w-full">
            <UserCheck className={`w-3.5 h-3.5 ${isCras ? 'text-rose-500 dark:text-rose-400' : 'text-sky-500 dark:text-sky-400'}`} />
            <select
              value={selectedCoordinator}
              onChange={(e) => setSelectedCoordinator(e.target.value)}
              className="min-w-0 bg-transparent text-slate-700 dark:text-slate-300 text-[13px] outline-none cursor-pointer max-w-[130px] lg:max-w-[130px] truncate"
            >
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                {isCras 
                  ? `All Education Counsellors (${relevantCoordinators.length})` 
                  : isRwc 
                  ? `All Patient Coordinators (${relevantCoordinators.length})` 
                  : `All Staff (Coordinators & Counsellors)`}
              </option>
              <option value="unassigned" className="bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400">⚠️ Unassigned Only</option>
              {relevantCoordinators.map((u) => (
                <option key={u.id} value={u.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                  {u.fullName} ({u.company === 'CRAS' ? 'Education Counsellor' : 'Patient Coordinator'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      </div>

      {/* Actions remain distinct from filters, with the primary contact action pinned right. */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
        {/* Toggle Kanban / Table */}
        <div className="h-9 bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center">
          <button
            onClick={() => setViewMode('kanban')}
            className={`h-7 px-2.5 rounded text-[13px] font-medium flex items-center gap-1 transition-all ${
              viewMode === 'kanban' 
                ? 'bg-white dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-slate-200 dark:border-teal-500/40 shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Kanban</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`h-7 px-2.5 rounded text-[13px] font-medium flex items-center gap-1 transition-all ${
              viewMode === 'table' 
                ? 'bg-white dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-slate-200 dark:border-teal-500/40 shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
        </div>

        {/* CSV Export Button - Super Admin only */}
        {isSuperAdmin && (
          <button
            onClick={onExportCsv}
            className="h-9 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            title="Export Filtered Leads as CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300" />
            <span>Export CSV</span>
          </button>
        )}

        {/* Recall All Inquiries for Selected Coordinator - Super Admin only */}
        {isSuperAdmin && selectedCoordinator !== 'all' && selectedCoordinator !== 'unassigned' && (() => {
          const coordLeads = leads.filter(l => l.assignedTo === selectedCoordinator);
          if (coordLeads.length === 0) return null;
          const coordName = relevantCoordinators.find(u => u.id === selectedCoordinator)?.fullName || 'this coordinator';
          return (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Recall all ${coordLeads.length} inquiry/inquiries assigned to ${coordName} back to Admin queue?\n\nThis will unassign the staff member and revert the status to 'New Inquiry'.`)) {
                  recallLeadsBulk(coordLeads.map(l => l.id));
                }
              }}
              className="h-9 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer active:scale-95"
              title={`Recall all inquiries assigned to ${coordName} back to Admin`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Recall All ({coordLeads.length})</span>
            </button>
          );
        })()}

        {/* New Contact Button */}
        <button
          type="button"
          onClick={onAddContact}
          className="h-9 w-full justify-end px-3 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-[13px] font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer sm:ml-auto sm:w-auto"
          title="Add a new contact"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>New Contact</span>
        </button>
      </div>
    </div>
  );
};
