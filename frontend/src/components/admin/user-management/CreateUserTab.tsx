import React, { useState } from 'react';
import { UserPlus, Shield, Eye, EyeOff, Sparkles, Building2, MapPin, KeyRound, Lock } from 'lucide-react';
import { SectionCard } from '../../ui';
import { userManagementApi, ROLE_OPTIONS, COMPANY_OPTIONS, type Department, type ManagedUser } from './api';
import { ErrorNote, Field, PrimaryButton, RoleBadge, CompanyBadge, inputClass } from './bits';

const ROLE_HOME: Record<string, { company: boolean; defaultCompany: string; branch: string; departmentHint: string }> = {
  super_admin: { company: true, defaultCompany: 'ALL', branch: 'All Branches (Global)', departmentHint: 'Administration' },
  coordinator: { company: true, defaultCompany: 'RWC', branch: 'Colombo', departmentHint: 'CRM' },
  leads_officer: { company: true, defaultCompany: 'ALL', branch: 'Colombo (Head Office)', departmentHint: 'CRM' },
  sales_coordinator: { company: true, defaultCompany: 'RWC', branch: 'Colombo', departmentHint: 'CRM' },
  exam_department_manager: { company: false, defaultCompany: 'CRAS', branch: 'Colombo', departmentHint: 'Exam Department' },
  exam_coordinator: { company: false, defaultCompany: 'CRAS', branch: 'Colombo', departmentHint: 'Exam Department' },
  exam_providing_officer: { company: false, defaultCompany: 'CRAS', branch: 'Colombo', departmentHint: 'Exam Department' },
  marketing_officer: { company: true, defaultCompany: 'ALL', branch: 'Colombo', departmentHint: 'Public Contact Marketing' },
  marketing_admin: { company: true, defaultCompany: 'ALL', branch: 'Colombo', departmentHint: 'Public Contact Marketing' },
  clinical_nurse: { company: false, defaultCompany: 'RWC', branch: 'Colombo', departmentHint: 'Clinical' },
  clinical_doctor: { company: false, defaultCompany: 'RWC', branch: 'Colombo', departmentHint: 'Clinical' },
  report_analyst: { company: false, defaultCompany: 'RWC', branch: 'Colombo', departmentHint: 'Clinical' },
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
  const [showPassword, setShowPassword] = useState(false);

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const isSuperAdmin = form.role === 'super_admin';

  const applySuperAdminPreset = () => {
    setForm(current => ({
      ...current,
      role: 'super_admin',
      company: 'ALL',
      branch: 'All Branches (Global)',
      marketingAccess: true,
      active: true,
    }));
  };

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
      <SectionCard title="Account created successfully" description="The new staff account is active and visible in the directory.">
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                {created.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-base font-bold text-slate-900 dark:text-slate-100">{created.fullName}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">{created.email}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/80 dark:border-white/10">
              <RoleBadge role={created.role} label={created.roleLabel} />
              <CompanyBadge company={created.company} />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">📍 {created.branch || 'All Branches'}</span>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Share the initial credentials through your authorized secure channel. Passwords and PINs are stored as salted hashes and never displayed again.
            </p>
          </div>
          <div className="pt-2">
            <PrimaryButton onClick={() => setCreated(null)}>
              <UserPlus className="h-3.5 w-3.5" /> Create another staff account
            </PrimaryButton>
          </div>
        </div>
      </SectionCard>
    );
  }

  const home = ROLE_HOME[form.role] || ROLE_HOME.coordinator;

  return (
    <div className="space-y-4">
      {/* Super Admin Quick Setup Pill / Notice */}
      <div className="rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-emerald-500/10 to-teal-500/10 p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Super Admin Executive Account</h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">Unrestricted executive authority over All Companies (RWC, CRAS, AHC) and All Branches.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={applySuperAdminPreset}
          className="px-3 py-1.5 rounded-lg border border-purple-500/40 bg-purple-600 text-white hover:bg-purple-700 text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
        >
          👑 Apply Super Admin Preset
        </button>
      </div>

      <SectionCard
        title="Create staff account"
        description="Provision an immediately usable account with server-enforced role, company, and branch scopes."
      >
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={submit}>
          {error && <div className="sm:col-span-2"><ErrorNote message={error} /></div>}

          {/* Full Name */}
          <Field label="Full name" required>
            <input
              className={inputClass}
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              placeholder="e.g. Dr. John Doe, Sarah Coordinator"
              required
              maxLength={255}
              autoComplete="off"
            />
          </Field>

          {/* Email */}
          <Field label="Corporate email" required hint="Must be unique; used to sign in to the CRM.">
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="staff@royalwellness.lk"
              required
              autoComplete="off"
            />
          </Field>

          {/* Phone */}
          <Field label="Phone number">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+94 7X XXX XXXX"
              maxLength={50}
              autoComplete="off"
            />
          </Field>

          {/* Employee ID */}
          <Field label="Employee ID" hint="Optional unique staff identifier.">
            <input
              className={inputClass}
              value={form.employeeId}
              onChange={(e) => set('employeeId', e.target.value)}
              placeholder="EMP-1001"
              maxLength={50}
            />
          </Field>

          {/* Role */}
          <Field label="System role" required>
            <select
              className={inputClass}
              value={form.role}
              onChange={(e) => {
                const role = e.target.value;
                const nextHome = ROLE_HOME[role] || ROLE_HOME.coordinator;
                setForm((current) => ({
                  ...current,
                  role,
                  company: nextHome.defaultCompany || current.company,
                  branch: nextHome.branch,
                  departmentId: '',
                  marketingAccess: role.startsWith('marketing') || role === 'super_admin' ? true : current.marketingAccess,
                }));
              }}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role === 'super_admin' ? '👑 Super Admin (Executive All Scope)' : role.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] text-slate-400 dark:text-slate-500">
              Suggested department: {home.departmentHint}
            </span>
          </Field>

          {/* Company Scope (supports ALL) */}
          <Field
            label="Company scope"
            hint={isSuperAdmin ? 'Executive access to all three corporate entities.' : 'Required company assignment.'}
          >
            <select
              className={inputClass}
              value={form.company}
              onChange={(e) => set('company', e.target.value)}
            >
              <option value="ALL">✨ ALL (All Companies — Alpha Health Group)</option>
              <option value="RWC">🌿 RWC (Royal Wellness Center)</option>
              <option value="CRAS">🎓 CRAS (College of Royal Aesthetic Studies)</option>
              <option value="AHC">✦ AHC (Alpha Health Consultancy)</option>
            </select>
          </Field>

          {/* Branch Scope */}
          <Field label="Branch assignment" required>
            <div className="space-y-1.5">
              <input
                className={inputClass}
                value={form.branch}
                onChange={(e) => set('branch', e.target.value)}
                placeholder="e.g. All Branches (Global), Colombo (Head Office)"
                maxLength={100}
                required
              />
              <div className="flex flex-wrap gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => set('branch', 'All Branches (Global)')}
                  className="px-2 py-0.5 rounded border border-slate-200 dark:border-[#222D34] hover:bg-slate-100 dark:hover:bg-[#2A3942] text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  🌐 All Branches (Global)
                </button>
                <button
                  type="button"
                  onClick={() => set('branch', 'Colombo (Head Office)')}
                  className="px-2 py-0.5 rounded border border-slate-200 dark:border-[#222D34] hover:bg-slate-100 dark:hover:bg-[#2A3942] text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Colombo (Head Office)
                </button>
                <button
                  type="button"
                  onClick={() => set('branch', 'Kandy Branch')}
                  className="px-2 py-0.5 rounded border border-slate-200 dark:border-[#222D34] hover:bg-slate-100 dark:hover:bg-[#2A3942] text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Kandy Branch
                </button>
              </div>
            </div>
          </Field>

          {/* Department */}
          <Field label="Department">
            <select
              className={inputClass}
              value={form.departmentId}
              onChange={(e) => set('departmentId', e.target.value)}
            >
              <option value="">Unassigned</option>
              {departments.filter((department) => department.active).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}{department.company ? ` · ${department.company}` : ''}
                </option>
              ))}
            </select>
          </Field>

          {/* Reporting Manager */}
          <Field label="Reporting manager">
            <select
              className={inputClass}
              value={form.managerId}
              onChange={(e) => set('managerId', e.target.value)}
            >
              <option value="">None (Independent / Executive)</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.fullName} · {manager.role.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </Field>

          {/* Initial Password */}
          <Field label="Initial password" required hint="Minimum 12 characters. Stored as salted scrypt hash.">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className={inputClass}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="Enter secure initial password"
                minLength={12}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          {/* PIN */}
          <Field label="Quick sign-in PIN" hint="Optional 4–10 digits for fast login keypad.">
            <input
              type="password"
              className={inputClass}
              value={form.pin}
              onChange={(e) => set('pin', e.target.value)}
              placeholder="e.g. 1234"
              minLength={4}
              maxLength={10}
              autoComplete="new-password"
            />
          </Field>

          {/* Checkbox Options */}
          <div className="sm:col-span-2 pt-2 flex flex-wrap gap-6 border-t border-slate-100 dark:border-[#222D34]">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                checked={form.marketingAccess}
                onChange={(e) => set('marketingAccess', e.target.checked)}
              />
              <span>Public contact marketing access</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                checked={form.active}
                onChange={(e) => set('active', e.target.checked)}
              />
              <span>Activate account immediately</span>
            </label>
          </div>

          <div className="sm:col-span-2 pt-2">
            <PrimaryButton type="submit" disabled={busy} className="w-full sm:w-auto h-10 px-6 text-sm">
              <UserPlus className="h-4 w-4" /> {busy ? 'Creating Account…' : 'Create Staff Account'}
            </PrimaryButton>
          </div>
        </form>
      </SectionCard>
    </div>
  );
};
