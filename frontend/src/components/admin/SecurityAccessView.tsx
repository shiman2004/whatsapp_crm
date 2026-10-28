import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Info,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  UserCog,
  Users,
  XCircle
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { User, UserRole } from '../../types';
import { API_BASE_URL } from '../../config/api';

type AccessSection = 'roles' | 'users';
type CompanyScopeFilter = 'all' | 'RWC' | 'CRAS' | 'AHC' | 'shared';
type PermissionArea =
  | 'Leads' | 'Leads Pipeline' | 'Live WhatsApp' | 'Contact Database' | 'Appointments' | 'Dashboard & Analytics'
  | 'Marketing' | 'Marketing Contacts' | 'Marketing Campaigns' | 'Marketing Tasks' | 'Marketing Reports'
  | 'Exam' | 'Exam Operations' | 'Courses' | 'Mock Tests' | 'Study Materials' | 'Question Bank' | 'Student Database'
  | 'Clinical' | 'Patient Assessment' | 'Clinical Reports'
  | 'System' | 'Staff & Security' | 'Audit Trail' | 'API & Webhooks';
type PermissionCompany = 'RWC' | 'CRAS' | 'AHC';

const PERMISSION_AREA_OPTIONS: PermissionArea[] = [
  'Leads', 'Leads Pipeline', 'Live WhatsApp', 'Contact Database', 'Appointments', 'Dashboard & Analytics',
  'Marketing', 'Marketing Contacts', 'Marketing Campaigns', 'Marketing Tasks', 'Marketing Reports',
  'Exam', 'Exam Operations', 'Courses', 'Mock Tests', 'Study Materials', 'Question Bank', 'Student Database',
  'Clinical', 'Patient Assessment', 'Clinical Reports',
  'System', 'Staff & Security', 'Audit Trail', 'API & Webhooks'
];
const PERMISSION_COMPANY_OPTIONS: PermissionCompany[] = ['RWC', 'CRAS', 'AHC'];

interface RolePolicy {
  role: UserRole;
  label: string;
  description: string;
  scope: string;
  modules: string[];
  actions: string[];
  requiresGrant?: boolean;
}

interface PermissionTitle {
  id: string;
  title: string;
  description: string;
  allowedCompanies: PermissionCompany[];
  areas: PermissionArea[];
  role?: UserRole;
  builtIn: boolean;
}

interface PermissionTitleDraft {
  id?: string;
  title: string;
  description: string;
  allowedCompanies: PermissionCompany[];
  areas: PermissionArea[];
  role?: UserRole;
  builtIn?: boolean;
}

