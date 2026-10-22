import React from 'react';
import { MarketingContact, MarketingOfficer } from './types';
import { Users, UserCheck, Shuffle, Loader2, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { LifecycleBadge } from './MarketingBadges';

interface MarketingAssignmentProps {
  loading: boolean;
  onRequestApi: (path: string, init?: RequestInit) => Promise<any>;
  onAssignmentComplete: () => void;
}

export const MarketingAssignment: React.FC<MarketingAssignmentProps> = ({
  loading,
  onRequestApi,
  onAssignmentComplete,
}) => {
  const [unassignedContacts, setUnassignedContacts] = React.useState<MarketingContact[]>([]);
  const [officers, setOfficers] = React.useState<MarketingOfficer[]>([]);
  const [fetching, setFetching] = React.useState(true);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');

  // Selection states
  const [selectedContactIds, setSelectedContactIds] = React.useState<Set<string>>(new Set());
  const [selectedOfficerIds, setSelectedOfficerIds] = React.useState<Set<string>>(new Set());
  const [reason, setReason] = React.useState('Marketing follow-up allocation');
  const [mode, setMode] = React.useState<'round_robin' | 'single'>('round_robin');
  const [singleOfficerId, setSingleOfficerId] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const loadAssignableData = React.useCallback(async () => {
    setFetching(true);
    setError('');
    try {
      const response = await onRequestApi('/api/marketing/assignable');
      if (response?.data) {
        setUnassignedContacts(response.data.contacts || []);
        setOfficers(response.data.officers || []);
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

  const toggleContact = (id: string) => {
    const next = new Set(selectedContactIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedContactIds(next);
  };

  const toggleSelectAllContacts = () => {
    if (selectedContactIds.size === unassignedContacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(unassignedContacts.map(c => c.id)));
    }
  };

  const toggleOfficer = (id: string) => {
    const next = new Set(selectedOfficerIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOfficerIds(next);
  };

  const handleAssign = async () => {
    if (selectedContactIds.size === 0) {
      setError('Please select at least one contact to assign.');
      return;
    }

    const targetOfficerIds = mode === 'round_robin'
      ? Array.from(selectedOfficerIds)
      : singleOfficerId ? [singleOfficerId] : [];

    if (targetOfficerIds.length === 0) {
      setError('Please select at least one marketing officer for allocation.');
      return;
    }

    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const response = await onRequestApi('/api/marketing/assignments', {
        method: 'POST',
        body: JSON.stringify({
          contactIds: Array.from(selectedContactIds),
          officerIds: targetOfficerIds,
          reason,
        }),
      });

      if (response?.success) {
        setNotice(`Successfully assigned ${response.data?.assigned || selectedContactIds.size} contacts.`);
        setSelectedContactIds(new Set());
        void loadAssignableData();
        onAssignmentComplete();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Assignment failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
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

      {/* 2-Column Layout: Left (Contacts Pool), Right (Officers & Distribution) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Unassigned Contacts Pool (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Unassigned Pool ({unassignedContacts.length})
            </span>
            <button
              type="button"
              onClick={toggleSelectAllContacts}
              className="text-xs text-teal-400 hover:text-teal-300 font-semibold"
            >
              {selectedContactIds.size === unassignedContacts.length && unassignedContacts.length > 0
                ? 'Deselect all'
                : 'Select all'}
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0D1526]/70 overflow-hidden max-h-[520px] flex flex-col">
            <div className="overflow-y-auto flex-1">
              {fetching ? (
                <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  <span>Loading unassigned contacts...</span>
                </div>
              ) : unassignedContacts.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  All captured contacts are currently assigned to marketing officers!
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5 w-8">
                        <input
                          type="checkbox"
                          checked={selectedContactIds.size === unassignedContacts.length && unassignedContacts.length > 0}
                          onChange={toggleSelectAllContacts}
                          className="rounded border-slate-700 bg-slate-900 text-teal-400 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="px-3 py-2.5">Serial</th>
                      <th className="px-3 py-2.5">Phone</th>
                      <th className="px-3 py-2.5">Source</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Added Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {unassignedContacts.map(c => {
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
                          <td className="px-3 py-2.5 font-mono font-bold text-slate-200">{c.serialNumber}</td>
                          <td className="px-3 py-2.5 font-mono text-teal-300 font-bold">{c.normalizedPhone}</td>
                          <td className="px-3 py-2.5 text-slate-300 truncate max-w-[150px]">{c.originalSource}</td>
                          <td className="px-3 py-2.5"><LifecycleBadge status={c.lifecycleStatus} /></td>
                          <td className="px-3 py-2.5 text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>{selectedContactIds.size} contacts selected for allocation</span>
              <span className="font-mono text-teal-400 font-bold">{unassignedContacts.length} available</span>
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
                  <span className="text-slate-300 font-semibold">Active Officers for Pool:</span>
                  <span className="text-teal-400 font-mono font-bold">
                    {selectedOfficerIds.size} of {officers.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {officers.length === 0 ? (
                    <p className="text-xs text-slate-500">No active marketing officers found.</p>
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
                          <span className="text-[10px] uppercase font-bold text-teal-400/80">Officer</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-300">Assign to Single Officer:</span>
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
                <strong className="text-white font-mono">{selectedContactIds.size}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Distribution Mode:</span>
                <strong className="text-teal-300 capitalize">{mode.replace('_', '-')}</strong>
              </div>
              {mode === 'round_robin' && selectedOfficerIds.size > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Avg per Officer:</span>
                  <strong className="text-teal-300 font-mono">
                    ~{Math.round(selectedContactIds.size / selectedOfficerIds.size)}
                  </strong>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={submitting || selectedContactIds.size === 0}
              onClick={handleAssign}
              className="w-full py-2.5 rounded-lg bg-teal-400 text-slate-950 font-bold text-xs hover:bg-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Distributing contacts...
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" /> Execute Assignment ({selectedContactIds.size})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
