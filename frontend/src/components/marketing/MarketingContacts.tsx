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
  Phone,
  MessageSquare,
  Lock,
  RefreshCw,
  Check,
  AlertCircle,
  X,
  Loader2,
  AlertTriangle,
  Pencil,
  Trash2,
  Calendar,
  RotateCcw,
  Eye,
  Clock,
  Sparkles,
  ShieldCheck,
  Activity,
  Layers,
  Users,
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
  onPageSizeChange: (newSize: number) => void;
  onPageChange: (newPage: number) => void;
  search: string;
  onSearchChange: (search: string) => void;
  consentFilter: string;
  onConsentFilterChange: (val: string) => void;
  lifecycleFilter: string;
  onLifecycleFilterChange: (val: string) => void;
  assignmentFilter: string;
  onAssignmentFilterChange: (val: string) => void;
  staffFilter?: string;
  onStaffFilterChange?: (val: string) => void;
  batchFilter?: string;
  onBatchFilterChange?: (val: string) => void;
  leadStatusFilter?: string;
  onLeadStatusFilterChange?: (val: string) => void;
  dateFilter?: string;
  onDateFilterChange?: (val: string) => void;
  sortFilter?: string;
  onSortFilterChange?: (val: string) => void;
  uploads?: any[];
  onResetFilters?: () => void;
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
  onPageSizeChange,
  onPageChange,
  search,
  onSearchChange,
  consentFilter,
  onConsentFilterChange,
  lifecycleFilter,
  onLifecycleFilterChange,
  assignmentFilter,
  onAssignmentFilterChange,
  staffFilter = 'all',
  onStaffFilterChange,
  batchFilter = 'all',
  onBatchFilterChange,
  leadStatusFilter = 'all',
  onLeadStatusFilterChange,
  dateFilter = 'all',
  onDateFilterChange,
  sortFilter = 'date_desc',
  onSortFilterChange,
  uploads = [],
  onResetFilters,
}) => {
  const { setSelectedLeadId, setActiveNavTab, leads, users, currentUser } = useCrm();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Count active filters
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (consentFilter !== 'all') count++;
    if (lifecycleFilter !== 'all') count++;
    if (assignmentFilter !== 'all') count++;
    if (staffFilter !== 'all') count++;
    if (batchFilter !== 'all') count++;
    if (leadStatusFilter !== 'all') count++;
    if (dateFilter !== 'all') count++;
    return count;
  }, [search, consentFilter, lifecycleFilter, assignmentFilter, staffFilter, batchFilter, leadStatusFilter, dateFilter]);

  const handleResetFilters = () => {
    onSearchChange('');
    onConsentFilterChange('all');
    onLifecycleFilterChange('all');
    onAssignmentFilterChange('all');
    if (onStaffFilterChange) onStaffFilterChange('all');
    if (onBatchFilterChange) onBatchFilterChange('all');
    if (onLeadStatusFilterChange) onLeadStatusFilterChange('all');
    if (onDateFilterChange) onDateFilterChange('all');
    if (onSortFilterChange) onSortFilterChange('date_desc');
    if (onResetFilters) onResetFilters();
  };

  // Notification state
  const [notice, setNotice] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active dropdown state for "Assign Coordinator" column
  const [openDropdownContactId, setOpenDropdownContactId] = React.useState<string | null>(null);
  const [coordinatorSearch, setCoordinatorSearch] = React.useState<string>('');
  const [assigningContactId, setAssigningContactId] = React.useState<string | null>(null);

  // Assignment history modal state
  const [historyTarget, setHistoryTarget] = React.useState<MarketingContact | null>(null);
  const [historyList, setHistoryList] = React.useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState('');

  const handleOpenHistory = async (contact: MarketingContact, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setHistoryTarget(contact);
    setHistoryLoading(true);
    setHistoryError('');
    setHistoryList([]);
    try {
      if (onRequestApi) {
        const res = await onRequestApi(`/api/marketing/contacts/${contact.id}/history`);
        if (res?.data?.history) {
          setHistoryList(res.data.history);
        }
      }
    } catch (err: any) {
      setHistoryError(err.message || 'Failed to load assignment history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Reassignment modal state
  const [reassignModal, setReassignModal] = React.useState<{
    contact: MarketingContact;
    newCoordinator: { id: string; fullName: string; roleTitle?: string; company?: string };
  } | null>(null);
  const [reassignReason, setReassignReason] = React.useState('');
  const [reassignSubmitting, setReassignSubmitting] = React.useState(false);

  // Delete modal state (supports single and bulk delete)
  const [deleteTarget, setDeleteTarget] = React.useState<
    | { mode: 'single'; contact: MarketingContact }
    | { mode: 'bulk'; count: number; ids: string[] }
    | null
  >(null);
  const [deleteReason, setDeleteReason] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Quick Edit Contact Modal state (Numbers update)
  const [editingContact, setEditingContact] = React.useState<MarketingContact | null>(null);
  const [editPhone, setEditPhone] = React.useState('');
  const [editSource, setEditSource] = React.useState('');
  const [editGroupName, setEditGroupName] = React.useState('');
  const [editStatus, setEditStatus] = React.useState('new');
  const [editNotes, setEditNotes] = React.useState('');
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [editError, setEditError] = React.useState('');

  const handleOpenEdit = (contact: MarketingContact, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingContact(contact);
    setEditPhone(contact.normalizedPhone);
    setEditSource(contact.originalSource || '');
    setEditGroupName(contact.sourceGroupName || '');
    setEditStatus(contact.lifecycleStatus || 'new');
    setEditNotes(contact.qualificationNote || '');
    setEditError('');
  };

  const handleSaveEdit = async () => {
    if (!editingContact || !onRequestApi) return;
    if (!editPhone.trim()) {
      setEditError('Phone number is required.');
      return;
    }
    setEditSubmitting(true);
    setEditError('');
    try {
      await onRequestApi(`/api/marketing/contacts/${editingContact.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          phone: editPhone.trim(),
          source: editSource.trim(),
          sourceGroupName: editGroupName.trim(),
          status: editStatus,
          notes: editNotes.trim(),
        }),
      });
      setNotice({
        type: 'success',
        message: `Successfully updated contact ${editingContact.serialNumber} (${editPhone.trim()}).`,
      });
      setEditingContact(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update contact number and details.');
    } finally {
      setEditSubmitting(false);
    }
  };

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

  // Deterministic displayContacts with sort order
  const displayContacts = React.useMemo(() => {
    let result = [...contacts];
    if (sortFilter === "phone_asc") {
      result.sort((a, b) => a.normalizedPhone.localeCompare(b.normalizedPhone));
    } else if (sortFilter === "phone_desc") {
      result.sort((a, b) => b.normalizedPhone.localeCompare(a.normalizedPhone));
    } else if (sortFilter === "serial_asc") {
      result.sort((a, b) => (a.serialNumber || "").localeCompare(b.serialNumber || ""));
    } else if (sortFilter === "serial_desc") {
      result.sort((a, b) => (b.serialNumber || "").localeCompare(a.serialNumber || ""));
    } else if (sortFilter === "source_asc") {
      result.sort((a, b) => (a.originalSource || "").localeCompare(b.originalSource || ""));
    } else if (sortFilter === "source_desc") {
      result.sort((a, b) => (b.originalSource || "").localeCompare(a.originalSource || ""));
    } else if (sortFilter === "date_asc") {
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortFilter === "date_desc") {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return result;
  }, [contacts, sortFilter]);

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedIds.size === displayContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayContacts.map(c => c.id)));
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
    if (displayContacts.length === 0) return;
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
    const rows = displayContacts.map(c => [
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

  const handleSingleDelete = (contact: MarketingContact) => {
    setDeleteTarget({ mode: 'single', contact });
    setDeleteReason('');
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteTarget({ mode: 'bulk', count: selectedIds.size, ids: Array.from(selectedIds) });
    setDeleteReason('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !onRequestApi) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.mode === 'single') {
        await onRequestApi(`/api/marketing/contacts/${deleteTarget.contact.id}`, {
          method: 'DELETE',
          body: JSON.stringify({ reason: deleteReason.trim() || 'Soft delete' }),
        });
        setNotice({
          type: 'success',
          message: `Successfully deleted contact ${deleteTarget.contact.serialNumber || deleteTarget.contact.normalizedPhone}.`,
        });
      } else {
        await onRequestApi('/api/marketing/contacts/bulk-delete', {
          method: 'POST',
          body: JSON.stringify({ contactIds: deleteTarget.ids, reason: deleteReason.trim() || 'Bulk delete' }),
        });
        setNotice({
          type: 'success',
          message: `Successfully deleted ${deleteTarget.count} selected contacts.`,
        });
        setSelectedIds(new Set());
      }
      setDeleteTarget(null);
      setDeleteReason('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to delete contact(s).',
      });
    } finally {
      setIsDeleting(false);
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

      {/* Redesigned Search & Filter Control Hub */}
      <div className="space-y-3 bg-[#0a1120] p-3.5 rounded-xl border border-slate-800 shadow-sm">
        {/* Row 1: Prominent Search Bar & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-xl">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search phone (+94...), serial (MKT-...), source, or group..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-8 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-800/80 bg-rose-950/40 text-xs font-semibold text-rose-300 hover:bg-rose-900/60 hover:text-white transition-colors"
                title="Reset all active filters"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>Reset Filters</span>
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-rose-900/80 text-[10px] text-rose-200 font-mono font-bold">
                  {activeFilterCount}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={exportCleanedCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 hover:border-slate-600 transition-colors"
              title="Download CSV export of current contacts"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Export Cleaned</span>
            </button>
          </div>
        </div>

        {/* Row 2: Filter Group Pills & Sorting (De-duplicated & Categorized) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-teal-400" />
            <span>Filters:</span>
          </div>

          {/* 1. Allocation Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition-colors">
            <UserCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="text-slate-400 text-[11px] font-medium">Allocation:</span>
            <select
              value={assignmentFilter}
              onChange={e => onAssignmentFilterChange(e.target.value)}
              className="bg-transparent text-xs text-white outline-none cursor-pointer font-medium"
              style={{ colorScheme: 'dark' }}
              title="Filter by assignment status"
            >
              <option className="bg-slate-900 text-slate-200" value="all">All</option>
              <option className="bg-slate-900 text-slate-200" value="false">Unassigned Only</option>
              <option className="bg-slate-900 text-slate-200" value="true">Assigned Only</option>
              <option className="bg-slate-900 text-slate-200" value="reassigned">Reassigned Only</option>
            </select>
          </div>

          {/* 2. Assigned Staff Filter */}
          {users && users.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition-colors">
              <Users className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="text-slate-400 text-[11px] font-medium">Staff:</span>
              <select
                value={staffFilter}
                onChange={e => onStaffFilterChange && onStaffFilterChange(e.target.value)}
                className="bg-transparent text-xs text-white outline-none cursor-pointer font-medium max-w-[140px] truncate"
                style={{ colorScheme: 'dark' }}
                title="Filter by assigned staff member"
              >
                <option className="bg-slate-900 text-slate-200" value="all">All Staff</option>
                {users.filter(u => u.active).map(u => (
                  <option key={u.id} className="bg-slate-900 text-slate-200" value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 3. CRM Lead Conversion Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition-colors">
            <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="text-slate-400 text-[11px] font-medium">CRM Lead:</span>
            <select
              value={leadStatusFilter}
              onChange={e => onLeadStatusFilterChange && onLeadStatusFilterChange(e.target.value)}
              className="bg-transparent text-xs text-white outline-none cursor-pointer font-medium"
              style={{ colorScheme: 'dark' }}
              title="Filter by CRM lead conversion status"
            >
              <option className="bg-slate-900 text-slate-200" value="all">All Leads</option>
              <option className="bg-slate-900 text-slate-200" value="converted">Converted to Lead</option>
              <option className="bg-slate-900 text-slate-200" value="not_converted">Not Converted</option>
            </select>
          </div>

          {/* 4. Outreach / Lifecycle Status (De-duplicated: removed 'assigned' and 'converted' which belong to Allocation and Lead) */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition-colors">
            <Activity className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="text-slate-400 text-[11px] font-medium">Outreach:</span>
            <select
              value={lifecycleFilter}
              onChange={e => onLifecycleFilterChange(e.target.value)}
              className="bg-transparent text-xs text-white outline-none cursor-pointer font-medium"
              style={{ colorScheme: 'dark' }}
              title="Filter by marketing outreach progress"
            >
              <option className="bg-slate-900 text-slate-200" value="all">All Outreach</option>
              <option className="bg-slate-900 text-slate-200" value="new">New / Uncontacted</option>
              <option className="bg-slate-900 text-slate-200" value="contacted">Contacted</option>
              <option className="bg-slate-900 text-slate-200" value="follow_up_pending">Follow-up Pending</option>
              <option className="bg-slate-900 text-slate-200" value="interested">Interested</option>
              <option className="bg-slate-900 text-slate-200" value="not_interested">Not Interested</option>
              <option className="bg-slate-900 text-slate-200" value="do_not_contact">Do Not Contact (DND)</option>
            </select>
          </div>

          {/* 5. Consent Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition-colors">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="text-slate-400 text-[11px] font-medium">Consent:</span>
            <select
              value={consentFilter}
              onChange={e => onConsentFilterChange(e.target.value)}
              className="bg-transparent text-xs text-white outline-none cursor-pointer font-medium"
              style={{ colorScheme: 'dark' }}
              title="Filter by consent status"
            >
              <option className="bg-slate-900 text-slate-200" value="all">All Consent</option>
              <option className="bg-slate-900 text-slate-200" value="verified">Verified Opt-in</option>
              <option className="bg-slate-900 text-slate-200" value="unknown">Pending Consent</option>
              <option className="bg-slate-900 text-slate-200" value="denied">Denied / Opted-out</option>
            </select>
          </div>

          {/* 6. Batch Filter */}
          {uploads && uploads.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition-colors">
              <Layers className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="text-slate-400 text-[11px] font-medium">Batch:</span>
              <select
                value={batchFilter}
                onChange={e => onBatchFilterChange && onBatchFilterChange(e.target.value)}
                className="bg-transparent text-xs text-white outline-none cursor-pointer font-medium max-w-[130px] truncate"
                style={{ colorScheme: 'dark' }}
                title="Filter by import batch"
              >
                <option className="bg-slate-900 text-slate-200" value="all">All Batches</option>
                {uploads.map(b => (
                  <option key={b.id} className="bg-slate-900 text-slate-200" value={b.id}>
                    Batch #{b.batchNumber}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 7. Added Date Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="text-slate-400 text-[11px] font-medium">Date:</span>
            <select
              value={dateFilter}
              onChange={e => onDateFilterChange && onDateFilterChange(e.target.value)}
              className="bg-transparent text-xs text-white outline-none cursor-pointer font-medium"
              style={{ colorScheme: 'dark' }}
              title="Filter by added date"
            >
              <option className="bg-slate-900 text-slate-200" value="all">All Dates</option>
              <option className="bg-slate-900 text-slate-200" value="today">Today</option>
              <option className="bg-slate-900 text-slate-200" value="yesterday">Yesterday</option>
              <option className="bg-slate-900 text-slate-200" value="last7days">Last 7 Days</option>
              <option className="bg-slate-900 text-slate-200" value="this_month">This Month</option>
              <option className="bg-slate-900 text-slate-200" value="last_month">Last Month</option>
            </select>
          </div>

          {/* 8. Sorting Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition-colors sm:ml-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="text-slate-400 text-[11px] font-medium">Sort:</span>
            <select
              value={sortFilter}
              onChange={e => onSortFilterChange && onSortFilterChange(e.target.value)}
              className="bg-transparent text-xs text-teal-300 outline-none cursor-pointer font-semibold"
              style={{ colorScheme: 'dark' }}
              title="Sort contacts list"
            >
              <option className="bg-slate-900 text-slate-200" value="date_desc">Newest First</option>
              <option className="bg-slate-900 text-slate-200" value="date_asc">Oldest First</option>
              <option className="bg-slate-900 text-slate-200" value="phone_asc">Number (0-9)</option>
              <option className="bg-slate-900 text-slate-200" value="phone_desc">Number (9-0)</option>
              <option className="bg-slate-900 text-slate-200" value="serial_asc">Serial (A-Z)</option>
              <option className="bg-slate-900 text-slate-200" value="serial_desc">Serial (Z-A)</option>
              <option className="bg-slate-900 text-slate-200" value="source_asc">Source (A-Z)</option>
              <option className="bg-slate-900 text-slate-200" value="source_desc">Source (Z-A)</option>
            </select>
          </div>
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
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.size})
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

      {/* Main Contacts Table - Required 13 Column Order (+ Checkbox) */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0D1526]/70 min-h-[420px]">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={displayContacts.length > 0 && selectedIds.size === displayContacts.length}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-700 bg-slate-900 text-teal-400 focus:ring-0 cursor-pointer"
                />
              </th>
              {/* 1. Serial */}
              <th className="px-3 py-3">Serial</th>
              {/* 2. Contact Number */}
              <th className="px-3 py-3">Contact Number</th>
              {/* 3. Source & Group */}
              <th className="px-3 py-3">Source & Group</th>
              {/* 4. Assigned Staff (Consolidated with Role & Inline Reassign) */}
              <th className="px-3 py-3">Assigned Staff</th>
              {/* 5. Assigned By */}
              <th className="px-3 py-3">Assigned By</th>
              {/* 6. Assignment Date (Merged with Reassigned Date) */}
              <th className="px-3 py-3">Assignment Date</th>
              {/* 7. Consent Status */}
              <th className="px-3 py-3">Consent Status</th>
              {/* 8. Lead Status */}
              <th className="px-3 py-3">Lead Status</th>
              {/* 9. Actions */}
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                    <span>Loading marketing contacts...</span>
                  </div>
                </td>
              </tr>
            ) : displayContacts.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-12 text-center text-slate-500">
                  No marketing contacts found matching the filters.
                </td>
              </tr>
            ) : (
              displayContacts.map(contact => {
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

                    {/* 2. Contact Number */}
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

                    {/* 4. Assigned Staff (Consolidated with Role & Inline Assign/Reassign Action) */}
                    <td className="px-3 py-3 coordinator-dropdown-container relative" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {contact.assignedOwner ? (
                          <div className="min-w-[110px] max-w-[140px]">
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-indigo-300 font-semibold truncate">
                              <User className="w-3 h-3 text-indigo-400 shrink-0" />
                              <span className="truncate">{contact.assignedOwner.fullName}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {contact.assignedOwner.roleTitle || 'Marketing Staff'}
                            </span>
                          </div>
                        ) : contact.currentOwnerId ? (
                          <div className="min-w-[100px]">
                            <span className="inline-flex items-center gap-1 text-[11px] text-indigo-300 font-medium">
                              <User className="w-3 h-3 text-indigo-400" />
                              Assigned
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-slate-500 border border-slate-800">
                            Unassigned
                          </span>
                        )}

                        {/* Inline Assign / Reassign Button with Popover */}
                        {!canAssignContacts ? (
                          <button
                            type="button"
                            disabled
                            className="p-1 rounded border border-slate-800 bg-slate-900/60 text-slate-600 text-[10px] cursor-not-allowed"
                            title="Only administrators can assign contacts"
                          >
                            <Lock className="w-3 h-3" />
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
                              className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all border shadow-sm inline-flex items-center gap-1 ${
                                isAssigned
                                  ? 'border-indigo-800/70 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/60 hover:text-white'
                                  : 'border-teal-700/70 bg-teal-950/40 text-teal-300 hover:bg-teal-900/60 hover:text-white'
                              }`}
                              title={isAssigned ? 'Reassign to another staff member' : 'Assign to staff member'}
                            >
                              {isRowAssigning ? (
                                <Loader2 className="w-3 h-3 animate-spin text-teal-400" />
                              ) : isAssigned ? (
                                <>
                                  <RotateCcw className="w-2.5 h-2.5 text-indigo-400" />
                                  <span>Reassign</span>
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-2.5 h-2.5 text-teal-400" />
                                  <span>Assign</span>
                                </>
                              )}
                              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                            </button>

                            {/* Dropdown Popover */}
                            {isDropdownOpen && (
                              <div className="absolute left-0 mt-1.5 w-64 rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-2xl z-50 animate-in fade-in duration-150">
                                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 text-[11px]">
                                  <span className="font-semibold text-slate-300">
                                    {isAssigned ? 'Reassign Staff' : 'Assign Staff'}
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
                                    placeholder="Search staff, role..."
                                    className="w-full rounded border border-slate-800 bg-slate-900 py-1 pl-7 pr-2 text-[11px] text-white placeholder-slate-500 outline-none focus:border-teal-400"
                                  />
                                </div>

                                {/* Options List */}
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                  {filteredCoordinators.length === 0 ? (
                                    <div className="p-3 text-center text-[11px] text-slate-500">
                                      No eligible staff found for {contact.company}.
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
                      </div>
                    </td>

                    {/* 5. Assigned By */}
                    <td className="px-3 py-3 text-slate-300 whitespace-nowrap">
                      {contact.assignedBy?.fullName || contact.assignedByName ? (
                        <div>
                          <div className="font-medium text-slate-200 truncate max-w-[130px]">
                            {contact.assignedBy?.fullName || contact.assignedByName}
                          </div>
                          {(contact.assignedBy?.roleTitle || contact.assignedBy?.role) && (
                            <span className="text-[10px] text-slate-500 block truncate">
                              {contact.assignedBy.roleTitle || contact.assignedBy.role}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono text-[11px]">—</span>
                      )}
                    </td>

                    {/* 6. Assignment Date (Merged Assigned & Reassigned Timestamps) */}
                    <td className="px-3 py-3 text-slate-300 whitespace-nowrap font-mono text-[11px]">
                      {contact.assignedAt ? (
                        <div>
                          <div className="text-slate-300">
                            {new Date(contact.assignedAt).toLocaleDateString()}
                            <span className="text-slate-500 text-[10px] ml-1.5">
                              {new Date(contact.assignedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {contact.lastReassignedAt && (
                            <div className="inline-flex items-center gap-1 text-[10px] text-amber-400/90 mt-0.5" title="Reassigned date">
                              <RotateCcw className="w-2.5 h-2.5 text-amber-400" />
                              <span>Reassigned {new Date(contact.lastReassignedAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono text-[11px]">—</span>
                      )}
                    </td>

                    {/* 11. Consent Status */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <ConsentBadge status={contact.consentStatus} />
                    </td>

                    {/* 12. Lead Status */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      {contact.convertedLeadId || contact.lifecycleStatus === 'converted' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-950 text-teal-300 border border-teal-800 inline-flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Converted
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-slate-500 border border-slate-800">
                          Not Converted
                        </span>
                      )}
                    </td>

                    {/* 13. Actions */}
                    <td className="px-3 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => onSelectContact(contact)}
                          className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                          title="View contact details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={e => handleOpenHistory(contact, e)}
                          className="p-1.5 rounded-lg border border-indigo-800/80 bg-indigo-950/60 text-indigo-300 hover:text-white hover:bg-indigo-900/80 transition-colors"
                          title="View assignment history"
                        >
                          <Clock className="w-3.5 h-3.5" />
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
                        <button
                          type="button"
                          onClick={e => handleOpenEdit(contact, e)}
                          className="p-1.5 rounded-lg border border-teal-800/80 bg-teal-950/60 text-teal-300 hover:text-white hover:bg-teal-900/80 transition-colors"
                          title="Quick Edit Number & Details"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSingleDelete(contact)}
                          className="p-1.5 rounded-lg border border-rose-800/80 bg-rose-950/60 text-rose-400 hover:text-white hover:bg-rose-800 transition-colors"
                          title="Delete contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Contact database footer */}
      <footer className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#080e1d] px-4 py-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span>Showing <strong className="text-slate-200">{totalContacts ? ((page - 1) * pageSize) + 1 : 0} - {Math.min(page * pageSize, totalContacts)}</strong> of <strong className="text-slate-200">{totalContacts}</strong> contacts</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <label className="flex items-center gap-2">Rows per page:
            <select value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-teal-400">
              {[25, 50, 100, 200].map(size => <option key={size} value={size}>{size === 200 ? 'All available' : size}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="flex items-center gap-1">
          <button type="button" aria-label="First page" disabled={page <= 1 || loading} onClick={() => onPageChange(1)} className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40">&laquo;</button>
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" aria-label={`Page ${page}`} className="min-w-8 rounded-lg bg-teal-500 px-2 py-1.5 font-semibold text-slate-950">{page}</button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button type="button" aria-label="Last page" disabled={page >= totalPages || loading} onClick={() => onPageChange(totalPages)} className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40">&raquo;</button>
          </div>
          <span className="whitespace-nowrap">Page {page} of {totalPages}</span>
        </div>
      </footer>

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
      {/* Delete Confirmation Modal (Supports Single & Bulk Delete) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-white text-sm">
                  {deleteTarget.mode === 'single' ? 'Delete Marketing Contact?' : `Delete ${deleteTarget.count} Selected Contacts?`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deleteTarget.mode === 'single' ? (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                <div className="font-semibold text-slate-200">
                  Contact: <span className="font-mono text-teal-300">{deleteTarget.contact.normalizedPhone}</span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  Serial: <span className="font-mono text-slate-300">{deleteTarget.contact.serialNumber}</span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                <div className="font-semibold text-rose-300">
                  {deleteTarget.count} contacts selected for deletion
                </div>
                <div className="text-slate-400 text-[11px]">
                  All selected records will be removed from active marketing lists.
                </div>
              </div>
            )}

            <p className="text-xs text-slate-400 leading-relaxed">
              This action will remove the contact{deleteTarget.mode === 'bulk' ? 's' : ''} from active marketing lists and assignments. Historical activity and consent audit records will be preserved according to data retention policy.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300">
                Reason for Deletion <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                placeholder="e.g. Requested removal, duplicate entry, campaign concluded..."
                className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment History Timeline Modal */}
      {historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Contact Assignment History</h3>
                  <p className="text-xs text-slate-400">
                    Serial: <span className="font-mono text-teal-300 font-semibold">{historyTarget.serialNumber}</span> &bull; Number: <span className="font-mono text-slate-200 font-semibold">{historyTarget.normalizedPhone}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {historyLoading ? (
                <div className="p-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  <span>Loading assignment timeline...</span>
                </div>
              ) : historyError ? (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                  {historyError}
                </div>
              ) : historyList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No previous assignment records found for this contact.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-[#0D1526]/70 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px]">
                      <tr>
                        <th className="px-3 py-2.5">Event</th>
                        <th className="px-3 py-2.5">From Staff</th>
                        <th className="px-3 py-2.5">To Staff</th>
                        <th className="px-3 py-2.5">Date & Time</th>
                        <th className="px-3 py-2.5">Performed By</th>
                        <th className="px-3 py-2.5">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans text-[11px]">
                      {historyList.map(item => (
                        <tr key={item.id} className="hover:bg-slate-900/40">
                          <td className="px-3 py-2.5 font-bold">
                            {item.eventType === 'reassigned' || item.previousOwnerId ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                                Reassignment
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                                Initial Assignment
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-400">
                            {item.previousOwner?.fullName || (item.previousOwnerId ? 'Previous Staff' : '—')}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-200">
                            {item.newOwner?.fullName || '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-400">
                            {new Date(item.createdAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-slate-300">
                            {item.assignedBy?.fullName || 'System'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 italic max-w-[160px] truncate" title={item.reason || ''}>
                            {item.reason || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