const ROLE_POLICIES: RolePolicy[] = [
  {
    role: 'super_admin',
    label: 'Super Admin',
    description: 'Full system administration and emergency security control.',
    scope: 'RWC + CRAS + AHC',
    modules: ['All CRM modules', 'Staff & Security', 'Audit Trail'],
    actions: ['Create staff', 'Assign/reassign', 'Export', 'Approve', 'Audit']
  },
  {
    role: 'leads_officer',
    label: 'Leads / Sales Officer',
    description: 'Collects, triages, assigns, and updates incoming leads.',
    scope: 'RWC + CRAS + AHC',
    modules: ['Live WhatsApp', 'Leads Pipeline', 'Dashboard', 'Marketing tasks'],
    actions: ['Collect contacts', 'Import uploads', 'Update assigned work'],
    requiresGrant: true
  },
  {
    role: 'sales_coordinator',
    label: 'Sales Coordinator',
    description: 'Works on sales follow-up and routes qualified requirements to the correct department.',
    scope: 'RWC + CRAS + AHC',
    modules: ['Leads Pipeline', 'Live WhatsApp', 'Dashboard', 'Marketing tasks'],
    actions: ['View contacts', 'Update assigned work', 'Forward requirements'],
    requiresGrant: true
  },
  {
    role: 'coordinator',
    label: 'Patient / Education Coordinator',
    description: 'Works only on assigned company leads and appointments.',
    scope: 'Assigned RWC, CRAS, or AHC company',
    modules: ['Live WhatsApp', 'Assigned Leads', 'Appointments', 'Marketing tasks'],
    actions: ['View assigned', 'Update status', 'Add notes'],
    requiresGrant: true
  },
  {
    role: 'marketing_admin',
    label: 'Marketing Administrator',
    description: 'Manages campaign drafts and marketing reporting for one company.',
    scope: 'Assigned company',
    modules: ['Marketing Dashboard', 'Campaigns', 'Reports'],
    actions: ['Manage drafts', 'View reports'],
    requiresGrant: true
  },
  {
    role: 'marketing_officer',
    label: 'Marketing Officer',
    description: 'Works on marketing contacts and assigned follow-up tasks.',
    scope: 'Assigned company',
    modules: ['Marketing Dashboard', 'My Marketing Tasks'],
    actions: ['View assigned', 'Update assigned'],
    requiresGrant: true
  },
  {
    role: 'exam_department_manager',
    label: 'Head of Exam Department',
    description: 'Accepts exam handoffs and assigns exam providing officers.',
    scope: 'Exam Department',
    modules: ['Exam Operations', 'Courses', 'Mock Tests', 'Question Bank'],
    actions: ['Accept handoff', 'Assign officer', 'Publish material']
  },
  {
    role: 'exam_coordinator',
    label: 'Exam Coordinator',
    description: 'Prepares and delivers assigned exam materials.',
    scope: 'Assigned exam work',
    modules: ['Exam Operations', 'Study Materials'],
    actions: ['Accept assignment', 'Update progress', 'Upload delivery']
  },
  {
    role: 'exam_providing_officer',
    label: 'Exam Providing Officer',
    description: 'Completes assigned exam preparation and delivery tasks.',
    scope: 'Assigned exam work',
    modules: ['Exam Operations', 'Question Bank', 'Mock Tests'],
    actions: ['Accept assignment', 'Update progress', 'Submit delivery']
  },
  {
    role: 'clinical_nurse',
    label: 'Clinical Nurse',
    description: 'Creates and manages assigned patient assessment records.',
    scope: 'Assigned patient records',
    modules: ['Patient Assessment'],
    actions: ['Create assessment', 'Upload consented files', 'Update nurse queue']
  },
  {
    role: 'clinical_doctor',
    label: 'Clinical Doctor',
    description: 'Reviews assigned clinical assessments and prepares reports.',
    scope: 'Assigned patient records',
    modules: ['Patient Assessment & Reports'],
    actions: ['Review assessment', 'Add clinical decision', 'Approve report']
  },
  {
    role: 'report_analyst',
    label: 'Report Analyst',
    description: 'Processes reports without access to unrelated CRM areas.',
    scope: 'Assigned patient reports',
    modules: ['Patient Assessment & Reports'],
    actions: ['Review draft', 'Return correction', 'Complete report']
  }
];

const MARKETING_ACCESS_ROLES: UserRole[] = ['coordinator', 'leads_officer', 'sales_coordinator', 'marketing_officer', 'marketing_admin'];

const PERMISSION_AREAS_BY_ROLE: Partial<Record<UserRole, PermissionArea[]>> = {
  super_admin: [...PERMISSION_AREA_OPTIONS],
  leads_officer: ['Leads', 'Leads Pipeline', 'Live WhatsApp', 'Contact Database', 'Dashboard & Analytics', 'Marketing', 'Marketing Contacts', 'Marketing Tasks'],
  sales_coordinator: ['Leads', 'Leads Pipeline', 'Live WhatsApp', 'Contact Database', 'Appointments', 'Marketing', 'Marketing Tasks'],
  coordinator: ['Leads', 'Leads Pipeline', 'Live WhatsApp', 'Appointments', 'Marketing', 'Marketing Tasks'],
  marketing_admin: ['Marketing', 'Marketing Contacts', 'Marketing Campaigns', 'Marketing Tasks', 'Marketing Reports'],
  marketing_officer: ['Marketing', 'Marketing Contacts', 'Marketing Tasks'],
  exam_department_manager: ['Exam', 'Exam Operations', 'Courses', 'Mock Tests', 'Study Materials', 'Question Bank', 'Student Database'],
  exam_coordinator: ['Exam', 'Exam Operations', 'Courses', 'Study Materials', 'Student Database'],
  exam_providing_officer: ['Exam', 'Exam Operations', 'Mock Tests', 'Study Materials', 'Question Bank'],
  clinical_nurse: ['Clinical', 'Patient Assessment'],
  clinical_doctor: ['Clinical', 'Patient Assessment', 'Clinical Reports'],
  report_analyst: ['Clinical', 'Clinical Reports']
};
const COMPANY_WIDE_ROLES: UserRole[] = [
  'super_admin',
  'leads_officer',
  'sales_coordinator',
  'exam_department_manager',
  'exam_coordinator',
  'exam_providing_officer'
];

