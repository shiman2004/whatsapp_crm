import React from 'react';
import { MarketingContact } from './types';
import { LifecycleBadge, ConsentBadge } from './MarketingBadges';
import {
  Search,
  Filter,
  Download,
  UserCheck,
  ShieldAlert,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  User,
  Eye,
  Phone,
  MessageSquare,
} from 'lucide-react';

interface MarketingContactsProps {
  contacts: MarketingContact[];
  loading: boolean;
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
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

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
    const headers = ['Serial Number', 'Phone', 'Source', 'Source Group', 'Consent Status', 'Lifecycle Status', 'Created At'];
    const rows = contacts.map(c => [
      c.serialNumber,
      c.normalizedPhone,
      `"${c.originalSource.replace(/"/g, '""')}"`,
      `"${(c.sourceGroupName || '').replace(/"/g, '""')}"`,
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

  const totalPages = Math.ceil(totalContacts / pageSize) || 1;

  return (
    <div className="p-4 sm:p-6 space-y-4">
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

      {/* Main Contacts Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0D1526]/70">
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
              <th className="px-3 py-3">Serial</th>
              <th className="px-3 py-3">Contact</th>
              <th className="px-3 py-3">Source & Group</th>
              <th className="px-3 py-3">Consent</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Assigned Coordinator</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">
                  Loading marketing contacts...
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-12 text-center text-slate-500">
                  No marketing contacts found matching the filters.
                </td>
              </tr>
            ) : (
              contacts.map(contact => {
                const isSelected = selectedIds.has(contact.id);
                const rawPhoneDigits = contact.normalizedPhone.replace(/[^0-9]/g, '');
                return (
                  <tr
                    key={contact.id}
                    onClick={() => onSelectContact(contact)}
                    className={`hover:bg-slate-900/70 transition-colors cursor-pointer ${
                      isSelected ? 'bg-teal-500/5' : ''
                    }`}
                  >
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => toggleSelectOne(contact.id, e as any)}
                        className="rounded border-slate-700 bg-slate-900 text-teal-400 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-3 font-mono font-bold text-slate-200">
                      {contact.serialNumber}
                    </td>
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
                    <td className="px-3 py-3 text-slate-300 max-w-[200px] truncate">
                      <div>{contact.originalSource}</div>
                      {contact.sourceGroupName && (
                        <span className="text-[10px] text-teal-400/80 font-mono block truncate">
                          {contact.sourceGroupName}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <ConsentBadge status={contact.consentStatus} />
                    </td>
                    <td className="px-3 py-3">
                      <LifecycleBadge status={contact.lifecycleStatus} />
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {contact.assignedOwner ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-[11px] text-indigo-300 font-semibold truncate">
                            <User className="w-3 h-3 text-indigo-400 shrink-0" />
                            {contact.assignedOwner.fullName}
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
                        <span className="text-slate-500 text-[11px]">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </td>
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
                        <a
                          href={`https://wa.me/${rawPhoneDigits}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-teal-800/80 bg-teal-950/60 text-teal-300 hover:bg-teal-900/60 transition-colors"
                          title="Open WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
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
    </div>
  );
};

