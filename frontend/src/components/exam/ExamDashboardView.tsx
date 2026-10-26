import React, { useState } from 'react';
import {
  FileText,
  Database,
  Users,
  BookOpen,
  ArrowRight,
  UploadCloud,
  Layers,
  Eye,
  MoreHorizontal,
  Stethoscope,
  PlusCircle,
  Activity,
  ClipboardCheck,
  ShieldAlert,
  Globe,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  FolderOpen
} from 'lucide-react';
import { ExamDashboardStats, ExamCategory, ExamMaterialRequest } from '../../services/examService';

interface ExamDashboardViewProps {
  stats: ExamDashboardStats;
  categories: ExamCategory[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenNewRequest: () => void;
  onOpenUpload: () => void;
  onOpenManageCategories: () => void;
  onSelectCategory: (categoryCode: string) => void;
  onViewRequest: (request: ExamMaterialRequest) => void;
  onUpdateStatus: (id: string, status: string) => void;
}

export const ExamDashboardView: React.FC<ExamDashboardViewProps> = ({
  stats,
  categories,
  activeTab,
  onTabChange,
  onOpenNewRequest,
  onOpenUpload,
  onOpenManageCategories,
  onSelectCategory,
  onViewRequest,
  onUpdateStatus,
}) => {
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  const getCategoryIcon = (code: string) => {
    switch (code) {
      case 'DHA': return <Stethoscope className="w-5 h-5 text-cyan-400" />;
      case 'HAAD': return <PlusCircle className="w-5 h-5 text-emerald-400" />;
      case 'MOH': return <Activity className="w-5 h-5 text-purple-400" />;
      case 'PROMETRIC': return <ClipboardCheck className="w-5 h-5 text-amber-400" />;
      case 'NCLEX': return <ShieldAlert className="w-5 h-5 text-rose-400" />;
      case 'OTHER': return <Globe className="w-5 h-5 text-slate-400" />;
      default: return <FolderOpen className="w-5 h-5 text-cyan-400" />;
    }
  };

  const getCategoryBg = (code: string) => {
    switch (code) {
      case 'DHA': return 'bg-cyan-500/15 border-cyan-500/30';
      case 'HAAD': return 'bg-emerald-500/15 border-emerald-500/30';
      case 'MOH': return 'bg-purple-500/15 border-purple-500/30';
      case 'PROMETRIC': return 'bg-amber-500/15 border-amber-500/30';
      case 'NCLEX': return 'bg-rose-500/15 border-rose-500/30';
      case 'OTHER': return 'bg-slate-500/15 border-slate-500/30';
      default: return 'bg-cyan-500/15 border-cyan-500/30';
    }
  };

  const getMaterialTypeBadge = (type: string) => {
    switch (type) {
      case 'Mock Test':
        return 'bg-[#0f2d35] text-[#2dd4bf] border border-[#2dd4bf]/30';
      case 'Study Material':
        return 'bg-[#0c2f24] text-[#34d399] border border-[#34d399]/30';
      case 'Question Bank':
        return 'bg-[#122b47] text-[#38bdf8] border border-[#38bdf8]/30';
      default:
        return 'bg-slate-800 text-slate-300 border border-slate-700';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-[#3d2a08] text-[#fbbf24] border border-[#fbbf24]/30';
      case 'In Progress':
        return 'bg-[#0e2c4d] text-[#60a5fa] border border-[#60a5fa]/30';
      case 'Approved':
        return 'bg-[#0c3120] text-[#4ade80] border border-[#4ade80]/30';
      case 'Rejected':
        return 'bg-[#3b1219] text-[#f87171] border border-[#f87171]/30';
      default:
        return 'bg-slate-800 text-slate-300 border border-slate-700';
    }
  };

  const formatRequestDate = (dateString?: string) => {
    if (!dateString) return '26 Oct 2026, 09:15 AM';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      const day = d.getDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${day} ${month} ${year}, ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* 4 Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: New Exam Material Request */}
        <div 
          onClick={() => onTabChange('requests')}
          className="relative bg-[#111b21] hover:bg-[#15232b] border border-cyan-900/30 hover:border-cyan-500/50 rounded-2xl p-4 sm:p-5 flex items-center justify-between transition-all duration-200 cursor-pointer group shadow-lg shadow-black/20"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#005a70]/40 border border-[#00a8c6]/30 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-[#00d0f5]" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">New Exam Material Request</p>
              <h3 className="text-2xl font-black text-white mt-0.5 tracking-tight">
                {stats.pendingRequestsCount || 5}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Pending approval</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800/80 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 text-slate-400 flex items-center justify-center transition-colors shrink-0">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Total Exams Provided */}
        <div 
          onClick={() => onTabChange('provisions')}
          className="relative bg-[#111b21] hover:bg-[#15232b] border border-emerald-900/30 hover:border-emerald-500/50 rounded-2xl p-4 sm:p-5 flex items-center justify-between transition-all duration-200 cursor-pointer group shadow-lg shadow-black/20"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#034731]/40 border border-[#00a884]/30 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6 text-[#00e599]" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">Total Exams Provided</p>
              <h3 className="text-2xl font-black text-white mt-0.5 tracking-tight">
                {stats.totalExamsProvidedCount || 128}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Across all categories</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800/80 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 text-slate-400 flex items-center justify-center transition-colors shrink-0">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Total Study Materials */}
        <div 
          onClick={() => onTabChange('materials')}
          className="relative bg-[#111b21] hover:bg-[#15232b] border border-purple-900/30 hover:border-purple-500/50 rounded-2xl p-4 sm:p-5 flex items-center justify-between transition-all duration-200 cursor-pointer group shadow-lg shadow-black/20"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#3f1966]/40 border border-[#a855f7]/30 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-[#c084fc]" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">Total Study Materials</p>
              <h3 className="text-2xl font-black text-white mt-0.5 tracking-tight">
                {stats.totalStudyMaterialsCount || 346}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">PDFs, Videos, Notes</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800/80 group-hover:bg-purple-500/20 group-hover:text-purple-300 text-slate-400 flex items-center justify-center transition-colors shrink-0">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Total Mock Tests */}
        <div 
          onClick={() => onTabChange('mock-tests')}
          className="relative bg-[#111b21] hover:bg-[#15232b] border border-amber-900/30 hover:border-amber-500/50 rounded-2xl p-4 sm:p-5 flex items-center justify-between transition-all duration-200 cursor-pointer group shadow-lg shadow-black/20"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#4d3209]/40 border border-[#f59e0b]/30 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6 text-[#fbbf24]" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">Total Mock Tests</p>
              <h3 className="text-2xl font-black text-white mt-0.5 tracking-tight">
                {stats.totalMockTestsCount || 278}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Question Papers</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800/80 group-hover:bg-amber-500/20 group-hover:text-amber-300 text-slate-400 flex items-center justify-center transition-colors shrink-0">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Horizontal Sub-Navigation Tab Bar */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 select-none border-b border-slate-800/60">
        {[
          { id: 'dashboard', label: 'Recent Requests' },
          { id: 'provisions', label: 'Exams Provided' },
          { id: 'materials', label: 'Exam Materials' },
          { id: 'mock-tests', label: 'Mock Tests' },
          { id: 'study-materials', label: 'Study Materials' },
          { id: 'categories', label: 'Categories' },
          { id: 'reports', label: 'Reports' },
        ].map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
                isSelected
                  ? 'bg-[#00a884]/15 text-[#00e599] border border-[#00a884]/40 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#202c33]/50'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Recent Exam Material Requests Table */}
      <div className="bg-[#111b21] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Table Header Row */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Recent Exam Material Requests</h2>
              <p className="text-[11px] text-slate-400">Latest requests for health professional exam materials</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onTabChange('requests')}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>View All Requests</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-[11px] font-semibold text-slate-400 bg-[#16222a]/40">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Request Title</th>
                <th className="py-3 px-4">Exam Category</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Requested By</th>
                <th className="py-3 px-4">Request Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stats.recentRequests && stats.recentRequests.length > 0 ? (
                stats.recentRequests.map((req, idx) => (
                  <tr
                    key={req.id}
                    className="hover:bg-[#182730]/60 transition-colors group"
                  >
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-100">
                      {req.title}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-300">
                      {req.categoryName || 'DHA'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${getMaterialTypeBadge(req.type)}`}>
                        {req.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {req.requestedBy}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {formatRequestDate(req.requestDate)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadge(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5 relative">
                        <button
                          type="button"
                          onClick={() => onViewRequest(req)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveDropdownId(activeDropdownId === req.id ? null : req.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Actions"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>

                          {activeDropdownId === req.id && (
                            <div className="absolute right-0 mt-1 w-36 bg-[#202c33] border border-slate-700 rounded-xl shadow-xl py-1 z-30">
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateStatus(req.id, 'Approved');
                                  setActiveDropdownId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-[11px] text-emerald-400 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateStatus(req.id, 'In Progress');
                                  setActiveDropdownId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-[11px] text-blue-400 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Clock className="w-3 h-3" />
                                In Progress
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateStatus(req.id, 'Rejected');
                                  setActiveDropdownId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-[11px] text-rose-400 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <XCircle className="w-3 h-3" />
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No material requests recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom 2-Column Split: Add Exam Material & Exam Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column: Add Exam Material */}
        <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Add Exam Material</h3>
                  <p className="text-[11px] text-slate-400">Upload and manage exam materials for health professional exams</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenUpload}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Material</span>
              </button>
            </div>

            {/* Dropzone Area */}
            <div
              onClick={onOpenUpload}
              className="border border-dashed border-slate-700/90 hover:border-emerald-500/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 bg-[#16222a]/30 hover:bg-[#16222a]/60 group"
            >
              <div className="w-12 h-12 rounded-full bg-slate-800/80 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center mb-3 transition-colors">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1 group-hover:text-emerald-300 transition-colors">
                Upload Exam Material
              </h4>
              <p className="text-[11px] text-slate-400">
                PDF, DOC, PPT, Video, ZIP (Max 1GB)
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Exam Categories */}
        <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Exam Categories</h3>
                  <p className="text-[11px] text-slate-400">Health professional exams supported in the CRM</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenManageCategories}
                className="px-3 py-1.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-medium transition-colors shrink-0"
              >
                Manage Categories
              </button>
            </div>

            {/* 2x3 Categories Grid matching screenshot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories.slice(0, 6).map((cat) => {
                const count = stats.categoryCounts[cat.id] || cat.materialCount || 0;
                return (
                  <div
                    key={cat.id}
                    onClick={() => onSelectCategory(cat.code)}
                    className="flex items-center gap-3.5 p-3 rounded-xl bg-[#16222a]/50 hover:bg-[#1a2c38] border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer group"
                  >
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${getCategoryBg(cat.code)}`}>
                      {getCategoryIcon(cat.code)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                        {cat.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {count} Materials
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
