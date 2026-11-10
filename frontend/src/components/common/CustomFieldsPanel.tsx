import React, { useEffect, useState } from 'react';
import { FileEdit, Check, RotateCw } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

interface CustomFieldDef {
  id: string;
  entity: 'lead' | 'appointment' | 'patient' | 'student';
  name: string;
  type: 'text' | 'number' | 'dropdown' | 'date' | 'textarea';
  required?: boolean;
  options?: string[];
}

interface CustomFieldsPanelProps {
  entityType: 'lead' | 'appointment' | 'patient' | 'student';
  entityId: string;
  company?: string;
}

function getAuthToken() {
  return (
    localStorage.getItem('rw_crm_auth_token') ||
    localStorage.getItem('royal_crm_token') ||
    localStorage.getItem('auth_token') ||
    ''
  );
}

export const CustomFieldsPanel: React.FC<CustomFieldsPanelProps> = ({
  entityType,
  entityId,
  company = 'RWC',
}) => {
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!entityId) return;
      setIsLoading(true);
      setErrorMsg(null);
      const base = API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : '';
      const headers = { Authorization: `Bearer ${getAuthToken()}` };
      try {
        const [defsRes, valsRes] = await Promise.all([
          fetch(`${base}/api/custom-fields/definitions?entity=${encodeURIComponent(entityType)}&company=${encodeURIComponent(company)}`, { headers }),
          fetch(`${base}/api/custom-fields/values/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`, { headers }),
        ]);
        const defsJson = defsRes.ok ? await defsRes.json() : { fields: [] };
        const valsJson = valsRes.ok ? await valsRes.json() : { values: {} };
        if (active) {
          setFields(Array.isArray(defsJson.fields) ? defsJson.fields : []);
          setValues(valsJson.values && typeof valsJson.values === 'object' ? valsJson.values : {});
        }
      } catch {
        if (active) setFields([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [entityType, entityId, company]);

  if (isLoading || fields.length === 0) {
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    for (const f of fields) {
      if (f.required && !String(values[f.id] || '').trim()) {
        setErrorMsg(`"${f.name}" is required.`);
        return;
      }
    }

    setIsSaving(true);
    setSavedNotice(false);
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : '';
    try {
      const res = await fetch(`${base}/api/custom-fields/values/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ values }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2500);
      } else {
        setErrorMsg(json.error || 'Failed to save custom fields.');
      }
    } catch {
      setErrorMsg('Network error saving custom fields.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="bg-slate-50 dark:bg-[#111b21]/80 border border-slate-200 dark:border-slate-700/70 rounded-xl p-3.5 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <FileEdit className="w-3.5 h-3.5 text-[#128C7E] dark:text-[#25D366]" />
          Custom Fields
        </span>
        {savedNotice && (
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Check className="w-3 h-3" /> Saved
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{errorMsg}</div>
      )}

      <div className="space-y-2.5">
        {fields.map((field) => {
          const val = values[field.id] || '';
          const onChange = (next: string) => setValues((prev) => ({ ...prev, [field.id]: next }));
          return (
            <div key={field.id}>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {field.name} {field.required && <span className="text-rose-500">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  rows={2}
                  value={val}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full bg-white dark:bg-[#202C33] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              ) : field.type === 'dropdown' ? (
                <select
                  value={val}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full bg-white dark:bg-[#202C33] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Select…</option>
                  {(field.options || ['Yes', 'No', 'Pending']).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                  value={val}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full bg-white dark:bg-[#202C33] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={isSaving}
          className="px-3 py-1 rounded-lg bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
        >
          {isSaving ? <RotateCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          <span>{isSaving ? 'Saving…' : 'Save Fields'}</span>
        </button>
      </div>
    </form>
  );
};
