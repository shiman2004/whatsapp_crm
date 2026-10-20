import React from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  LayoutGrid, 
  Table as TableIcon,
  Globe,
  Sparkles,
  UserCheck,
  GraduationCap,
  UserPlus
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

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
  company?: 'RWC' | 'CRAS' | 'ALL';
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
  const { categories, treatments, users, stages, isSuperAdmin, isLeadsOfficer } = useCrm();

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

  const activeFilterCount = Number(Boolean(dateFrom)) + Number(Boolean(dateTo)) + Number(Boolean(selectedStage));

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedLanguage('all');
    setSelectedCoordinator('all');
    setDateFrom('');
    setDateTo('');
    setSelectedStage('');
    setIsFilterOpen(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-sm dark:shadow-md">
      {/* Left: Search input */}
      <div className="flex items-center gap-2.5 flex-1 min-w-[260px] max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className={`w-full bg-slate-50 dark:bg-slate-950/80 border rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors ${
              isCras 
                ? 'border-rose-200 dark:border-rose-500/30 focus:border-rose-500' 
                : 'border-slate-200 dark:border-slate-700/80 focus:border-teal-500'
            }`}
          />
        </div>
      </div>

      {/* Middle: Filter Dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsFilterOpen((open) => !open)}
            aria-expanded={isFilterOpen}
            aria-haspopup="dialog"
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              activeFilterCount > 0
                ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-300 dark:border-teal-500/40 text-teal-700 dark:text-teal-300'
                : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
            {activeFilterCount > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-teal-600 text-white text-[10px] leading-4 text-center">{activeFilterCount}</span>}
          </button>
          {isFilterOpen && (
            <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Date range</p>
                {activeFilterCount > 0 && <button type="button" onClick={clearAllFilters} className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline">Clear filters</button>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-500 dark:text-slate-400">From
                  <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-teal-500" />
                </label>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">To
                  <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-teal-500" />
                </label>
              </div>
            </div>
          )}
        </div>
        {/* Lead Stage Filter */}
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
          <Filter className={`w-3.5 h-3.5 ${selectedStage ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            aria-label="Filter by lead stage"
            className="bg-transparent text-slate-700 dark:text-slate-300 text-xs outline-none cursor-pointer max-w-[150px] truncate"
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
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
          {isCras ? (
            <GraduationCap className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          )}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-transparent text-slate-700 dark:text-slate-300 text-xs outline-none cursor-pointer max-w-[180px] truncate"
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
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950/60 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
          <Globe className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="bg-transparent text-slate-700 dark:text-slate-300 text-xs outline-none cursor-pointer"
          >
            <option value="all" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">All Languages</option>
            <option value="en" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">🇬🇧 English</option>
            <option value="si" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">🇱🇰 සිංහල (Sinhala)</option>
            <option value="ta" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">🇱🇰 தமிழ் (Tamil)</option>
          </select>
        </div>

        {/* Coordinator / Counsellor Filter (Super Admin & Leads Officer) */}
        {(isSuperAdmin || isLeadsOfficer) && (
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950/60 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            <UserCheck className={`w-3.5 h-3.5 ${isCras ? 'text-rose-500 dark:text-rose-400' : 'text-sky-500 dark:text-sky-400'}`} />
            <select
              value={selectedCoordinator}
              onChange={(e) => setSelectedCoordinator(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-300 text-xs outline-none cursor-pointer max-w-[210px] truncate"
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

      {/* Right: View mode & Export */}
      <div className="flex w-full items-center gap-2">
        {/* Toggle Kanban / Table */}
        <div className="bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center">
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all ${
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
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all ${
              viewMode === 'table' 
                ? 'bg-white dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-slate-200 dark:border-teal-500/40 shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
        </div>

        {/* CSV Export Button */}
        <button
          onClick={onExportCsv}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
          title="Export Filtered Leads as CSV"
        >
          <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300" />
          <span>Export CSV</span>
        </button>

        {/* New Contact Button */}
        <button
          type="button"
          onClick={onAddContact}
          className="ml-auto px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          title="Add a new contact"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>New Contact</span>
        </button>
      </div>
    </div>
  );
};
