import React, { useState } from 'react';
import { useCrm } from '../../../context/CrmContext';
import { CourseManagementTab } from './CourseManagementTab';
import { TreatmentManagementTab } from './TreatmentManagementTab';
import { StageManagementTab } from './StageManagementTab';
import { AdminAccountsTab } from './AdminAccountsTab';
import {
  Sliders,
  GraduationCap,
  Sparkles,
  KanbanSquare,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Lock
} from 'lucide-react';

type SettingsTab = 'courses' | 'treatments' | 'stages' | 'admins';

export const SuperAdminSettingsView: React.FC = () => {
  const { currentUser, isSuperAdmin } = useCrm();
  const [activeTab, setActiveTab] = useState<SettingsTab>('courses');

  // Strict RBAC Access Protection
  if (!isSuperAdmin || currentUser?.role !== 'super_admin') {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 font-serif mb-2">
            Access Restricted
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            System Settings and Dynamic Configuration are strictly reserved for authorized
            Executive Super Admins. Your account ({currentUser?.roleTitle || currentUser?.role})
            does not hold the required privileges.
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400">
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span>ROLE_SUPER_ADMIN_REQUIRED</span>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: 'courses' as SettingsTab,
      label: 'CRAS Courses',
      subtitle: 'Admissions & Curriculums',
      icon: GraduationCap,
      color: 'text-rose-400',
      activeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
      tag: 'CRAS',
      tagColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    },
    {
      id: 'treatments' as SettingsTab,
      label: 'RWC Treatments',
      subtitle: 'Clinical Care & Services',
      icon: Sparkles,
      color: 'text-teal-400',
      activeBg: 'bg-teal-500/15 border-teal-500/30 text-teal-300',
      tag: 'RWC',
      tagColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    },
    {
      id: 'stages' as SettingsTab,
      label: 'Lead Stages',
      subtitle: 'Pipeline & Kanban Order',
      icon: KanbanSquare,
      color: 'text-indigo-400',
      activeBg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
      tag: 'PIPELINE',
      tagColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    },
    {
      id: 'admins' as SettingsTab,
      label: 'Super Admins',
      subtitle: 'Security & Access Control',
      icon: ShieldCheck,
      color: 'text-purple-400',
      activeBg: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
      tag: 'SECURITY',
      tagColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    },
  ];

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-600 dark:text-purple-400">
              <Sliders className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-serif">
              System Management & Dynamic Configuration
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-10">
            Manage course curriculums, clinical treatment menus, pipeline stage sequences, and administrator accounts
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
            <span>Supabase Cloud Sync</span>
          </div>
        </div>
      </div>

      {/* Modern Segmented Navigation Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800/80">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between ${
                isActive
                  ? `${tab.activeBg} shadow-md dark:shadow-lg dark:shadow-black/20 scale-[1.01]`
                  : 'bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isActive ? 'bg-white/20 dark:bg-white/10' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${tab.color}`} />
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${tab.tagColor}`}
                >
                  {tab.tag}
                </span>
              </div>
              <div>
                <p className={`text-xs font-bold ${isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-800 dark:text-slate-300'}`}>
                  {tab.label}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5 truncate">{tab.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="animate-in fade-in duration-150">
        {activeTab === 'courses' && <CourseManagementTab />}
        {activeTab === 'treatments' && <TreatmentManagementTab />}
        {activeTab === 'stages' && <StageManagementTab />}
        {activeTab === 'admins' && <AdminAccountsTab />}
      </div>
    </div>
  );
};
