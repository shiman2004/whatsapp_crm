import React from 'react';
import { MarketingImportBatch, MarketingImportRow } from './types';
import { Upload, FileSpreadsheet, Eye, X, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

interface MarketingUploadsProps {
  uploads: MarketingImportBatch[];
  loading: boolean;
  onRequestApi: (path: string, init?: RequestInit) => Promise<any>;
}

export const MarketingUploads: React.FC<MarketingUploadsProps> = ({ uploads, loading, onRequestApi }) => {
  const [selectedBatch, setSelectedBatch] = React.useState<MarketingImportBatch | null>(null);
  const [batchRows, setBatchRows] = React.useState<MarketingImportRow[]>([]);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  const openBatchDetail = async (batch: MarketingImportBatch) => {
    setSelectedBatch(batch);
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
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {uploads.map(batch => (
                <tr key={batch.id} className="hover:bg-slate-900/60 transition-colors">
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
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openBatchDetail(batch)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-teal-300 hover:bg-slate-800 transition-colors"
                      title="Inspect batch rows"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Batch Detail Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-3xl rounded-xl border border-slate-800 bg-[#0D1526] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
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
              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
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

            {/* Rows list */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingDetail ? (
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
          </div>
        </div>
      )}
    </div>
  );
};

