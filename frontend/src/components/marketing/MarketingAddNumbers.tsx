import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  FileSpreadsheet,
  ClipboardPaste,
  UserPlus,
  Upload,
  Check,
  X,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

interface MarketingAddNumbersProps {
  onContactCreated: () => void;
  onRequestApi: (path: string, init?: RequestInit) => Promise<any>;
  onNavigateToAssignment?: () => void;
}

// RFC-4180 Client-side CSV Parser for instant preview and validation
function parseCsvClient(text: string) {
  if (!text) return [];
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Determine delimiter
  const first = lines[0];
  let delim = ',';
  if ((first.match(/\t/g) || []).length > (first.match(/,/g) || []).length) delim = '\t';
  else if ((first.match(/;/g) || []).length > (first.match(/,/g) || []).length) delim = ';';

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    const next = clean[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delim && !inQuotes) {
      currentRow.push(field.trim());
      field = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      currentRow.push(field.trim());
      field = '';
      if (currentRow.some(col => col.length > 0)) rows.push(currentRow);
      currentRow = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || currentRow.length > 0) {
    currentRow.push(field.trim());
    if (currentRow.some(col => col.length > 0)) rows.push(currentRow);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.toLowerCase().replace(/[\s\-_]/g, ''));
  const hasPhoneHeader = headers.some(h =>
    ['phone', 'phonenumber', 'mobile', 'contact', 'telephone', 'whatsapp', 'number'].includes(h)
  );

  const dataRows = hasPhoneHeader ? rows.slice(1) : rows;

  return dataRows.map((row, idx) => {
    let phone = '';
    let name = '';
    let group = '';
    let notes = '';

    if (hasPhoneHeader) {
      headers.forEach((h, colIdx) => {
        const val = row[colIdx] || '';
        if (['phone', 'phonenumber', 'mobile', 'contact', 'telephone', 'whatsapp', 'number'].includes(h)) {
          phone = val;
        } else if (['name', 'fullname', 'contactname'].includes(h)) {
          name = val;
        } else if (['group', 'groupname', 'sourcegroup'].includes(h)) {
          group = val;
        } else if (['notes', 'note', 'remarks'].includes(h)) {
          notes = val;
        }
      });
    } else {
      phone = row.find(col => /[\d]{7,}/.test(col)) || row[0] || '';
      name = row.find(col => col !== phone && !/^[\d\s+\-()]+$/.test(col)) || '';
    }

    return {
      index: idx + 1,
      phone: phone.trim(),
      name: name.trim() || undefined,
      group: group.trim() || undefined,
      notes: notes.trim() || undefined,
      isValid: /^\+?[\d\s\-().]{8,18}$/.test(phone.trim()),
    };
  }).filter(r => Boolean(r.phone));
}

