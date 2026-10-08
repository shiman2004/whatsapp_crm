import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { FiltersBar } from './FiltersBar';
import { KanbanBoard } from './KanbanBoard';
import { TableView } from './TableView';
import { Lead } from '../../types';

interface LeadsViewProps {
  onSelectLead: (leadId: string) => void;
}

export const LeadsView: React.FC<LeadsViewProps> = ({ onSelectLead }) => {
  const { leads, isSuperAdmin, isLeadsOfficer, currentUser, categories, treatments } = useCrm();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedCoordinator, setSelectedCoordinator] = useState('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Filter leads based on role & search params
  const filteredLeads = leads.filter((lead) => {
    // Role filter: Super Admins and Leads Officers can see all leads; Coordinators see assigned leads only
    if (!isSuperAdmin && !isLeadsOfficer && lead.assignedTo !== currentUser.id) {
      return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = lead.customer?.displayName?.toLowerCase().includes(q);
      const matchPhone = lead.customer?.whatsappNumber?.includes(q);
      if (!matchName && !matchPhone) return false;
    }

    // Category filter
    if (selectedCategory !== 'all' && lead.categoryId !== selectedCategory) {
      return false;
    }

    // Language filter
    if (selectedLanguage !== 'all' && lead.language !== selectedLanguage) {
      return false;
    }

    // Coordinator filter (Admin & Leads Officer)
    if ((isSuperAdmin || isLeadsOfficer) && selectedCoordinator !== 'all') {
      if (selectedCoordinator === 'unassigned' && lead.assignedTo) return false;
      if (selectedCoordinator !== 'unassigned' && lead.assignedTo !== selectedCoordinator) return false;
    }

    return true;
  });

  // CSV Export handler (PRD §FR-9.2)
  const handleExportCsv = () => {
    const headers = ['Lead ID', 'Patient Name', 'WhatsApp Phone', 'Language', 'Category', 'Service', 'Stage', 'Assigned To', 'Created Date'];
    const rows = filteredLeads.map(l => {
      const cat = categories.find(c => c.id === l.categoryId)?.name || '';
      const trt = treatments.find(t => t.id === l.treatmentId)?.name || '';
      const coord = l.assignedCoordinator?.fullName || 'Unassigned';
      return [
        l.id,
        `"${l.customer?.displayName || ''}"`,
        `"${l.customer?.whatsappNumber || ''}"`,
        l.language,
        `"${cat}"`,
        `"${trt}"`,
        l.stage,
        `"${coord}"`,
        `"${new Date(l.createdAt).toLocaleString()}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `royal_wellness_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 space-y-4">
      {/* Top filter bar */}
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
      />

      {/* Main Content Area: Kanban or Table */}
      {viewMode === 'kanban' ? (
        <KanbanBoard leads={filteredLeads} onSelectLead={onSelectLead} />
      ) : (
        <TableView leads={filteredLeads} onSelectLead={onSelectLead} />
      )}
    </div>
  );
};