const permissionTitleStorageKey = 'rw_crm_permission_titles';

const defaultAllowedCompaniesFor = (policy: RolePolicy): PermissionCompany[] =>
  COMPANY_WIDE_ROLES.includes(policy.role) ? [...PERMISSION_COMPANY_OPTIONS] : [];

const defaultPermissionTitles = (): PermissionTitle[] => ROLE_POLICIES.map(policy => ({
  id: `role-${policy.role}`,
  title: policy.label,
  description: policy.description,
  allowedCompanies: defaultAllowedCompaniesFor(policy),
  areas: PERMISSION_AREAS_BY_ROLE[policy.role] || [],
  role: policy.role,
  builtIn: true
}));

const loadPermissionTitles = (): PermissionTitle[] => {
  const defaults = defaultPermissionTitles();
  try {
    const stored = JSON.parse(localStorage.getItem(permissionTitleStorageKey) || 'null');
    if (!Array.isArray(stored)) return defaults;
    const valid = stored.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string') as PermissionTitle[];
    const savedById = new Map(valid.map(item => [item.id, item]));
    const mergedDefaults = defaults.map(item => ({ ...item, ...(savedById.get(item.id) || {}) }));
    const custom = valid.filter(item => !defaults.some(defaultItem => defaultItem.id === item.id)).map(item => ({ ...item, builtIn: false }));
    return [...mergedDefaults, ...custom];
  } catch {
    return defaults;
  }
};

const permissionAreasFor = (user: User, titles: PermissionTitle[] = defaultPermissionTitles()): PermissionArea[] => {
  const saved = titles.find(title => title.role === user.role);
  return saved?.areas?.length ? saved.areas : (PERMISSION_AREAS_BY_ROLE[user.role] || []);
};

const allowedCompanyFor = (user: User): string => {
  if (COMPANY_WIDE_ROLES.includes(user.role)) return 'RWC + CRAS + AHC';
  const company = String(user.company || '').toUpperCase();
  if (company === 'RWC' || company === 'CRAS' || company === 'AHC') return company;
  return 'Assigned company';
};

const matchesCompanyScope = (user: User, filter: CompanyScopeFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'shared') return COMPANY_WIDE_ROLES.includes(user.role);
  if (COMPANY_WIDE_ROLES.includes(user.role)) return true;
  return String(user.company || '').toUpperCase() === filter;
};

const roleLabel = (user: User, titles: PermissionTitle[] = defaultPermissionTitles()) =>
  titles.find(title => title.role === user.role)?.title || ROLE_POLICIES.find(policy => policy.role === user.role)?.label || user.role;

