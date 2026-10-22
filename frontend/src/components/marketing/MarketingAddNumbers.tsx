import React from 'react';
import { Loader2, Plus, UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, XCircle, Info, RefreshCw } from 'lucide-react';
import { MarketingImportBatch } from './types';

interface MarketingAddNumbersProps {
  loading: boolean;
  onImportComplete: (batch: MarketingImportBatch) => void;
  onRequestApi: (path: string, init?: RequestInit) => Promise<any>;
}

type AddTab = 'single' | 'bulk' | 'file';

export const MarketingAddNumbers: React.FC<MarketingAddNumbersProps> = ({
  loading,
  onImportComplete,
  onRequestApi,
}) => {
  const [tab, setTab] = React.useState<AddTab>('bulk');

  // Form states
  const [source, setSource] = React.useState('WhatsApp public group');
  const [group, setGroup] = React.useState('');
  const [singlePhone, setSinglePhone] = React.useState('');
  const [bulkText, setBulkText] = React.useState('');
  
  // File import states
  const [file, setFile] = React.useState<File | null>(null);
  const [parsedFileNumbers, setParsedFileNumbers] = React.useState<string[]>([]);
  const [filePreviewRows, setFilePreviewRows] = React.useState<string[]>([]);
  const [fileError, setFileError] = React.useState('');

  // Execution & result states
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [summary, setSummary] = React.useState<MarketingImportBatch | null>(null);

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

        // Detect phone numbers from file
        const detected: string[] = [];
        const preview: string[] = [];

        lines.forEach((line, idx) => {
          // split by comma, semicolon or tab
          const parts = line.split(/[,;\t]+/).map(p => p.trim().replace(/^["']|["']$/g, ''));
          // Look for part that resembles a phone number
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSummary(null);

    let numbersToSubmit: string[] = [];
    let fileName: string | undefined = undefined;

    if (tab === 'single') {
      if (!singlePhone.trim()) {
        setError('Please enter a phone number.');
        return;
      }
      numbersToSubmit = [singlePhone.trim()];
    } else if (tab === 'bulk') {
      numbersToSubmit = bulkText
        .split(/[\r\n,;\t]+/)
        .map(n => n.trim())
        .filter(Boolean);
      if (numbersToSubmit.length === 0) {
        setError('Please enter at least one phone number in the text area.');
        return;
      }
    } else if (tab === 'file') {
      if (parsedFileNumbers.length === 0) {
        setError('Please select and parse a valid CSV or text file containing phone numbers.');
        return;
      }
      numbersToSubmit = parsedFileNumbers;
      fileName = file?.name;
    }

    if (!source.trim()) {
      setError('Source description is required.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await onRequestApi('/api/marketing/imports', {
        method: 'POST',
        body: JSON.stringify({
          source: source.trim(),
          sourceGroupName: group.trim() || null,
          numbers: numbersToSubmit,
          fileName,
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      if (response?.data) {
        setSummary(response.data);
        onImportComplete(response.data);
        // Clear inputs
        if (tab === 'single') setSinglePhone('');
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

  const rawCount = tab === 'single'
    ? (singlePhone ? 1 : 0)
    : tab === 'bulk'
    ? bulkText.split(/[\r\n,;\t]+/).map(n => n.trim()).filter(Boolean).length
    : parsedFileNumbers.length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => { setTab('bulk'); setError(''); }}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
            tab === 'bulk'
              ? 'border-teal-400 text-teal-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Bulk raw paste
        </button>
        <button
          type="button"
          onClick={() => { setTab('single'); setError(''); }}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
            tab === 'single'
              ? 'border-teal-400 text-teal-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Single entry
        </button>
        <button
          type="button"
          onClick={() => { setTab('file'); setError(''); }}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
            tab === 'file'
              ? 'border-teal-400 text-teal-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          CSV / Excel file
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-bold text-slate-300">
              Source Description <span className="text-rose-400">*</span>
            </span>
            <input
              required
              value={source}
              onChange={e => setSource(e.target.value)}
              placeholder="e.g. WhatsApp Public Community, Exhibition 2026"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-slate-300">
              Source Group / Campaign Tag
            </span>
            <input
              value={group}
              onChange={e => setGroup(e.target.value)}
              placeholder="e.g. Colombo Medical Expo, Group #4"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
            />
          </label>
        </div>

        {/* Tab 1: Single Phone Input */}
        {tab === 'single' && (
          <label className="block">
            <span className="text-xs font-bold text-slate-300">
              Phone Number <span className="text-rose-400">*</span>
            </span>
            <input
              required
              value={singlePhone}
              onChange={e => setSinglePhone(e.target.value)}
              placeholder="+94771234567 or 0771234567"
              className="mt-1.5 w-full font-mono rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Numbers will be automatically normalized to international E.164 format.
            </span>
          </label>
        )}

        {/* Tab 2: Bulk Text Input */}
        {tab === 'bulk' && (
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
              placeholder={`+94771234567\n0769876543\n+94715554433\n(Paste one number per line or comma separated)`}
              className="mt-1.5 w-full font-mono rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
            />
          </label>
        )}

        {/* Tab 3: CSV File Dropzone */}
        {tab === 'file' && (
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-300">
              Upload CSV or Text File <span className="text-rose-400">*</span>
            </span>
            <div className="border-2 border-dashed border-slate-700 hover:border-teal-500/50 rounded-xl p-6 text-center bg-slate-900/50 transition-colors">
              <input
                type="file"
                id="csv-file-input"
                accept=".csv, .txt, .tsv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer block space-y-2">
                <UploadCloud className="w-8 h-8 text-teal-400 mx-auto" />
                <p className="text-xs font-bold text-slate-200">
                  {file ? file.name : 'Click to select CSV, TSV or text file'}
                </p>
                <p className="text-[11px] text-slate-400">
                  Client-side parser will extract phone numbers and validate E.164 formatting.
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
                    <div key={i} className="text-[11px] font-mono text-slate-300 bg-slate-900/80 px-2 py-1 rounded">
                      Row {i + 1}: {sample}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Normalizer Banner & Submit button */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-4 h-4 text-teal-400 shrink-0" />
            <span>
              E.164 normalizer standardizes formatting. Duplicate phone numbers are automatically skipped.
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting || loading || rawCount === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Ingesting & normalizing...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> Ingest {rawCount > 0 ? `${rawCount} Contact${rawCount === 1 ? '' : 's'}` : 'Contacts'}
              </>
            )}
          </button>
        </div>
      </form>

      {/* Ingestion Reconciliation Summary */}
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
            Status: <span className="font-bold uppercase text-slate-200">{summary.status}</span>. Contacts are loaded with <strong className="text-amber-300">pending consent</strong> and are ready for marketing assignment.
          </p>
        </div>
      )}
    </div>
  );
};
