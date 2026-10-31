import React, { useState, useEffect } from 'react';
import {
  Award,
  Search,
  Filter,
  Download,
  Printer,
  CheckCircle2,
  XCircle,
  Eye,
  Calendar,
  Clock,
  Sparkles,
  ShieldCheck,
  FileCheck2
} from 'lucide-react';
import {
  examService,
  ExamMockTestAttemptRecord
} from '../../services/examService';

export const ExamResultsView: React.FC = () => {
  const [results, setResults] = useState<ExamMockTestAttemptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('all');

  // Review modal
  const [activeReview, setActiveReview] = useState<ExamMockTestAttemptRecord | null>(null);

  const loadResults = async () => {
    try {
      setLoading(true);
      const data = await examService.getMockTestResults();
      setResults(data);
    } catch (err) {
      console.error('Failed to load exam results:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, []);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}m ${secs}s`;
  };

  const filteredResults = results.filter((r) => {
    const matchSearch =
      r.studentName.toLowerCase().includes(search.toLowerCase()) ||
      r.mockTestName.toLowerCase().includes(search.toLowerCase());
    const matchRes = resultFilter === 'all' || r.result === resultFilter;
    return matchSearch && matchRes;
  });

  const exportCsv = () => {
    if (results.length === 0) return;
    const header = 'Student Name,Mock Test,Score,Percentage,Result,Time Taken (s),Date\n';
    const rows = results.map(
      (r) =>
        `"${r.studentName}","${r.mockTestName}",${r.score}/${r.totalQuestions},${r.percentage}%,${r.result},${r.timeTakenSeconds},"${r.submittedAt}"`
    );
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `mock_exam_results_${Date.now()}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-[#111B21] dark:text-[#E9EDEF] tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-teal-400" />
            <span>Mock Examination Official Results & Audit Log</span>
          </h2>
          <p className="text-xs text-[#667781] dark:text-[#8696A0] font-medium mt-0.5">
            Audit history of completed mock exam simulations with scored answers snapshot.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4 text-teal-400" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#111b21] p-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate name or mock test..."
            className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 font-semibold">Result:</span>
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-white focus:outline-none"
          >
            <option value="all">All Results</option>
            <option value="PASS">PASS</option>
            <option value="FAIL">FAIL</option>
          </select>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#111b21] overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading exam results...</div>
        ) : filteredResults.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No mock examination records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Mock Examination</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Percentage</th>
                  <th className="py-3 px-4">Result</th>
                  <th className="py-3 px-4">Time Taken</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredResults.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-white whitespace-nowrap">{r.studentName}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-300 font-medium">
                      {r.mockTestName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-teal-400">
                      {r.score} / {r.totalQuestions}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono font-bold">{r.percentage}%</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase ${
                          r.result === 'PASS'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {r.result}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400">
                      {formatTime(r.timeTakenSeconds)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      {new Date(r.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setActiveReview(r)}
                        className="px-3 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Review</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Snapshot Modal */}
      {activeReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-6 w-full max-w-3xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white">{activeReview.mockTestName}</h3>
                <span className="text-xs text-slate-400">
                  Candidate: {activeReview.studentName} • Score: {activeReview.score}/{activeReview.totalQuestions} ({activeReview.percentage}%)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveReview(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {activeReview.answersSnapshot && activeReview.answersSnapshot.length > 0 ? (
                activeReview.answersSnapshot.map((ans, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-4 space-y-2 text-xs ${
                      ans.isCorrect
                        ? 'border-emerald-500/40 bg-emerald-950/10'
                        : 'border-rose-500/40 bg-rose-950/10'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="font-mono text-teal-400">Question {idx + 1}</span>
                      <span className={ans.isCorrect ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {ans.isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>

                    <p className="font-bold text-white leading-relaxed">{ans.questionText}</p>

                    <div className="flex items-center gap-4 text-[11px] pt-1">
                      <span className="text-slate-300">
                        Selected: <strong className={ans.isCorrect ? 'text-emerald-400' : 'text-rose-400'}>{ans.studentAnswer || 'None'}</strong>
                      </span>
                      <span className="text-slate-300">
                        Correct: <strong className="text-emerald-400">{ans.correctAnswer}</strong>
                      </span>
                    </div>

                    {ans.rememberNotes && ans.rememberNotes.length > 0 && (
                      <div className="rounded-lg bg-slate-900/60 p-2.5 text-slate-400 text-[11px] space-y-0.5">
                        <span className="text-teal-400 font-bold block mb-1">Remember Notes:</span>
                        {ans.rememberNotes.map((n, i) => (
                          <p key={i}>• {n}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No snapshot details available for this attempt.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
