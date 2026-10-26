import React from 'react';
import {
  Loader2,
  Plus,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Info,
  RefreshCw,
  History,
  FileText,
  UserPlus,
  Layers,
  Calendar,
  Eye,
  X
} from 'lucide-react';
import { MarketingImportBatch, MarketingImportRow } from './types';
import { useCrm } from '../../context/CrmContext';

interface MarketingAddNumbersProps {
  loading: boolean;
  onImportComplete: (batch: MarketingImportBatch) => void;
  onRequestApi: (path: string, init?: RequestInit) => Promise<any>;
}

type AddTab = 'single' | 'bulk' | 'file' | 'history';

export const MarketingAddNumbers: React.FC<MarketingAddNumbersProps> = ({
  loading,
  onImportComplete,
  onRequestApi,
}) => {
  const { currentUser } = useCrm();
  const [tab, setTab] = React.useState<AddTab>('single');

  // Single Contact Form State
  const [singleName, setSingleName] = React.useState('');
  const [singlePhone, setSinglePhone] = React.useState('');
  const [singleCompany, setSingleCompany] = React.useState(currentUser?.company || 'RWC');
  const [singleSource, setSingleSource] = React.useState('Event / Walk-in');
  const [singleSourceName, setSingleSourceName] = React.useState('');
  const [singleTags, setSingleTags] = React.useState('');
  const [singleConsent, setSingleConsent] = React.useState<'unknown' | 'verified' | 'denied' | 'opted_out'>('unknown');
  const [singleNotes, setSingleNotes] = React.useState('');

  // Bulk Paste Form State
  const [bulkSource, setBulkSource] = React.useState('WhatsApp public group');
  const [bulkSourceName, setBulkSourceName] = React.useState('');
  const [bulkText, setBulkText] = React.useState('');

  // File Upload Form State
  const [fileSource, setFileSource] = React.useState('Exhibition / Trade Fair');
  const [fileSourceName, setFileSourceName] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [parsedFileNumbers, setParsedFileNumbers] = React.useState<string[]>([]);
  const [filePreviewRows, setFilePreviewRows] = React.useState<string[]>([]);
  const [fileError, setFileError] = React.useState('');

  // Execution & Feedback States
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [summary, setSummary] = React.useState<MarketingImportBatch | null>(null);

  // Import History States
  const [historyBatches, setHistoryBatches] = React.useState<MarketingImportBatch[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [selectedBatch, setSelectedBatch] = React.useState<MarketingImportBatch | null>(null);
  const [batchRows, setBatchRows] = React.useState<MarketingImportRow[]>([]);
  const [loadingBatchRows, setLoadingBatchRows] = React.useState(false);

  // Load history when tab becomes active
  const loadHistory = React.useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await onRequestApi('/api/marketing/imports');
      if (res?.data) {
        setHistoryBatches(res.data);
      }
    } catch (err) {
      console.error('Failed to load batch history', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [onRequestApi]);

  React.useEffect(() => {
    if (tab === 'history') {
      void loadHistory();
    }
  }, [tab, loadHistory]);

  // Load row audit details for a specific batch
  const handleViewBatchDetails = async (batch: MarketingImportBatch) => {
    setSelectedBatch(batch);
    setLoadingBatchRows(true);
    try {
      const res = await onRequestApi(`/api/marketing/imports/${batch.id}`);
      if (res?.data?.rows) {
        setBatchRows(res.data.rows);
      }
    } catch (err) {
      console.error('Failed to load batch rows', err);
    } finally {
      setLoadingBatchRows(false);
    }
  };

  // File parsing logic
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setFileError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result || '');
        const lines = text.split(/[\r\n]+/).map(line => line.trim()).filter(Boolean);
        if (lines.length === 0) {
          setFileError('The selected file appears to be empty.');
          return;
        }

        const detected: string[] = [];
        const preview: string[] = [];

        lines.forEach((line) => {
          const parts = line.split(/[,;\t]+/).map(p => p.trim().replace(/^["']|["']$/g, ''));
          const phoneCandidate = parts.find(p => /\+?\d[\d\s\-().]{6,16}/.test(p)) || parts[0];
          if (phoneCandidate) {
            detected.push(phoneCandidate);
            if (preview.length < 5) {
              preview.push(`${phoneCandidate} (${parts.slice(1).join(', ') || 'No extra cols'})`);
            }
          }
        });

        if (detected.length === 0) {
          setFileError('Could not find any phone number patterns in this file.');
          return;
        }

        setParsedFileNumbers(detected);
        setFilePreviewRows(preview);
      } catch (err) {
        setFileError('Failed to parse file: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(selected);
  };

  // Submit Single Contact
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSummary(null);

    if (!singlePhone.trim()) {
      setError('Please enter a phone number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await onRequestApi('/api/marketing/contacts', {
        method: 'POST',
        body: JSON.stringify({
          phone: singlePhone.trim(),
          name: singleName.trim() || undefined,
          company: singleCompany,
          source: singleSource,
          sourceName: singleSourceName.trim() || undefined,
          tags: singleTags.trim() || undefined,
          consentStatus: singleConsent,
          notes: singleNotes.trim() || undefined,
        }),
      });

      if (res?.data) {
        setNotice(`Contact successfully added with Serial #${res.data.serialNumber || res.data.id}`);
        setSingleName('');
        setSinglePhone('');
        setSingleSourceName('');
        setSingleTags('');
        setSingleNotes('');
        onImportComplete({
          id: res.data.id,
          batchNumber: res.data.serialNumber,
          company: res.data.company,
          uploadedById: currentUser?.id || '',
          source: res.data.originalSource,
          totalSubmitted: 1,
          validNewCount: 1,
          duplicateCount: 0,
          invalidCount: 0,
          savedCount: 1,
          status: 'completed',
          createdAt: new Date().toISOString()
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to add contact');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Bulk Paste or File Import
  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSummary(null);

    let numbersToSubmit: string[] = [];
    let currentSource = '';
    let currentGroupName = '';
    let fileName: string | undefined = undefined;

    if (tab === 'bulk') {
      numbersToSubmit = bulkText
        .split(/[\r\n,;\t]+/)
        .map(n => n.trim())
        .filter(Boolean);
      if (numbersToSubmit.length === 0) {
        setError('Please enter at least one phone number in the text area.');
        return;
      }
      currentSource = bulkSource.trim();
      currentGroupName = bulkSourceName.trim();
    } else if (tab === 'file') {
      if (parsedFileNumbers.length === 0) {
        setError('Please select and parse a valid CSV or text file containing phone numbers.');
        return;
      }
      numbersToSubmit = parsedFileNumbers;
      currentSource = fileSource.trim();
      currentGroupName = fileSourceName.trim();
      fileName = file?.name;
    }

    if (!currentSource) {
      setError('Source description is required.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await onRequestApi('/api/marketing/import', {
        method: 'POST',
        body: JSON.stringify({
          source: currentSource,
          sourceGroupName: currentGroupName || null,
          numbers: numbersToSubmit,
          fileName,
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      if (response?.data) {
        setSummary(response.data);
        onImportComplete(response.data);
        if (tab === 'bulk') setBulkText('');
        if (tab === 'file') {
          setFile(null);
          setParsedFileNumbers([]);
          setFilePreviewRows([]);
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import failed');
    } finally {
      setSubmitting(false);
    }
  };

  const rawCount = tab === 'bulk'
    ? bulkText.split(/[\r\n,;\t]+/).map(n => n.trim()).filter(Boolean).length
    : tab === 'file'
    ? parsedFileNumbers.length
    : 1;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* 4-Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => { setTab('single'); setError(''); setNotice(''); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            tab === 'single'
              ? 'bg-teal-400/10 text-teal-300 border border-teal-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <UserPlus className="w-4 h-4" /> Single Contact
        </button>

        <button
          type="button"
          onClick={() => { setTab('bulk'); setError(''); setNotice(''); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            tab === 'bulk'
              ? 'bg-teal-400/10 text-teal-300 border border-teal-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" /> Bulk Paste
        </button>

        <button
          type="button"
          onClick={() => { setTab('file'); setError(''); setNotice(''); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            tab === 'file'
              ? 'bg-teal-400/10 text-teal-300 border border-teal-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> CSV / Excel Upload
        </button>

        <button
          type="button"
          onClick={() => { setTab('history'); setError(''); setNotice(''); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            tab === 'history'
              ? 'bg-teal-400/10 text-teal-300 border border-teal-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <History className="w-4 h-4" /> Import History
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: SINGLE CONTACT FORM                                     */}
      {/* ============================================================== */}
      {tab === 'single' && (
        <form onSubmit={handleSingleSubmit} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-300">
                Contact Name (Optional)
              </span>
              <input
                value={singleName}
                onChange={e => setSingleName(e.target.value)}
                placeholder="e.g. John Perera"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">
                Phone Number <span className="text-rose-400">*</span>
              </span>
              <input
                required
                value={singlePhone}
                onChange={e => setSinglePhone(e.target.value)}
                placeholder="+94771234567 or 0771234567"
                className="mt-1.5 w-full font-mono rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-300">Company Scope</span>
              <select
                value={singleCompany}
                onChange={e => setSingleCompany(e.target.value as 'RWC' | 'CRAS')}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-teal-400"
              >
                <option value="RWC">Royal Wellness Center (RWC)</option>
                <option value="CRAS">Aviation Academy (CRAS)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">Contact Source</span>
              <input
                required
                value={singleSource}
                onChange={e => setSingleSource(e.target.value)}
                placeholder="e.g. Walk-in, Expo, Web form"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">Source Name / Tag</span>
              <input
                value={singleSourceName}
                onChange={e => setSingleSourceName(e.target.value)}
                placeholder="e.g. Medical Clinic Day #2"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-300">Consent Status</span>
              <select
                value={singleConsent}
                onChange={e => setSingleConsent(e.target.value as any)}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-teal-400"
              >
                <option value="unknown">Unknown / Pending (Standard Ingestion)</option>
                <option value="verified">Verified Opt-in (Consent Confirmed)</option>
                <option value="opted_out">Opted Out / Do Not Contact</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">Tags (Comma-separated)</span>
              <input
                value={singleTags}
                onChange={e => setSingleTags(e.target.value)}
                placeholder="e.g. VIP, Cardiology, Urgent"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-bold text-slate-300">Initial Notes</span>
            <textarea
              rows={3}
              value={singleNotes}
              onChange={e => setSingleNotes(e.target.value)}
              placeholder="Add customer background, specific treatment interest, or notes..."
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
            />
          </label>

          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <span className="text-[11px] text-slate-400">
              Numbers are normalized to E.164 (+94...) and deduplicated automatically.
            </span>
            <button
              type="submit"
              disabled={submitting || !singlePhone.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-teal-300 disabled:opacity-50 transition-all shadow-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save Single Contact
            </button>
          </div>
        </form>
      )}

      {/* ============================================================== */}
      {/* TAB 2: BULK PASTE FORM                                         */}
      {/* ============================================================== */}
      {tab === 'bulk' && (
        <form onSubmit={handleBatchSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-300">
                Source Description <span className="text-rose-400">*</span>
              </span>
              <input
                required
                value={bulkSource}
                onChange={e => setBulkSource(e.target.value)}
                placeholder="e.g. WhatsApp Public Community, Exhibition 2026"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">Source Group / Campaign Tag</span>
              <input
                value={bulkSourceName}
                onChange={e => setBulkSourceName(e.target.value)}
                placeholder="e.g. Colombo Medical Expo, Group #4"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
              />
            </label>
          </div>

          <label className="block">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                Raw Phone Numbers <span className="text-rose-400">*</span>
              </span>
              <span className="text-[11px] font-mono text-teal-400">
                {rawCount} number{rawCount === 1 ? '' : 's'} detected
              </span>
            </div>
            <textarea
              required
              rows={8}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={`+94771234567\n0769876543\n+94715554433\n(Paste one number per line or separated by commas/tabs)`}
              className="mt-1.5 w-full font-mono rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
            />
          </label>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Info className="w-4 h-4 text-teal-400 shrink-0" />
              <span>E.164 engine cleans and deduplicates against existing contacts and CRM leads.</span>
            </div>
            <button
              type="submit"
              disabled={submitting || rawCount === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-teal-300 disabled:opacity-50 transition-all shadow-sm shrink-0"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Ingesting & normalizing...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Ingest {rawCount > 0 ? `${rawCount} Contacts` : 'Contacts'}
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ============================================================== */}
      {/* TAB 3: CSV / EXCEL UPLOAD                                      */}
      {/* ============================================================== */}
      {tab === 'file' && (
        <form onSubmit={handleBatchSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-300">
                Source Description <span className="text-rose-400">*</span>
              </span>
              <input
                required
                value={fileSource}
                onChange={e => setFileSource(e.target.value)}
                placeholder="e.g. Aviation Expo 2026, Clinical Conference"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">Source Group / File Label</span>
              <input
                value={fileSourceName}
                onChange={e => setFileSourceName(e.target.value)}
                placeholder="e.g. Sheet #1 - Registrations"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
              />
            </label>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-300">
              Upload CSV, TSV or Text File <span className="text-rose-400">*</span>
            </span>
            <div className="border-2 border-dashed border-slate-700 hover:border-teal-500/50 rounded-xl p-6 text-center bg-slate-900/50 transition-colors">
              <input
                type="file"
                id="csv-file-input"
                accept=".csv, .txt, .tsv, .xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer block space-y-2">
                <UploadCloud className="w-8 h-8 text-teal-400 mx-auto" />
                <p className="text-xs font-bold text-slate-200">
                  {file ? file.name : 'Click to select CSV, TSV or spreadsheet file'}
                </p>
                <p className="text-[11px] text-slate-400">
                  Client-side detector extracts phone numbers from the first detected column.
                </p>
              </label>
            </div>

            {fileError && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> {fileError}
              </p>
            )}

            {parsedFileNumbers.length > 0 && (
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1526] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-teal-300">
                    Parsed {parsedFileNumbers.length} contact candidate{parsedFileNumbers.length === 1 ? '' : 's'}
                  </span>
                  <span className="text-slate-400 text-[11px]">Previewing first 5 rows:</span>
                </div>
                <div className="space-y-1">
                  {filePreviewRows.map((sample, i) => (
                    <div key={i} className="text-[11px] font-mono text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded">
                      Row {i + 1}: {sample}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <span className="text-[11px] text-slate-400">
              Batches of up to 10,000 numbers are supported safely.
            </span>
            <button
              type="submit"
              disabled={submitting || parsedFileNumbers.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-teal-300 disabled:opacity-50 transition-all shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Ingesting file...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Import {parsedFileNumbers.length} Contacts
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ============================================================== */}
      {/* TAB 4: IMPORT HISTORY                                          */}
      {/* ============================================================== */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Audit log of previous ingestion batches, duplicates detected, and row status.
            </p>
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              title="Refresh history"
            >
              <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin text-teal-400' : ''}`} />
            </button>
          </div>

          {loadingHistory ? (
            <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
              Loading batch audit history...
            </div>
          ) : historyBatches.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 rounded-xl border border-slate-800 bg-slate-900/40">
              No previous import batches recorded for this company.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Batch Number</th>
                    <th className="px-4 py-3">Source & File</th>
                    <th className="px-4 py-3 text-right">Submitted</th>
                    <th className="px-4 py-3 text-right">Saved Clean</th>
                    <th className="px-4 py-3 text-right">Duplicates</th>
                    <th className="px-4 py-3 text-right">Invalid</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-center">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-[#0D1526]/40">
                  {historyBatches.map(b => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-teal-300">{b.batchNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{b.source}</p>
                        {b.fileName && <p className="text-[10px] text-slate-400">{b.fileName}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">{b.totalSubmitted}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400 font-bold">{b.savedCount}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-400">{b.duplicateCount}</td>
                      <td className="px-4 py-3 text-right font-mono text-rose-400">{b.invalidCount}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          b.status === 'completed'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                            : b.status === 'partially_completed'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                            : 'bg-rose-950 text-rose-300 border border-rose-800/50'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(b.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleViewBatchDetails(b)}
                          className="p-1 rounded text-slate-400 hover:text-teal-300 hover:bg-slate-800"
                          title="View row-level logs"
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
        </div>
      )}

      {/* Row-Level Batch Details Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[80vh] rounded-xl border border-slate-800 bg-[#0D1526] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-teal-400 font-mono">
                  {selectedBatch.batchNumber}
                </span>
                <h3 className="text-sm font-bold text-white mt-0.5">Row-Level Ingestion Audit</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingBatchRows ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" /> Loading rows...
                </div>
              ) : batchRows.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No row entries available.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Raw Phone</th>
                      <th className="px-3 py-2">Normalized</th>
                      <th className="px-3 py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {batchRows.map(row => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 text-slate-400">{row.rowNumber}</td>
                        <td className="px-3 py-2 text-slate-300">{row.rawPhone}</td>
                        <td className="px-3 py-2 text-teal-300">{row.normalizedPhone || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            row.status === 'saved'
                              ? 'text-emerald-400 bg-emerald-950/60'
                              : row.status === 'duplicate'
                              ? 'text-amber-400 bg-amber-950/60'
                              : 'text-rose-400 bg-rose-950/60'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reconciliation Summary Card */}
      {summary && (
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-5 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-teal-400" />
              <h3 className="text-sm font-bold text-white">Import Reconciliation Complete</h3>
            </div>
            <span className="font-mono text-xs text-teal-300 font-bold">{summary.batchNumber}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Submitted</span>
              <p className="text-xl font-black text-white mt-0.5">{summary.totalSubmitted}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Saved (Clean)</span>
              <p className="text-xl font-black text-emerald-300 mt-0.5">{summary.savedCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Duplicates Skipped</span>
              <p className="text-xl font-black text-amber-300 mt-0.5">{summary.duplicateCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Invalid Rejected</span>
              <p className="text-xl font-black text-rose-300 mt-0.5">{summary.invalidCount}</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 pt-1">
            Status: <span className="font-bold uppercase text-slate-200">{summary.status}</span>. Contacts loaded into the unassigned pool and ready for coordinator allocation.
          </p>
        </div>
      )}
    </div>
  );
};
