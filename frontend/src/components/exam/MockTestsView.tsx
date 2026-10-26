import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Clock,
  Award,
  FileCheck,
  Search,
  Download,
  Trash2,
  CheckCircle2,
  HelpCircle,
  FileText
} from 'lucide-react';
import { ExamMockTest, ExamCategory, examService } from '../../services/examService';

interface MockTestsViewProps {
  mockTests: ExamMockTest[];
  categories: ExamCategory[];
  onRefresh: () => void;
}

export const MockTestsView: React.FC<MockTestsViewProps> = ({
  mockTests,
  categories,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state for creating new mock test
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-dha');
  const [targetProfession, setTargetProfession] = useState('Registered Nurse');
  const [totalQuestions, setTotalQuestions] = useState(100);
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [passingScore, setPassingScore] = useState(65);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [questionPaperUrl, setQuestionPaperUrl] = useState('');
  const [answerKeyUrl, setAnswerKeyUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredTests = mockTests.filter((test) => {
    const matchesSearch =
      test.title.toLowerCase().includes(search.toLowerCase()) ||
      (test.targetProfession && test.targetProfession.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || test.categoryId === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleCreateMock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setLoading(true);
      const selCat = categories.find(c => c.id === categoryId);
      await examService.createMockTest({
        title: title.trim(),
        categoryId,
        categoryName: selCat?.name || 'DHA',
        targetProfession,
        totalQuestions,
        durationMinutes,
        passingScore,
        difficulty,
        questionPaperUrl: questionPaperUrl.trim(),
        answerKeyUrl: answerKeyUrl.trim(),
      });

      setTitle('');
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to create mock test');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this mock test paper?')) {
      await examService.deleteMockTest(id);
      onRefresh();
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search mock exams, question papers..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-amber-500 transition-all"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
          >
            <option value="all">All Exam Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-600/20 flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Mock Test</span>
        </button>
      </div>

      {/* Grid of Mock Tests */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTests.map((test) => (
          <div
            key={test.id}
            className="bg-[#111b21] hover:bg-[#15232b] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  {test.categoryName}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  test.difficulty === 'Hard' ? 'bg-rose-500/15 text-rose-400' :
                  test.difficulty === 'Medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                }`}>
                  {test.difficulty || 'Medium'} Difficulty
                </span>
              </div>

              <h4 className="text-sm font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
                {test.title}
              </h4>
              <p className="text-xs text-slate-400 mb-4">{test.targetProfession || 'General Healthcare'}</p>

              {/* Badges / Metrics */}
              <div className="grid grid-cols-3 gap-2 bg-[#16222a]/70 p-2.5 rounded-xl border border-slate-800/80 mb-4 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block">Questions</span>
                  <span className="text-xs font-bold text-white">{test.totalQuestions}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Duration</span>
                  <span className="text-xs font-bold text-white">{test.durationMinutes}m</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Pass Mark</span>
                  <span className="text-xs font-bold text-emerald-400">{test.passingScore}%</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.open(test.questionPaperUrl || '#', '_blank')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 border border-amber-500/30"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Question Paper</span>
                </button>
                {test.answerKeyUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(test.answerKeyUrl, '_blank')}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="View Answer Key"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDelete(test.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                title="Delete test"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for creating Mock Test */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#111b21] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Create New Mock Examination</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-xs">
                Close
              </button>
            </div>

            <form onSubmit={handleCreateMock} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. DHA Nursing Full Mock Paper 2026"
                  className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Target Profession</label>
                  <input
                    type="text"
                    value={targetProfession}
                    onChange={(e) => setTargetProfession(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Questions</label>
                  <input
                    type="number"
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Duration (Min)</label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Pass %</label>
                  <input
                    type="number"
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Question Paper URL / Cloud File</label>
                <input
                  type="url"
                  placeholder="https://.../paper.pdf"
                  value={questionPaperUrl}
                  onChange={(e) => setQuestionPaperUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Answer Key / Rubric URL</label>
                <input
                  type="url"
                  placeholder="https://.../answers.pdf"
                  value={answerKeyUrl}
                  onChange={(e) => setAnswerKeyUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs"
                >
                  Save Mock Test
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
