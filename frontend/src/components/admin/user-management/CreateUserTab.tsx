import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Shield,
  Eye,
  EyeOff,
  Sparkles,
  Building2,
  MapPin,
  KeyRound,
  Lock,
  ArrowLeft,
  Mail,
  Phone,
  User,
  CreditCard,
  Briefcase,
  Layers,
  UserCheck,
  RotateCw,
  Info,
  Check,
  CheckCircle2,
  Copy,
  Settings,
  X,
  HelpCircle,
  FileBadge
} from 'lucide-react';
import { userManagementApi, ROLE_OPTIONS, COMPANY_OPTIONS, type Department, type ManagedUser } from './api';

const ROLE_HOME: Record<string, { company: boolean; defaultCompany: string; branch: string; departmentHint: string; defaultTitle: string }> = {
  super_admin: { company: true, defaultCompany: 'ALL', branch: 'All Branches (Global)', departmentHint: 'Administration', defaultTitle: 'Executive Super Admin' },
  coordinator: { company: true, defaultCompany: 'RWC', branch: 'Colombo', departmentHint: 'CRM', defaultTitle: 'Patient Coordinator' },
  leads_officer: { company: true, defaultCompany: 'ALL', branch: 'Colombo (Head Office)', departmentHint: 'CRM', defaultTitle: 'Leads Intake Officer' },
  sales_coordinator: { company: true, defaultCompany: 'RWC', branch: 'Colombo', departmentHint: 'CRM', defaultTitle: 'Sales Coordinator' },
  exam_department_manager: { company: false, defaultCompany: 'CRAS', branch: 'Colombo', departmentHint: 'Exam Department', defaultTitle: 'Exam Department Manager' },
  exam_coordinator: { company: false, defaultCompany: 'CRAS', branch: 'Colombo', departmentHint: 'Exam Department', defaultTitle: 'Academic Exam Coordinator' },
  exam_providing_officer: { company: false, defaultCompany: 'CRAS', branch: 'Colombo', departmentHint: 'Exam Department', defaultTitle: 'Exam Providing Officer' },
  finance_officer: { company: true, defaultCompany: 'ALL', branch: 'Colombo (Head Office)', departmentHint: 'Finance', defaultTitle: 'Finance Officer' },
  marketing_officer: { company: true, defaultCompany: 'ALL', branch: 'Colombo', departmentHint: 'Public Contact Marketing', defaultTitle: 'Marketing Outreach Officer' },
  marketing_admin: { company: true, defaultCompany: 'ALL', branch: 'Colombo', departmentHint: 'Public Contact Marketing', defaultTitle: 'Marketing Administrator' },
  clinical_nurse: { company: false, defaultCompany: 'RWC', branch: 'Colombo', departmentHint: 'Clinical', defaultTitle: 'Clinical Registered Nurse' },
  clinical_doctor: { company: false, defaultCompany: 'RWC', branch: 'Colombo', departmentHint: 'Clinical', defaultTitle: 'Aesthetic Physician' },
  report_analyst: { company: false, defaultCompany: 'RWC', branch: 'Colombo', departmentHint: 'Clinical', defaultTitle: 'Clinical Report Analyst' },
};

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  super_admin: 'Super Admin',
  coordinator: 'Coordinator',
  leads_officer: 'Leads Intake Officer',
  sales_coordinator: 'Sales Coordinator',
  exam_department_manager: 'Exam Department Manager',
  exam_coordinator: 'Academic Exam Coordinator',
  exam_providing_officer: 'Exam Providing Officer',
  finance_officer: 'Finance Officer',
  marketing_officer: 'Marketing Officer',
  marketing_admin: 'Marketing Administrator',
  clinical_nurse: 'Clinical Nurse',
  clinical_doctor: 'Clinical Doctor',
  report_analyst: 'Report Analyst'
};

const COMPANY_DISPLAY_NAMES: Record<string, string> = {
  RWC: 'RWC (Royal Wellness Center)',
  CRAS: 'CRAS (CRAS College)',
  AHC: 'AHC (Alpha Health Group)',
  ALL: 'ALL (All Companies / Global)'
};

function generateSecurePassword(length = 16): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*_+~';
  const all = upper + lower + digits + symbols;

  const pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  for (let i = pwd.length; i < length; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }
  return pwd.sort(() => Math.random() - 0.5).join('');
}

