import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  MessageSquare,
  KanbanSquare,
  CalendarDays,
  Megaphone,
  ClipboardCheck,
  ClipboardList,
  BookOpen,
  Database,
  FileCheck2,
  Edit3,
  CheckSquare,
  Target,
  Inbox,
  FileText,
  Upload,
  Contact,
  Users,
  UsersRound,
  UserPlus,
  Building2,
  BriefcaseBusiness,
  MailPlus,
  UserX,
  MonitorSmartphone,
  BarChart3,
  Sliders,
  ShieldCheck,
  ScrollText,
  Code2,
  Sparkles,
  GraduationCap,
  Clock,
  Layers,
  TrendingUp,
  Award,
} from 'lucide-react';
import type { User, UserRole } from '../types';

export type NavTab =
  | 'dashboard'
  | 'leads-kanban'
  | 'chat'
  | 'broadcast'
  | 'appointment-rooms'
  | 'settings'
  | 'security-access'
  | 'treatments'
  | 'coordinators'
  | 'user-management'
  | 'templates'
  | 'reports'
  | 'audit'
  | 'webhook-sandbox'
  | 'architecture'
  | 'exam'
  | 'marketing'
  | 'exam-department'
  | 'patient-assessment';

/** Sub-destination inside a module. `intentEvent` lets the existing module
 *  react without a new page or a new API. */
export interface NavChild {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  intentEvent?: string;
  intentValue?: string;
}

export interface NavItem {
  id: NavTab;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Base hash path, always starts with "/" (hash format is "#/path"). */
  path: string;
  adminOnly?: boolean;
  examStaffOnly?: boolean;
  clinicalStaffOnly?: boolean;
  studentOnly?: boolean;
  marketingModule?: boolean;
  children?: NavChild[];
}

export interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

export const EXAM_STAFF_ROLES: UserRole[] = [
  'super_admin',
  'coordinator',
  'leads_officer',
  'exam_department_manager',
  'exam_coordinator',
  'exam_providing_officer',
  'finance_officer',
];

export const CLINICAL_ROLES: UserRole[] = [
  'super_admin',
  'clinical_nurse',
  'clinical_doctor',
  'report_analyst',
];

/** Mirrors backend/src/marketing/permissions.js role matrix (visibility only). */
export const MARKETING_ROLES: UserRole[] = [
  'super_admin',
  'leads_officer',
  'marketing_officer',
  'marketing_admin',
  'coordinator',
];

const examChildren: NavChild[] = [
  { id: 'operations', label: '1. Operations & Case Management', icon: Inbox, path: '/exam-department/operations', intentEvent: 'exam-subtab-change', intentValue: 'operations' },
  { id: 'dashboard', label: '2. Operations Dashboard', icon: LayoutDashboard, path: '/exam-department/dashboard', intentEvent: 'exam-subtab-change', intentValue: 'dashboard' },
  { id: 'courses', label: '3. Course Catalog', icon: BookOpen, path: '/exam-department/courses', intentEvent: 'exam-subtab-change', intentValue: 'courses' },
  { id: 'mcq-practice', label: '4. Interactive MCQ Practice', icon: Target, path: '/exam-department/mcq-practice', intentEvent: 'exam-subtab-change', intentValue: 'mcq-practice' },
  { id: 'mock-tests', label: '5. Mock Tests', icon: FileCheck2, path: '/exam-department/mock-tests', intentEvent: 'exam-subtab-change', intentValue: 'mock-tests' },
  { id: 'question-bank', label: '6. Question Bank', icon: Database, path: '/exam-department/question-bank', intentEvent: 'exam-subtab-change', intentValue: 'question-bank' },
  { id: 'study-materials', label: '7. Study Materials', icon: FileText, path: '/exam-department/study-materials', intentEvent: 'exam-subtab-change', intentValue: 'study-materials' },
  { id: 'guidelines', label: '8. Exam Guidelines', icon: ShieldCheck, path: '/exam-department/guidelines', intentEvent: 'exam-subtab-change', intentValue: 'guidelines' },
  { id: 'my-drafts', label: '9. My Drafts & Submissions', icon: Edit3, path: '/exam-department/my-drafts', intentEvent: 'exam-subtab-change', intentValue: 'my-drafts' },
  { id: 'approval-queue', label: '10. Manager Approval Queue', icon: CheckSquare, path: '/exam-department/approval-queue', intentEvent: 'exam-subtab-change', intentValue: 'approval-queue' },
  { id: 'progress', label: '11. Student Progress', icon: TrendingUp, path: '/exam-department/progress', intentEvent: 'exam-subtab-change', intentValue: 'progress' },
  { id: 'reports', label: '12. Exam Reports & Analytics', icon: BarChart3, path: '/exam-department/reports', intentEvent: 'exam-subtab-change', intentValue: 'reports' },
  { id: 'results', label: 'Exam Results', icon: Award, path: '/exam-department/results', intentEvent: 'exam-subtab-change', intentValue: 'results' },
  { id: 'categories', label: 'Categories', icon: Layers, path: '/exam-department/categories', intentEvent: 'exam-subtab-change', intentValue: 'categories' },
  { id: 'requests', label: 'Material Requests', icon: Inbox, path: '/exam-department/requests', intentEvent: 'exam-subtab-change', intentValue: 'requests' },
  { id: 'settings', label: 'Exam Settings', icon: Sliders, path: '/exam-department/settings', intentEvent: 'exam-subtab-change', intentValue: 'settings' },
];

