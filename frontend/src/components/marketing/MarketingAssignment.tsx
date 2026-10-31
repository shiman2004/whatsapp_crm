import React from 'react';
import { MarketingContact, MarketingOfficer, LifecycleStatus } from './types';
import {
  Users,
  UserCheck,
  Shuffle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Search,
  ArrowUpDown,
  Pencil,
  X,
  Check,
  Calendar,
  Phone,
  Tag,
} from 'lucide-react';
import { LifecycleBadge } from './MarketingBadges';

interface MarketingAssignmentProps {
  loading: boolean;
  onRequestApi: (path: string, init?: RequestInit) => Promise<any>;
  onAssignmentComplete: () => void;
  initialSelectedContactIds?: string[];
  onClearTransferredSelection?: () => void;
}

export const MarketingAssignment: React.FC<MarketingAssignmentProps> = ({
  loading,
  onRequestApi,
  onAssignmentComplete,
  initialSelectedContactIds,
  onClearTransferredSelection,
}) => {
  const [unassignedContacts, setUnassignedContacts] = React.useState<MarketingContact[]>([]);
  const [officers, setOfficers] = React.useState<MarketingOfficer[]>([]);
  const [staff, setStaff] = React.useState<Array<MarketingOfficer & { marketingAccess: boolean }>>([]);
  const [batches, setBatches] = React.useState<Array<{ id: string; batchNumber: string; source: string; savedCount: number }>>([]);
  const [selectedBatchId, setSelectedBatchId] = React.useState('');
  const [preview, setPreview] = React.useState<{ totalContacts: number; excluded: number; staff: Array<{ id: string; fullName: string; allocated: number }> } | null>(null);
  const [fetching, setFetching] = React.useState(true);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');

  // Filtering & Sorting for Unassigned Pool
  const [search, setSearch] = React.useState('');
  const [dateFilter, setDateFilter] = React.useState<'all' | 'today' | 'yesterday' | 'last7days' | 'this_month'>('all');
  const [sortOption, setSortOption] = React.useState<
    'date_desc' | 'date_asc' | 'phone_asc' | 'phone_desc' | 'serial_asc' | 'serial_desc' | 'source_asc'
  >('date_desc');

  // Quick Edit Modal state (Numbers update)
  const [editingContact, setEditingContact] = React.useState<MarketingContact | null>(null);
  const [editPhone, setEditPhone] = React.useState('');
  const [editSource, setEditSource] = React.useState('');
  const [editGroupName, setEditGroupName] = React.useState('');
  const [editStatus, setEditStatus] = React.useState<LifecycleStatus>('new');
  const [editNotes, setEditNotes] = React.useState('');
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [editError, setEditError] = React.useState('');

  // Selection states
  const [selectedContactIds, setSelectedContactIds] = React.useState<Set<string>>(new Set());
  const [selectedOfficerIds, setSelectedOfficerIds] = React.useState<Set<string>>(new Set());
  const [reason, setReason] = React.useState('Marketing follow-up allocation');
  const [mode, setMode] = React.useState<'round_robin' | 'single'>('round_robin');
  const [singleOfficerId, setSingleOfficerId] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // Auto-dismiss notice
  React.useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Synchronize transferred selection state from Contact Database
  React.useEffect(() => {
    if (initialSelectedContactIds && initialSelectedContactIds.length > 0) {
      setSelectedContactIds(new Set(initialSelectedContactIds));
      setNotice(`Transferred ${initialSelectedContactIds.length} contact(s) from Contact Database for assignment.`);
    }
  }, [initialSelectedContactIds]);

  const loadAssignableData = React.useCallback(async () => {
    setFetching(true);
    setError('');
    try {
      const response = await onRequestApi('/api/marketing/assignable');
      if (response?.data) {
        setUnassignedContacts(response.data.contacts || []);
        setOfficers(response.data.officers || []);
        setStaff(response.data.staff || []);
        setBatches(response.data.batches || []);
        // Select all officers by default for round-robin
        const activeOfficerIds = (response.data.officers || []).map((o: MarketingOfficer) => o.id);
        setSelectedOfficerIds(new Set(activeOfficerIds));
        if (activeOfficerIds.length > 0) {
          setSingleOfficerId(activeOfficerIds[0]);
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load assignable contacts');
    } finally {
      setFetching(false);
    }
  }, [onRequestApi]);

  React.useEffect(() => {
    void loadAssignableData();
  }, [loadAssignableData]);

  // Filtered & Sorted Contacts computation
  const filteredContacts = React.useMemo(() => {
    let result = [...unassignedContacts];

    // 1. Text search (phone, serial, source, group)
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        c =>
          c.normalizedPhone.toLowerCase().includes(q) ||
          c.serialNumber.toLowerCase().includes(q) ||
          (c.originalSource && c.originalSource.toLowerCase().includes(q)) ||
          (c.sourceGroupName && c.sourceGroupName.toLowerCase().includes(q))
      );
    }

    // 2. Date filtering
    if (dateFilter !== 'all') {
      const now = new Date();
      result = result.filter(c => {
        const cDate = new Date(c.createdAt);
        if (dateFilter === 'today') {
          return cDate.toDateString() === now.toDateString();
        }
        if (dateFilter === 'yesterday') {
          const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          return cDate.toDateString() === y.toDateString();
        }
        if (dateFilter === 'last7days') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return cDate >= weekAgo;
        }
        if (dateFilter === 'this_month') {
          return cDate.getFullYear() === now.getFullYear() && cDate.getMonth() === now.getMonth();
        }
        return true;
      });
    }

    // 3. Sorting (A to Z, Z to A, Date newest / oldest)
    result.sort((a, b) => {
      if (sortOption === 'phone_asc') {
        return a.normalizedPhone.localeCompare(b.normalizedPhone);
      }
      if (sortOption === 'phone_desc') {
        return b.normalizedPhone.localeCompare(a.normalizedPhone);
      }
      if (sortOption === 'serial_asc') {
        return a.serialNumber.localeCompare(b.serialNumber);
      }
      if (sortOption === 'serial_desc') {
        return b.serialNumber.localeCompare(a.serialNumber);
      }
      if (sortOption === 'source_asc') {
        return (a.originalSource || '').localeCompare(b.originalSource || '');
      }
      if (sortOption === 'date_asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      // default: date_desc
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [unassignedContacts, search, dateFilter, sortOption]);

  const toggleContact = (id: string) => {
    const next = new Set(selectedContactIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedContactIds(next);
  };

  const toggleSelectAllFiltered = () => {
    if (filteredContacts.length === 0) return;
    const allSelected = filteredContacts.every(c => selectedContactIds.has(c.id));
    const next = new Set(selectedContactIds);
    if (allSelected) {
      filteredContacts.forEach(c => next.delete(c.id));
    } else {
      filteredContacts.forEach(c => next.add(c.id));
    }
    setSelectedContactIds(next);
  };

  const toggleOfficer = (id: string) => {
    const next = new Set(selectedOfficerIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOfficerIds(next);
  };

  const selectAllPool = () => {
    setSelectedContactIds(new Set(unassignedContacts.map(c => c.id)));
  };

  const clearSelection = () => {
    setSelectedContactIds(new Set());
    if (selectedBatchId === 'all_unassigned') {
      setSelectedBatchId('');
    }
  };

  const isAllUnassignedSelected = selectedBatchId === 'all_unassigned';
  const effectiveContactCount = isAllUnassignedSelected
    ? unassignedContacts.length
    : selectedContactIds.size;

  const assignmentPayload = (): {
    contactIds?: string[];
    allUnassigned?: boolean;
    officerIds: string[];
    batchId?: string;
    reason: string;
    mode: 'round_robin' | 'single';
  } => ({
    ...(isAllUnassignedSelected ? { allUnassigned: true } : { contactIds: Array.from(selectedContactIds) }),
    officerIds: mode === 'round_robin' ? Array.from(selectedOfficerIds) : singleOfficerId ? [singleOfficerId] : [],
    ...(selectedBatchId && selectedBatchId !== 'all_unassigned' ? { batchId: selectedBatchId } : {}),
    reason,
    mode,
  });

  const handlePreview = async () => {
    const payload = assignmentPayload();
    if (!payload.contactIds?.length && !payload.batchId && !payload.allUnassigned) {
      setError('Please select contacts or choose an allocation pool.');
      return;
    }
    if (!payload.officerIds.length) {
      setError('Please select at least one marketing officer for allocation.');
      return;
    }
    setError('');
    try {
      const response = await onRequestApi('/api/marketing/assignments/preview', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPreview(response.data || null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Preview failed');
    }
  };

  const handleAssign = async () => {
    setSubmitting(true);
    setError('');
    try {
      const response = await onRequestApi('/api/marketing/assignments', {
        method: 'POST',
        body: JSON.stringify(assignmentPayload()),
      });

      if (response?.success) {
        setNotice(`Successfully assigned ${response.data?.assigned || selectedContactIds.size} contacts.`);
        setSelectedContactIds(new Set());
        setPreview(null);
        void loadAssignableData();
        onAssignmentComplete();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Assignment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMarketingAccess = async (member: MarketingOfficer & { marketingAccess: boolean }) => {
    try {
      await onRequestApi(`/api/marketing/staff/${member.id}/access`, {
        method: 'PATCH',
        body: JSON.stringify({ authorized: !member.marketingAccess }),
      });
      await loadAssignableData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update marketing access');
    }
  };

  // Open Quick Edit Modal for Phone & Contact details
  const handleOpenEdit = (contact: MarketingContact, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingContact(contact);
    setEditPhone(contact.normalizedPhone);
    setEditSource(contact.originalSource || '');
    setEditGroupName(contact.sourceGroupName || '');
    setEditStatus(contact.lifecycleStatus || 'new');
    setEditNotes(contact.qualificationNote || '');
    setEditError('');
  };

  // Save Quick Edit (Numbers update)
  const handleSaveEdit = async () => {
    if (!editingContact) return;
    if (!editPhone.trim()) {
      setEditError('Phone number is required.');
      return;
    }
    setEditSubmitting(true);
    setEditError('');
    try {
      const res = await onRequestApi(`/api/marketing/contacts/${editingContact.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          phone: editPhone.trim(),
          source: editSource.trim(),
          sourceGroupName: editGroupName.trim(),
          status: editStatus,
          notes: editNotes.trim(),
        }),
      });

      if (res?.success) {
        const updatedPhone = res.data?.normalizedPhone || editPhone.trim();
        setNotice(`Updated contact ${editingContact.serialNumber} to ${updatedPhone}.`);
        setUnassignedContacts(prev =>
          prev.map(c =>
            c.id === editingContact.id
              ? {
                  ...c,
                  normalizedPhone: updatedPhone,
                  originalSource: editSource.trim() || c.originalSource,
                  sourceGroupName: editGroupName.trim() || c.sourceGroupName,
                  lifecycleStatus: (editStatus as LifecycleStatus) || c.lifecycleStatus,
                  qualificationNote: editNotes.trim() || c.qualificationNote,
                }
              : c
          )
        );
        setEditingContact(null);
      }
    } catch (caught: any) {
      setEditError(caught.message || 'Failed to update contact number and details.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const isAllFilteredSelected =
    filteredContacts.length > 0 && filteredContacts.every(c => selectedContactIds.has(c.id));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header & Modes */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-400" />
            Contact Assignment Engine
          </h3>
          <p className="text-xs text-slate-400">
            Super Admin pool view of unallocated public contacts. Distribute via round-robin or targeted officer assignment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('round_robin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              mode === 'round_robin'
                ? 'bg-teal-400 text-slate-950 font-bold'
                : 'bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Shuffle className="w-3.5 h-3.5" /> Round-Robin
          </button>
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              mode === 'single'
                ? 'bg-teal-400 text-slate-950 font-bold'
                : 'bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" /> Single Officer
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* 2-Column Layout: Left (Contacts Pool with Filters & Sort), Right (Officers & Distribution) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Unassigned Contacts Pool (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          {/* Top Pool Header + Counter */}
          {initialSelectedContactIds && initialSelectedContactIds.length > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs animate-in fade-in duration-150">
              <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
              <span>
                Transferred <strong className="font-mono font-bold text-white">{initialSelectedContactIds.length}</strong> selected contacts from Contact Database for allocation.
              </span>
              {onClearTransferredSelection && (
                <button
                  type="button"
                  onClick={() => {
                    onClearTransferredSelection();
                    setSelectedContactIds(new Set());
                  }}
                  className="ml-auto text-[11px] text-teal-300 hover:text-white underline font-semibold"
                >
                  Clear Transfer
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Unassigned Pool ({filteredContacts.length}
                {filteredContacts.length !== unassignedContacts.length
                  ? ` of ${unassignedContacts.length}`
                  : ''}
                )
              </span>
              {selectedContactIds.size > 0 && (
                <span className="text-[11px] font-mono text-teal-400 bg-teal-950/60 border border-teal-800 px-2 py-0.5 rounded-full font-semibold">
                  {selectedContactIds.size} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className="text-xs text-teal-400 hover:text-teal-300 font-semibold"
              >
                {isAllFilteredSelected ? 'Deselect visible' : 'Select visible'}
              </button>
              <span className="text-slate-600 text-xs">·</span>
              <button
                type="button"
                onClick={selectAllPool}
                className="text-xs text-teal-400 hover:text-teal-300 font-semibold"
                title="Select all unassigned contacts in the entire pool"
              >
                Select All Pool ({unassignedContacts.length})
              </button>
              {selectedContactIds.size > 0 && (
                <>
                  <span className="text-slate-600 text-xs">·</span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Search, Date Filter, and A-to-Z Sort Toolbar */}
          <div className="flex flex-wrap items-center gap-2 bg-[#0c1424] p-2.5 rounded-xl border border-slate-800">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search phone, serial, source..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value as any)}
                className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer"
                style={{ colorScheme: 'dark' }}
                title="Filter by Added Date"
              >
                <option className="bg-slate-900 text-slate-200" value="all">All Dates</option>
                <option className="bg-slate-900 text-slate-200" value="today">Today</option>
                <option className="bg-slate-900 text-slate-200" value="yesterday">Yesterday</option>
                <option className="bg-slate-900 text-slate-200" value="last7days">Last 7 Days</option>
                <option className="bg-slate-900 text-slate-200" value="this_month">This Month</option>
              </select>
            </div>

            {/* A-to-Z / Z-to-A Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300">
              <ArrowUpDown className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <select
                value={sortOption}
                onChange={e => setSortOption(e.target.value as any)}
                className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer font-medium"
                style={{ colorScheme: 'dark' }}
                title="Sort by Number, Serial, or Date"
              >
                <option className="bg-slate-900 text-slate-200" value="date_desc">Date: Newest First</option>
                <option className="bg-slate-900 text-slate-200" value="date_asc">Date: Oldest First</option>
                <option className="bg-slate-900 text-slate-200" value="phone_asc">Numbers: A to Z (0-9)</option>
                <option className="bg-slate-900 text-slate-200" value="phone_desc">Numbers: Z to A (9-0)</option>
                <option className="bg-slate-900 text-slate-200" value="serial_asc">Serial: A to Z</option>
                <option className="bg-slate-900 text-slate-200" value="serial_desc">Serial: Z to A</option>
                <option className="bg-slate-900 text-slate-200" value="source_asc">Source: A to Z</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-xl border border-slate-800 bg-[#0D1526]/70 overflow-hidden max-h-[520px] flex flex-col">
            <div className="overflow-y-auto flex-1">
              {fetching ? (
                <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  <span>Loading unassigned contacts...</span>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  {unassignedContacts.length === 0
                    ? 'All captured contacts are currently assigned to marketing officers!'
                    : 'No unassigned contacts match the selected search, date or sort filter.'}
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 w-8">
                        <input
                          type="checkbox"
                          checked={isAllFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          className="rounded border-slate-700 bg-slate-900 text-teal-400 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="px-3 py-2.5">Serial</th>
                      <th className="px-3 py-2.5">Phone (Number)</th>
                      <th className="px-3 py-2.5">Source & Group</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Added Date</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredContacts.map(c => {
                      const isSelected = selectedContactIds.has(c.id);
                      return (
                        <tr
                          key={c.id}
                          onClick={() => toggleContact(c.id)}
                          className={`hover:bg-slate-900/60 transition-colors cursor-pointer ${
                            isSelected ? 'bg-teal-500/10' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleContact(c.id)}
                              className="rounded border-slate-700 bg-slate-900 text-teal-400 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold text-slate-200 whitespace-nowrap">
                            {c.serialNumber}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-teal-300 font-bold whitespace-nowrap">
                            {c.normalizedPhone}
                          </td>
                          <td className="px-3 py-2.5 text-slate-300 max-w-[160px] truncate">
                            <div className="truncate">{c.originalSource}</div>
                            {c.sourceGroupName && (
                              <span className="text-[10px] text-teal-400/80 font-mono block truncate">
                                {c.sourceGroupName}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <LifecycleBadge status={c.lifecycleStatus} />
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                          {/* Quick Edit Action (Number Update) */}
                          <td className="px-3 py-2.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={e => handleOpenEdit(c, e)}
                              className="p-1.5 rounded-lg border border-teal-800/70 bg-teal-950/50 text-teal-300 hover:text-white hover:bg-teal-900/70 transition-colors inline-flex items-center gap-1 text-[11px]"
                              title="Update number and contact details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>
                <strong className="text-white font-mono">{selectedContactIds.size}</strong> contacts selected for allocation
              </span>
              <span className="font-mono text-teal-400 font-bold">
                {filteredContacts.length} visible ({unassignedContacts.length} pool total)
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Allocation Controls & Officers */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-[#0D1526]/80 p-5 space-y-4">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Allocation Parameters
            </h4>

            {mode === 'round_robin' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Active Coordinators & Staff:</span>
                  <span className="text-teal-400 font-mono font-bold">
                    {selectedOfficerIds.size} of {officers.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {officers.length === 0 ? (
                    <p className="text-xs text-slate-500">No active patient coordinators or staff found.</p>
                  ) : (
                    officers.map(officer => {
                      const isChecked = selectedOfficerIds.has(officer.id);
                      return (
                        <label
                          key={officer.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'border-teal-500/40 bg-teal-500/10 text-white'
                              : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleOfficer(officer.id)}
                              className="rounded border-slate-700 bg-slate-900 text-teal-400 focus:ring-0"
                            />
                            <div>
                              <p className="font-bold">{officer.fullName}</p>
                              <p className="text-[10px] text-slate-500">{officer.email}</p>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-bold text-teal-400/80">
                            {officer.role === 'coordinator'
                              ? officer.company === 'CRAS'
                                ? 'Counsellor'
                                : 'Coordinator'
                              : officer.role === 'leads_officer'
                              ? 'Leads Officer'
                              : 'Staff'}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-300">Assign to Coordinator / Staff:</span>
                <select
                  value={singleOfficerId}
                  onChange={e => setSingleOfficerId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white outline-none focus:border-teal-400"
                >
                  {officers.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.fullName} ({o.email})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Contact batch (optional):</span>
              <select
                value={selectedBatchId}
                onChange={e => {
                  setSelectedBatchId(e.target.value);
                  setPreview(null);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white outline-none focus:border-teal-400"
              >
                <option value="">Use selected contacts ({selectedContactIds.size})</option>
                <option value="all_unassigned">
                  All Unassigned Contacts ({unassignedContacts.length} in Pool)
                </option>
                {batches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchNumber} · {batch.source} ({batch.savedCount})
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Marketing access:</span>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {staff.map(member => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => void toggleMarketingAccess(member)}
                    className="w-full flex justify-between rounded border border-slate-800 bg-slate-900 px-2 py-1.5 text-left text-[11px] hover:border-teal-500/40"
                  >
                    <span>{member.fullName}</span>
                    <span className={member.marketingAccess ? 'text-teal-300' : 'text-slate-500'}>
                      {member.marketingAccess ? 'Authorized' : 'Grant access'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Assignment Reason / Batch Tag:</span>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Q4 WhatsApp Campaign Followup"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white outline-none focus:border-teal-400"
              />
            </label>

            {/* Allocation summary estimate */}
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/80 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Selected Contacts:</span>
                <strong className="text-white font-mono">{effectiveContactCount}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Distribution Mode:</span>
                <strong className="text-teal-300 capitalize">{mode.replace('_', '-')}</strong>
              </div>
              {mode === 'round_robin' && selectedOfficerIds.size > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Avg per Officer:</span>
                  <strong className="text-teal-300 font-mono">
                    ~{Math.round(effectiveContactCount / selectedOfficerIds.size)}
                  </strong>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={
                submitting ||
                (!effectiveContactCount && !selectedBatchId) ||
                (mode === 'round_robin' ? !selectedOfficerIds.size : !singleOfficerId)
              }
              onClick={preview ? handleAssign : handlePreview}
              className="w-full py-2.5 rounded-lg bg-teal-400 text-slate-950 font-bold text-xs hover:bg-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Distributing contacts...
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />{' '}
                  {preview ? `Confirm Assignment (${preview.totalContacts})` : 'Preview Assignment'}
                </>
              )}
            </button>
            {preview && (
              <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 p-3 text-xs space-y-1">
                {preview.staff.map(st => (
                  <div key={st.id} className="flex justify-between">
                    <span>{st.fullName}</span>
                    <strong>{st.allocated}</strong>
                  </div>
                ))}
                <div className="flex justify-between text-slate-400">
                  <span>Excluded / already assigned</span>
                  <strong>{preview.excluded}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Numbers Update / Quick Edit Modal */}
      {editingContact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setEditingContact(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Update Contact Number & Details</h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Serial: {editingContact.serialNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              {/* Phone Input */}
              <label className="block space-y-1">
                <span className="font-semibold text-slate-300">
                  Phone Number (E.164 International Format) *
                </span>
                <input
                  type="text"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  placeholder="+94771234567 or 0771234567"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono font-bold text-teal-300 outline-none focus:border-teal-400"
                />
                <span className="text-[10px] text-slate-500">
                  Auto-normalized to international standard upon saving.
                </span>
              </label>

              {/* Source Group Name / Name */}
              <label className="block space-y-1">
                <span className="font-semibold text-slate-300">Source Group / Contact Name:</span>
                <input
                  type="text"
                  value={editGroupName}
                  onChange={e => setEditGroupName(e.target.value)}
                  placeholder="e.g. VIP Wellness Group A"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-teal-400"
                />
              </label>

              {/* Original Source */}
              <label className="block space-y-1">
                <span className="font-semibold text-slate-300">Contact Source:</span>
                <input
                  type="text"
                  value={editSource}
                  onChange={e => setEditSource(e.target.value)}
                  placeholder="WhatsApp public group, Expo, Organic, etc."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-teal-400"
                />
              </label>

              {/* Lifecycle Status */}
              <label className="block space-y-1">
                <span className="font-semibold text-slate-300">Status:</span>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as LifecycleStatus)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-teal-400 cursor-pointer"
                >
                  <option value="new">New</option>
                  <option value="follow_up_pending">Follow-up Pending</option>
                  <option value="contacted">Contacted</option>
                  <option value="interested">Interested</option>
                  <option value="not_interested">Not Interested</option>
                  <option value="do_not_contact">Do Not Contact (DND)</option>
                </select>
              </label>

              {/* Notes */}
              <label className="block space-y-1">
                <span className="font-semibold text-slate-300">Notes / Details:</span>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Add notes about this number or qualification details..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-teal-400 resize-none"
                />
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSubmitting}
                onClick={handleSaveEdit}
                className="px-4 py-1.5 rounded-lg bg-teal-400 text-slate-950 font-bold text-xs hover:bg-teal-300 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {editSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Save Changes
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