const MultiSelectDropdown: React.FC<{
  label: string;
  options: readonly string[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}> = ({ label, options, values, onChange, placeholder }) => {
  const toggle = (option: string) => onChange(values.includes(option) ? values.filter(value => value !== option) : [...values, option]);
  const summary = values.length === 0 ? placeholder : values.length === options.length ? 'All selected' : values.join(', ');
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white marker:hidden">
        <span className="truncate"><span className="mr-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </summary>
      <div className="absolute z-20 mt-2 w-full min-w-[220px] rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-2xl">
        <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
          <button type="button" onClick={() => onChange([...options])} className="text-indigo-300 hover:text-indigo-200">Select all</button>
          <button type="button" onClick={() => onChange([])} className="text-slate-400 hover:text-white">Clear</button>
        </div>
        <div className="space-y-1.5">
          {options.map(option => (
            <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
              <input type="checkbox" checked={values.includes(option)} onChange={() => toggle(option)} className="accent-indigo-500" />
              {option}
            </label>
          ))}
        </div>
      </div>
    </details>
  );
};
export const SecurityAccessView: React.FC = () => {
  const { currentUser, users, isSuperAdmin } = useCrm();
  const [section, setSection] = useState<AccessSection>('roles');
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState<CompanyScopeFilter>('all');
  const [areaFilter, setAreaFilter] = useState<'all' | PermissionArea>('all');
  const [accessByUserId, setAccessByUserId] = useState<Record<string, boolean>>({});
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [permissionTitles, setPermissionTitles] = useState<PermissionTitle[]>(loadPermissionTitles);
  const [permissionEditor, setPermissionEditor] = useState<PermissionTitleDraft | null>(null);

  useEffect(() => {
    setAccessByUserId(Object.fromEntries(users.map(user => [user.id, user.marketingAccess === true])));
  }, [users]);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users
      .filter(user => user.role !== ('student' as UserRole))
      .filter(user => !query || user.fullName.toLowerCase().includes(query) || user.email.toLowerCase().includes(query) || user.role.toLowerCase().includes(query))
      .filter(user => matchesCompanyScope(user, companyFilter))
      .filter(user => areaFilter === 'all' || permissionAreasFor(user, permissionTitles).includes(areaFilter))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [users, search, companyFilter, areaFilter, permissionTitles]);

  const persistPermissionTitles = (next: PermissionTitle[]) => {
    setPermissionTitles(next);
    localStorage.setItem(permissionTitleStorageKey, JSON.stringify(next));
  };

  const openNewPermissionTitle = () => {
    setPermissionEditor({ title: '', description: '', allowedCompanies: [], areas: [] });
    setMessage(null);
  };

  const openPermissionTitleEditor = (title: PermissionTitle) => {
    setPermissionEditor({
      id: title.id,
      title: title.title,
      description: title.description,
      allowedCompanies: [...title.allowedCompanies],
      areas: [...title.areas],
      role: title.role,
      builtIn: title.builtIn
    });
    setMessage(null);
  };

  const savePermissionTitle = () => {
    if (!permissionEditor?.title.trim()) {
      setMessage({ type: 'error', text: 'Permission title is required.' });
      return;
    }
    if (!permissionEditor.areas.length) {
      setMessage({ type: 'error', text: 'Select at least one permission area.' });
      return;
    }
    const existingId = permissionEditor.id;
    const record: PermissionTitle = {
      id: existingId || `custom-${Date.now()}`,
      title: permissionEditor.title.trim(),
      description: permissionEditor.description.trim(),
      allowedCompanies: [...permissionEditor.allowedCompanies],
      areas: [...permissionEditor.areas],
      role: permissionEditor.role,
      builtIn: Boolean(permissionEditor.builtIn)
    };
    const next = existingId ? permissionTitles.map(item => item.id === existingId ? record : item) : [...permissionTitles, record];
    persistPermissionTitles(next);
    setPermissionEditor(null);
    setMessage({ type: 'success', text: `${record.title} permission title saved.` });
  };

  const removePermissionTitle = (title: PermissionTitle) => {
    if (title.builtIn) {
      setMessage({ type: 'error', text: 'Built-in role permissions cannot be removed. Create a custom permission title instead.' });
      return;
    }
    if (!window.confirm(`Remove the permission title “${title.title}”?`)) return;
    persistPermissionTitles(permissionTitles.filter(item => item.id !== title.id));
    setMessage({ type: 'success', text: `${title.title} permission title removed.` });
  };

  const updateMarketingAccess = async (user: User) => {
    if (!MARKETING_ACCESS_ROLES.includes(user.role) || updatingUserId) return;
    const authorized = !Boolean(accessByUserId[user.id]);
    setUpdatingUserId(user.id);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/marketing/staff/${encodeURIComponent(user.id)}/access`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rw_crm_auth_token') || ''}`
        },
        body: JSON.stringify({ authorized })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || result.error || 'Unable to update marketing access.');
      }
      setAccessByUserId(previous => ({ ...previous, [user.id]: authorized }));
      setMessage({ type: 'success', text: `${user.fullName} marketing access ${authorized ? 'granted' : 'revoked'}.` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Unable to update access.' });
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (!isSuperAdmin || currentUser?.role !== 'super_admin') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-3xl border border-rose-500/30 bg-slate-900 p-8 text-center shadow-2xl">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-rose-400" />
          <h2 className="text-xl font-bold text-white">Security area restricted</h2>
          <p className="mt-2 text-sm text-slate-400">Only an active Super Admin can view or change access permissions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto pb-10 pr-1">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-3 text-indigo-300"><ShieldCheck className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">Security &amp; Access</h1>
          <p className="mt-1 text-sm text-slate-400">Permission titles, company scope, area selection, and individual marketing access.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <LockKeyhole className="h-4 w-4" /> Server-enforced RBAC
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"><p className="text-xs text-slate-500">Active staff</p><p className="mt-1 text-2xl font-bold text-white">{users.filter(user => user.active !== false).length}</p></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"><p className="text-xs text-slate-500">Permission titles</p><p className="mt-1 text-2xl font-bold text-white">{permissionTitles.length}</p></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"><p className="text-xs text-slate-500">Marketing enabled</p><p className="mt-1 text-2xl font-bold text-teal-300">{users.filter(user => accessByUserId[user.id]).length}</p></div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-2">
        <button type="button" onClick={() => setSection('roles')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${section === 'roles' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><ShieldCheck className="mr-2 inline h-4 w-4" />Role permissions</button>
        <button type="button" onClick={() => setSection('users')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${section === 'users' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Users className="mr-2 inline h-4 w-4" />User access</button>
      </div>

      {message && <div className={`rounded-xl border p-3 text-sm ${message.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>{message.text}</div>}

      {section === 'roles' ? (
          <>
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {ROLE_POLICIES.map(policy => (
            <article key={policy.role} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-base font-bold text-white">{permissionTitles.find(title => title.role === policy.role)?.title || policy.label}</h2><p className="mt-1 text-xs text-slate-400">{permissionTitles.find(title => title.role === policy.role)?.description || policy.description}</p></div>
                <span className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-200">{policy.role}</span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-300"><Building2 className="h-4 w-4 text-teal-300" />{policy.scope}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">{(permissionTitles.find(title => title.role === policy.role)?.areas || PERMISSION_AREAS_BY_ROLE[policy.role] || []).map(area => <span key={area} className="rounded-lg bg-indigo-500/10 px-2 py-1 text-[11px] text-indigo-200">{area}</span>)}</div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Modules</p><div className="mt-2 flex flex-wrap gap-1.5">{policy.modules.map(module => <span key={module} className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] text-slate-200">{module}</span>)}</div></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Actions</p><div className="mt-2 flex flex-wrap gap-1.5">{policy.actions.map(action => <span key={action} className="rounded-lg bg-teal-500/10 px-2 py-1 text-[11px] text-teal-200">{action}</span>)}</div></div>
              </div>
              {policy.requiresGrant && <p className="mt-4 flex items-center gap-1.5 text-[11px] text-amber-200"><Info className="h-3.5 w-3.5" />Requires the individual Marketing Access grant in the User Access tab.</p>}
            </article>
          ))}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div><h2 className="text-lg font-bold text-white">Permission titles</h2><p className="mt-1 text-xs text-slate-400">Add, edit, or remove permission titles and choose their allowed companies and access areas.</p></div>
              <button type="button" onClick={openNewPermissionTitle} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-400"><Plus className="h-4 w-4" />Add permission title</button>
            </div>
            <div className="mt-4 space-y-2">
              {permissionTitles.map(title => (
                <div key={title.id} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-white">{title.title}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${title.builtIn ? 'bg-slate-800 text-slate-300' : 'bg-indigo-500/15 text-indigo-200'}`}>{title.builtIn ? 'Built-in role' : 'Custom title'}</span></div><p className="mt-1 text-xs text-slate-500">{title.description || 'No description added.'}</p></div>
                  <div className="flex flex-wrap items-center gap-1.5">{title.allowedCompanies.length ? title.allowedCompanies.map(company => <span key={company} className="rounded-lg bg-indigo-500/10 px-2 py-1 text-[11px] text-indigo-200">{company}</span>) : <span className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] text-slate-300">Assigned company</span>}{title.areas.map(area => <span key={area} className="rounded-lg bg-teal-500/10 px-2 py-1 text-[11px] text-teal-200">{area}</span>)}</div>
                  <div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => openPermissionTitleEditor(title)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-indigo-400 hover:text-white"><Pencil className="h-3.5 w-3.5" />Edit</button><button type="button" onClick={() => removePermissionTitle(title)} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${title.builtIn ? 'cursor-not-allowed border-slate-800 text-slate-600' : 'border-rose-500/30 text-rose-200 hover:bg-rose-500/10'}`}><Trash2 className="h-3.5 w-3.5" />Remove</button></div>
                </div>
              ))}
            </div>
          </section>
          </>
      ) : (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-[minmax(220px,1fr)_190px_240px]"><div className="relative"><UserCog className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search staff or role" className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-indigo-400" /></div><select value={companyFilter} onChange={event => setCompanyFilter(event.target.value as CompanyScopeFilter)} aria-label="Filter by allowed company" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"><option value="all">All allowed companies</option><option value="RWC">RWC only</option><option value="CRAS">CRAS only</option><option value="AHC">AHC only</option><option value="shared">All three companies</option></select><select value={areaFilter} onChange={event => setAreaFilter(event.target.value as 'all' | PermissionArea)} aria-label="Filter by permission area" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"><option value="all">All permission areas</option>{PERMISSION_AREA_OPTIONS.map(area => <option key={area} value={area}>{area}</option>)}</select></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">User</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Allowed company</th><th className="px-3 py-3">Permission area</th><th className="px-3 py-3">Account</th><th className="px-3 py-3 text-right">Marketing access</th></tr></thead><tbody>{visibleUsers.map(user => { const canToggle = MARKETING_ACCESS_ROLES.includes(user.role); const granted = Boolean(accessByUserId[user.id]); const areas = permissionAreasFor(user, permissionTitles); return <tr key={user.id} className="border-b border-slate-900"><td className="px-3 py-3"><div className="font-semibold text-white">{user.fullName}</div><div className="text-xs text-slate-500">{user.email}</div></td><td className="px-3 py-3"><span className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200">{roleLabel(user, permissionTitles)}</span></td><td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/20 bg-indigo-500/10 px-2 py-1 text-xs text-indigo-100"><Building2 className="h-3.5 w-3.5 text-indigo-300" />{allowedCompanyFor(user)}</span></td><td className="px-3 py-3"><div className="flex max-w-[240px] flex-wrap gap-1.5">{areas.length ? areas.map(area => <span key={area} className="rounded-lg bg-teal-500/10 px-2 py-1 text-[11px] text-teal-200">{area}</span>) : <span className="text-xs text-slate-500">Role controlled</span>}</div></td><td className="px-3 py-3">{user.active === false ? <span className="inline-flex items-center gap-1 text-xs text-rose-300"><XCircle className="h-3.5 w-3.5" />Inactive</span> : <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Active</span>}</td><td className="px-3 py-3 text-right">{canToggle ? <button type="button" disabled={user.active === false || updatingUserId === user.id} onClick={() => void updateMarketingAccess(user)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${granted ? 'border-teal-400/40 bg-teal-500/15 text-teal-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-indigo-400 hover:text-white'}`}>{updatingUserId === user.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : granted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{granted ? 'Granted' : 'Grant access'}</button> : <span className="text-xs text-slate-500">Role controlled</span>}</td></tr>; })}</tbody></table></div>
          {!visibleUsers.length && <p className="py-8 text-center text-sm text-slate-500">No matching staff accounts.</p>}
        </section>
      )}

      {permissionEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div><h2 className="text-lg font-bold text-white">{permissionEditor.id ? 'Edit permission title' : 'Add permission title'}</h2><p className="mt-1 text-xs text-slate-400">Choose the allowed companies and access areas for this permission title.</p></div>
              <button type="button" onClick={() => setPermissionEditor(null)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white">×</button>
            </div>
            <div className="mt-4 space-y-4">
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Permission title *</span><input value={permissionEditor.title} onChange={event => setPermissionEditor(previous => previous ? { ...previous, title: event.target.value } : previous)} placeholder="e.g. Exam Content Reviewer" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Description</span><textarea value={permissionEditor.description} onChange={event => setPermissionEditor(previous => previous ? { ...previous, description: event.target.value } : previous)} rows={3} placeholder="Describe what this permission title is allowed to do." className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400" /></label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MultiSelectDropdown label="Allowed companies" options={PERMISSION_COMPANY_OPTIONS} values={permissionEditor.allowedCompanies} onChange={values => setPermissionEditor(previous => previous ? { ...previous, allowedCompanies: values as PermissionCompany[] } : previous)} placeholder="Assigned company" />
                <MultiSelectDropdown label="Permission areas" options={PERMISSION_AREA_OPTIONS} values={permissionEditor.areas} onChange={values => setPermissionEditor(previous => previous ? { ...previous, areas: values as PermissionArea[] } : previous)} placeholder="Select areas" />
              </div>
              {permissionEditor.builtIn && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100">This is a built-in backend role. You can update its title and catalogue areas here, but the server’s verified role remains the enforcement authority.</div>}
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-800 pt-4"><button type="button" onClick={() => setPermissionEditor(null)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button><button type="button" onClick={savePermissionTitle} className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">Save permission</button></div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/5 p-4 text-xs text-indigo-100"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" /><p><strong>Security rule:</strong> permissions are enforced by the backend using the user’s verified role. This page never displays passwords or PINs. Company-scoped users are limited to their assigned RWC, CRAS, or AHC company; cross-company roles are explicitly marked. Permission-title edits are saved as the Super Admin catalogue; custom server roles are required before a new title can grant backend access.</p></div></div>
    </div>
  );
};