const settingsChildren: NavChild[] = [
  { id: 'courses', label: 'Courses & Programs', icon: BookOpen, path: '/settings/courses', intentEvent: 'settings-subtab-change', intentValue: 'courses' },
  { id: 'treatments', label: 'Treatments Catalog', icon: Sparkles, path: '/settings/treatments', intentEvent: 'settings-subtab-change', intentValue: 'treatments' },
  { id: 'stages', label: 'Lead Funnel Stages', icon: KanbanSquare, path: '/settings/stages', intentEvent: 'settings-subtab-change', intentValue: 'stages' },
  { id: 'exam-settings', label: 'Exam Department Settings', icon: GraduationCap, path: '/settings/exam-settings', intentEvent: 'settings-subtab-change', intentValue: 'exam-settings' },
];

const userManagementChildren: NavChild[] = [
  { id: 'directory', label: 'User Directory', icon: UsersRound, path: '/staff/directory' },
  { id: 'create', label: 'Create User', icon: UserPlus, path: '/staff/create' },
  { id: 'teams', label: 'Teams & Departments', icon: Building2, path: '/staff/teams' },
  { id: 'assignments', label: 'User Assignments', icon: BriefcaseBusiness, path: '/staff/assignments' },
  { id: 'invitations', label: 'Pending Invitations', icon: MailPlus, path: '/staff/invitations' },
  { id: 'deactivated', label: 'Deactivated Accounts', icon: UserX, path: '/staff/deactivated' },
];

const securityChildren: NavChild[] = [
  { id: 'overview', label: 'Security Overview', icon: LayoutDashboard, path: '/security/overview' },
  { id: 'roles', label: 'Roles & Permissions', icon: ShieldCheck, path: '/security/roles' },
  { id: 'matrix', label: 'Permission Matrix', icon: KanbanSquare, path: '/security/matrix' },
  { id: 'policies', label: 'Access Policies', icon: Users, path: '/security/policies' },
  { id: 'sessions', label: 'Login & Session Activity', icon: MonitorSmartphone, path: '/security/sessions' },
  { id: 'events', label: 'Security Events', icon: ScrollText, path: '/security/events' },
];

const marketingChildren: NavChild[] = [
  { id: 'dashboard', label: 'Marketing Dashboard', icon: LayoutDashboard, path: '/marketing/dashboard', intentEvent: 'marketing-page-change', intentValue: 'dashboard' },
  { id: 'add', label: 'Add Public Numbers', icon: Upload, path: '/marketing/add', intentEvent: 'marketing-page-change', intentValue: 'add' },
  { id: 'uploads', label: 'My Uploads', icon: FileText, path: '/marketing/uploads', intentEvent: 'marketing-page-change', intentValue: 'uploads' },
  { id: 'contacts', label: 'Contact Database', icon: Contact, path: '/marketing/contacts', intentEvent: 'marketing-page-change', intentValue: 'contacts' },
  { id: 'assignment', label: 'Contact Assignment', icon: Users, path: '/marketing/assignment', intentEvent: 'marketing-page-change', intentValue: 'assignment' },
  { id: 'tasks', label: 'My Marketing Tasks', icon: ClipboardList, path: '/marketing/tasks', intentEvent: 'marketing-page-change', intentValue: 'tasks' },
  { id: 'campaigns', label: 'Campaign Content', icon: FileText, path: '/marketing/campaigns', intentEvent: 'marketing-page-change', intentValue: 'campaigns' },
  { id: 'reports', label: 'Marketing Reports', icon: BarChart3, path: '/marketing/reports', intentEvent: 'marketing-page-change', intentValue: 'reports' },
];

