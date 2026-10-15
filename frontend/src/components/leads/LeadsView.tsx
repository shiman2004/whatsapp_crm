import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { FiltersBar } from './FiltersBar';
import { KanbanBoard } from './KanbanBoard';
import { TableView } from './TableView';
import { Lead } from '../../types';
import { Building2, GraduationCap, Lock, Sparkles, Layers } from 'lucide-react';

interface LeadsViewProps {
  onSelectLead: (leadId: string) => void;
}

export type PipelineCompany = 'RWC' | 'CRAS' | 'ALL';

export const LeadsView: React.FC<LeadsViewProps> = ({ onSelectLead }) => {
  const { leads, isSuperAdmin, isLeadsOfficer, currentUser, categories, treatments } = useCrm();

  const canSeeBothCompanies = isSuperAdmin || isLeadsOfficer;
  const isCrasUser = !canSeeBothCompanies && currentUser.company === 'CRAS';
  const isRwcUser = !canSeeBothCompanies && (currentUser.company === 'RWC' || !currentUser.company);

  // Selected company pipeline: Super Admin & Leads Officer can switch; others are locked to their own company
  const [selectedCompany, setSelectedCompany] = useState<PipelineCompany>(() => {
    if (!canSeeBothCompanies) {
      return (currentUser.company as PipelineCompany) || 'RWC';
    }
    const saved = localStorage.getItem('rw_crm_selected_pipeline_company') as PipelineCompany;
    if (saved && ['RWC', 'CRAS', 'ALL'].includes(saved)) {
      return saved;
    }
    return 'RWC';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedCoordinator, setSelectedCoordinator] = useState('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  const effectiveCompany: PipelineCompany = canSeeBothCompanies 
    ? selectedCompany 
    : (currentUser.company === 'CRAS' ? 'CRAS' : 'RWC');

  // Handle switching pipeline company for Super Admin and Leads Officer
  const handleCompanyChange = (comp: PipelineCompany) => {
    if (!canSeeBothCompanies) return;
    setSelectedCompany(comp);
    localStorage.setItem('rw_crm_selected_pipeline_company', comp);
    // Reset filters when changing company to prevent mismatch
    setSelectedCategory('all');
    setSelectedCoordinator('all');
  };

  // Helper to resolve lead's company cleanly
  const getLeadCompany = (lead: Lead): 'RWC' | 'CRAS' => {
    if (lead.company) return lead.company.toUpperCase() === 'CRAS' ? 'CRAS' : 'RWC';
    if (lead.source && lead.source.toUpperCase() === 'CRAS') return 'CRAS';
    if (lead.categoryId === 'cat-cras-courses') return 'CRAS';
    return 'RWC';
  };

  // Base leads accessible to this user
  const accessibleLeads = leads.filter((lead) => {
    // Coordinators only see their assigned leads
    if (!isSuperAdmin && !isLeadsOfficer && lead.assignedTo !== currentUser.id) {
      return false;
    }
    return true;
  });

  // Calculate live counts per company for tabs
  const rwcCount = accessibleLeads.filter(l => getLeadCompany(l) === 'RWC').length;
  const crasCount = accessibleLeads.filter(l => getLeadCompany(l) === 'CRAS').length;

  // Filter leads based on company pipeline, role, & search params
  const filteredLeads = accessibleLeads.filter((lead) => {
    const leadComp = getLeadCompany(lead);

    // 1. Company Pipeline Isolation
    if (!canSeeBothCompanies) {
      const myCompany = currentUser.company === 'CRAS' ? 'CRAS' : 'RWC';
      if (leadComp !== myCompany) return false;
    } else {
      if (selectedCompany !== 'ALL' && leadComp !== selectedCompany) {
        return false;
      }
    }

    // 2. Search query filter (matches customer name, phone, or serial number)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = lead.customer?.displayName?.toLowerCase().includes(q);
      const matchPhone = lead.customer?.whatsappNumber?.includes(q);
      const matchSerial = lead.serialNumber?.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchSerial) return false;
    }

    // 3. Category / Course / Treatment filter
    if (selectedCategory !== 'all') {
      if (lead.categoryId !== selectedCategory && lead.treatmentId !== selectedCategory) {
        return false;
      }
    }

    // 4. Language filter
    if (selectedLanguage !== 'all' && lead.language !== selectedLanguage) {
      return false;
    }

    // 5. Coordinator / Counsellor filter (Super Admin & Leads Officer)
    if (canSeeBothCompanies && selectedCoordinator !== 'all') {
      if (selectedCoordinator === 'unassigned' && lead.assignedTo) return false;
      if (selectedCoordinator !== 'unassigned' && lead.assignedTo !== selectedCoordinator) return false;
    }

    return true;
  });

  // CSV Export handler adapts to active company pipeline
  const handleExportCsv = () => {
    const isCrasExport = effectiveCompany === 'CRAS';
    const headers = [
      'Lead ID', 
      isCrasExport ? 'Student Name' : 'Patient Name', 
      'WhatsApp Phone', 
      'Company',
      'Language', 
      'Category / Program', 
      isCrasExport ? 'Course' : 'Treatment Service', 
      'Serial Number',
      isCrasExport ? 'Admissions Stage' : 'Lead Stage', 
      isCrasExport ? 'Assigned Counsellor' : 'Assigned Coordinator', 
      'Created Date'
    ];

    const rows = filteredLeads.map(l => {
      const cat = categories.find(c => c.id === l.categoryId)?.name || '';
      const trt = treatments.find(t => t.id === l.treatmentId)?.name || '';
      const coord = l.assignedCoordinator?.fullName || 'Unassigned';
      return [
        l.id,
        `"${l.customer?.displayName || ''}"`,
        `"${l.customer?.whatsappNumber || ''}"`,
        getLeadCompany(l),
        l.language,
        `"${cat}"`,
        `"${trt}"`,
        `"${l.serialNumber || ''}"`,
        l.stage,
        `"${coord}"`,
        `"${new Date(l.createdAt).toLocaleString()}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = isCrasExport 
      ? `cras_students_pipeline_${dateStr}.csv` 
      : `royal_wellness_leads_pipeline_${dateStr}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 space-y-3.5">
      {/* Top Company Pipeline Switcher / Header Card */}
      {canSeeBothCompanies ? (
        /* Super Admin & Leads Officer Interactive Company Pipeline Switcher */
        <div className="bg-slate-900/90 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl border border-slate-800 shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Active Pipeline Title & Meta */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border font-bold text-lg shrink-0 shadow-md transition-all ${
              selectedCompany === 'CRAS' 
                ? 'bg-[#800000]/30 border-rose-500/50 text-rose-300 ring-2 ring-rose-500/20' 
                : selectedCompany === 'RWC'
                ? 'bg-[#008000]/25 border-emerald-500/50 text-emerald-300 ring-2 ring-emerald-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}>
              {selectedCompany === 'CRAS' ? '🎓' : selectedCompany === 'RWC' ? '🌿' : '🏢'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-extrabold text-white tracking-tight">
                  {selectedCompany === 'CRAS' 
                    ? 'CRAS College Admissions Pipeline' 
                    : selectedCompany === 'RWC'
                    ? 'Royal Wellness Patient Pipeline'
                    : 'Unified Multi-Company Pipeline'}
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  selectedCompany === 'CRAS'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : selectedCompany === 'RWC'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  {filteredLeads.length} {selectedCompany === 'CRAS' ? 'Inquiries' : 'Leads'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedCompany === 'CRAS' 
                  ? 'College of Royal Aesthetic Studies • Academic Courses & Students • WhatsApp +94 70 637 3353' 
                  : selectedCompany === 'RWC'
                  ? 'Royal Wellness Center • Clinical Care & Patient Inquiries • WhatsApp +94 70 639 3353'
                  : 'Consolidated overview across all companies (Super Admin & Leads Officer view)'}
              </p>
            </div>
          </div>

          {/* Company Pipeline Switcher Tabs */}
          <div className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800 gap-1 self-start lg:self-auto shrink-0 shadow-inner">
            {/* RWC Wellness Pipeline Tab */}
            <button
              type="button"
              onClick={() => handleCompanyChange('RWC')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                selectedCompany === 'RWC'
                  ? 'bg-[#008000]/30 border border-emerald-500/60 text-emerald-200 shadow-md shadow-emerald-950/60 ring-1 ring-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>(RWC) Wellness</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                {rwcCount}
              </span>
            </button>

            {/* CRAS College Pipeline Tab */}
            <button
              type="button"
              onClick={() => handleCompanyChange('CRAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                selectedCompany === 'CRAS'
                  ? 'bg-[#800000]/35 border border-rose-500/60 text-rose-200 shadow-md shadow-rose-950/60 ring-1 ring-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span>(CRAS) College</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60">
                {crasCount}
              </span>
            </button>

            {/* All Pipelines Tab */}
            <button
              type="button"
              onClick={() => handleCompanyChange('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedCompany === 'ALL'
                  ? 'bg-slate-800 border border-slate-700 text-slate-100 shadow'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-transparent'
              }`}
              title="View all company pipelines consolidated"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All</span>
            </button>
          </div>
        </div>
      ) : (
        /* Coordinator / Counsellor: Strictly Locked Single-Company Pipeline Indicator */
        <div className={`p-2.5 sm:p-3 rounded-2xl border shadow-md flex items-center justify-between gap-3 ${
          isCrasUser 
            ? 'bg-[#800000]/20 border-rose-500/40 text-rose-200' 
            : 'bg-[#008000]/15 border-emerald-500/40 text-emerald-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border font-bold text-base shrink-0 shadow-sm ${
              isCrasUser ? 'bg-rose-950/80 border-rose-500/50 text-rose-300' : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
            }`}>
              {isCrasUser ? '🎓' : '🌿'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-extrabold text-white">
                  {isCrasUser 
                    ? 'College of Royal Aesthetic Studies (CRAS) — Admissions Pipeline' 
                    : 'Royal Wellness Center (RWC) — Patient Care Pipeline'}
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isCrasUser ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {filteredLeads.length} Assigned {isCrasUser ? 'Inquiries' : 'Leads'}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-300/80">
                {isCrasUser 
                  ? 'Student academic inquiries and course admissions • Connected line: +94 70 637 3353' 
                  : 'Clinical patient treatments and consultations • Connected line: +94 70 639 3353'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] font-semibold text-slate-400 shrink-0">
            <Lock className="w-3 h-3 text-amber-400" />
            <span>{isCrasUser ? '(CRAS) Locked Line' : '(RWC) Locked Line'}</span>
          </div>
        </div>
      )}

      {/* Top Filter Bar */}
      <FiltersBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        selectedCoordinator={selectedCoordinator}
        setSelectedCoordinator={setSelectedCoordinator}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onExportCsv={handleExportCsv}
        company={effectiveCompany}
      />

      {/* Main Content Area: Kanban or Table */}
      {viewMode === 'kanban' ? (
        <KanbanBoard leads={filteredLeads} onSelectLead={onSelectLead} company={effectiveCompany} />
      ) : (
        <TableView leads={filteredLeads} onSelectLead={onSelectLead} company={effectiveCompany} />
      )}
    </div>
  );
};
