import React, { useState, useEffect } from 'react';
import {
  FileText,
  Clock,
  Send,
  AlertCircle,
  BookOpen,
  Database,
  FileCheck2,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import { examService } from '../../services/examService';

interface MyDraftsViewProps {
  onNavigateToSection?: (section: string) => void;
}

export const MyDraftsView: React.FC<MyDraftsViewProps> = ({ onNavigateToSection }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<{
    courses: any[];
    materials: any[];
    questions: any[];
    mockTests: any[];
    total: number;
  }>({
    courses: [],
    materials: [],
    questions: [],
    mockTests: [],
    total: 0,
  });

  const [activeCategory, setActiveCategory] = useState<'all' | 'courses' | 'materials' | 'questions' | 'mockTests'>('all');

  const loadDrafts = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await examService.getMyDrafts();
      setDrafts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load your drafts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrafts();
  }, []);

  const handleSubmitForReview = async (entityType: 'course' | 'material' | 'question' | 'mock_test', entityId: string) => {
    try {
      setSubmittingId(entityId);
      setActionMessage('');
      await examService.transitionAcademicContent(entityType, entityId, 'submit_for_review');
      setActionMessage('Item submitted for departmental review successfully!');
      await loadDrafts();
    } catch (err: any) {
      setError(err.message || 'Failed to submit item for review.');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleRetract = async (entityType: 'course' | 'material' | 'question' | 'mock_test', entityId: string) => {
    try {
      setSubmittingId(entityId);
      setActionMessage('');
      await examService.transitionAcademicContent(entityType, entityId, 'retract_to_draft');
      setActionMessage('Submission retracted back to personal draft.');
      await loadDrafts();
    } catch (err: any) {
      setError(err.message || 'Failed to retract item.');
    } finally {
      setSubmittingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = String(status || 'Draft').toUpperCase();
    if (s === 'PENDING_REVIEW') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <Clock className="w-3 h-3" /> Pending Review
        </span>
      );
    }
    if (s === 'CHANGES_REQUESTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <AlertCircle className="w-3 h-3" /> Changes Requested
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
        <FileText className="w-3 h-3" /> Draft
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF] tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-400" />
            <span>My Academic Drafts & Submissions</span>
          </h2>
          <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
            Manage your personal course, material, question, and mock test drafts before departmental approval.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDrafts}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E0E5E7] dark:border-[#222D34] bg-[#F0F2F5] dark:bg-[#202C33] hover:bg-[#E4E8EB] dark:hover:bg-[#2A3942] text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {actionMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200 flex items-center gap-2 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${activeCategory === 'all' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'text-slate-400 hover:text-white'}`}
        >
          All Items ({drafts.total})
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('courses')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${activeCategory === 'courses' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'text-slate-400 hover:text-white'}`}
        >
          Courses ({drafts.courses.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('materials')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${activeCategory === 'materials' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'text-slate-400 hover:text-white'}`}
        >
          Materials ({drafts.materials.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('questions')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${activeCategory === 'questions' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'text-slate-400 hover:text-white'}`}
        >
          Questions ({drafts.questions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('mockTests')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${activeCategory === 'mockTests' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'text-slate-400 hover:text-white'}`}
        >
          Mock Tests ({drafts.mockTests.length})
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading your drafts...</div>
      ) : drafts.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center space-y-3 bg-[#111b21]/40">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">No active drafts found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You currently have no unapproved drafts. Use the "Courses", "Study Materials", "Question Bank", or "Mock Tests" sections to author new content.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Courses Drafts */}
          {(activeCategory === 'all' || activeCategory === 'courses') && drafts.courses.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-teal-400" /> Course Drafts ({drafts.courses.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {drafts.courses.map(course => (
                  <div key={course.id} className="rounded-xl border border-slate-800 bg-[#111b21] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-teal-400 uppercase tracking-wide">{course.courseCode}</span>
                        <h4 className="text-sm font-bold text-white mt-0.5">{course.courseName}</h4>
                        <p className="text-xs text-slate-400">{course.profession} • {course.examAuthority}</p>
                      </div>
                      {getStatusBadge(course.status)}
                    </div>
                    {course.reviewComments && (
                      <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-300">
                        <span className="font-bold">Reviewer Feedback:</span> {course.reviewComments}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] text-slate-500">Updated {new Date(course.createdAt || Date.now()).toLocaleDateString()}</span>
                      {String(course.status).toUpperCase() === 'PENDING_REVIEW' ? (
                        <button
                          type="button"
                          onClick={() => handleRetract('course', course.id)}
                          disabled={submittingId === course.id}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Retract to Edit
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSubmitForReview('course', course.id)}
                          disabled={submittingId === course.id}
                          className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-teal-500/20"
                        >
                          <Send className="w-3 h-3" /> Submit for Review
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Study Materials Drafts */}
          {(activeCategory === 'all' || activeCategory === 'materials') && drafts.materials.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-400" /> Study Material Drafts ({drafts.materials.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {drafts.materials.map(mat => (
                  <div key={mat.id} className="rounded-xl border border-slate-800 bg-[#111b21] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wide">{mat.materialType || 'PDF'}</span>
                        <h4 className="text-sm font-bold text-white truncate mt-0.5">{mat.title}</h4>
                        <p className="text-xs text-slate-400 truncate">{mat.topic || mat.description || 'Clinical Resource'}</p>
                      </div>
                      {getStatusBadge(mat.status)}
                    </div>
                    {mat.reviewComments && (
                      <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-300">
                        <span className="font-bold">Reviewer Feedback:</span> {mat.reviewComments}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] text-slate-500">{mat.fileUrl ? 'Attached File' : 'External Link'}</span>
                      {String(mat.status).toUpperCase() === 'PENDING_REVIEW' ? (
                        <button
                          type="button"
                          onClick={() => handleRetract('material', mat.id)}
                          disabled={submittingId === mat.id}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Retract to Edit
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSubmitForReview('material', mat.id)}
                          disabled={submittingId === mat.id}
                          className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-teal-500/20"
                        >
                          <Send className="w-3 h-3" /> Submit for Review
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question Drafts */}
          {(activeCategory === 'all' || activeCategory === 'questions') && drafts.questions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-teal-400" /> Question Drafts ({drafts.questions.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {drafts.questions.map(q => (
                  <div key={q.id} className="rounded-xl border border-slate-800 bg-[#111b21] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-mono font-bold text-teal-400 uppercase tracking-wide">{q.questionCode || 'MCQ'}</span>
                        <h4 className="text-sm font-bold text-white line-clamp-2 mt-0.5">{q.title || q.questionText}</h4>
                        <p className="text-xs text-slate-400">{q.subject} • Correct: {q.correctAnswer}</p>
                      </div>
                      {getStatusBadge(q.status)}
                    </div>
                    {q.reviewComments && (
                      <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-300">
                        <span className="font-bold">Reviewer Feedback:</span> {q.reviewComments}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] text-slate-500">Difficulty: {q.difficulty || 'Medium'}</span>
                      {String(q.status).toUpperCase() === 'PENDING_REVIEW' ? (
                        <button
                          type="button"
                          onClick={() => handleRetract('question', q.id)}
                          disabled={submittingId === q.id}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Retract to Edit
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSubmitForReview('question', q.id)}
                          disabled={submittingId === q.id}
                          className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-teal-500/20"
                        >
                          <Send className="w-3 h-3" /> Submit for Review
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mock Test Drafts */}
          {(activeCategory === 'all' || activeCategory === 'mockTests') && drafts.mockTests.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-teal-400" /> Mock Test Drafts ({drafts.mockTests.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {drafts.mockTests.map(mock => (
                  <div key={mock.id} className="rounded-xl border border-slate-800 bg-[#111b21] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wide">{mock.durationMinutes || 60} Mins • {mock.totalQuestions || 50} Qs</span>
                        <h4 className="text-sm font-bold text-white truncate mt-0.5">{mock.mockTestName || mock.title}</h4>
                        <p className="text-xs text-slate-400 truncate">{mock.subjectScope || 'Exam Simulation'}</p>
                      </div>
                      {getStatusBadge(mock.status)}
                    </div>
                    {mock.reviewComments && (
                      <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-300">
                        <span className="font-bold">Reviewer Feedback:</span> {mock.reviewComments}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] text-slate-500">Pass Score: {mock.passPercentage || 70}%</span>
                      {String(mock.status).toUpperCase() === 'PENDING_REVIEW' ? (
                        <button
                          type="button"
                          onClick={() => handleRetract('mock_test', mock.id)}
                          disabled={submittingId === mock.id}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Retract to Edit
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSubmitForReview('mock_test', mock.id)}
                          disabled={submittingId === mock.id}
                          className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-teal-500/20"
                        >
                          <Send className="w-3 h-3" /> Submit for Review
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

