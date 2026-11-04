export type SettingsScope = 'global' | 'company' | 'user';

export type SettingsCategoryId = 
  | 'org_admin'
  | 'communication'
  | 'business_ops'
  | 'platform_admin';

export interface SettingsCategory {
  id: SettingsCategoryId;
  title: string;
  description: string;
  iconName: string;
}

export interface SettingsSectionMeta {
  id: string;
  num: number;
  label: string;
  shortDesc: string;
  category: SettingsCategoryId;
  scope: SettingsScope;
  path: string;
  iconName: string;
  adminOnly: boolean;
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'org_admin',
    title: 'Organization Administration',
    description: 'Corporate entities, staff directory and enterprise role matrix',
    iconName: 'Building2'
  },
  {
    id: 'communication',
    title: 'Communication & Channels',
    description: 'WhatsApp policies, automated messaging and delivery rules',
    iconName: 'MessageSquare'
  },
  {
    id: 'business_ops',
    title: 'Business Operations',
    description: 'Pipelines, marketing, clinical parameters, courses and automations',
    iconName: 'Briefcase'
  },
  {
    id: 'platform_admin',
    title: 'Platform Administration',
    description: 'API keys, security governance, backups, monitoring and preferences',
    iconName: 'Shield'
  }
];

export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  // 1. Organization Administration
  {
    id: 'company',
    num: 1,
    label: 'Company & Branch Management',
    shortDesc: 'Corporate profiles, branches, business hours, and multi-brand scope',
    category: 'org_admin',
    scope: 'company',
    path: '/settings/company',
    iconName: 'Building2',
    adminOnly: true
  },
  {
    id: 'users',
    num: 2,
    label: 'User Management',
    shortDesc: 'Staff directory, invitations, workload capacity and credentials',
    category: 'org_admin',
    scope: 'global',
    path: '/settings/users',
    iconName: 'Users',
    adminOnly: true
  },
  {
    id: 'roles',
    num: 3,
    label: 'Role Access & Monitoring',
    shortDesc: 'Simple access control, staff activity, and session monitoring.',
    category: 'org_admin',
    scope: 'global',
    path: '/settings/roles',
    iconName: 'ShieldCheck',
    adminOnly: true
  },

  // 2. Communication
  {
    id: 'whatsapp_messaging',
    num: 4,
    label: 'WhatsApp Messaging Configuration',
    shortDesc: 'Inbox routing, business hours auto-replies, templates, and opt-outs',
    category: 'communication',
    scope: 'company',
    path: '/settings/whatsapp_messaging',
    iconName: 'MessageSquare',
    adminOnly: true
  },

  // 3. Business Operations
  {
    id: 'sales',
    num: 5,
    label: 'Leads & Pipeline Settings',
    shortDesc: 'Deal stages, win/lost criteria, lead sources, and stage protection',
    category: 'business_ops',
    scope: 'company',
    path: '/settings/sales',
    iconName: 'KanbanSquare',
    adminOnly: true
  },
  {
    id: 'marketing',
    num: 6,
    label: 'Contacts & Marketing Settings',
    shortDesc: 'Contact deduping, allocation quotas, consent rules, and campaigns',
    category: 'business_ops',
    scope: 'company',
    path: '/settings/marketing',
    iconName: 'Megaphone',
    adminOnly: true
  },
  {
    id: 'clinical',
    num: 7,
    label: 'Appointment & Clinical Settings',
    shortDesc: 'Room scheduling buffers, double-booking prevention, cancellation rules',
    category: 'business_ops',
    scope: 'company',
    path: '/settings/clinical',
    iconName: 'Stethoscope',
    adminOnly: true
  },
  {
    id: 'academic',
    num: 8,
    label: 'Exam Department',
    shortDesc: 'CRAS course catalog, exam pass thresholds, retake rules, scoring, and student portal controls',
    category: 'business_ops',
    scope: 'global',
    path: '/settings/academic',
    iconName: 'GraduationCap',
    adminOnly: true
  },
  {
    id: 'automation',
    num: 9,
    label: 'Automation & Workflow Engine',
    shortDesc: 'Trigger-condition-action automations with dry-run verification',
    category: 'business_ops',
    scope: 'company',
    path: '/settings/automation',
    iconName: 'Zap',
    adminOnly: true
  },
  {
    id: 'email_notifications',
    num: 10,
    label: 'Notifications & Email',
    shortDesc: 'SMTP configuration, test email dispatcher, event toggles, quiet hours',
    category: 'business_ops',
    scope: 'global',
    path: '/settings/email_notifications',
    iconName: 'Mail',
    adminOnly: true
  },
  {
    id: 'custom_fields',
    num: 11,
    label: 'Custom Fields & Forms',
    shortDesc: 'Entity field extensions, validation rules, and custom form layouts',
    category: 'business_ops',
    scope: 'company',
    path: '/settings/custom_fields',
    iconName: 'FileEdit',
    adminOnly: true
  },

  // 4. Platform Administration
  {
    id: 'integrations',
    num: 12,
    label: 'Integrations & API Management',
    shortDesc: 'Hashed API keys, outbound signed webhooks, and third-party links',
    category: 'platform_admin',
    scope: 'global',
    path: '/settings/integrations',
    iconName: 'Code2',
    adminOnly: true
  },
  {
    id: 'security_policy',
    num: 13,
    label: 'Security & Audit Center',
    shortDesc: 'Password policy, session timeout, active sessions, and audit trail',
    category: 'platform_admin',
    scope: 'global',
    path: '/settings/security_policy',
    iconName: 'Lock',
    adminOnly: true
  },
  {
    id: 'data_management',
    num: 14,
    label: 'Data Management & Backup',
    shortDesc: 'Automated database backups, data retention policies, and CSV exports',
    category: 'platform_admin',
    scope: 'global',
    path: '/settings/data_management',
    iconName: 'HardDrive',
    adminOnly: true
  },
  {
    id: 'system_monitoring',
    num: 15,
    label: 'System Infrastructure & Monitoring',
    shortDesc: 'Real-time database, API latency, Prisma status, and socket health',
    category: 'platform_admin',
    scope: 'global',
    path: '/settings/system_monitoring',
    iconName: 'Activity',
    adminOnly: true
  },
  {
    id: 'reporting',
    num: 16,
    label: 'Dashboard & Reporting Settings',
    shortDesc: 'Executive KPIs, conversion target formulas, and fiscal boundaries',
    category: 'platform_admin',
    scope: 'company',
    path: '/settings/reporting',
    iconName: 'BarChart3',
    adminOnly: true
  },
  {
    id: 'appearance',
    num: 17,
    label: 'Appearance & General Preferences',
    shortDesc: 'User theme, interface density, language, and regional localization',
    category: 'platform_admin',
    scope: 'user',
    path: '/settings/appearance',
    iconName: 'Palette',
    adminOnly: false
  }
];

export interface SettingApiResponse<T = any> {
  success: boolean;
  section: string;
  scope: string;
  scopeId: string;
  version: number;
  data: T;
  updatedAt?: string;
  error?: string;
  message?: string;
  currentVersion?: number;
  serverData?: T;
}

