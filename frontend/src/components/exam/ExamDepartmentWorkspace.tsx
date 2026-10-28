import { useCrm } from '../../context/CrmContext';
import { ExamOperationsView } from './ExamOperationsView';
import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Plus,
  LayoutDashboard,
  BookOpen,
  Target,
  FileCheck2,
  FileText,
  ShieldCheck,
  Database,
  TrendingUp,
  Award,
  Inbox,
  BarChart3,
  Settings,
  Layers
} from 'lucide-react';
import {
  examService,
  ExamDashboardStats,
  ExamCategory,
  ExamMaterialRequest,
  ExamMaterial,
  ExamMockTest,
  ExamProvision,
} from '../../services/examService';

import { ExamDashboardView } from './ExamDashboardView';
import { CoursesManagerView } from './CoursesManagerView';
import { InteractiveMcqPracticeView } from './InteractiveMcqPracticeView';
import { MockTestRunnerView } from './MockTestRunnerView';
import { StudyMaterialsView } from './StudyMaterialsView';
import { ExamGuidelinesView } from './ExamGuidelinesView';
import { QuestionBankView } from './QuestionBankView';
import { StudentProgressView } from './StudentProgressView';
import { ExamResultsView } from './ExamResultsView';
import { MaterialRequestsView } from './MaterialRequestsView';
import { ExamReportsView } from './ExamReportsView';
import { ExamSettingsView } from './ExamSettingsView';
import { ExamProvisionView } from './ExamProvisionView';
import { ExamMaterialsView } from './ExamMaterialsView';
import { MockTestsView } from './MockTestsView';

import { NewMaterialRequestModal } from './NewMaterialRequestModal';
import { UploadMaterialModal } from './UploadMaterialModal';
import { RequestDetailModal } from './RequestDetailModal';
import { ExamCategoriesModal } from './ExamCategoriesModal';

interface ExamDepartmentWorkspaceProps {
  initialSubTab?: string;
  onSubTabChange?: (tab: string) => void;
}

