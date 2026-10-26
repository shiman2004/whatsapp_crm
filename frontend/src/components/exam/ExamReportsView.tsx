import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Users,
  CheckCircle2,
  Clock,
  BookOpen,
  FileText
} from 'lucide-react';
import { ExamReportsData, examService } from '../../services/examService';

export const ExamReportsView: React.FC = () => {
  const [reports, setReports] = useState<ExamReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    examService
      .getReports()
      .then(setReports)
      .catch((err) => console.error('Failed to load reports:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <BarChart3 className="w-8 h-8 mx-auto animate-pulse text-cyan-400 mb-2" />
        <p className="text-xs">Generating exam department analytics...</p>
      </div>
    );
  }

  const breakdown = reports?.categoryBreakdown || [];

  return (
    <div className="space-y-5">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-[11px] text-slate-400 font-medium">Total Requests Logged</span>
          <h3 className="text-2xl font-black text-white mt-1">{reports?.totalRequests || 7}</h3>
          <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{reports?.approvedRequests || 1} approved</span>
          </p>
        </div>

        <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-[11px] text-slate-400 font-medium">Active In Progress</span>
          <h3 className="text-2xl font-black text-blue-400 mt-1">{reports?.inProgressRequests || 1}</h3>
          <p className="text-[11px] text-slate-400 mt-1">Under syllabus review</p>
        </div>

        <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-[11px] text-slate-400 font-medium">Material Repository</span>
          <h3 className="text-2xl font-black text-emerald-400 mt-1">{reports?.totalMaterials || 346}</h3>
          <p className="text-[11px] text-slate-400 mt-1">Across all licensing boards</p>
        </div>

        <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-[11px] text-slate-400 font-medium">Candidates Enrolled</span>
          <h3 className="text-2xl font-black text-amber-400 mt-1">{reports?.totalProvisions || 128}</h3>
          <p className="text-[11px] text-slate-400 mt-1">Active test preparation</p>
        </div>
      </div>

      {/* Category Breakdown Bars */}
      <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-cyan-400" />
            <span>Material Distribution by Exam Board</span>
          </h3>
          <span className="text-xs text-slate-400">Total 346 Learning Assets</span>
        </div>

        <div className="space-y-3.5">
          {breakdown.map((item) => (
            <div key={item.category} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">{item.category}</span>
                <span className="text-slate-400">
                  <strong className="text-white">{item.count}</strong> materials ({item.percentage}%)
                </span>
              </div>
              <div className="w-full h-2 bg-[#202c33] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${item.percentage * 3.5}%`,
                    backgroundColor:
                      item.category === 'DHA' ? '#06b6d4' :
                      item.category === 'HAAD' ? '#10b981' :
                      item.category === 'MOH' ? '#8b5cf6' :
                      item.category === 'Prometric' ? '#f59e0b' :
                      item.category === 'NCLEX' ? '#ef4444' : '#64748b'
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
