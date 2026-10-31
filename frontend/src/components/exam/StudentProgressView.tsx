import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Award,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  BookOpen,
  Target,
  Sparkles,
  BarChart2,
  ShieldAlert,
  Zap
} from 'lucide-react';
import {
  examService,
  StudentProgressAnalyticsData
} from '../../services/examService';

interface StudentProgressViewProps {
  currentUser?: { id?: string; fullName?: string };
  onNavigateToPractice?: (subjectName?: string) => void;
}

export const StudentProgressView: React.FC<StudentProgressViewProps> = ({
  currentUser,
  onNavigateToPractice,
}) => {
  const [analytics, setAnalytics] = useState<StudentProgressAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProgress = async () => {
    try {
      setLoading(true);
      const data = await examService.getStudentProgressAnalytics(
        currentUser?.id,
        currentUser?.fullName || 'Candidate Student'
      );
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load student progress:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-[#111B21] dark:text-[#E9EDEF] tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-400" />
            <span>Candidate Learning Progress & Mastery</span>
          </h2>
          <p className="text-xs text-[#667781] dark:text-[#8696A0] font-medium mt-0.5">
            Real-time tracking of clinical attempts, first-try accuracy, and weak subject recommendations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateToPractice?.()}
          className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-teal-500/20 flex items-center gap-2 cursor-pointer"
        >
          <span>Continue Practice</span>
          <ArrowRight className="w-4 h-4 stroke-[3]" />
        </button>
      </div>

      {loading || !analytics ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading learning analytics...</div>
      ) : (
        <div className="space-y-6">
          {/* Top Summary Cards (Spec 41) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-4 shadow-lg">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Questions Attempted
              </span>
              <p className="text-2xl font-black text-white mt-1">
                {analytics.totalQuestionsAttempted}
              </p>
              <span className="text-[10px] text-teal-400 font-medium mt-1 block">Active Session</span>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-4 shadow-lg">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Overall Accuracy
              </span>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                {analytics.accuracyRate}%
              </p>
              <span className="text-[10px] text-slate-400 font-medium mt-1 block">Across All Clinical MCQs</span>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-4 shadow-lg">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Avg. Attempts / Q
              </span>
              <p className="text-2xl font-black text-amber-400 mt-1">
                {analytics.averageAttemptsPerQuestion}
              </p>
              <span className="text-[10px] text-slate-400 font-medium mt-1 block">Retry Efficiency</span>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-4 shadow-lg">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Time Studied
              </span>
              <p className="text-2xl font-black text-teal-300 mt-1">
                {analytics.timeStudiedMinutes}m
              </p>
              <span className="text-[10px] text-slate-400 font-medium mt-1 block">Total Practice Time</span>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* WEAK AREA ANALYSIS (Spec 42: <60% Weak, 60-79% Needs Imp, 80%+ Strong) */}
          {/* ------------------------------------------------------------- */}
          <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-teal-400" />
                  <span>Clinical Subject Mastery & Weak Area Breakdown</span>
                </h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                  Automated performance categorization based on exam preparedness standards.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Strong (80%+)
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Needs Work (60-79%)
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  Weak (&lt;60%)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {analytics.subjectsAnalysis.map((item) => {
                const isWeak = item.status === 'Weak';
                const isNeedsWork = item.status === 'Needs Improvement';

                return (
                  <div
                    key={item.subject}
                    className={`rounded-xl border p-4 space-y-2.5 transition-all ${
                      isWeak
                        ? 'border-rose-500/40 bg-rose-950/10'
                        : isNeedsWork
                        ? 'border-amber-500/40 bg-amber-950/10'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white text-sm">{item.subject}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          isWeak
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : isNeedsWork
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {item.status} ({item.accuracy}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isWeak
                            ? 'bg-rose-500'
                            : isNeedsWork
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${item.accuracy}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{item.correctFirstTry} first-try correct</span>
                      <span>{item.totalQuestions} questions practiced</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* RECOMMENDED FOR YOU (Spec 43: Generated from weak areas)      */}
          {/* ------------------------------------------------------------- */}
          <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-br from-teal-950/20 via-[#111b21] to-slate-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-teal-400">
              <Zap className="w-5 h-5 stroke-[2.5]" />
              <h3 className="text-base font-black text-white">Recommended Practice For You</h3>
            </div>
            <p className="text-xs text-slate-300">
              Targeted practice sets generated automatically to boost your lowest scoring examination subjects before test day.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {analytics.recommendedPractice.map((rec, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-800 bg-[#111b21] p-4 flex items-center justify-between gap-4 shadow-md hover:border-teal-500/40 transition-colors"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-rose-400">
                      Current Mastery: {rec.accuracy}%
                    </span>
                    <h4 className="text-sm font-bold text-white">{rec.subject}</h4>
                    <p className="text-xs text-slate-400">{rec.recommendation}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigateToPractice?.(rec.subject)}
                    className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all shrink-0 cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    <span>Practice</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