const leadChildren: NavChild[] = [
  { id: 'all', label: 'All Leads', icon: ClipboardList, path: '/leads/all', intentEvent: 'leads-view-change', intentValue: 'table' },
  { id: 'board', label: 'Pipeline Board', icon: KanbanSquare, path: '/leads/board', intentEvent: 'leads-view-change', intentValue: 'kanban' },
  { id: 'assignment', label: 'Assignment & Follow-ups', icon: Users, path: '/leads/assignment', intentEvent: 'leads-view-change', intentValue: 'table' },
  { id: 'activity', label: 'Lead Activity', icon: ScrollText, path: '/leads/activity', intentEvent: 'leads-view-change', intentValue: 'table' },
];

const appointmentChildren: NavChild[] = [
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, path: '/appointments/calendar' },
  { id: 'bookings', label: 'All Bookings', icon: ClipboardList, path: '/appointments/bookings' },
  { id: 'rooms', label: 'Rooms & Availability', icon: Database, path: '/appointments/rooms' },
  { id: 'doctors', label: 'Doctor Scheduling', icon: GraduationCap, path: '/appointments/doctors' },
];

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'workspace',
    title: 'Operations & Workspace',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        description: 'Operational performance across all brands',
        icon: LayoutDashboard,
        path: '/dashboard',
      },
      {
        id: 'chat',
        label: 'Live WhatsApp',
        description: 'Live conversations and customer context',
        icon: MessageSquare,
        path: '/inbox',
      },
      {
        id: 'leads-kanban',
        label: 'Leads Pipeline',
        description: 'Lead stages, assignment and follow-ups',
        icon: KanbanSquare,
        path: '/leads',
        children: leadChildren,
      },
      {
        id: 'appointment-rooms',
        label: 'Appointment Room',
        description: 'Room calendar, bookings and doctor scheduling',
        icon: CalendarDays,
        path: '/appointments',
        children: appointmentChildren,
      },
      {
        id: 'broadcast',
        label: 'Team Broadcast',
        description: 'Internal team announcements',
        icon: Megaphone,
        path: '/broadcast',
      },
    ],
  },
  {
    id: 'clinical-academic',
    title: 'Clinical & Academic',
    items: [
      {
        id: 'patient-assessment',
        label: 'Patient Assessment & Reports',
        description: 'Clinical assessment records and reports',
        icon: ClipboardCheck,
        path: '/patient-assessments',
        clinicalStaffOnly: true,
      },
      {
        id: 'exam-department',
        label: 'Exam Department',
        description: 'Academic exams, materials and approvals',
        icon: ClipboardList,
        path: '/exam-department',
        examStaffOnly: true,
        children: examChildren,
      },
      {
        id: 'exam',
        label: 'Exam Portal',
        description: 'Student exam portal',
        icon: Clock,
        path: '/exam-portal',
        studentOnly: true,
      },
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing & Outreach',
    items: [
      {
        id: 'marketing',
        label: 'Public Contact Marketing',
        description: 'Collect, verify and convert public contacts',
        icon: Megaphone,
        path: '/marketing',
        marketingModule: true,
        children: marketingChildren,
      },
      {
        id: 'templates',
        label: 'Templates & Nurture',
        description: 'WhatsApp templates and follow-up sequences',
        icon: FileText,
        path: '/templates',
      },
    ],
  },
  {
    id: 'management',
    title: 'Management & Analytics',
    items: [
      {
        id: 'reports',
        label: 'Analytics',
        description: 'Conversion, revenue and team performance',
        icon: BarChart3,
        path: '/analytics',
        adminOnly: true,
      },
      {
        id: 'treatments',
        label: 'Treatments',
        description: 'Treatment catalogue and availability',
        icon: Sparkles,
        path: '/treatments',
        adminOnly: true,
      },
    ],
  },
  {
    id: 'system',
    title: 'System & Security',
    items: [
      {
        id: 'user-management',
        label: 'User Management',
        description: 'Accounts, roles, teams, assignments and invitations',
        icon: UsersRound,
        path: '/staff',
        adminOnly: true,
        children: userManagementChildren,
      },
      {
        id: 'security-access',
        label: 'Security & Access',
        description: 'Roles, permission matrix, policies and sessions',
        icon: ShieldCheck,
        path: '/security',
        adminOnly: true,
        children: securityChildren,
      },
      {
        id: 'settings',
        label: 'System Settings',
        description: 'Catalogues, stages and module configuration',
        icon: Sliders,
        path: '/settings',
        adminOnly: true,
        children: settingsChildren,
      },
      {
        id: 'audit',
        label: 'Audit Trail',
        description: 'Timestamped system activity log',
        icon: ScrollText,
        path: '/audit',
        adminOnly: true,
      },
      {
        id: 'webhook-sandbox',
        label: 'Webhook Sandbox',
        description: 'Safe webhook testing environment',
        icon: Code2,
        path: '/webhooks',
        adminOnly: true,
      },
      {
        id: 'architecture',
        label: 'API Specs',
        description: 'Integration and API reference',
        icon: Code2,
        path: '/api-specs',
        adminOnly: true,
      },
    ],
  },
];