export const ExamDepartmentWorkspace: React.FC<ExamDepartmentWorkspaceProps> = ({
  initialSubTab = 'dashboard',
  onSubTabChange,
}) => {
  const { currentUser } = useCrm();
  const isAcademicAdmin = ['super_admin', 'exam_department_manager'].includes(currentUser?.role || '');
  const [selectedCourseId, setSelectedCourseId] = useState('course-dha-rn');
  const [activeTab, setActiveTab] = useState<string>(initialSubTab);

  // Sync when initialSubTab changes from sidebar
  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onSubTabChange?.(tab);
  };

  // Live Data Stores
  const [stats, setStats] = useState<ExamDashboardStats>({
    pendingRequestsCount: 0,
    totalExamsProvidedCount: 0,
    totalStudyMaterialsCount: 0,
    totalMockTestsCount: 0,
    categoryCounts: {},
    recentRequests: [],
  });

  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [requests, setRequests] = useState<ExamMaterialRequest[]>([]);
  const [materials, setMaterials] = useState<ExamMaterial[]>([]);
  const [mockTests, setMockTests] = useState<ExamMockTest[]>([]);
  const [provisions, setProvisions] = useState<ExamProvision[]>([]);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<string>('all');

  // Modals state
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [activeDetailRequest, setActiveDetailRequest] = useState<ExamMaterialRequest | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Preserve successful sections and report failures instead of showing empty success.
  const refreshData = useCallback(async () => {
    if (!isAcademicAdmin) return;
    setIsRefreshing(true);
    try {
      const results = await Promise.allSettled([
        examService.getDashboardStats(), examService.getCategories(),
        examService.getRequests(), examService.getMaterials(),
        examService.getMockTests(), examService.getProvisions(),
      ] as const);
      const [statsResult, categoriesResult, requestsResult, materialsResult, mocksResult, provisionsResult] = results;
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      if (categoriesResult.status === 'fulfilled') setCategories(categoriesResult.value);
      if (requestsResult.status === 'fulfilled') setRequests(requestsResult.value);
      if (materialsResult.status === 'fulfilled') setMaterials(materialsResult.value);
      if (mocksResult.status === 'fulfilled') setMockTests(mocksResult.value);
      if (provisionsResult.status === 'fulfilled') setProvisions(provisionsResult.value);
      const labels = ['dashboard', 'categories', 'requests', 'materials', 'mock tests', 'access provisions'];
      const failed = labels.filter((_, index) => results[index].status === 'rejected');
      setLoadError(failed.length ? 'Could not refresh ' + failed.join(', ') + '. Displayed values may be incomplete or out of date. Check your connection and retry.' : null);
    } finally {
      setIsRefreshing(false);
    }
  }, [isAcademicAdmin]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Request status change handler
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await examService.updateRequestStatus(id, newStatus);
      await refreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to update request status');
    }
  };

  // Request delete handler
  const handleDeleteRequest = async (id: string) => {
    try {
      await examService.deleteRequest(id);
      await refreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete request');
    }
  };

  // Material delete handler
  const handleDeleteMaterial = async (id: string) => {
    if (confirm('Are you sure you want to delete this exam material?')) {
      try {
        await examService.deleteMaterial(id);
        await refreshData();
      } catch (err: any) {
        alert(err.message || 'Failed to delete material');
      }
    }
  };

  // Material download increment
  const handleIncrementDownload = (id: string) => {
    examService.incrementDownload(id);
  };

  // Category selection from dashboard cards
  const handleSelectCategory = (categoryCode: string) => {
    setSelectedCategoryCode(categoryCode);
    handleTabChange('study-materials');
  };

  // 12 Sections Main Menu (Spec 2)
  const navTabs = [
    { id: 'operations', label: 'Operations', icon: Inbox },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'mcq-practice', label: 'MCQ Practice', icon: Target },
    { id: 'mock-tests', label: 'Mock Tests', icon: FileCheck2 },
    { id: 'study-materials', label: 'Study Materials', icon: FileText },
    { id: 'guidelines', label: 'Exam Guidelines', icon: ShieldCheck },
    { id: 'question-bank', label: 'Question Bank', icon: Database },
    { id: 'progress', label: 'Student Progress', icon: TrendingUp },
    { id: 'results', label: 'Exam Results', icon: Award },
    { id: 'requests', label: 'Material Requests', icon: Inbox },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (!isAcademicAdmin) return <div className="min-w-0 rounded-2xl bg-slate-950 p-4 sm:p-6"><ExamOperationsView /></div>;

  return (
    <div className="space-y-6 flex-1 min-w-0 overflow-x-hidden overflow-y-auto rounded-2xl bg-slate-950 p-4 sm:p-6 pb-10">
      {loadError && (
        <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p>{loadError}</p>
          <button type="button" disabled={isRefreshing} onClick={() => void refreshData()} className="shrink-0 rounded-lg border border-amber-400/50 px-3 py-2 font-semibold disabled:opacity-50">
            {isRefreshing ? 'Retrying…' : 'Retry loading'}
          </button>
        </div>
      )}
      {/* Top Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-teal-400 shrink-0 shadow-md">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Exam Department
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Healthcare Licensing Exam Preparation Platform • DHA, DOH, MOH, Prometric
            </p>
          </div>
        </div>

        {/* Top Right Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsNewRequestOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Material Request</span>
          </button>
        </div>
      </div>

      {/* 12-Section Sub-Navigation Bar (Spec 2) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-800 text-xs">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            activeTab === tab.id ||
            (tab.id === 'courses' && activeTab === 'courses') ||
            (tab.id === 'mcq-practice' && (activeTab === 'mcq' || activeTab === 'mcq-practice')) ||
            (tab.id === 'study-materials' && (activeTab === 'materials' || activeTab === 'study-materials'));

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 12-SECTION ROUTER                                                 */}
      {/* ----------------------------------------------------------------- */}

      {activeTab === 'operations' && <ExamOperationsView />}

      {/* 1. Dashboard */}
      {activeTab === 'dashboard' && (
        <ExamDashboardView
          stats={stats}
          categories={categories}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenNewRequest={() => setIsNewRequestOpen(true)}
          onOpenUpload={() => setIsUploadOpen(true)}
          onOpenManageCategories={() => setIsCategoriesModalOpen(true)}
          onSelectCategory={handleSelectCategory}
          onViewRequest={(req) => setActiveDetailRequest(req)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {/* 2. Courses / Exam Preparation */}
      {activeTab === 'courses' && (
        <CoursesManagerView
          categories={categories}
          onNavigateToSection={(sec, courseId) => { if (courseId) setSelectedCourseId(courseId); handleTabChange(sec); }}
        />
      )}

      {/* 3. MCQ Practice Questions (Interactive Runner) */}
      {(activeTab === 'mcq-practice' || activeTab === 'mcq') && (
        <InteractiveMcqPracticeView
          categories={categories}
          key={activeTab + selectedCourseId}
          initialCourseId={selectedCourseId}
        />
      )}

      {/* 4. Mock Tests (Timed Exam Simulation) */}
      {activeTab === 'mock-tests' && (
        <MockTestRunnerView
          key={activeTab + selectedCourseId}
          initialCourseId={selectedCourseId}
          onNavigateToPractice={() => handleTabChange('mcq-practice')}
          onNavigateToQuestionBank={() => handleTabChange('question-bank')}
        />
      )}

      {/* 5. Study Materials (PDF viewer & downloads) */}
      {(activeTab === 'study-materials' || activeTab === 'materials') && (
        <StudyMaterialsView
          key={activeTab + selectedCourseId}
          initialCourseId={selectedCourseId}
        />
      )}

      {/* 6. Exam Guidelines */}
      {activeTab === 'guidelines' && (
        <ExamGuidelinesView
          key={activeTab + selectedCourseId}
          initialCourseId={selectedCourseId}
        />
      )}

      {/* 7. Question Bank */}
      {activeTab === 'question-bank' && (
        <QuestionBankView
          key={activeTab + selectedCourseId}
          initialCourseId={selectedCourseId}
        />
      )}

      {/* 8. Student Progress */}
      {activeTab === 'progress' && (
        <StudentProgressView
          onNavigateToPractice={() => handleTabChange('mcq-practice')}
        />
      )}

      {/* 9. Exam Results */}
      {activeTab === 'results' && (
        <ExamResultsView />
      )}

      {/* 10. Material Requests */}
      {activeTab === 'requests' && (
        <MaterialRequestsView
          requests={requests}
          categories={categories}
          onOpenNewRequest={() => setIsNewRequestOpen(true)}
          onViewRequest={(req) => setActiveDetailRequest(req)}
          onUpdateStatus={handleUpdateStatus}
          onDeleteRequest={handleDeleteRequest}
        />
      )}

      {/* 11. Reports */}
      {activeTab === 'reports' && <ExamReportsView />}

      {/* 12. Settings */}
      {activeTab === 'settings' && <ExamSettingsView />}

      {/* Legacy Support for Exam Provisions */}
      {activeTab === 'provisions' && (
        <ExamProvisionView
          provisions={provisions}
          categories={categories}
          onRefresh={refreshData}
        />
      )}

      {/* Modals */}
      <NewMaterialRequestModal
        isOpen={isNewRequestOpen}
        onClose={() => setIsNewRequestOpen(false)}
        categories={categories}
        onSuccess={refreshData}
      />

      <UploadMaterialModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        categories={categories}
        onSuccess={refreshData}
      />

      <RequestDetailModal
        request={activeDetailRequest}
        isOpen={!!activeDetailRequest}
        onClose={() => setActiveDetailRequest(null)}
        onStatusChange={handleUpdateStatus}
        onDelete={handleDeleteRequest}
      />

      <ExamCategoriesModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        categories={categories}
        onRefresh={refreshData}
      />
    </div>
  );
};
