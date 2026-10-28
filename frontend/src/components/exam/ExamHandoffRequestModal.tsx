import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config/api';
import { ExamHandoffDetails, useCrm } from '../../context/CrmContext';

const inputStyle = 'w-full rounded-lg border border-slate-600 bg-slate-900 p-2.5 text-sm text-white';
const serviceOptions = [
  { value: 'exam_material', label: 'Exam material' },
  { value: 'mock_test', label: 'Mock test' },
  { value: 'model_study_question', label: 'Model study question' },
];
const countryOptions = ['International requirement', 'United Arab Emirates', 'Qatar', 'Saudi Arabia', 'Oman', 'Kuwait', 'Bahrain', 'Sri Lanka', 'Maldives', 'Other country'];

type FormState = Omit<ExamHandoffDetails, 'paymentReceiptUrl' | 'paymentReceiptFileName' | 'receiptVoucherUrl' | 'receiptVoucherFileName'>;

export function ExamHandoffRequestModal() {
  const { examHandoffDraft, cancelExamHandoff, submitExamHandoff, leads } = useCrm();
  const lead = examHandoffDraft ? leads.find(item => item.id === examHandoffDraft.leadId) : undefined;
  const [form, setForm] = useState<FormState>({
    requirementType: 'international', examCountry: 'International requirement', examTitle: '', authority: '', priority: 'regular_work', services: [],
    quotationNumber: '', clientName: '', clientEmail: '', contactNumber: '', receiptVoucherNo: '',
  });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [voucherPdf, setVoucherPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!examHandoffDraft) return;
    setForm(prev => ({
      ...prev,
      clientName: lead?.customer?.displayName || prev.clientName,
      contactNumber: lead?.customer?.whatsappNumber || lead?.customer?.phoneNumber || prev.contactNumber,
    }));
    setReceipt(null);
    setVoucherPdf(null);
    setError('');
  }, [examHandoffDraft?.leadId, lead?.customer?.displayName, lead?.customer?.phoneNumber, lead?.customer?.whatsappNumber]);

  if (!examHandoffDraft || !lead) return null;

  const setField = (field: keyof FormState, value: string) => setForm(prev => ({ ...prev, [field]: value } as FormState));
  const toggleService = (value: string) => setForm(prev => ({ ...prev, services: prev.services.includes(value) ? prev.services.filter(item => item !== value) : [...prev.services, value] }));

  const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the attachment.'));
    reader.readAsDataURL(file);
  });

  const uploadFile = async (file: File, label: string) => {
    const dataUrl = await readAsDataUrl(file);
    const token = localStorage.getItem('rw_crm_auth_token') || localStorage.getItem('crm_auth_token') || '';
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
      body: JSON.stringify({ dataUrl, type: 'document', fileName: file.name }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success || !(payload.url || payload.mediaUrl)) throw new Error(payload.error || `${label} upload failed.`);
    return payload.url || payload.mediaUrl;
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!receipt) { setError('Attach the payment receipt before forwarding.'); return; }
    if (!voucherPdf) { setError('Attach the receipt voucher PDF before forwarding.'); return; }
    if (voucherPdf.type !== 'application/pdf') { setError('Receipt voucher must be a PDF file.'); return; }
    if (!form.services.length) { setError('Select at least one service.'); return; }
    // The legacy upload endpoint accepts a 25 MB JSON body; base64 adds ~33%
    // overhead, so keep the raw receipt below 15 MB.
    if (receipt.size > 15 * 1024 * 1024 || voucherPdf.size > 15 * 1024 * 1024) { setError('Each attachment must be 15 MB or smaller.'); return; }
    setBusy(true);
    setError('');
    try {
      const paymentReceiptUrl = await uploadFile(receipt, 'Payment receipt');
      const receiptVoucherUrl = await uploadFile(voucherPdf, 'Receipt voucher PDF');
      submitExamHandoff({ ...form, paymentReceiptUrl, paymentReceiptFileName: receipt.name, receiptVoucherUrl, receiptVoucherFileName: voucherPdf.name });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to attach the payment receipt and voucher.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="exam-handoff-title">
    <form onSubmit={submit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-cyan-500/40 bg-slate-900 p-5 text-slate-100 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><h2 id="exam-handoff-title" className="text-xl font-bold">Exam Department forwarding details</h2><p className="mt-1 text-sm text-slate-400">Required information must be completed before this sales lead is sent to the Head of Exam Department.</p></div><button type="button" className="rounded-lg border border-slate-600 px-3 py-1 text-sm" onClick={cancelExamHandoff}>Close</button></div>
      <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-sm"><b>Client:</b> {lead.customer?.displayName || 'Unnamed lead'} <span className="text-slate-400">· {lead.customer?.whatsappNumber || 'No contact number'}</span></div>
      {error && <p role="alert" className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs">Requirement type *<select required className={inputStyle} value={form.requirementType} onChange={e => setField('requirementType', e.target.value)}><option value="international">International requirement</option><option value="country_specific">Country-specific requirement</option></select></label>
        <label className="text-xs">Exam country *<select required className={inputStyle} value={form.examCountry} onChange={e => setField('examCountry', e.target.value)}>{countryOptions.map(country => <option key={country} value={country}>{country}</option>)}</select></label>
        <label className="text-xs">Exam title *<input required className={inputStyle} value={form.examTitle} onChange={e => setField('examTitle', e.target.value)} placeholder="e.g. DHA Registered Nurse" /></label>
        <label className="text-xs">Authority *<input required className={inputStyle} value={form.authority} onChange={e => setField('authority', e.target.value)} placeholder="DHA, DOH, MOH, Prometric…" /></label>
        <label className="text-xs">Priority *<select required className={inputStyle} value={form.priority} onChange={e => setField('priority', e.target.value)}><option value="urgent">Urgent</option><option value="regular_work">Regular work</option></select></label>
        <label className="text-xs">Quotation number *<input required className={inputStyle} value={form.quotationNumber} onChange={e => setField('quotationNumber', e.target.value)} /></label>
        <label className="text-xs">Receipt voucher number *<input required className={inputStyle} value={form.receiptVoucherNo} onChange={e => setField('receiptVoucherNo', e.target.value)} /></label>
        <label className="text-xs">Client name *<input required className={inputStyle} value={form.clientName} onChange={e => setField('clientName', e.target.value)} /></label>
        <label className="text-xs">Client email ID *<input required type="email" className={inputStyle} value={form.clientEmail} onChange={e => setField('clientEmail', e.target.value)} /></label>
        <label className="text-xs sm:col-span-2">Contact number *<input required className={inputStyle} value={form.contactNumber} onChange={e => setField('contactNumber', e.target.value)} /></label>
      </div>
      <fieldset className="mt-4 rounded-lg border border-slate-700 p-3"><legend className="px-1 text-xs text-slate-300">Services required *</legend><div className="grid gap-2 sm:grid-cols-3">{serviceOptions.map(option => <label key={option.value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.services.includes(option.value)} onChange={() => toggleService(option.value)} />{option.label}</label>)}</div></fieldset>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label className="text-xs">Attach payment receipt *<input required type="file" accept="application/pdf,image/*" className="mt-1 block w-full max-w-md rounded-lg border border-slate-600 bg-slate-900 p-1.5 text-xs text-slate-200 file:mr-2 file:rounded file:border-0 file:bg-cyan-600 file:px-2 file:py-1 file:text-white" onChange={e => setReceipt(e.target.files?.[0] || null)} /></label>{receipt && <p className="mt-1 truncate text-[11px] text-teal-300" title={receipt.name}>Attached: {receipt.name}</p>}</div><div><label className="text-xs">Attach receipt voucher PDF *<input required type="file" accept="application/pdf" className="mt-1 block w-full max-w-md rounded-lg border border-slate-600 bg-slate-900 p-1.5 text-xs text-slate-200 file:mr-2 file:rounded file:border-0 file:bg-cyan-600 file:px-2 file:py-1 file:text-white" onChange={e => setVoucherPdf(e.target.files?.[0] || null)} /></label>{voucherPdf && <p className="mt-1 truncate text-[11px] text-teal-300" title={voucherPdf.name}>Voucher PDF: {voucherPdf.name}</p>}</div></div>
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" className="rounded-lg border border-slate-600 px-4 py-2 text-sm" onClick={cancelExamHandoff}>Cancel</button><button disabled={busy} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Uploading receipt…' : 'Validate & forward to Exam Department'}</button></div>
    </form>
  </div>;
}