function generateSecurePin(length = 6): string {
  let pin = '';
  for (let i = 0; i < length; i++) {
    pin += Math.floor(Math.random() * 10).toString();
  }
  return pin;
}

export interface CreateUserTabProps {
  departments: Department[];
  managers: { id: string; fullName: string; role: string }[];
  onCreated: () => void;
  onNotify: (title: string, message: string, tone?: 'success' | 'warning' | 'info') => void;
  onCancel?: () => void;
}

export const CreateUserTab: React.FC<CreateUserTabProps> = ({
  departments,
  managers,
  onCreated,
  onNotify,
  onCancel
}) => {
  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('EMP-1001');
  const [role, setRole] = useState('coordinator');
  const [company, setCompany] = useState('RWC');
  const [branch, setBranch] = useState('Colombo');
  const [departmentId, setDepartmentId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [jobTitle, setJobTitle] = useState('Operations Coordinator');

  // Options
  const [activateImmediately, setActivateImmediately] = useState(true);
  const [marketingAccess, setMarketingAccess] = useState(false);
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);

  // Credentials Mode: 'auto' | 'custom'
  const [credMode, setCredMode] = useState<'auto' | 'custom'>('auto');
  const [password, setPassword] = useState(() => generateSecurePassword(16));
  const [pin, setPin] = useState(() => generateSecurePin(6));
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Submission & UI States
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ user: ManagedUser; initialPass: string; initialPin: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync role defaults
  useEffect(() => {
    const home = ROLE_HOME[role];
    if (home) {
      if (home.defaultCompany) setCompany(home.defaultCompany);
      if (home.branch) setBranch(home.branch);
      if (home.defaultTitle) setJobTitle(home.defaultTitle);
    }
  }, [role]);

  // Handle regeneration
  const handleRegeneratePassword = () => {
    const newPass = generateSecurePassword(16);
    setPassword(newPass);
    onNotify?.('Password Regenerated', 'Generated new high-entropy initial web password.', 'info');
  };

  const handleRegeneratePin = () => {
    const newPin = generateSecurePin(6);
    setPin(newPin);
    onNotify?.('PIN Code Regenerated', 'Generated new random 6-digit login PIN.', 'info');
  };

  const handleCopyCredentials = () => {
    if (!created) return;
    const text = [
      `🔐 Royal Wellness & CRAS CRM Staff Account Credentials`,
      `👤 Name: ${created.user.fullName}`,
      `📧 Email: ${created.user.email}`,
      `🏢 Company: ${created.user.company}`,
      `📍 Branch: ${created.user.branch || 'Colombo'}`,
      `🛡️ Role: ${created.user.roleLabel || created.user.role}`,
      `🔑 Web Password: ${created.initialPass}`,
      created.initialPin ? `🔢 PIN Code: ${created.initialPin}` : null,
      `🌐 Portal: ${window.location.origin}/#/login`,
      `⚠️ Note: Stored as secure salted hashes. Please save these credentials safely.`
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedKey('all');
    setTimeout(() => setCopiedKey(null), 2500);
    onNotify?.('Credentials Copied', 'Staff login details copied to clipboard.', 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (!fullName.trim()) {
      setError('Full name is required.');
      setBusy(false);
      return;
    }
    if (!email.trim()) {
      setError('Corporate email is required.');
      setBusy(false);
      return;
    }
    if (!password || password.length < 12) {
      setError('Web password must be at least 12 characters.');
      setBusy(false);
      return;
    }
    if (pin && (pin.length < 4 || pin.length > 10)) {
      setError('PIN code must be between 4 and 10 digits.');
      setBusy(false);
      return;
    }

    try {
      const result = await userManagementApi.createUser({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        role,
        company,
        branch,
        employeeId: employeeId.trim() || undefined,
        departmentId: departmentId || null,
        managerId: managerId || null,
        marketingAccess,
        password,
        pin: pin || undefined,
        active: activateImmediately,
      });

      setCreated({
        user: result,
        initialPass: password,
        initialPin: pin,
      });
      onNotify('Account Created', `Staff account for ${result.fullName} provisioned successfully.`, 'success');
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'The staff account could not be created.');
    } finally {
      setBusy(false);
    }
  };

  // SUCCESS SCREEN: Account Created Summary
  if (created) {
    return (
      <div className="bg-white dark:bg-[#182229] border border-slate-200 dark:border-[#222D34] rounded-2xl p-6 shadow-xl space-y-6 max-w-4xl mx-auto animate-in fade-in duration-150">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222D34] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Staff Account Created Successfully</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                The account is active and initial credentials have been securely provisioned.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyCredentials}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            {copiedKey === 'all' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedKey === 'all' ? 'Copied' : 'Copy All Credentials'}</span>
          </button>
        </div>

        {/* Credentials Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 dark:bg-[#202C33] border border-slate-200 dark:border-[#2A3942] rounded-xl p-4 space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Account Information</p>
            <div>
              <p className="text-xs text-slate-400">Full Name</p>
              <p className="text-sm font-bold text-slate-100">{created.user.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Corporate Email</p>
              <p className="text-sm font-mono text-slate-200">{created.user.email}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60 text-xs">
              <div>
                <p className="text-slate-400">System Role</p>
                <p className="font-semibold text-emerald-400">{created.user.roleLabel || created.user.role}</p>
              </div>
              <div>
                <p className="text-slate-400">Company Scope</p>
                <p className="font-semibold text-teal-400">{created.user.company}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-[#202C33] border border-emerald-500/30 rounded-xl p-4 space-y-3">
            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Initial Credentials (Shown Once)</span>
            </p>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Initial Web Password</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(created.initialPass);
                    setCopiedKey('pass');
                    setTimeout(() => setCopiedKey(null), 2000);
                  }}
                  className="text-[10px] text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'pass' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-sm font-mono font-bold text-emerald-300 bg-black/40 px-3 py-1.5 rounded-lg border border-emerald-500/20 mt-1 select-all">
                {created.initialPass}
              </p>
            </div>

            {created.initialPin && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Login PIN Code</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(created.initialPin);
                      setCopiedKey('pin');
                      setTimeout(() => setCopiedKey(null), 2000);
                    }}
                    className="text-[10px] text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'pin' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm font-mono font-bold text-teal-300 bg-black/40 px-3 py-1.5 rounded-lg border border-teal-500/20 mt-1 select-all">
                  {created.initialPin}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-[#222D34]">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Send these credentials to the staff member. Passwords are saved with salted scrypt encryption.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setFullName('');
                setEmail('');
                setPhone('');
                setPassword(generateSecurePassword(16));
                setPin(generateSecurePin(6));
              }}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-[#202C33] hover:bg-slate-300 dark:hover:bg-[#2A3942] text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              Create Another User
            </button>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                onCreated();
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition-colors cursor-pointer shadow-sm"
            >
              Done & View Directory
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex items-center gap-3 pb-1">
        <button
          type="button"
          onClick={() => {
            if (onCancel) onCancel();
            else onCreated();
          }}
          className="h-9 w-9 rounded-xl bg-white dark:bg-[#202C33] border border-slate-200 dark:border-[#2A3942] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors shadow-xs cursor-pointer"
          title="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <UserPlus className="h-4 w-4" />
        </div>

        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-none">
            Create Staff Account
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Provision an immediately usable account with role, company, branch and secure credentials.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (8 cols): Staff Info, Role & Org, Account Options */}
        <div className="lg:col-span-8 space-y-5">
          {/* Section 1: Staff Information */}
          <div className="bg-white dark:bg-[#182229] border border-slate-200 dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
            <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-[#222D34] pb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Staff Information
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Basic details and contact information
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Full name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. John Doe, Sarah Coordinator"
                    className="w-full bg-[#F0F2F5] dark:bg-[#202C33] border border-slate-300 dark:border-[#2A3942] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Corporate Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Corporate email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@royalwellness.lk"
                    className="w-full bg-[#F0F2F5] dark:bg-[#202C33] border border-slate-300 dark:border-[#2A3942] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Must be unique and used to sign in to the CRM.
                </p>
              </div>

              {/* Phone number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Phone number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+94 7X XXX XXXX"
                    className="w-full bg-[#F0F2F5] dark:bg-[#202C33] border border-slate-300 dark:border-[#2A3942] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Employee ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Employee ID <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="EMP-1001"
                    className="w-full bg-[#F0F2F5] dark:bg-[#202C33] border border-slate-300 dark:border-[#2A3942] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono uppercase"
                  />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Unique staff identifier (e.g. EMP-1001).
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Role & Organization */}
          <div className="bg-white dark:bg-[#182229] border border-slate-200 dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
            <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-[#222D34] pb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Role & Organization
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Access role and organizational assignment
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* System role */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  System role <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-[#F0F2F5] dark:bg-[#202C33] border border-slate-300 dark:border-[#2A3942] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none"
                  >
                    {ROLE_OPTIONS.map((val) => (
                      <option key={val} value={val}>
                        {ROLE_DISPLAY_NAMES[val] || val}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Controls system access and permissions.
                </p>
              </div>

              {/* Company scope */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Company scope <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full bg-[#F0F2F5] dark:bg-[#202C33] border border-slate-300 dark:border-[#2A3942] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none"
                  >
                    {COMPANY_OPTIONS.map((val) => (
                      <option key={val} value={val}>
                        {COMPANY_DISPLAY_NAMES[val] || val}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Company or business unit assignment.
                </p>
              </div>

              {/* Branch assignment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Branch assignment <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-[#F0F2F5] dark:bg-[#202C33] border border-slate-300 dark:border-[#2A3942] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none"
                  >
                    <option value="All Branches (Global)">All Branches (Global)</option>
                    <option value="Colombo (Head Office)">Colombo (Head Office)</option>
                    <option value="Colombo">Colombo</option>
                    <option value="Kandy Branch">Kandy Branch</option>
                    <option value="Negombo">Negombo</option>
                  </select>
                </div>

                {/* Quick Radio Pills */}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-600 dark:text-slate-300 flex-wrap">
                  {[
                    { id: 'All Branches (Global)', label: 'All Branches (Global)' },
                    { id: 'Colombo (Head Office)', label: 'Colombo (Head Office)' },
                    { id: 'Kandy Branch', label: 'Kandy Branch' },
                  ].map((item) => (
                    <label key={item.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="branchQuickRadio"
                        checked={branch === item.id}
                        onChange={() => setBranch(item.id)}
                        className="h-3.5 w-3.5 text-emerald-500 bg-[#202C33] border-slate-600 focus:ring-emerald-500"
                      />
                      <span className={branch === item.id ? 'text-emerald-400 font-semibold' : ''}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Department <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Layers className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full bg-[#F0F2F5] dark:bg-[#202C33] border border-slate-300 dark:border-[#2A3942] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none"
                  >
                    <option value="">Unassigned</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                    {!departments.some((d) => d.name === 'Administration') && <option value="dept-admin">Administration</option>}
                    {!departments.some((d) => d.name === 'Operations') && <option value="dept-operations">Operations</option>}
                    {!departments.some((d) => d.name === 'CRM / Patient Care') && <option value="dept-crm">CRM / Patient Care</option>}
                    {!departments.some((d) => d.name === 'Clinical & Medical') && <option value="dept-clinical">Clinical & Medical</option>}
                    {!departments.some((d) => d.name === 'Exam Department') && <option value="dept-exam">Exam Department</option>}
                    {!departments.some((d) => d.name === 'Finance & Billing') && <option value="dept-finance">Finance & Billing</option>}
                    {!departments.some((d) => d.name === 'Public Contact Marketing') && <option value="dept-marketing">Public Contact Marketing</option>}
                  </select>
                </div>
              </div>

              {/* Reporting manager */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Reporting manager
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    className="w-full bg-[#F0F2F5] dark:bg-[#202C33] border border-slate-300 dark:border-[#2A3942] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none"
                  >
                    <option value="">None (Independent / Executive)</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Job title / Position */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Job title / Position
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Operations Coordinator"
                    className="w-full bg-[#F0F2F5] dark:bg-[#202C33] border border-slate-300 dark:border-[#2A3942] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Account Options */}
          <div className="bg-white dark:bg-[#182229] border border-slate-200 dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
            <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-[#222D34] pb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Account Options
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Account activation and access preferences
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Option 1: Activate immediately */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#202C33] border border-slate-200 dark:border-[#2A3942] cursor-pointer hover:border-emerald-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={activateImmediately}
                  onChange={(e) => setActivateImmediately(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded text-emerald-600 bg-white dark:bg-[#111B21] border-slate-300 dark:border-slate-700 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    Activate account immediately
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                    User can sign in as soon as the account is created.
                  </span>
                </div>
              </label>

              {/* Option 2: Public contact marketing */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#202C33] border border-slate-200 dark:border-[#2A3942] cursor-pointer hover:border-emerald-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={marketingAccess}
                  onChange={(e) => setMarketingAccess(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded text-emerald-600 bg-white dark:bg-[#111B21] border-slate-300 dark:border-slate-700 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    Public contact marketing access
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                    Allow access to marketing contact lists (if authorized).
                  </span>
                </div>
              </label>

              {/* Option 3: Require password change */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#202C33] border border-slate-200 dark:border-[#2A3942] cursor-pointer hover:border-emerald-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={requirePasswordChange}
                  onChange={(e) => setRequirePasswordChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded text-emerald-600 bg-white dark:bg-[#111B21] border-slate-300 dark:border-slate-700 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    Require password change at first login
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                    User must set a new password after initial sign in.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Initial Credentials & Security Policy */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#182229] border border-slate-200 dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
            <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-[#222D34] pb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Initial Credentials
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Generate secure login credentials for this staff account.
                </p>
              </div>
            </div>

            {/* Credential Mode Selector: Auto vs Custom Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setCredMode('auto')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  credMode === 'auto'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-sm'
                    : 'border-slate-300 dark:border-[#2A3942] bg-slate-50 dark:bg-[#202C33] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-slate-900 dark:text-slate-100">Generate automatically</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  Create a strong password and PIN using security policy.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCredMode('custom')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  credMode === 'custom'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-sm'
                    : 'border-slate-300 dark:border-[#2A3942] bg-slate-50 dark:bg-[#202C33] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <span className="w-2 h-2 rounded-full border border-slate-400"></span>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span className="text-slate-900 dark:text-slate-100">Set custom password & PIN</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  Manually define initial credentials (policy enforced).
                </p>
              </button>
            </div>

            {/* Field 1: Web Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Web Password</span>
                  <span title="Minimum 12 characters"><Info className="w-3 h-3 text-slate-400 cursor-help" /></span>
                </span>

                <button
                  type="button"
                  onClick={handleRegeneratePassword}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw className="w-2.5 h-2.5" />
                  <span>Auto-generate</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (credMode === 'auto') setCredMode('custom');
                  }}
                  placeholder="Minimum 12 characters"
                  className="w-full bg-[#F0F2F5] dark:bg-[#202C33] border border-slate-300 dark:border-[#2A3942] rounded-xl pl-3 pr-20 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tracking-wider focus:outline-none focus:border-emerald-500 transition-colors"
                />

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleRegeneratePassword}
                    className="p-1 rounded text-slate-400 hover:text-emerald-400 cursor-pointer"
                    title="Regenerate random password"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Field 2: PIN Code */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                  <span>PIN Code</span>
                  <span title="4-10 digits for quick keypad sign-in"><Info className="w-3 h-3 text-slate-400 cursor-help" /></span>
                </span>

                <button
                  type="button"
                  onClick={handleRegeneratePin}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw className="w-2.5 h-2.5" />
                  <span>Auto-generate</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={10}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ''));
                    if (credMode === 'auto') setCredMode('custom');
                  }}
                  placeholder="e.g. 1234"
                  className="w-full bg-[#F0F2F5] dark:bg-[#202C33] border border-slate-300 dark:border-[#2A3942] rounded-xl pl-3 pr-20 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tracking-widest focus:outline-none focus:border-emerald-500 transition-colors"
                />

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                    title={showPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleRegeneratePin}
                    className="p-1 rounded text-slate-400 hover:text-emerald-400 cursor-pointer"
                    title="Regenerate random PIN"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Credential Policy Box */}
            <div className="bg-slate-50 dark:bg-[#202C33]/70 border border-slate-200 dark:border-[#2A3942] rounded-xl p-3.5 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                <Info className="w-3.5 h-3.5 text-teal-500" />
                <span>Credential Policy</span>
              </div>
              <ul className="space-y-1 text-[10.5px] text-slate-500 dark:text-slate-400">
                <li className="flex items-start gap-1.5">
                  <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Web password: minimum 12 characters, with upper & lower case, number and symbol.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  <span>PIN code: 4 – 10 digits (server policy).</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Credentials are stored securely (hashed) and shown only once after creation.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-[#222D34]">
        <button
          type="button"
          onClick={() => {
            if (onCancel) onCancel();
            else onCreated();
          }}
          className="px-4 py-2 rounded-xl bg-white dark:bg-[#202C33] hover:bg-slate-100 dark:hover:bg-[#2A3942] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#2A3942] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </button>

        <button
          type="submit"
          disabled={busy}
          className="px-5 py-2 rounded-xl bg-[#25D366] hover:bg-[#128C7E] text-[#111B21] hover:text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>{busy ? 'Creating Account...' : 'Create Staff Account'}</span>
        </button>
      </div>
    </form>
  );
};