export const ALL_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);

/** Old hash URLs kept alive so bookmarks and in-app links keep working. */
const LEGACY_ALIASES: Record<string, string> = {
  '/patient-assessment': '/patient-assessments',
  '/security-access': '/security',
  '/reports': '/analytics',
  '/coordinators': '/staff',
  '/staffs': '/staff',
  '/user-management': '/staff',
  '/settings/admins': '/staff/directory',
  '/architecture': '/api-specs',
  '/webhook-sandbox': '/webhooks',
  '/leads-kanban': '/leads',
  '/appointment-rooms': '/appointments',
  '/chat': '/inbox',
};

/** Prefix moves for old sections that had sub-paths of their own. */
const LEGACY_PREFIXES: Array<[string, string]> = [
  ['/security-access/', '/security/'],
  ['/coordinators/', '/staff/'],
  ['/user-management/', '/staff/'],
];

function normalizePath(path: string): string {
  const exact = LEGACY_ALIASES[path];
  if (exact) return exact;
  for (const [from, to] of LEGACY_PREFIXES) {
    if (path.startsWith(from)) return `${to}${path.slice(from.length)}`;
  }
  return path;
}

export function currentPathname(): string {
  const raw = window.location.hash.replace(/^#/, '');
  const path = (raw || '/dashboard').split('?')[0].replace(/\/+$/, '') || '/dashboard';
  return normalizePath(path);
}

export interface ResolvedRoute {
  item: NavItem;
  child?: NavChild;
  path: string;
}

export function resolveRoute(path: string): ResolvedRoute | null {
  const normalized = normalizePath(path);
  for (const item of ALL_ITEMS) {
    if (normalized === item.path || normalized.startsWith(`${item.path}/`)) {
      const rest = normalized.slice(item.path.length).replace(/^\//, '');
      const child = rest ? item.children?.find((c) => c.id === rest) : undefined;
      return { item, child, path: normalized };
    }
  }
  return null;
}

/** Landing path for an item: its first child when it has sub-destinations. */
export function navTarget(item: NavItem): string {
  return item.children?.[0]?.path || item.path;
}

export function routeForTab(tab: NavTab): string {
  const item = ALL_ITEMS.find((entry) => entry.id === tab);
  return item ? navTarget(item) : '/dashboard';
}

export function isNavItemVisible(item: NavItem, user: User | null | undefined): boolean {
  const role = user?.role;
  if (!role) return false;
  if (item.adminOnly) return role === 'super_admin';
  if (item.studentOnly) return String(role) === 'student';
  if (item.examStaffOnly) return EXAM_STAFF_ROLES.includes(role);
  if (item.clinicalStaffOnly) return CLINICAL_ROLES.includes(role);
  if (item.marketingModule) {
    // Backend remains the authority; this only hides links a role cannot use.
    // super_admin bypasses the per-user revoke, matching backend marketing/permissions.js.
    if (role === 'super_admin') return true;
    return MARKETING_ROLES.includes(role) && user?.marketingAccess !== false;
  }
  return true;
}

export interface Breadcrumb {
  label: string;
  path?: string;
}

export function breadcrumbsForRoute(route: ResolvedRoute | null): Breadcrumb[] {
  if (!route) return [{ label: 'Dashboard', path: '/dashboard' }];
  const section = NAV_SECTIONS.find((s) => s.items.some((i) => i.id === route.item.id));
  const crumbs: Breadcrumb[] = [];
  if (section) crumbs.push({ label: section.title });
  crumbs.push({ label: route.item.label, path: route.item.path });
  if (route.child) crumbs.push({ label: route.child.label });
  return crumbs;
}

/** Single navigation entry point: keeps the hash URL and dispatches module intents. */
export function navigateToPath(path: string): void {
  const route = resolveRoute(path);
  if (!route) return;
  const target = route.path;
  if (currentPathname() === target) {
    dispatchIntent(route);
    return;
  }
  window.location.hash = target;
}

export function dispatchIntent(route: ResolvedRoute): void {
  if (route.child?.intentEvent) {
    window.dispatchEvent(
      new CustomEvent(route.child.intentEvent, { detail: route.child.intentValue }),
    );
  }
}

/** Total number of visible destinations, used by the global search empty state. */
export function visibleNavCount(user: User | null | undefined): number {
  return NAV_SECTIONS.reduce(
    (total, section) =>
      total +
      section.items.filter((item) => isNavItemVisible(item, user)).reduce(
        (sum, item) => sum + 1 + (item.children?.length || 0),
        0,
      ),
    0,
  );
}
