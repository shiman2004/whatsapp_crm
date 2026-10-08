import React from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  LayoutGrid, 
  Table as TableIcon,
  Globe,
  Sparkles,
  UserCheck
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
  viewMode: 'kanban' | 'table';
  setViewMode: (mode: 'kanban' | 'table') => void;
  onExportCsv: () => void;
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
  viewMode,
  setViewMode,
  onExportCsv
}) => {
  const { categories, users, isSuperAdmin, isLeadsOfficer } = useCrm();

  const coordinators = users.filter(u => u.role === 'coordinator');

  return (
    <div className="bg-slate-900/80 backdrop-blur-md p-3.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
      {/* Left: Search input */}
      <div className="flex items-center gap-2.5 flex-1 min-w-[260px] max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by patient name, phone (+94)..."
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
          />
        </div>
      </div>

      {/* Middle: Filter Dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Category Filter */}
        <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-1 rounded-lg border border-slate-800 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-transparent text-slate-300 text-xs outline-none cursor-pointer"
          >
            <option value="all" className="bg-slate-900">All Treatments</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="bg-slate-900">
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Language Filter */}
        <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-1 rounded-lg border border-slate-800 text-xs">
          <Globe className="w-3.5 h-3.5 text-amber-400" />
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="bg-transparent text-slate-300 text-xs outline-none cursor-pointer"
          >
            <option value="all" className="bg-slate-900">All Languages</option>
            <option value="en" className="bg-slate-900">🇬🇧 English</option>
            <option value="si" className="bg-slate-900">🇱🇰 සිංහල (Sinhala)</option>
            <option value="ta" className="bg-slate-900">🇱🇰 தமிழ் (Tamil)</option>
          </select>
        </div>

        {/* Coordinator Filter (Super Admin & Leads Officer) */}
        {(isSuperAdmin || isLeadsOfficer) && (
          <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-1 rounded-lg border border-slate-800 text-xs">
            <UserCheck className="w-3.5 h-3.5 text-sky-400" />
            <select
              value={selectedCoordinator}
              onChange={(e) => setSelectedCoordinator(e.target.value)}
              className="bg-transparent text-slate-300 text-xs outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Coordinators</option>
              <option value="unassigned" className="bg-slate-900">⚠️ Unassigned Only</option>
              {coordinators.map((u) => (
                <option key={u.id} value={u.id} className="bg-slate-900">
                  {u.fullName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: View mode & Export */}
      <div className="flex items-center gap-2">
        {/* Toggle Kanban / Table */}
        <div className="bg-slate-950 p-0.5 rounded-lg border border-slate-800 flex items-center">
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all ${
              viewMode === 'kanban' 
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Kanban</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all ${
              viewMode === 'table' 
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
        </div>

        {/* CSV Export Button */}
        <button
          onClick={onExportCsv}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
          title="Export Filtered Leads as CSV"
        >
          <Download className="w-3.5 h-3.5 text-slate-300" />
          <span>Export CSV</span>
        </button>
      </div>
    </div>
  );
};
