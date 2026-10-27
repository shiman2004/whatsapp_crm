import React from 'react';
import { MarketingImportBatch, MarketingImportRow } from './types';
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, XCircle, Loader2, Pencil, Trash2 } from 'lucide-react';

interface MarketingUploadsProps {
  uploads: MarketingImportBatch[];
  loading: boolean;
  onRequestApi: (path: string, init?: RequestInit) => Promise<any>;
  onRefresh?: () => void;
}

export const MarketingUploads: React.FC<MarketingUploadsProps> = ({ uploads, loading, onRequestApi, onRefresh }) => {
  const [selectedBatch, setSelectedBatch] = React.useState<MarketingImportBatch | null>(null);
  const [batchRows, setBatchRows] = React.useState<MarketingImportRow[]>([]);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [mode, setMode] = React.useState<'preview' | 'edit' | 'delete'>('preview');
  const [source, setSource] = React.useState('');
  const [sourceGroupName, setSourceGroupName] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState('');

  const openBatchDetail = async (batch: MarketingImportBatch) => {
    setSelectedBatch(batch);
    setMode('preview');
    setSource(batch.source);
    setSourceGroupName(batch.sourceGroupName || '');
    setActionError('');
    setLoadingDetail(true);
    try {
      const response = await onRequestApi(`/api/marketing/uploads/${batch.id}`);
      if (response?.data?.rows) {
        setBatchRows(response.data.rows);
      } else {
        setBatchRows([]);
      }
    } catch (e) {
      console.error('Failed to load batch rows', e);
      setBatchRows([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const saveBatch = async () => {
    if (!selectedBatch || !source.trim()) return;
    setSaving(true);
    setActionError('');
    try {
      const response = await onRequestApi(`/api/marketing/uploads/${selectedBatch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ source, sourceGroupName }),
      });
      setSelectedBatch(response.data);
      setMode('preview');
      onRefresh?.();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update batch.');
    } finally {
      setSaving(false);
    }
  };

  const deleteBatch = async () => {
    if (!selectedBatch) return;
    setSaving(true);
    setActionError('');
    try {
      await onRequestApi(`/api/marketing/uploads/${selectedBatch.id}`, { method: 'DELETE' });
      setSelectedBatch(null);
      onRefresh?.();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to delete batch.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Batch Upload History</h3>
          <p className="text-xs text-slate-400">
            Audit logs and reconciliation reports for all ingested contact batches.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
          {uploads.length} total batche{uploads.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
          <span>Loading batch audit trail...</span>
        </div>
      ) : uploads.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
          <Upload className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-slate-300 mt-2">No Ingest Batches Yet</h4>
          <p className="text-xs text-slate-500 mt-1">
            Submitted contact uploads will automatically record here with row-level audit trails.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0D1526]/70">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Batch Number</th>
                <th className="px-4 py-3">Source & Group</th>
                <th className="px-4 py-3 text-center">Submitted</th>
                <th className="px-4 py-3 text-center">Saved</th>
                <th className="px-4 py-3 text-center">Duplicates</th>
                <th className="px-4 py-3 text-center">Invalid</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {uploads.map(batch => (
                <tr
                  key={batch.id}
                  tabIndex={0}
                  onClick={() => openBatchDetail(batch)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openBatchDetail(batch);
                    }
                  }}
                  aria-label={`Open batch ${batch.batchNumber} details`}
                  className="cursor-pointer hover:bg-slate-900/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-400"
                >
                  <td className="px-4 py-3 font-mono font-bold text-white">
                    {batch.batchNumber}
                    {batch.fileName && (
                      <span className="block text-[10px] font-sans font-normal text-slate-500 truncate max-w-[140px]">
                        {batch.fileName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <div>{batch.source}</div>
                    {batch.sourceGroupName && (
                      <span className="text-[10px] text-teal-400/80">{batch.sourceGroupName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-slate-200">
                    {batch.totalSubmitted}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
                    {batch.savedCount}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-amber-400">
                    {batch.duplicateCount}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-rose-400">
                    {batch.invalidCount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        batch.status === 'completed'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : batch.status === 'partially_completed'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {batch.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                    {new Date(batch.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Batch Detail Drawer */}
      {selectedBatch && (
        <div className="fixed inset-x-0 top-[50px] bottom-0 z-50 flex justify-end bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <aside aria-label="Batch upload details" className="w-full max-w-3xl border-l border-slate-800 bg-[#0D1526] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-150">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                  Batch Audit: {selectedBatch.batchNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Source: {selectedBatch.source} • Ingested on {new Date(selectedBatch.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setMode('preview')} className={`px-2 py-1 rounded text-[11px] font-bold ${mode === 'preview' ? 'bg-teal-950 text-teal-300' : 'text-slate-400 hover:text-white'}`}>Preview numbers</button>
                <button type="button" onClick={() => setMode('edit')} className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold ${mode === 'edit' ? 'bg-teal-950 text-teal-300' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><Pencil className="w-3.5 h-3.5" /> Edit batch</button>
                <button type="button" onClick={() => setMode('delete')} className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold ${mode === 'delete' ? 'bg-rose-950 text-rose-300' : 'text-slate-400 hover:text-rose-300 hover:bg-slate-800'}`}><Trash2 className="w-3.5 h-3.5" /> Delete batch</button>
                <button type="button" onClick={() => setSelectedBatch(null)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800" title="Close"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Batch stats metrics */}
            <div className="grid grid-cols-4 gap-2 p-4 bg-slate-950/60 border-b border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total</span>
                <p className="text-base font-bold text-white">{selectedBatch.totalSubmitted}</p>
              </div>
              <div>
                <span className="text-emerald-400 text-[10px] uppercase font-bold">Saved Clean</span>
                <p className="text-base font-bold text-emerald-300">{selectedBatch.savedCount}</p>
              </div>
              <div>
                <span className="text-amber-400 text-[10px] uppercase font-bold">Duplicates</span>
                <p className="text-base font-bold text-amber-300">{selectedBatch.duplicateCount}</p>
              </div>
              <div>
                <span className="text-rose-400 text-[10px] uppercase font-bold">Invalid</span>
                <p className="text-base font-bold text-rose-300">{selectedBatch.invalidCount}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {actionError && <p className="mb-3 rounded-lg border border-rose-800 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">{actionError}</p>}
              {mode === 'edit' ? (
                <div className="space-y-4 max-w-lg">
                  <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Source</label><input value={source} onChange={event => setSource(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></div>
                  <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Group name</label><input value={sourceGroupName} onChange={event => setSourceGroupName(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></div>
                  <p className="text-xs text-slate-500">Editing changes the batch label only; imported contacts and their audit history remain unchanged.</p>
                  <button type="button" disabled={saving || !source.trim()} onClick={saveBatch} className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save changes'}</button>
                </div>
              ) : mode === 'delete' ? (
                <div className="max-w-lg rounded-lg border border-rose-900/70 bg-rose-950/20 p-4">
                  <h4 className="text-sm font-bold text-rose-200">Delete this batch record?</h4>
                  <p className="mt-2 text-xs leading-5 text-slate-300">This removes the upload batch and its row audit log. It does not delete imported contacts, assignments, consent, or CRM leads.</p>
                  <div className="mt-4 flex gap-2"><button type="button" onClick={() => setMode('preview')} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white">Cancel</button><button type="button" disabled={saving} onClick={deleteBatch} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Deleting...' : 'Delete batch record'}</button></div>
                </div>
              ) : loadingDetail ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  <span>Loading batch rows...</span>
                </div>
              ) : batchRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No individual row log entries recorded for this batch.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {batchRows.map(row => (
                    <div
                      key={row.id}
                      className="p-2.5 rounded-lg border border-slate-800/80 bg-slate-900/60 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-[10px]">#{row.rowNumber}</span>
                        <span className="text-white font-bold">{row.normalizedPhone || row.rawPhone || '—'}</span>
                        {row.rawPhone && row.rawPhone !== row.normalizedPhone && (
                          <span className="text-slate-500 text-[10px]">(Raw: {row.rawPhone})</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 font-sans">
                        {row.status === 'saved' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Saved
                          </span>
                        )}
                        {row.status === 'duplicate' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Duplicate Skipped
                          </span>
                        )}
                        {row.status === 'invalid' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800">
                            <XCircle className="w-3 h-3" /> {row.errorMessage || 'Invalid Phone'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-bold text-white hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

