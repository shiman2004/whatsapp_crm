import React, { useState } from 'react';
import {
  GraduationCap,
  BookOpen,
  Award,
  Clock,
  RotateCcw,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';
import { CourseManagementTab } from '../admin/SuperAdminSettings/CourseManagementTab';

interface AcademicSettingsProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

export const AcademicSettingsSection: React.FC<AcademicSettingsProps> = ({
  currentSectionId,
  onSelectSection,
  selectedCompanyId,
  onSelectCompany
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'courses' | 'governance'>('courses');

  const {
    data,
    updateField,
    version,
    isLoading,
    isSaving,
    isDirty,
    error,
    saveSettings,
    discardChanges,
    conflictState
  } = useSettingsSection({
    sectionId: 'academic',
    scope: 'global'
  });

  if (isLoading) {
    return (
      <SettingsLayout
        currentSectionId={currentSectionId}
        onSelectSection={onSelectSection}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={onSelectCompany}
      >
        <div className="flex items-center justify-center h-64 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3" />
          <span>Loading Exam Department & Course configuration...</span>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout
      currentSectionId={currentSectionId}
      onSelectSection={onSelectSection}
      selectedCompanyId={selectedCompanyId}
      onSelectCompany={onSelectCompany}
      isDirty={isDirty}
      isSaving={isSaving}
      version={version}
      conflictState={conflictState}
      onSave={saveSettings}
      onDiscard={discardChanges}
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Sub-tab Switcher: Courses Catalog vs Exam Governance */}
        <div className="flex items-center gap-2 border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
          <button
            type="button"
            onClick={() => setActiveSubTab('courses')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'courses'
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#202C33]'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-rose-500" />
            <span>CRAS Courses & Curriculums</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('governance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'governance'
                ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#202C33]'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-teal-500" />
            <span>Exam Pass Standards & Portal Controls</span>
          </button>
        </div>

        {/* Active Tab Content */}
        {activeSubTab === 'courses' ? (
          <CourseManagementTab />
        ) : (
          <div className="space-y-6">
            {/* 1. Academic Examination Standards */}
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
              <div className="border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] uppercase tracking-wider flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                  Exam Department Parameters
                </h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0]">
                  Govern student assessment passing criteria, retakes, and time limits
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">
                    Minimum Pass Score (%)
                  </label>
                  <input
                    type="number"
                    min={40}
                    max={100}
                    value={data.passingScorePercentage || 70}
                    onChange={(e) => updateField('passingScorePercentage', parseInt(e.target.value, 10))}
                    className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">
                    Maximum Retake Attempts
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={data.maxRetakes || 3}
                    onChange={(e) => updateField('maxRetakes', parseInt(e.target.value, 10))}
                    className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">
                    Auto-Issue Certificate
                  </label>
                  <select
                    value={data.autoIssueCertificate !== undefined ? String(data.autoIssueCertificate) : 'true'}
                    onChange={(e) => updateField('autoIssueCertificate', e.target.value === 'true')}
                    className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
                  >
                    <option value="true">Enabled (Generate upon verified pass)</option>
                    <option value="false">Manual Review Required</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Question Bank & Timed Session Standards */}
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
              <div className="border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                  Student Portal Integrity Standards
                </h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0]">
                  MCQ shuffling, proctoring warnings and practice mode toggles
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF] block">
                      Shuffle Question Order
                    </span>
                    <span className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                      Randomize question delivery sequence per attempt
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={data.shuffleQuestions !== false}
                    onChange={(e) => updateField('shuffleQuestions', e.target.checked)}
                    className="h-4 w-4 text-emerald-600 rounded bg-white dark:bg-[#202C33] border-[#E0E5E7] dark:border-[#222D34] focus:ring-emerald-500"
                  />
                </div>

                <div className="p-3.5 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF] block">
                      Enable Public Self-Study Mode
                    </span>
                    <span className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                      Allow enrolled students to take non-graded mock practice
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={data.enablePracticeMode !== false}
                    onChange={(e) => updateField('enablePracticeMode', e.target.checked)}
                    className="h-4 w-4 text-emerald-600 rounded bg-white dark:bg-[#202C33] border-[#E0E5E7] dark:border-[#222D34] focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
};
