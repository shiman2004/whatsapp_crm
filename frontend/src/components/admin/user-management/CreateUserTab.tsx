import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { SectionCard } from '../../ui';
import { userManagementApi, ROLE_OPTIONS, COMPANY_OPTIONS, type Department, type ManagedUser } from './api';
import { ErrorNote, Field, PrimaryButton, RoleBadge, inputClass } from './bits';

const ROLE_HOME: Record<string, { company: boolean; branch: string; departmentHint: string }> = {
  super_admin: { company: true, branch: 'Colombo (Head Office)', departmentHint: 'Administration' },
  coordinator: { company: true, branch: 'Colombo', departmentHint: 'CRM' },
  leads_officer: { company: true, branch: 'Colombo', departmentHint: 'CRM' },
  sales_coordinator: { company: true, branch: 'Colombo', departmentHint: 'CRM' },
  exam_department_manager: { company: false, branch: 'Colombo', departmentHint: 'Exam Department' },
  exam_coordinator: { company: false, branch: 'Colombo', departmentHint: 'Exam Department' },
  exam_providing_officer: { company: false, branch: 'Colombo', departmentHint: 'Exam Department' },
  marketing_officer: { company: true, branch: 'Colombo', departmentHint: 'Public Contact Marketing' },
  marketing_admin: { company: true, branch: 'Colombo', departmentHint: 'Public Contact Marketing' },
  clinical_nurse: { company: false, branch: 'Colombo', departmentHint: 'Clinical' },
  clinical_doctor: { company: false, branch: 'Colombo', departmentHint: 'Clinical' },
  report_analyst: { company: false, branch: 'Colombo', departmentHint: 'Clinical' },
};

const EMPTY = {
  fullName: '', email: '', phone: '', role: 'coordinator', company: 'RWC', branch: 'Colombo',
  employeeId: '', departmentId: '', managerId: '', marketingAccess: false, password: '', pin: '', active: true,
};

export const CreateUserTab: React.FC<{
  departments: Department[];
  managers: { id: string; fullName: string; role: string }[];
  onCreated: () => void;
  onNotify: (title: string, message: string, tone?: 'success' | 'warning' | 'info') => void;
}> = ({ departments, managers, onCreated, onNotify }) => {
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ManagedUser | null>(null);

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await userManagementApi.createUser({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        company: form.company,
        branch: form.branch,
        employeeId: form.employeeId.trim() || undefined,
        departmentId: form.departmentId || null,
        managerId: form.managerId || null,
        marketingAccess: form.marketingAccess,
        password: form.password,
        pin: form.pin || undefined,
        active: form.active,
      });
      setCreated(result);
      setForm({ ...EMPTY });
      onCreated();
      onNotify('User created', `${result.fullName} can sign in with the password you set.`, 'success');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The account could not be created.');
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <SectionCard title="Account created" description="The new account is active and visible in the directory.">
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-4">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{created.fullName}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">{created.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <RoleBadge role={created.role} label={created.roleLabel} />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{created.company} · {created.branch || 'No branch'}</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Share the password through your normal secure channel. It is never displayed again.
            </p>
          </div>
          <div>
            <PrimaryButton onClick={() => setCreated(null)}><UserPlus className="h-3.5 w-3.5" /> Create another user</PrimaryButton>
          </div>
        </div>
      </SectionCard>
    );
  }

  const home = ROLE_HOME[form.role] || ROLE_HOME.coordinator;

  return (
    <SectionCard title="Create user" description="Creates a real, immediately usable account. The server validates every field and enforces company and department boundaries.">
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={submit}>
        {error && <div className="sm:col-span-2"><ErrorNote message={error} /></div>}
        <Field label="Full name" required>
          <input className={inputClass} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required maxLength={255} autoComplete="off" />
        </Field>
        <Field label="Email" required hint="Must be unique; used to sign in.">
          <input type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} required autoComplete="off" />
        </Field>
        <Field label="Phone">
          <input className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={50} autoComplete="off" />
        </Field>
        <Field label="Employee ID" hint="Optional, unique when set.">
          <input className={inputClass} value={form.employeeId} onChange={(e) => set('employeeId', e.target.value)} maxLength={50} />
        </Field>
        <Field label="Role" required>
          <select
            className={inputClass}
            value={form.role}
            onChange={(e) => {
              const role = e.target.value;
              const nextHome = ROLE_HOME[role] || ROLE_HOME.coordinator;
              setForm((current) => ({
                ...current,
                role,
                branch: nextHome.branch,
                departmentId: '',
                marketingAccess: role.startsWith('marketing') ? true : current.marketingAccess,
              }));
            }}
          >
            {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>)}
          </select>
          <span className="mt-1 block text-[10px] text-slate-400 dark:text-slate-500">Suggested department: {home.departmentHint}</span>
        </Field>
        <Field label="Company" hint={home.company ? 'Required for this role.' : 'Not used by this role’s scope.'}>
          <select className={inputClass} value={form.company} onChange={(e) => set('company', e.target.value)} disabled={!home.company}>
            {COMPANY_OPTIONS.map((company) => <option key={company} value={company}>{company}</option>)}
          </select>
        </Field>
        <Field label="Branch" required>
          <input className={inputClass} value={form.branch} onChange={(e) => set('branch', e.target.value)} maxLength={100} required />
        </Field>
        <Field label="Department">
          <select className={inputClass} value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
            <option value="">Unassigned</option>
            {departments.filter((department) => department.active).map((department) => (
              <option key={department.id} value={department.id}>{department.name}{department.company ? ` · ${department.company}` : ''}</option>
            ))}
          </select>
        </Field>
        <Field label="Reporting manager">
          <select className={inputClass} value={form.managerId} onChange={(e) => set('managerId', e.target.value)}>
            <option value="">None</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>{manager.fullName} · {manager.role.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </Field>
        <Field label="Initial password" required hint="Minimum 12 characters. Stored as a salted scrypt hash.">
          <input
            type="password"
            className={inputClass}
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            minLength={12}
            required
            autoComplete="new-password"
          />
        </Field>
        <Field label="PIN" hint="Optional 4–10 characters for PIN sign-in.">
          <input type="password" className={inputClass} value={form.pin} onChange={(e) => set('pin', e.target.value)} minLength={4} maxLength={10} autoComplete="new-password" />
        </Field>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            checked={form.marketingAccess}
            onChange={(e) => set('marketingAccess', e.target.checked)}
          />
          Public contact marketing access
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            checked={form.active}
            onChange={(e) => set('active', e.target.checked)}
          />
          Active immediately
        </label>
        <div className="sm:col-span-2">
          <PrimaryButton type="submit" disabled={busy}>
            <UserPlus className="h-3.5 w-3.5" /> {busy ? 'Creating…' : 'Create user'}
          </PrimaryButton>
        </div>
      </form>
    </SectionCard>
  );
};
