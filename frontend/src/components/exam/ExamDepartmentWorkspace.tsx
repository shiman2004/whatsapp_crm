import React, { useState, useEffect, useCallback } from 'react';
import { GraduationCap, Plus } from 'lucide-react';
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
import { MaterialRequestsView } from './MaterialRequestsView';
import { ExamMaterialsView } from './ExamMaterialsView';
import { MockTestsView } from './MockTestsView';
import { InteractiveMcqPracticeView } from './InteractiveMcqPracticeView';
import { ExamProvisionView } from './ExamProvisionView';
import { ExamReportsView } from './ExamReportsView';
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

  // Load all initial data from database
  const refreshData = useCallback(async () => {
    try {
      const [statsData, catData, reqData, matData, mockData, provData] = await Promise.all([
        examService.getDashboardStats().catch(() => null),
        examService.getCategories().catch(() => []),
        examService.getRequests().catch(() => []),
        examService.getMaterials().catch(() => []),
        examService.getMockTests().catch(() => []),
        examService.getProvisions().catch(() => []),
      ]);

      if (statsData) setStats(statsData);
      if (catData && catData.length > 0) setCategories(catData);
      if (reqData) setRequests(reqData);
      if (matData) setMaterials(matData);
      if (mockData) setMockTests(mockData);
      if (provData) setProvisions(provData);
    } catch (err) {
      console.error('Error fetching exam department data:', err);
    }
  }, []);

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
    handleTabChange('materials');
  };

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-10">
      {/* Top Header matching Screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-white shrink-0 shadow-md">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Exam Department
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Health Professional Exams • Mock Tests • Study Materials
            </p>
          </div>
        </div>

        {/* Top Right Action Button */}
        <button
          type="button"
          onClick={() => setIsNewRequestOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Exam Material Request</span>
        </button>
      </div>

      {/* Main Content Router */}
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

      {(activeTab === 'materials' || activeTab === 'study-materials') && (
        <ExamMaterialsView
          materials={materials}
          categories={categories}
          selectedCategoryCode={selectedCategoryCode}
          onOpenUpload={() => setIsUploadOpen(true)}
          onDeleteMaterial={handleDeleteMaterial}
          onIncrementDownload={handleIncrementDownload}
        />
      )}

      {activeTab === 'mock-tests' && (
        <MockTestsView
          mockTests={mockTests}
          categories={categories}
          onRefresh={refreshData}
          onNavigateToPractice={() => handleTabChange('mcq-practice')}
        />
      )}

      {(activeTab === 'mcq-practice' || activeTab === 'mcq') && (
        <InteractiveMcqPracticeView
          categories={categories}
        />
      )}

      {activeTab === 'provisions' && (
        <ExamProvisionView
          provisions={provisions}
          categories={categories}
          onRefresh={refreshData}
        />
      )}

      {activeTab === 'reports' && <ExamReportsView />}

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