export const MarketingAddNumbers: React.FC<MarketingAddNumbersProps> = ({
  onContactCreated,
  onRequestApi,
  onNavigateToAssignment,
}) => {
  const { currentUser } = useCrm();

  // Mode Tabs: 'single' | 'paste' | 'csv'
  const [activeMode, setActiveMode] = React.useState<'single' | 'paste' | 'csv'>('single');

  // Shared Config
  const [company, setCompany] = React.useState(currentUser?.company || 'RWC');
  const [source, setSource] = React.useState('Public Event / Campaign');
  const [sourceName, setSourceName] = React.useState('');
  const [region, setRegion] = React.useState('LK');

  // Single Contact Form State
  const [singleName, setSingleName] = React.useState('');
  const [singlePhone, setSinglePhone] = React.useState('');
  const [singleTags, setSingleTags] = React.useState('');
  const [singleNotes, setSingleNotes] = React.useState('');

  // Bulk Paste State
  const [pasteText, setPasteText] = React.useState('');

  // CSV Upload State
  const [csvFile, setCsvFile] = React.useState<File | null>(null);
  const [csvTextContent, setCsvTextContent] = React.useState<string>('');
  const [csvPreviewRows, setCsvPreviewRows] = React.useState<Array<{ index: number; phone: string; name?: string; group?: string; isValid: boolean }>>([]);
  const [isDragging, setIsDragging] = React.useState(false);

  // Status & Receipts
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [batchReceipt, setBatchReceipt] = React.useState<{
    id?: string;
    batchNumber: string;
    totalSubmitted: number;
    savedCount: number;
    duplicateCount: number;
    invalidCount: number;
  } | null>(null);

  // Post-Upload Equal Staff Assignment Step
  const [assignableStaff, setAssignableStaff] = React.useState<Array<{ id: string; fullName: string; role: string; email?: string }>>([]);
  const [selectedStaffIds, setSelectedStaffIds] = React.useState<string[]>([]);
  const [assignmentOption, setAssignmentOption] = React.useState<'unassigned' | 'equal'>('unassigned');
  const [assigningBatch, setAssigningBatch] = React.useState(false);
  const [assignmentSuccess, setAssignmentSuccess] = React.useState<string | null>(null);

  const fetchStaff = React.useCallback(async () => {
    try {
      const res = await onRequestApi('/api/marketing/assignable');
      if (res?.data?.staff) {
        const active = res.data.staff.filter((s: any) => s.marketingAccess !== false);
        setAssignableStaff(active);
        setSelectedStaffIds(active.map((s: any) => s.id));
      }
    } catch {
      // ignore
    }
  }, [onRequestApi]);

  const previewDistribution = React.useMemo(() => {
    if (!batchReceipt || selectedStaffIds.length === 0) return [];
    const count = batchReceipt.savedCount;
    const n = selectedStaffIds.length;
    const base = Math.floor(count / n);
    const remainder = count % n;
    return selectedStaffIds.map((id, index) => {
      const staffMember = assignableStaff.find(s => s.id === id);
      const allocated = index < remainder ? base + 1 : base;
      return {
        id,
        name: staffMember?.fullName || id,
        role: staffMember?.role || 'Staff',
        allocated,
      };
    });
  }, [batchReceipt, selectedStaffIds, assignableStaff]);

  const handleConfirmDistribution = async () => {
    if (!batchReceipt?.id || selectedStaffIds.length === 0) return;
    setAssigningBatch(true);
    setError('');
    try {
      const res = await onRequestApi('/api/marketing/assignments', {
        method: 'POST',
        body: JSON.stringify({
          batchId: batchReceipt.id,
          officerIds: selectedStaffIds,
          mode: 'round_robin',
        }),
      });
      setAssignmentSuccess(`Successfully distributed ${res?.data?.assigned || batchReceipt.savedCount} contacts equally across ${selectedStaffIds.length} staff members.`);
      onContactCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to distribute batch contacts.');
    } finally {
      setAssigningBatch(false);
    }
  };

  // Bulk Paste Real-Time Statistics
  const parsedPasteStats = React.useMemo(() => {
    if (!pasteText.trim()) return { total: 0, valid: 0, sample: [] };
    const rawTokens = pasteText.split(/[\n,;\t]+/).map(t => t.trim()).filter(Boolean);
    const uniqueTokens = Array.from(new Set(rawTokens));
    const validCount = uniqueTokens.filter(t => /^\+?[\d\s\-().]{8,18}$/.test(t)).length;
    return {
      total: uniqueTokens.length,
      valid: validCount,
      sample: uniqueTokens.slice(0, 5),
    };
  }, [pasteText]);

  // Handle Single Contact Submit
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBatchReceipt(null);

    if (!singlePhone.trim()) {
      setError('Please provide a valid phone number.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await onRequestApi('/api/marketing/contacts', {
        method: 'POST',
        body: JSON.stringify({
          phone: singlePhone.trim(),
          name: singleName.trim() || undefined,
          company,
          source,
          sourceName: sourceName.trim() || undefined,
          tags: singleTags.trim() || undefined,
          notes: singleNotes.trim() || undefined,
          region,
        }),
      });

      if (response?.data) {
        setNotice(`Contact successfully ingested with Serial #${response.data.serialNumber || response.data.id}`);
        setSingleName('');
        setSinglePhone('');
        setSingleTags('');
        setSingleNotes('');
        onContactCreated();
      }
    } catch (caught: any) {
      setError(caught.message || 'Failed to add contact');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Bulk Paste Submit
  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBatchReceipt(null);

    const rawTokens = pasteText.split(/[\n,;\t]+/).map(t => t.trim()).filter(Boolean);
    if (rawTokens.length === 0) {
      setError('Please paste at least one phone number.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await onRequestApi('/api/marketing/imports', {
        method: 'POST',
        body: JSON.stringify({
          numbers: rawTokens,
          source,
          sourceGroupName: sourceName.trim() || undefined,
          company,
          region,
        }),
      });

      if (response?.data) {
        setBatchReceipt(response.data);
        setNotice(`Bulk ingestion finished: ${response.data.savedCount} new contacts saved to pool.`);
        setPasteText('');
        void fetchStaff();
        setAssignmentOption('unassigned');
        setAssignmentSuccess(null);
        onContactCreated();
      }
    } catch (caught: any) {
      setError(caught.message || 'Bulk ingestion failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle CSV File Selection
  const handleFileChange = (file: File) => {
    setCsvFile(file);
    setError('');
    setNotice('');
    setBatchReceipt(null);

    const reader = new FileReader();
    reader.onload = ev => {
      const content = String(ev.target?.result || '');
      setCsvTextContent(content);
      const parsed = parseCsvClient(content);
      setCsvPreviewRows(parsed);
    };
    reader.onerror = () => {
      setError('Unable to read the selected file.');
    };
    reader.readAsText(file);
  };

  // Handle CSV Upload Submit
  const handleCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBatchReceipt(null);

    if (!csvTextContent.trim()) {
      setError('Please select or drop a valid CSV spreadsheet.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await onRequestApi('/api/marketing/imports', {
        method: 'POST',
        body: JSON.stringify({
          csvText: csvTextContent,
          fileName: csvFile?.name || 'contacts.csv',
          source,
          sourceGroupName: sourceName.trim() || undefined,
          company,
          region,
        }),
      });

      if (response?.data) {
        setBatchReceipt(response.data);
        setNotice(`CSV Batch Import completed: ${response.data.savedCount} contacts created.`);
        setCsvFile(null);
        setCsvTextContent('');
        setCsvPreviewRows([]);
        void fetchStaff();
        setAssignmentOption('unassigned');
        setAssignmentSuccess(null);
        onContactCreated();
      }
    } catch (caught: any) {
      setError(caught.message || 'Failed to process CSV file.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-teal-400" />
            Add Public Contact Numbers
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Ingest single numbers, paste bulk lists, or upload RFC-4180 compliant CSV spreadsheets with E.164 normalization.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => { setActiveMode('single'); setError(''); setNotice(''); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeMode === 'single'
                ? 'bg-teal-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Single Contact</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveMode('paste'); setError(''); setNotice(''); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeMode === 'paste'
                ? 'bg-teal-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Bulk Paste</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveMode('csv'); setError(''); setNotice(''); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeMode === 'csv'
                ? 'bg-teal-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV / Excel Upload</span>
          </button>
        </div>
      </div>

      {/* 2. Notifications & Batch Receipts */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200 animate-in fade-in duration-150">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {notice && !batchReceipt && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 animate-in fade-in duration-150">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{notice}</span>
        </div>
      )}

      {/* Batch Ingestion Receipt Card */}
      {batchReceipt && (
        <div className="rounded-2xl border border-teal-500/40 bg-teal-950/30 p-5 shadow-lg space-y-3 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-800/60 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-white">Batch Import Ingested Successfully</h4>
                <p className="text-[11px] font-mono text-teal-300">
                  Batch #{batchReceipt.batchNumber}
                </p>
              </div>
            </div>

            {onNavigateToAssignment && (
              <button
                type="button"
                onClick={onNavigateToAssignment}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-400 text-slate-950 text-xs font-bold hover:bg-teal-300 transition-colors shadow-sm"
              >
                <span>Assign Ingested Contacts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-mono uppercase">Submitted</span>
              <p className="text-lg font-black text-white">{batchReceipt.totalSubmitted}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80">
              <span className="text-[10px] text-emerald-400 font-mono uppercase">New Contacts Saved</span>
              <p className="text-lg font-black text-emerald-300">{batchReceipt.savedCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-amber-400 font-mono uppercase">Duplicate Excluded</span>
              <p className="text-lg font-black text-amber-300">{batchReceipt.duplicateCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-rose-400 font-mono uppercase">Invalid Format</span>
              <p className="text-lg font-black text-rose-300">{batchReceipt.invalidCount}</p>
            </div>
          </div>

          {/* Post-Upload Equal Staff Assignment Step */}
          {batchReceipt.savedCount > 0 && (
            <div className="mt-4 pt-4 border-t border-teal-800/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-teal-400" />
                    Post-Upload Staff Allocation Step
                  </h5>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Choose whether to keep these {batchReceipt.savedCount} contacts unassigned or allocate them equally among staff.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignmentOption('unassigned')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      assignmentOption === 'unassigned'
                        ? 'bg-slate-800 text-teal-300 border border-teal-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Keep Unassigned
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignmentOption('equal');
                      if (assignableStaff.length === 0) void fetchStaff();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      assignmentOption === 'equal'
                        ? 'bg-teal-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white border border-slate-700 bg-slate-900'
                    }`}
                  >
                    Equal Distribution
                  </button>
                </div>
              </div>

              {assignmentSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{assignmentSuccess}</span>
                </div>
              )}

              {assignmentOption === 'equal' && !assignmentSuccess && (
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-semibold text-white">Select Eligible Staff Members ({selectedStaffIds.length} selected)</span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSelectedStaffIds(assignableStaff.map(s => s.id))}
                        className="text-teal-400 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedStaffIds([])}
                        className="text-slate-400 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {assignableStaff.map(staff => {
                      const isChecked = selectedStaffIds.includes(staff.id);
                      return (
                        <label
                          key={staff.id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-teal-950/30 border-teal-500/50 text-white'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedStaffIds(prev =>
                                prev.includes(staff.id) ? prev.filter(id => id !== staff.id) : [...prev, staff.id]
                              );
                            }}
                            className="rounded border-slate-700 bg-slate-900 text-teal-400 focus:ring-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate text-slate-200">{staff.fullName}</p>
                            <p className="text-[10px] text-slate-400 truncate">{staff.role}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Proposed Fair Distribution Preview */}
                  {previewDistribution.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-teal-300 uppercase tracking-wider">
                          Proposed Equal Distribution Preview (&Delta; &le; 1)
                        </span>
                        <span className="text-slate-400">
                          {batchReceipt.savedCount} contacts across {selectedStaffIds.length} staff
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {previewDistribution.map(item => (
                          <div key={item.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <span className="text-slate-300 truncate text-[11px] font-medium">{item.name}</span>
                            <span className="font-mono font-bold text-teal-300 px-2 py-0.5 rounded bg-teal-950/80 text-[11px]">
                              {item.allocated}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          disabled={assigningBatch || selectedStaffIds.length === 0}
                          onClick={handleConfirmDistribution}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50"
                        >
                          {assigningBatch ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Allocating Contacts...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Confirm Equal Allocation</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Common Context Bar (Company & Source Config) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-slate-800 bg-[#0c1424] text-xs">
        <div>
          <label className="block font-semibold text-slate-300 mb-1">Company Scope</label>
          <select
            value={company}
            onChange={e => setCompany(e.target.value as any)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-teal-400 cursor-pointer"
          >
            <option value="RWC">Royal Wellness Clinic (RWC)</option>
            <option value="CRAS">Alpha CRAS Education (CRAS)</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-300 mb-1">Contact Source / Channel *</label>
          <input
            required
            value={source}
            onChange={e => setSource(e.target.value)}
            placeholder="e.g. WhatsApp Group, Walk-in, Expo 2026"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-teal-400"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-300 mb-1">Source Group / Batch Tag</label>
          <input
            value={sourceName}
            onChange={e => setSourceName(e.target.value)}
            placeholder="e.g. VIP Wellness Group #3"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-teal-400"
          />
        </div>
      </div>

      {/* 4. Active Mode Panes */}

      {/* MODE 1: SINGLE CONTACT */}
      {activeMode === 'single' && (
        <form onSubmit={handleSingleSubmit} className="max-w-2xl space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-300">Contact Name (Optional)</span>
              <input
                value={singleName}
                onChange={e => setSingleName(e.target.value)}
                placeholder="e.g. Dr. John Perera"
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
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-teal-300 placeholder-slate-500 outline-none focus:border-teal-400"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-300">Default Country / Region</span>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-teal-400 cursor-pointer"
              >
                <option value="LK">Sri Lanka (+94)</option>
                <option value="AE">United Arab Emirates (+971)</option>
                <option value="IN">India (+91)</option>
                <option value="GB">United Kingdom (+44)</option>
                <option value="US">United States (+1)</option>
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
            <span className="text-xs font-bold text-slate-300">Initial Qualification Notes</span>
            <textarea
              rows={3}
              value={singleNotes}
              onChange={e => setSingleNotes(e.target.value)}
              placeholder="Add patient background, health interest, or special instructions..."
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
            />
          </label>

          <div className="flex items-center justify-between border-t border-slate-800 pt-3">
            <span className="text-[11px] text-slate-400">
              Numbers are normalized to E.164 and deduplicated against CRM patient records.
            </span>
            <button
              type="submit"
              disabled={submitting || !singlePhone.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-sm transition-all hover:bg-teal-300 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>Save Contact</span>
            </button>
          </div>
        </form>
      )}

      {/* MODE 2: BULK PASTE NUMBERS */}
      {activeMode === 'paste' && (
        <form onSubmit={handlePasteSubmit} className="space-y-4 animate-in fade-in duration-150">
          <div className="rounded-2xl border border-slate-800 bg-[#0D1526]/80 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Bulk Number Paste Area
                </h4>
                <p className="text-[11px] text-slate-400">
                  Paste up to 5,000 numbers separated by newlines, commas, tabs, or spaces.
                </p>
              </div>

              {parsedPasteStats.total > 0 && (
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                    {parsedPasteStats.total} detected
                  </span>
                  <span className="px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800 font-bold">
                    {parsedPasteStats.valid} valid numbers
                  </span>
                </div>
              )}
            </div>

            <textarea
              rows={8}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={`Paste unformatted numbers here...\nExample:\n0771234567\n+94770000001\n071-234-5678, +971501234567\n0112345678\t+94751239845`}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-4 font-mono text-xs text-teal-300 placeholder-slate-600 outline-none focus:border-teal-400 leading-relaxed"
            />

            {parsedPasteStats.sample.length > 0 && (
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Live preview sample: </span>
                {parsedPasteStats.sample.join(', ')}
                {parsedPasteStats.total > 5 ? ` and ${parsedPasteStats.total - 5} more...` : ''}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-3">
            <span className="text-[11px] text-slate-400">
              Duplicates within the paste and across the database are safely excluded automatically.
            </span>
            <button
              type="submit"
              disabled={submitting || parsedPasteStats.valid === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-sm transition-all hover:bg-teal-300 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Ingesting Numbers...
                </>
              ) : (
                <>
                  <ClipboardPaste className="h-4 w-4" />
                  <span>Ingest {parsedPasteStats.valid > 0 ? `${parsedPasteStats.valid} Numbers` : 'Numbers'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* MODE 3: STANDARDS-COMPLIANT CSV & EXCEL UPLOAD */}
      {activeMode === 'csv' && (
        <form onSubmit={handleCsvSubmit} className="space-y-4 animate-in fade-in duration-150">
          {/* Dropzone Container */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileChange(file);
            }}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
              isDragging
                ? 'border-teal-400 bg-teal-950/20'
                : 'border-slate-700/80 bg-[#0D1526]/60 hover:border-slate-600'
            }`}
          >
            <input
              type="file"
              id="csvFileInput"
              accept=".csv,.txt,.tsv"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFileChange(file);
              }}
              className="hidden"
            />
            <label htmlFor="csvFileInput" className="cursor-pointer space-y-3 block">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center mx-auto border border-teal-500/30">
                <FileSpreadsheet className="w-6 h-6" />
              </div>

              <div>
                <p className="text-sm font-bold text-white">
                  {csvFile ? csvFile.name : 'Drop your CSV / TSV spreadsheet here'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports RFC-4180 standard formatting, quoted text with commas, UTF-8 BOM, and custom headers.
                </p>
              </div>

              <span className="inline-block px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors">
                {csvFile ? 'Choose another file' : 'Browse local file'}
              </span>
            </label>
          </div>

          {/* Real-time Parsed Preview Table */}
          {csvPreviewRows.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-[#0c1424] overflow-hidden shadow-xs">
              <div className="p-3.5 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-400" />
                  <span className="font-bold text-white">
                    Parsed Preview ({csvPreviewRows.length} valid rows found)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">Showing first 6 rows</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Phone Column</th>
                      <th className="px-3 py-2">Name Column</th>
                      <th className="px-3 py-2">Group / Source</th>
                      <th className="px-3 py-2">Format Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {csvPreviewRows.slice(0, 6).map(row => (
                      <tr key={row.index} className="hover:bg-slate-900/50">
                        <td className="px-3 py-2 text-slate-500">{row.index}</td>
                        <td className="px-3 py-2 font-bold text-teal-300">{row.phone}</td>
                        <td className="px-3 py-2 font-sans text-slate-300">{row.name || '—'}</td>
                        <td className="px-3 py-2 font-sans text-slate-400">{row.group || sourceName || '—'}</td>
                        <td className="px-3 py-2 font-sans">
                          {row.isValid ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-[10px] font-bold inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> Valid
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/60 text-[10px] font-bold">
                              Invalid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-800 pt-3">
            <span className="text-[11px] text-slate-400">
              Columns mapped automatically (Phone, Name, Source, Group, Notes).
            </span>
            <button
              type="submit"
              disabled={submitting || csvPreviewRows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-sm transition-all hover:bg-teal-300 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Ingesting CSV Batch...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Upload & Ingest {csvPreviewRows.length} Contacts</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
