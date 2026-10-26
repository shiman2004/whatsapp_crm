import React, { useState, useEffect, useRef } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Plus,
  BookOpen,
  Award,
  Clock,
  Sparkles,
  Search,
  Filter,
  Trash2,
  Edit,
  History,
  GraduationCap,
  Lightbulb,
  Check,
  AlertCircle,
  FileQuestion,
  ChevronRight,
  User,
  Eye,
  TrendingUp,
  X
} from 'lucide-react';
import {
  examService,
  ExamMcqQuestion,
  ExamMcqPracticeAttempt,
  ExamMcqStats,
  ExamCategory
} from '../../services/examService';
import { API_BASE_URL } from '../../config/api';

const resolveMediaUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

interface InteractiveMcqPracticeViewProps {
  categories: ExamCategory[];
  currentUser?: { id?: string; fullName?: string; role?: string };
}

export const InteractiveMcqPracticeView: React.FC<InteractiveMcqPracticeViewProps> = ({
  categories,
  currentUser,
}) => {
  // Navigation tabs: 'practice' | 'manage' | 'history'
  const [activeTab, setActiveTab] = useState<'practice' | 'manage' | 'history'>('practice');

  // Live data
  const [questions, setQuestions] = useState<ExamMcqQuestion[]>([]);
  const [attempts, setAttempts] = useState<ExamMcqPracticeAttempt[]>([]);
  const [stats, setStats] = useState<ExamMcqStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ---------------------------------------------------------------------------
  // PRACTICE RUNNER STATE
  // ---------------------------------------------------------------------------
  const [studentName, setStudentName] = useState<string>(currentUser?.fullName || 'Candidate Student');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string>(`session-${Date.now()}`);

  // Current question attempt state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [firstSelectedAnswer, setFirstSelectedAnswer] = useState<string | null>(null);
  const [attemptsCount, setAttemptsCount] = useState<number>(0);
  const [attemptsHistory, setAttemptsHistory] = useState<string[]>([]);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean>(false);
  const [wrongOptionClicked, setWrongOptionClicked] = useState<string | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [sessionCorrectFirstTryCount, setSessionCorrectFirstTryCount] = useState<number>(0);

  // Question Timer
  const [questionSeconds, setQuestionSeconds] = useState<number>(0);
  const timerRef = useRef<any>(null);

  // ---------------------------------------------------------------------------
  // ADMIN CREATE / EDIT MODAL STATE
  // ---------------------------------------------------------------------------
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ExamMcqQuestion | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState('Nursing / Clinical Procedures');
  const [formCategoryId, setFormCategoryId] = useState('cat-dha');
  const [formQuestionText, setFormQuestionText] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formOptionA, setFormOptionA] = useState('');
  const [formOptionB, setFormOptionB] = useState('');
  const [formOptionC, setFormOptionC] = useState('');
  const [formOptionD, setFormOptionD] = useState('');
  const [formOptionE, setFormOptionE] = useState('');
  const [formCorrectAnswer, setFormCorrectAnswer] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('C');
  const [formRememberNote1, setFormRememberNote1] = useState('');
  const [formRememberNote2, setFormRememberNote2] = useState('');
  const [formRememberNote3, setFormRememberNote3] = useState('');
  const [formExplanation, setFormExplanation] = useState('');
  const [formDifficulty, setFormDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Load questions, stats and attempts
  const loadData = async () => {
    try {
      setLoading(true);
      const [qs, atts, st] = await Promise.all([
        examService.getMcqQuestions({ categoryId: selectedCategory, search: searchQuery }).catch(() => []),
        examService.getPracticeAttempts({ limit: 100 }).catch(() => []),
        examService.getMcqStats().catch(() => null)
      ]);
      setQuestions(qs);
      setAttempts(atts);
      setStats(st);
    } catch (err) {
      console.error('Failed to load MCQ practice data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  // Timer runner for current question
  useEffect(() => {
    if (activeTab === 'practice' && !sessionCompleted && !isAnswerCorrect) {
      timerRef.current = setInterval(() => {
        setQuestionSeconds((sec) => sec + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTab, sessionCompleted, isAnswerCorrect, currentIndex]);

  // Filtered questions for practice runner
  const practiceQuestions = questions.filter((q) => {
    if (selectedCategory !== 'all' && q.categoryId !== selectedCategory) return false;
    return true;
  });

  const currentQuestion: ExamMcqQuestion | undefined = practiceQuestions[currentIndex];

  // ---------------------------------------------------------------------------
  // OPTION CLICK FLOW (Immediate Verification)
  // ---------------------------------------------------------------------------
  const handleSelectOption = async (optionKey: 'A' | 'B' | 'C' | 'D' | 'E') => {
    if (!currentQuestion) return;
    if (isAnswerCorrect) return; // Already passed this question

    const newAttemptsCount = attemptsCount + 1;
    setAttemptsCount(newAttemptsCount);
    setAttemptsHistory((prev) => [...prev, optionKey]);
    setSelectedOption(optionKey);

    const firstAns = firstSelectedAnswer || optionKey;
    if (!firstSelectedAnswer) {
      setFirstSelectedAnswer(optionKey);
    }

    const isCorrect = optionKey === currentQuestion.correctAnswer;

    if (isCorrect) {
      // ✅ SUCCESS FLOW
      setIsAnswerCorrect(true);
      setWrongOptionClicked(null);

      const isFirstTry = newAttemptsCount === 1;
      if (isFirstTry) {
        setSessionCorrectFirstTryCount((prev) => prev + 1);
      }

      // Record to backend database asynchronously
      try {
        await examService.recordPracticeAttempt({
          sessionId,
          studentName: studentName.trim() || 'Candidate Student',
          studentId: currentUser?.id,
          questionId: currentQuestion.id,
          questionTitle: currentQuestion.title,
          examTitle: currentQuestion.subject || 'Clinical MCQ Practice',
          categoryId: currentQuestion.categoryId,
          firstSelectedAnswer: firstAns,
          numberOfAttempts: newAttemptsCount,
          attemptsHistory: [...attemptsHistory, optionKey],
          finalCorrectAnswer: currentQuestion.correctAnswer,
          isCorrectFirstTry: isFirstTry,
          timeSpentSeconds: questionSeconds,
        });
      } catch (recErr) {
        console.warn('Attempt logging warning:', recErr);
      }
    } else {
      // ❌ WRONG ANSWER FLOW
      setIsAnswerCorrect(false);
      setWrongOptionClicked(optionKey);
      // Gentle vibration feedback on supported mobile devices
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(100);
      }
    }
  };

  // Next Question button handler (enabled ONLY when correct)
  const handleNextQuestion = () => {
    if (currentIndex + 1 < practiceQuestions.length) {
      setCurrentIndex((prev) => prev + 1);
      // Reset question state
      setSelectedOption(null);
      setFirstSelectedAnswer(null);
      setAttemptsCount(0);
      setAttemptsHistory([]);
      setIsAnswerCorrect(false);
      setWrongOptionClicked(null);
      setQuestionSeconds(0);
    } else {
      // Completed full session
      setSessionCompleted(true);
    }
  };

  // Restart practice session
  const handleRestartPractice = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setFirstSelectedAnswer(null);
    setAttemptsCount(0);
    setAttemptsHistory([]);
    setIsAnswerCorrect(false);
    setWrongOptionClicked(null);
    setQuestionSeconds(0);
    setSessionCompleted(false);
    setSessionCorrectFirstTryCount(0);
    setSessionId(`session-${Date.now()}`);
  };

  // Open modal for new question
  const handleOpenCreateModal = () => {
    setEditingQuestion(null);
    setFormTitle(`Question ${questions.length + 1} — `);
    setFormSubject('Nursing / Clinical Procedures');
    setFormCategoryId(categories[0]?.id || 'cat-dha');
    setFormQuestionText('');
    setFormImageUrl('');
    setFormOptionA('');
    setFormOptionB('');
    setFormOptionC('');
    setFormOptionD('');
    setFormOptionE('');
    setFormCorrectAnswer('C');
    setFormRememberNote1('');
    setFormRememberNote2('');
    setFormRememberNote3('');
    setFormExplanation('');
    setFormDifficulty('Medium');
    setIsModalOpen(true);
  };

  // Open modal for editing question
  const handleOpenEditModal = (q: ExamMcqQuestion) => {
    setEditingQuestion(q);
    setFormTitle(q.title);
    setFormSubject(q.subject || 'Nursing / Clinical Procedures');
    setFormCategoryId(q.categoryId || categories[0]?.id || 'cat-dha');
    setFormQuestionText(q.questionText);
    setFormImageUrl(q.imageUrl || '');
    setFormOptionA(q.optionA);
    setFormOptionB(q.optionB);
    setFormOptionC(q.optionC);
    setFormOptionD(q.optionD);
    setFormOptionE(q.optionE);
    setFormCorrectAnswer(q.correctAnswer);
    setFormRememberNote1(q.rememberNote1);
    setFormRememberNote2(q.rememberNote2);
    setFormRememberNote3(q.rememberNote3);
    setFormExplanation(q.explanation || '');
    setFormDifficulty(q.difficulty || 'Medium');
    setIsModalOpen(true);
  };

  // Submit create / edit question
  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formQuestionText.trim()) {
      alert('Please enter question title and question text');
      return;
    }
    if (!formOptionA.trim() || !formOptionB.trim() || !formOptionC.trim() || !formOptionD.trim() || !formOptionE.trim()) {
      alert('All 5 options (A, B, C, D, E) are required');
      return;
    }
    if (!formRememberNote1.trim() || !formRememberNote2.trim() || !formRememberNote3.trim()) {
      alert('All 3 Remember Notes are required for correct answer learning');
      return;
    }

    try {
      setFormSubmitting(true);
      const selCat = categories.find((c) => c.id === formCategoryId);
      const payload: Partial<ExamMcqQuestion> = {
        title: formTitle.trim(),
        subject: formSubject.trim(),
        categoryId: formCategoryId,
        categoryName: selCat?.name || 'DHA',
        questionText: formQuestionText.trim(),
        imageUrl: formImageUrl.trim(),
        optionA: formOptionA.trim(),
        optionB: formOptionB.trim(),
        optionC: formOptionC.trim(),
        optionD: formOptionD.trim(),
        optionE: formOptionE.trim(),
        correctAnswer: formCorrectAnswer,
        rememberNote1: formRememberNote1.trim(),
        rememberNote2: formRememberNote2.trim(),
        rememberNote3: formRememberNote3.trim(),
        explanation: formExplanation.trim(),
        difficulty: formDifficulty,
      };

      if (editingQuestion) {
        await examService.updateMcqQuestion(editingQuestion.id, payload);
      } else {
        await examService.createMcqQuestion(payload);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save MCQ question');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete question
  const handleDeleteQuestion = async (id: string) => {
    if (confirm('Are you sure you want to delete this MCQ practice question?')) {
      await examService.deleteMcqQuestion(id);
      loadData();
    }
  };

  // Format time mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------------- */}
      {/* TOP HEADER & STATS BAR */}
      {/* ------------------------------------------------------------------- */}
      <div className="rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900 via-[#111b21] to-slate-900 p-5 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                <FileQuestion className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                  Interactive MCQ Practice Module
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Instant Feedback Mastery Mode • 5 Options • 3 Clinical Remember Notes
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation Pill Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-slate-800/80 p-1 border border-slate-700/60">
              <button
                type="button"
                onClick={() => setActiveTab('practice')}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'practice'
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Practice Runner</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('manage')}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'manage'
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Question Bank ({questions.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Student Logs ({attempts.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/30 transition-all hover:bg-blue-500 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Question</span>
            </button>
          </div>
        </div>

        {/* Aggregate Stats Mini-Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
            <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-2.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Questions</span>
              <p className="text-lg font-black text-white mt-0.5">{stats.totalQuestions}</p>
            </div>
            <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-2.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Student Attempts</span>
              <p className="text-lg font-black text-teal-400 mt-0.5">{stats.totalAttempts}</p>
            </div>
            <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-2.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">First-Try Accuracy</span>
              <p className="text-lg font-black text-emerald-400 mt-0.5">{stats.firstTryAccuracy}%</p>
            </div>
            <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-2.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active Students</span>
              <p className="text-lg font-black text-amber-400 mt-0.5">{stats.uniqueStudents}</p>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* TAB 1: INTERACTIVE STUDENT PRACTICE RUNNER */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'practice' && (
        <div className="space-y-4">
          {/* Practice Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#111b21] p-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-teal-400" />
                <span className="text-slate-400 font-semibold">Student Name:</span>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Enter student name..."
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white focus:border-teal-500 focus:outline-none w-48"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400 font-semibold">Exam Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentIndex(0);
                    handleRestartPractice();
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white focus:border-teal-500 focus:outline-none"
                >
                  <option value="all">All Exam Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-slate-300 font-mono text-xs bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Question Time: {formatTime(questionSeconds)}</span>
              </div>
              <button
                type="button"
                onClick={handleRestartPractice}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Restart Session"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restart</span>
              </button>
            </div>
          </div>

          {/* Empty State */}
          {practiceQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-[#111b21] p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-3">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No MCQ Questions Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                No questions exist in this category yet. Click below to add the first question or select all categories.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="mt-4 flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md hover:bg-teal-400"
              >
                <Plus className="w-4 h-4" />
                <span>Add Question Now</span>
              </button>
            </div>
          ) : sessionCompleted ? (
            /* ------------------------------------------------------------- */
            /* SESSION COMPLETED SUMMARY SCREEN */
            /* ------------------------------------------------------------- */
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-[#111b21] to-slate-900 p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mb-4 shadow-lg shadow-emerald-500/20">
                <Award className="h-8 w-8 stroke-[2.5]" />
              </div>
              <h3 className="text-xl font-black text-white">Interactive Practice Session Completed!</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                Great job, <span className="font-bold text-teal-400">{studentName}</span>! You have completed all {practiceQuestions.length} practice questions in this session.
              </p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Completed</span>
                  <p className="text-xl font-black text-white mt-0.5">{practiceQuestions.length}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">First-Try Correct</span>
                  <p className="text-xl font-black text-emerald-400 mt-0.5">
                    {sessionCorrectFirstTryCount} / {practiceQuestions.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">First-Try Accuracy</span>
                  <p className="text-xl font-black text-teal-400 mt-0.5">
                    {Math.round((sessionCorrectFirstTryCount / practiceQuestions.length) * 100)}%
                  </p>
                </div>
              </div>

              <div className="mt-8 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleRestartPractice}
                  className="flex items-center gap-2 rounded-xl bg-teal-500 px-6 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-teal-500/20 hover:bg-teal-400 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Practice Again</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-700 transition-all cursor-pointer"
                >
                  <History className="w-4 h-4" />
                  <span>View Student Attempt Records</span>
                </button>
              </div>
            </div>
          ) : (
            /* ------------------------------------------------------------- */
            /* ACTIVE QUESTION RUNNER */
            /* ------------------------------------------------------------- */
            currentQuestion && (
              <div className="space-y-4">
                {/* Progress Bar & Question Info Header */}
                <div className="rounded-xl border border-slate-800 bg-[#111b21] p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-semibold">
                    <span>
                      Question <span className="text-white font-bold">{currentIndex + 1}</span> of{' '}
                      <span className="text-white font-bold">{practiceQuestions.length}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-teal-500/10 px-2 py-0.5 text-[11px] font-bold text-teal-400 border border-teal-500/20">
                        {currentQuestion.subject || 'Clinical Practice'}
                      </span>
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                        {currentQuestion.categoryName || 'DHA'}
                      </span>
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-amber-400 font-bold">
                        {currentQuestion.difficulty || 'Medium'}
                      </span>
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300 rounded-full"
                      style={{ width: `${((currentIndex + 1) / practiceQuestions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Question Card */}
                <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-5 sm:p-7 shadow-lg space-y-5">
                  {/* Question Title */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                      {currentQuestion.title}
                    </h3>
                    {attemptsCount > 0 && (
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/60">
                        Attempt {attemptsCount}
                      </span>
                    )}
                  </div>

                  {/* Question Text */}
                  <p className="text-sm sm:text-base leading-relaxed text-slate-200 font-medium">
                    {currentQuestion.questionText}
                  </p>

                  {/* Optional Image */}
                  {currentQuestion.imageUrl && (
                    <div className="my-3 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950 max-h-72 flex items-center justify-center">
                      <img
                        src={resolveMediaUrl(currentQuestion.imageUrl)}
                        alt={currentQuestion.title}
                        className="object-contain max-h-72 w-full"
                      />
                    </div>
                  )}

                  {/* --------------------------------------------------------- */}
                  {/* 5 OPTIONS: A, B, C, D, E */}
                  {/* --------------------------------------------------------- */}
                  <div className="space-y-2.5 pt-2">
                    {[
                      { key: 'A' as const, text: currentQuestion.optionA },
                      { key: 'B' as const, text: currentQuestion.optionB },
                      { key: 'C' as const, text: currentQuestion.optionC },
                      { key: 'D' as const, text: currentQuestion.optionD },
                      { key: 'E' as const, text: currentQuestion.optionE },
                    ].map((opt) => {
                      const isOptionCorrect = isAnswerCorrect && opt.key === currentQuestion.correctAnswer;
                      const isOptionWrongAttempt = wrongOptionClicked === opt.key && !isAnswerCorrect;

                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => handleSelectOption(opt.key)}
                          disabled={isAnswerCorrect}
                          className={`w-full text-left flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl border transition-all duration-150 cursor-pointer ${
                            isOptionCorrect
                              ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500'
                              : isOptionWrongAttempt
                              ? 'bg-rose-500/15 border-rose-500 text-white animate-shake ring-1 ring-rose-500'
                              : 'bg-slate-900/60 border-slate-800 text-slate-200 hover:border-slate-600 hover:bg-slate-800/60 active:bg-slate-800'
                          }`}
                        >
                          {/* Option Bubble Letter */}
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black transition-all ${
                              isOptionCorrect
                                ? 'bg-emerald-500 text-slate-950'
                                : isOptionWrongAttempt
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {isOptionCorrect ? <Check className="w-4 h-4 stroke-[3]" /> : opt.key}
                          </span>

                          {/* Option Text */}
                          <span className="flex-1 text-xs sm:text-sm font-medium leading-normal pt-0.5">
                            {opt.text}
                          </span>

                          {/* Visual Indicator Pill */}
                          {isOptionCorrect && (
                            <span className="shrink-0 rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-slate-950 uppercase tracking-wide">
                              Correct Answer
                            </span>
                          )}
                          {isOptionWrongAttempt && (
                            <span className="shrink-0 rounded-md bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wide">
                              Wrong
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* --------------------------------------------------------- */}
                  {/* IMMEDIATE FEEDBACK BANNERS (Strictly adhering to spec) */}
                  {/* --------------------------------------------------------- */}

                  {/* WRONG ANSWER BANNER */}
                  {wrongOptionClicked && !isAnswerCorrect && (
                    <div className="flex items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-rose-300 animate-in fade-in slide-in-from-top-1 duration-200">
                      <XCircle className="w-5 h-5 shrink-0 text-rose-400 stroke-[2.5]" />
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm font-bold text-white">
                          ❌ Your answer is wrong. Please try again.
                        </p>
                        <p className="text-[11px] text-rose-300/80 mt-0.5">
                          You can review the clinical scenario and choose another option.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* CORRECT ANSWER BANNER + 3 REMEMBER NOTES */}
                  {isAnswerCorrect && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      {/* Success Banner */}
                      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-emerald-300">
                        <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 stroke-[2.5]" />
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-white">
                            ✅ Your answer is correct.
                          </p>
                          <p className="text-[11px] text-emerald-300/80 mt-0.5">
                            Excellent! Review the 3 Remember Notes below for high-yield exam retention.
                          </p>
                        </div>
                      </div>

                      {/* 3 REMEMBER NOTES CARD */}
                      <div className="rounded-xl border border-teal-500/30 bg-gradient-to-br from-teal-950/20 via-slate-900 to-slate-900 p-4 sm:p-5 shadow-md">
                        <div className="flex items-center gap-2 text-teal-400 mb-3">
                          <Lightbulb className="w-4 h-4 stroke-[2.5]" />
                          <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                            Remember Notes
                          </h4>
                        </div>

                        <ul className="space-y-2.5">
                          <li className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[11px] font-black mt-0.5">
                              1
                            </span>
                            <span>{currentQuestion.rememberNote1}</span>
                          </li>

                          <li className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[11px] font-black mt-0.5">
                              2
                            </span>
                            <span>{currentQuestion.rememberNote2}</span>
                          </li>

                          <li className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[11px] font-black mt-0.5">
                              3
                            </span>
                            <span>{currentQuestion.rememberNote3}</span>
                          </li>
                        </ul>

                        {/* Optional Explanation */}
                        {currentQuestion.explanation && (
                          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 leading-relaxed">
                            <span className="font-bold text-slate-300">Clinical Rationale: </span>
                            {currentQuestion.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* --------------------------------------------------------- */}
                  {/* NEXT QUESTION BUTTON (Enabled ONLY when answer is correct) */}
                  {/* --------------------------------------------------------- */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <span className="text-xs text-slate-400">
                      {!isAnswerCorrect
                        ? 'Select the correct option to unlock the next question'
                        : 'Answer verified! Click next to continue'}
                    </span>

                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      disabled={!isAnswerCorrect}
                      className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold transition-all shadow-md cursor-pointer ${
                        isAnswerCorrect
                          ? 'bg-teal-500 text-slate-950 shadow-teal-500/25 hover:bg-teal-400 active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <span>
                        {currentIndex + 1 < practiceQuestions.length ? 'Next Question' : 'Complete Practice'}
                      </span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 2: QUESTION BANK & MANAGE (ADMIN VIEW) */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'manage' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between rounded-xl border border-slate-800 bg-[#111b21] p-3 text-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search questions or topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="flex items-center gap-1.5 rounded-lg bg-teal-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-teal-400"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>New Question</span>
              </button>
            </div>
          </div>

          {/* Questions Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111b21]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Question Title / Topic</th>
                  <th className="py-3 px-4">Category / Subject</th>
                  <th className="py-3 px-4 text-center">Correct Answer</th>
                  <th className="py-3 px-4">Difficulty</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {questions.map((q, idx) => (
                  <tr key={q.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-white">{q.title}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{q.questionText}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="rounded bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-400 border border-teal-500/20">
                        {q.categoryName || 'DHA'}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{q.subject}</p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-slate-950 font-black text-xs">
                        {q.correctAnswer}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          q.difficulty === 'Easy'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : q.difficulty === 'Hard'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {q.difficulty || 'Medium'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentIndex(idx);
                            setActiveTab('practice');
                          }}
                          className="p-1.5 text-slate-400 hover:text-teal-400 rounded-lg hover:bg-slate-800 transition-colors"
                          title="Practice this question"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(q)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 transition-colors"
                          title="Edit question"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                          title="Delete question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 3: STUDENT PRACTICE ATTEMPTS HISTORY */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-[#111b21] p-3 text-xs flex items-center justify-between">
            <span className="text-slate-300 font-semibold">
              Live Practice Audit Logs • {attempts.length} attempts recorded
            </span>
            <button
              type="button"
              onClick={loadData}
              className="flex items-center gap-1.5 text-teal-400 hover:text-teal-300"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Refresh Logs</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111b21]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Exam / Paper</th>
                  <th className="py-3 px-4">Question</th>
                  <th className="py-3 px-4 text-center">First Answer</th>
                  <th className="py-3 px-4 text-center">Attempts</th>
                  <th className="py-3 px-4 text-center">Final Answer</th>
                  <th className="py-3 px-4">Time Spent</th>
                  <th className="py-3 px-4 text-right">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {attempts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No student practice attempts recorded yet.
                    </td>
                  </tr>
                ) : (
                  attempts.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{att.studentName}</td>
                      <td className="py-3 px-4 text-slate-300">{att.examTitle || 'MCQ Practice'}</td>
                      <td className="py-3 px-4 text-slate-200 font-medium max-w-xs truncate">
                        {att.questionTitle || att.questionId}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-md font-black text-xs ${
                            att.firstSelectedAnswer === att.finalCorrectAnswer
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {att.firstSelectedAnswer}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            att.numberOfAttempts === 1
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {att.numberOfAttempts} {att.numberOfAttempts === 1 ? 'attempt' : 'attempts'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-slate-950 font-black text-xs">
                          {att.finalCorrectAnswer}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {att.timeSpentSeconds}s
                      </td>
                      <td className="py-3 px-4 text-right text-[11px] text-slate-400">
                        {new Date(att.createdAt).toLocaleDateString()} {new Date(att.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL: CREATE / EDIT MCQ QUESTION */}
      {/* ------------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-[#111b21] shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  <FileQuestion className="w-4 h-4" />
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {editingQuestion ? 'Edit MCQ Practice Question' : 'Create New MCQ Practice Question'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitQuestion} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Question Title / Topic *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Question 1 — Blood Transfusion Reaction"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Exam Category *</label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:border-teal-500 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Subject / Domain</label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="e.g. Nursing / Clinical Procedures"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Difficulty</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:border-teal-500 focus:outline-none"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Question Text */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Question Scenario / Text *</label>
                <textarea
                  required
                  rows={3}
                  value={formQuestionText}
                  onChange={(e) => setFormQuestionText(e.target.value)}
                  placeholder="Fifteen minutes after starting a blood transfusion, a patient develops chills..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white text-xs focus:border-teal-500 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Optional Question Image */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Question Image URL (Optional)</label>
                <input
                  type="text"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://... or /uploads/clinical_ecg.png"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:border-teal-500 focus:outline-none"
                />
              </div>

              {/* 5 OPTIONS: A, B, C, D, E */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    5 Options (A, B, C, D, E) & Correct Answer Selector
                  </span>
                  <span className="text-[11px] text-teal-400 font-bold">Select the Radio button for the correct answer</span>
                </div>

                {[
                  { key: 'A' as const, val: formOptionA, setVal: setFormOptionA },
                  { key: 'B' as const, val: formOptionB, setVal: setFormOptionB },
                  { key: 'C' as const, val: formOptionC, setVal: setFormOptionC },
                  { key: 'D' as const, val: formOptionD, setVal: setFormOptionD },
                  { key: 'E' as const, val: formOptionE, setVal: setFormOptionE },
                ].map(({ key, val, setVal }) => (
                  <div key={key} className="flex items-center gap-2.5">
                    <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                      <input
                        type="radio"
                        name="correctAnswerRadio"
                        checked={formCorrectAnswer === key}
                        onChange={() => setFormCorrectAnswer(key)}
                        className="accent-teal-500 w-4 h-4 cursor-pointer"
                      />
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md font-bold text-xs ${
                          formCorrectAnswer === key
                            ? 'bg-emerald-500 text-slate-950 font-black'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {key}
                      </span>
                    </label>

                    <input
                      type="text"
                      required
                      value={val}
                      onChange={(e) => setVal(e.target.value)}
                      placeholder={`Option ${key} text...`}
                      className={`flex-1 rounded-xl border px-3 py-1.5 text-xs text-white bg-slate-900 focus:outline-none ${
                        formCorrectAnswer === key
                          ? 'border-emerald-500/70 ring-1 ring-emerald-500/40'
                          : 'border-slate-700 focus:border-teal-500'
                      }`}
                    />
                  </div>
                ))}
              </div>

              {/* 3 REMEMBER NOTES */}
              <div className="rounded-xl border border-teal-500/30 bg-teal-950/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-teal-400">
                  <Lightbulb className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    3 Remember Notes for the Correct Answer (Mandatory)
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-300 text-[11px] font-bold">
                      1
                    </span>
                    <input
                      type="text"
                      required
                      value={formRememberNote1}
                      onChange={(e) => setFormRememberNote1(e.target.value)}
                      placeholder="Remember Note 1: e.g. Suspected acute transfusion reaction → STOP the blood transfusion immediately."
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:border-teal-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-300 text-[11px] font-bold">
                      2
                    </span>
                    <input
                      type="text"
                      required
                      value={formRememberNote2}
                      onChange={(e) => setFormRememberNote2(e.target.value)}
                      placeholder="Remember Note 2: e.g. Maintain IV access with 0.9% normal saline using new tubing."
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:border-teal-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-300 text-[11px] font-bold">
                      3
                    </span>
                    <input
                      type="text"
                      required
                      value={formRememberNote3}
                      onChange={(e) => setFormRememberNote3(e.target.value)}
                      placeholder="Remember Note 3: e.g. Assess patient, monitor vital signs, and notify physician & blood bank."
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Clinical Explanation */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Clinical Rationale / Explanation (Optional)</label>
                <textarea
                  rows={2}
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                  placeholder="Additional background pathophysiology or guideline references..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white text-xs focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-md hover:bg-teal-400 disabled:opacity-50 cursor-pointer"
                >
                  {formSubmitting ? 'Saving...' : editingQuestion ? 'Update Question' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
