import React from 'react';
import { MarketingContact, MarketingOfficer } from './types';
import { LifecycleBadge, ConsentBadge } from './MarketingBadges';
import { useCrm } from '../../context/CrmContext';
import {
  Search,
  Filter,
  Download,
  UserCheck,
  UserPlus,
  ShieldAlert,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  Eye,
  Phone,
  MessageSquare,
  Lock,
  RefreshCw,
  Check,
  AlertCircle,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface MarketingContactsProps {
  contacts: MarketingContact[];
  loading: boolean;
  onRequestApi?: (path: string, init?: RequestInit) => Promise<any>;
  onRefresh?: () => void;
  onSelectContact: (contact: MarketingContact) => void;
  onBulkAssign: (contactIds: string[]) => void;
  onBulkSuppress: (contactIds: string[]) => void;
  totalContacts: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  search: string;
  onSearchChange: (search: string) => void;
  consentFilter: string;
  onConsentFilterChange: (val: string) => void;
  lifecycleFilter: string;
  onLifecycleFilterChange: (val: string) => void;
  assignmentFilter: string;
  onAssignmentFilterChange: (val: string) => void;
}

export const MarketingContacts: React.FC<MarketingContactsProps> = ({
  contacts,
  loading,
  onRequestApi,
  onRefresh,
  onSelectContact,
  onBulkAssign,
  onBulkSuppress,
  totalContacts,
  page,
  pageSize,
  onPageChange,
  search,
  onSearchChange,
  consentFilter,
  onConsentFilterChange,
  lifecycleFilter,
  onLifecycleFilterChange,
  assignmentFilter,
  onAssignmentFilterChange,
}) => {
  const { setSelectedLeadId, setActiveNavTab, leads, users, currentUser } = useCrm();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Notification state
  const [notice, setNotice] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active dropdown state for "Assign Coordinator" column
  const [openDropdownContactId, setOpenDropdownContactId] = React.useState<string | null>(null);
  const [coordinatorSearch, setCoordinatorSearch] = React.useState<string>('');
  const [assigningContactId, setAssigningContactId] = React.useState<string | null>(null);

  // Reassignment modal state
  const [reassignModal, setReassignModal] = React.useState<{
    contact: MarketingContact;
    newCoordinator: { id: string; fullName: string; roleTitle?: string; company?: string };
  } | null>(null);
  const [reassignReason, setReassignReason] = React.useState('');
  const [reassignSubmitting, setReassignSubmitting] = React.useState(false);

  // Auto-dismiss notification after 4 seconds
  React.useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.coordinator-dropdown-container')) {
        setOpenDropdownContactId(null);
        setCoordinatorSearch('');
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  const handleOpenLeadChat = (leadId: string) => {
    setSelectedLeadId(leadId);
    setActiveNavTab('chat');
  };

  // Permission check for assignment: super_admin or users with assign capability
  const canAssignContacts = currentUser?.role === 'super_admin';

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map(c => c.id)));
    }
  };

  const toggleSelectOne = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Export CSV
  const exportCleanedCsv = () => {
    if (contacts.length === 0) return;
    const headers = [
      'Serial Number',
      'Phone',
      'Source',
      'Source Group',
      'Assign By',
      'Assign Who',
      'Consent Status',
      'Lifecycle Status',
      'Created At',
    ];
    const rows = contacts.map(c => [
      c.serialNumber,
      c.normalizedPhone,
      `"${c.originalSource.replace(/"/g, '""')}"`,
      `"${(c.sourceGroupName || '').replace(/"/g, '""')}"`,
      `"${(c.assignedBy?.fullName || c.assignedByName || '—').replace(/"/g, '""')}"`,
      `"${(c.assignedOwner?.fullName || 'Unassigned').replace(/"/g, '""')}"`,
      c.consentStatus,
      c.lifecycleStatus,
      new Date(c.createdAt).toISOString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `marketing_contacts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get eligible coordinators for a specific contact (company matching)
  const getEligibleCoordinators = (contactCompany: string) => {
    return users.filter(u => {
      if (u.active === false) return false;
      const roleAllowed = ['coordinator', 'marketing_officer', 'leads_officer', 'super_admin'].includes(u.role);
      if (!roleAllowed) return false;
      // Super admin can be assigned anywhere; otherwise company must match
      if (u.role === 'super_admin') return true;
      if (!u.company) return true;
      return (u.company as string) === contactCompany;
    });
  };

  // Direct assignment for unassigned contact
  const handleDirectAssign = async (contact: MarketingContact, coordinator: { id: string; fullName: string }) => {
    if (!onRequestApi) return;
    setAssigningContactId(contact.id);
    setOpenDropdownContactId(null);
    setCoordinatorSearch('');
    try {
      await onRequestApi(`/api/marketing/contacts/${contact.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          assignedToId: coordinator.id,
          coordinatorId: coordinator.id,
          isReassignment: false,
        }),
      });
      setNotice({
        type: 'success',
        message: `Successfully assigned ${contact.serialNumber} to ${coordinator.fullName}.`,
      });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to assign coordinator.',
      });
    } finally {
      setAssigningContactId(null);
    }
  };

  // Execute confirmed reassignment
  const handleConfirmReassign = async () => {
    if (!reassignModal || !onRequestApi) return;
    const { contact, newCoordinator } = reassignModal;
    setReassignSubmitting(true);
    try {
      await onRequestApi(`/api/marketing/contacts/${contact.id}/reassign`, {
        method: 'POST',
        body: JSON.stringify({
          assignedToId: newCoordinator.id,
          coordinatorId: newCoordinator.id,
          isReassignment: true,
          reason: reassignReason.trim() || 'Coordinator reassignment',
        }),
      });
      setNotice({
        type: 'success',
        message: `Successfully reassigned ${contact.serialNumber} to ${newCoordinator.fullName}.`,
      });
      setReassignModal(null);
      setReassignReason('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to reassign coordinator.',
      });
    } finally {
      setReassignSubmitting(false);
    }
  };

  const totalPages = Math.ceil(totalContacts / pageSize) || 1;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Success / Error Notification Banner */}
      {notice && (
        <div
          className={`p-3 rounded-lg border flex items-center justify-between animate-in fade-in duration-200 ${
            notice.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            {notice.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search phone, serial, source or group..."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Consent Filter */}
          <select
            value={consentFilter}
            onChange={e => onConsentFilterChange(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 py-1.5 px-2.5 text-xs text-slate-200 outline-none focus:border-teal-400 cursor-pointer"
          >
            <option value="all">All Consent</option>
            <option value="verified">Verified Opt-in</option>
            <option value="unknown">Pending Consent</option>
            <option value="denied">Denied / Opted-out</option>
          </select>

          {/* Lifecycle Filter */}
          <select
            value={lifecycleFilter}
            onChange={e => onLifecycleFilterChange(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 py-1.5 px-2.5 text-xs text-slate-200 outline-none focus:border-teal-400 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="assigned">Assigned</option>
            <option value="contacted">Contacted</option>
            <option value="follow_up_pending">Follow-up Pending</option>
            <option value="interested">Interested</option>
            <option value="not_interested">Not Interested</option>
            <option value="converted">Converted to Lead</option>
            <option value="do_not_contact">Do Not Contact</option>
          </select>

          {/* Assignment Filter */}
          <select
            value={assignmentFilter}
            onChange={e => onAssignmentFilterChange(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 py-1.5 px-2.5 text-xs text-slate-200 outline-none focus:border-teal-400 cursor-pointer"
          >
            <option value="all">All Allocation</option>
            <option value="false">Unassigned Only</option>
            <option value="true">Assigned Only</option>
          </select>

          <button
            type="button"
            onClick={exportCleanedCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Download CSV export"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" /> Export Cleaned
          </button>
        </div>
      </div>

      {/* Bulk Selection Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="p-3 rounded-lg border border-teal-500/30 bg-teal-500/10 flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-xs text-teal-300">
            <span className="font-bold">{selectedIds.size}</span> contact{selectedIds.size === 1 ? '' : 's'} selected
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onBulkAssign(Array.from(selectedIds))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-400 text-slate-950 font-bold text-xs hover:bg-teal-300 transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5" /> Assign to Officer
            </button>
            <button
              type="button"
              onClick={() => onBulkSuppress(Array.from(selectedIds))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950 text-rose-300 border border-rose-800 font-bold text-xs hover:bg-rose-900 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Suppress (DND)
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Main Contacts Table - Required 10 Column Order (+ Checkbox) */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0D1526]/70 min-h-[420px]">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={contacts.length > 0 && selectedIds.size === contacts.length}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-700 bg-slate-900 text-teal-400 focus:ring-0 cursor-pointer"
                />
              </th>
              {/* 1. Serial */}
              <th className="px-3 py-3">Serial</th>
              {/* 2. Contact */}
              <th className="px-3 py-3">Contact</th>
              {/* 3. Source & Group */}
              <th className="px-3 py-3">Source & Group</th>
              {/* 4. Assign By */}
              <th className="px-3 py-3">Assign By</th>
              {/* 5. Assign Who */}
              <th className="px-3 py-3">Assign Who</th>
              {/* 6. Assign Coordinator */}
              <th className="px-3 py-3">Assign Coordinator</th>
              <th className="px-3 py-3">Consent</th>
              {/* 8. Status */}
              <th className="px-3 py-3">Status</th>
              {/* 9. Date */}
              <th className="px-3 py-3">Date</th>
              {/* 10. Actions */}
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                    <span>Loading marketing contacts...</span>
                  </div>
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-12 text-center text-slate-500">
                  No marketing contacts found matching the filters.
                </td>
              </tr>
            ) : (
              contacts.map(contact => {
                const isSelected = selectedIds.has(contact.id);
                const rawPhoneDigits = contact.normalizedPhone.replace(/[^0-9]/g, '');
                const isAssigned = Boolean(contact.assignedOwner?.id || contact.currentOwnerId);
                const isDropdownOpen = openDropdownContactId === contact.id;
                const isRowAssigning = assigningContactId === contact.id;

                // Eligible coordinators for this contact's company
                const eligibleCoordinators = getEligibleCoordinators(contact.company);
                const filteredCoordinators = eligibleCoordinators.filter(c => {
                  if (!coordinatorSearch.trim()) return true;
                  const term = coordinatorSearch.toLowerCase();
                  return (
                    c.fullName.toLowerCase().includes(term) ||
                    (c.roleTitle || c.role || '').toLowerCase().includes(term) ||
                    (c.email || '').toLowerCase().includes(term)
                  );
                });

                return (
                  <tr
                    key={contact.id}
                    onClick={() => onSelectContact(contact)}
                    className={`hover:bg-slate-900/70 transition-colors cursor-pointer ${
                      isSelected ? 'bg-teal-500/5' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => toggleSelectOne(contact.id, e as any)}
                        className="rounded border-slate-700 bg-slate-900 text-teal-400 focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* 1. Serial */}
                    <td className="px-3 py-3 font-mono font-bold text-slate-200 whitespace-nowrap">
                      {contact.serialNumber}
                    </td>

                    {/* 2. Contact */}
                    <td className="px-3 py-3">
                      {contact.name && (
                        <div className="font-semibold text-slate-100 truncate max-w-[150px]">
                          {contact.name}
                        </div>
                      )}
                      <div className="font-mono font-bold text-teal-300">
                        {contact.normalizedPhone}
                      </div>
                    </td>

                    {/* 3. Source & Group */}
                    <td className="px-3 py-3 text-slate-300 max-w-[180px] truncate">
                      <div className="truncate">{contact.originalSource}</div>
                      {contact.sourceGroupName && (
                        <span className="text-[10px] text-teal-400/80 font-mono block truncate">
                          {contact.sourceGroupName}
                        </span>
                      )}
                    </td>

                    {/* 4. Assign By */}
                    <td className="px-3 py-3 text-slate-300 whitespace-nowrap">
                      {contact.assignedBy?.fullName || contact.assignedByName ? (
                        <div>
                          <div className="font-medium text-slate-200 truncate max-w-[130px]">
                            {contact.assignedBy?.fullName || contact.assignedByName}
                          </div>
                          {contact.assignedBy?.roleTitle && (
                            <span className="text-[10px] text-slate-500 block truncate">
                              {contact.assignedBy.roleTitle}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono">—</span>
                      )}
                    </td>

                    {/* 5. Assign Who */}
                    <td className="px-3 py-3 text-slate-300 whitespace-nowrap">
                      {contact.assignedOwner ? (
                        <div className="max-w-[140px]">
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-indigo-300 font-semibold truncate">
                            <User className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="truncate">{contact.assignedOwner.fullName}</span>
                          </span>
                          {contact.assignedOwner.roleTitle && (
                            <span className="text-[10px] text-slate-400 block truncate">
                              {contact.assignedOwner.roleTitle}
                            </span>
                          )}
                        </div>
                      ) : contact.currentOwnerId ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-indigo-300 font-medium">
                          <User className="w-3 h-3 text-indigo-400" />
                          Assigned
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px] font-medium">Unassigned</span>
                      )}
                    </td>

                    {/* 6. Assigned At */}
                    <td className="hidden">
                      {contact.assignedAt ? new Date(contact.assignedAt).toLocaleString() : '—'}
                    </td>

                    {/* 7. Assign Coordinator (Interactive Searchable Dropdown) */}
                    <td className="px-3 py-3 coordinator-dropdown-container relative" onClick={e => e.stopPropagation()}>
                      {!canAssignContacts ? (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-800 bg-slate-900/60 text-slate-500 text-[11px] cursor-not-allowed"
                          title="Only authorized administrators can assign marketing contacts"
                        >
                          <Lock className="w-3 h-3 text-slate-600" />
                          <span>{isAssigned ? 'Reassign' : 'Assign'}</span>
                        </button>
                      ) : (
                        <div className="relative inline-block">
                          <button
                            type="button"
                            disabled={isRowAssigning}
                            onClick={() => {
                              if (isDropdownOpen) {
                                setOpenDropdownContactId(null);
                                setCoordinatorSearch('');
                              } else {
                                setOpenDropdownContactId(contact.id);
                                setCoordinatorSearch('');
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all border shadow-sm ${
                              isAssigned
                                ? 'border-indigo-800/70 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50 hover:border-indigo-600'
                                : 'border-teal-700/70 bg-teal-950/40 text-teal-300 hover:bg-teal-900/50 hover:border-teal-500'
                            }`}
                            title={isAssigned ? 'Reassign coordinator' : 'Assign to coordinator'}
                          >
                            {isRowAssigning ? (
                              <Loader2 className="w-3 h-3 animate-spin text-teal-400" />
                            ) : isAssigned ? (
                              <RefreshCw className="w-3 h-3 text-indigo-400" />
                            ) : (
                              <UserPlus className="w-3 h-3 text-teal-400" />
                            )}
                            <span>{isAssigned ? 'Reassign' : 'Assign'}</span>
                            <ChevronDown className="w-3 h-3 opacity-70" />
                          </button>

                          {/* Searchable Dropdown Popover */}
                          {isDropdownOpen && (
                            <div className="absolute left-0 mt-1.5 w-64 rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-2xl z-50 animate-in fade-in duration-150">
                              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 text-[11px]">
                                <span className="font-semibold text-slate-300">
                                  {isAssigned ? 'Reassign Coordinator' : 'Assign Coordinator'}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-teal-400">
                                  {contact.company}
                                </span>
                              </div>

                              {/* Search input inside dropdown */}
                              <div className="relative mb-2">
                                <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-500" />
                                <input
                                  type="text"
                                  autoFocus
                                  value={coordinatorSearch}
                                  onChange={e => setCoordinatorSearch(e.target.value)}
                                  placeholder="Search name, role..."
                                  className="w-full rounded border border-slate-800 bg-slate-900 py-1 pl-7 pr-2 text-[11px] text-white placeholder-slate-500 outline-none focus:border-teal-400"
                                />
                              </div>

                              {/* Coordinator Options List */}
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {filteredCoordinators.length === 0 ? (
                                  <div className="p-3 text-center text-[11px] text-slate-500">
                                    No eligible coordinators found for {contact.company}.
                                  </div>
                                ) : (
                                  filteredCoordinators.map(c => {
                                    const isCurrent = contact.assignedOwner?.id === c.id;
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        disabled={isCurrent}
                                        onClick={() => {
                                          if (isAssigned) {
                                            setOpenDropdownContactId(null);
                                            setReassignModal({
                                              contact,
                                              newCoordinator: {
                                                id: c.id,
                                                fullName: c.fullName,
                                                roleTitle: c.roleTitle || c.role,
                                                company: c.company,
                                              },
                                            });
                                            setReassignReason('');
                                          } else {
                                            void handleDirectAssign(contact, {
                                              id: c.id,
                                              fullName: c.fullName,
                                            });
                                          }
                                        }}
                                        className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-[11px] transition-colors ${
                                          isCurrent
                                            ? 'bg-slate-900/40 text-slate-500 cursor-not-allowed opacity-60'
                                            : 'hover:bg-slate-800/80 text-slate-200'
                                        }`}
                                      >
                                        <div className="truncate pr-2">
                                          <div className="font-medium text-slate-200 truncate">
                                            {c.fullName}
                                          </div>
                                          <div className="text-[10px] text-slate-400 truncate">
                                            {c.roleTitle || c.role} {c.company ? `(${c.company})` : ''}
                                          </div>
                                        </div>
                                        {isCurrent && (
                                          <span className="text-[10px] text-indigo-400 font-semibold shrink-0">
                                            Current
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 7. Consent */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <ConsentBadge status={contact.consentStatus} />
                    </td>

                    {/* 8. Status */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <LifecycleBadge status={contact.lifecycleStatus} />
                    </td>

                    {/* 9. Date */}
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </td>

                    {/* 10. Actions */}
                    <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => onSelectContact(contact)}
                          className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-teal-300 hover:text-white hover:bg-slate-700 transition-colors"
                          title="View contact drawer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`tel:${contact.normalizedPhone}`}
                          className="p-1.5 rounded-lg border border-emerald-800/80 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60 transition-colors"
                          title="Call contact"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        {(() => {
                          const matchedLead = contact.convertedLeadId
                            ? leads.find(l => l.id === contact.convertedLeadId)
                            : leads.find(l => {
                                const p1 = (l.customer?.phoneNumber || '').replace(/[^0-9]/g, '');
                                const p2 = (l.customer?.whatsappNumber || '').replace(/[^0-9]/g, '');
                                return (p1 && p1.endsWith(rawPhoneDigits.slice(-9))) || (p2 && p2.endsWith(rawPhoneDigits.slice(-9)));
                              });

                          if (matchedLead || contact.convertedLeadId) {
                            return (
                              <button
                                type="button"
                                onClick={() => handleOpenLeadChat(matchedLead?.id || contact.convertedLeadId!)}
                                className="p-1.5 rounded-lg border border-emerald-700/80 bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900/80 transition-colors"
                                title="Open in CRM Live Chat"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            );
                          }

                          if (contact.consentStatus === 'verified' && !contact.isSuppressed) {
                            return (
                              <a
                                href={`https://wa.me/${rawPhoneDigits}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg border border-teal-800/80 bg-teal-950/60 text-teal-300 hover:bg-teal-900/60 transition-colors"
                                title="Open WhatsApp (Verified Consent)"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            );
                          }

                          return (
                            <button
                              type="button"
                              disabled
                              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-600 cursor-not-allowed"
                              title="WhatsApp outreach locked: Requires verified opt-in consent"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
        <span>
          Showing {contacts.length} of {totalContacts} contacts
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reassignment Confirmation Modal */}
      {reassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Confirm Coordinator Reassignment</h3>
                  <p className="text-xs text-slate-400">
                    Contact <span className="font-mono text-teal-300 font-semibold">{reassignModal.contact.serialNumber}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReassignModal(null)}
                className="text-slate-500 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Transfer Visual */}
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Contact Phone</span>
                <span className="font-mono font-bold text-teal-300">{reassignModal.contact.normalizedPhone}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Company Scope</span>
                <span className="font-mono font-bold text-slate-300">{reassignModal.contact.company}</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">Current Coordinator</span>
                  <span className="font-medium text-slate-300">
                    {reassignModal.contact.assignedOwner?.fullName || 'Assigned'}
                  </span>
                </div>
                <div className="text-indigo-400 font-bold px-2">➔</div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">New Coordinator</span>
                  <span className="font-bold text-teal-300">{reassignModal.newCoordinator.fullName}</span>
                </div>
              </div>
            </div>

            {/* Optional Reason Textarea */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300">
                Reassignment Reason <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={reassignReason}
                onChange={e => setReassignReason(e.target.value)}
                placeholder="e.g., Workload rebalancing, specialist attention, coordinator off-duty..."
                className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={reassignSubmitting}
                onClick={() => setReassignModal(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reassignSubmitting}
                onClick={handleConfirmReassign}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {reassignSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Reassigning...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm Reassignment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
