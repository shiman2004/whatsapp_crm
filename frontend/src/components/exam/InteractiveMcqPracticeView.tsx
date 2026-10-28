import React, { useState, useEffect, useRef } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
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
  ChevronRight,
  User,
  Eye,
  TrendingUp,
  X
} from 'lucide-react';
import {
  examService,
  ExamPlatformQuestion,
  ExamMcqPracticeAttempt,
  ExamCategory,
  ExamPracticeSessionData
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
  categories?: ExamCategory[];
  currentUser?: { id?: string; fullName?: string; role?: string };
  initialCourseId?: string;
}

export const InteractiveMcqPracticeView: React.FC<InteractiveMcqPracticeViewProps> = ({
  categories = [],
  currentUser,
  initialCourseId = 'course-dha-rn',
}) => {
  // Navigation tabs: 'practice' | 'manage' | 'history'
  const [activeTab, setActiveTab] = useState<'practice' | 'manage' | 'history'>('practice');

  // Live questions
  const [questions, setQuestions] = useState<ExamPlatformQuestion[]>([]);
  const [attempts, setAttempts] = useState<ExamMcqPracticeAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCourse, setSelectedCourse] = useState<string>(initialCourseId);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ---------------------------------------------------------------------------
  // PRACTICE RUNNER STATE (Spec 8 - 18 & User Reference Screenshot)
  // ---------------------------------------------------------------------------
  const [studentName, setStudentName] = useState<string>(currentUser?.fullName || 'Candidate Student');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [questionsPerPage, setQuestionsPerPage] = useState<number>(20);
  const [navigatorPage, setNavigatorPage] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string>(`session-${Date.now()}`);

  // Persistent Question-State Map across session: { [questionId]: { completed: boolean, wrongChoices: string[], isCorrect: boolean, serverFeedback?: any } }
  const [questionProgress, setQuestionProgress] = useState<
    Record<
      string,
      {
        completed: boolean;
        wrongChoices: string[];
        isCorrect: boolean;
        selectedOption: string | null;
        firstChoice: string | null;
        attemptsCount: number;
        serverFeedback?: {
          correctAnswer?: string;
          rememberNotes?: string[];
          detailedExplanation?: string;
        };
      }
    >
  >({});

  // Current Question UI State
  const [checkingAnswer, setCheckingAnswer] = useState<boolean>(false);
  const [lastFeedbackMessage, setLastFeedbackMessage] = useState<string | null>(null);
  const [questionSeconds, setQuestionSeconds] = useState<number>(0);
  const timerRef = useRef<any>(null);

  // Load questions and previous session
  const loadData = async () => {
    try {
      setLoading(true);
      const [qs, sessionData, atts] = await Promise.all([
        examService.getQuestionBank({
          courseId: selectedCourse,
          subjectId: selectedSubject,
          search: searchQuery,
        }),
        examService.getPracticeSession(selectedCourse, currentUser?.id).catch(() => null),
        examService.getPracticeAttempts({ limit: 100 }).catch(() => []),
      ]);

      setQuestions(qs);
      setAttempts(atts);

      // Restore session if available
      if (sessionData && sessionData.completedQuestionIds) {
        const restoredMap: Record<string, any> = {};
        sessionData.completedQuestionIds.forEach((qId: string) => {
          restoredMap[qId] = {
            completed: true,
            isCorrect: true,
            wrongChoices: [],
            selectedOption: null,
            firstChoice: null,
            attemptsCount: 1,
          };
        });
        if (sessionData.questionAttemptsState) {
          Object.assign(restoredMap, sessionData.questionAttemptsState);
        }
        setQuestionProgress(restoredMap);
        if (sessionData.currentQuestionIndex < qs.length) {
          setCurrentIndex(sessionData.currentQuestionIndex);
        }
      }
    } catch (err) {
      console.error('Failed to load MCQ practice data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCourse, selectedSubject]);

  // Question Timer
  useEffect(() => {
    const currentQ = questions[currentIndex];
    const isAlreadyDone = currentQ && questionProgress[currentQ.id]?.isCorrect;

    if (activeTab === 'practice' && !isAlreadyDone) {
      timerRef.current = setInterval(() => {
        setQuestionSeconds((sec) => sec + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTab, currentIndex, questionProgress, questions]);

  const currentQuestion = questions[currentIndex];
  const currentQState = currentQuestion ? questionProgress[currentQuestion.id] : undefined;
  const isCurrentQCorrect = currentQState?.isCorrect || false;
  const wrongChoices = currentQState?.wrongChoices || [];
  const attemptsCount = currentQState?.attemptsCount || 0;

  // ---------------------------------------------------------------------------
  // OPTION CLICK FLOW (Server-Side Immediate Validation - Spec 12 & 13)
  // ---------------------------------------------------------------------------
  const handleSelectOption = async (optionKey: 'A' | 'B' | 'C' | 'D' | 'E') => {
    if (!currentQuestion || isCurrentQCorrect || checkingAnswer) return;
    if (wrongChoices.includes(optionKey)) return; // Already tried and wrong

    try {
      setCheckingAnswer(true);
      const newAttempts = attemptsCount + 1;
      const firstChoice = currentQState?.firstChoice || optionKey;

      // Validate on server
      const result = await examService.checkPracticeAnswerServer({
        questionId: currentQuestion.id,
        selectedAnswer: optionKey,
        attemptNumber: newAttempts,
        timeSpentSeconds: questionSeconds,
        studentName,
      });

      if (result.isCorrect) {
        // ✅ CORRECT FLOW (Spec 13 & Spec 14)
        const updatedState = {
          completed: true,
          isCorrect: true,
          selectedOption: optionKey,
          firstChoice,
          wrongChoices,
          attemptsCount: newAttempts,
          serverFeedback: {
            correctAnswer: result.correctAnswer || optionKey,
            rememberNotes: result.rememberNotes || [
              currentQuestion.rememberNote1,
              currentQuestion.rememberNote2,
              currentQuestion.rememberNote3,
            ],
            detailedExplanation: result.detailedExplanation || currentQuestion.detailedExplanation,
          },
        };

        const newMap = {
          ...questionProgress,
          [currentQuestion.id]: updatedState,
        };
        setQuestionProgress(newMap);
        setLastFeedbackMessage('✅ Your answer is correct.');

        // Auto-save practice session to backend (Spec 17)
        const completedIds = Object.keys(newMap).filter((id) => newMap[id]?.isCorrect);
        await examService.savePracticeSession({
          courseId: selectedCourse,
          studentId: currentUser?.id,
          studentName,
          currentQuestionIndex: currentIndex,
          completedQuestionIds: completedIds,
          questionAttemptsState: newMap,
          totalTimeSpent: questionSeconds,
        });
      } else {
        // ❌ WRONG FLOW (Spec 12)
        const updatedState = {
          completed: false,
          isCorrect: false,
          selectedOption: optionKey,
          firstChoice,
          wrongChoices: [...wrongChoices, optionKey],
          attemptsCount: newAttempts,
        };

        setQuestionProgress((prev) => ({
          ...prev,
          [currentQuestion.id]: updatedState,
        }));
        setLastFeedbackMessage('❌ Your answer is wrong. Please try again.');

        // Gentle vibration feedback on supported mobile devices
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(100);
        }
      }
    } catch (err: any) {
      console.warn('Answer validation fallback:', err.message);
      // Fallback local check if network dropped
      const isCorrectLocal = optionKey === currentQuestion.correctAnswer;
      if (isCorrectLocal) {
        setQuestionProgress((prev) => ({
          ...prev,
          [currentQuestion.id]: {
            completed: true,
            isCorrect: true,
            selectedOption: optionKey,
            firstChoice: currentQState?.firstChoice || optionKey,
            wrongChoices,
            attemptsCount: attemptsCount + 1,
            serverFeedback: {
              correctAnswer: currentQuestion.correctAnswer,
              rememberNotes: [
                currentQuestion.rememberNote1,
                currentQuestion.rememberNote2,
                currentQuestion.rememberNote3,
              ],
              detailedExplanation: currentQuestion.detailedExplanation,
            },
          },
        }));
        setLastFeedbackMessage('✅ Your answer is correct.');
      } else {
        setQuestionProgress((prev) => ({
          ...prev,
          [currentQuestion.id]: {
            completed: false,
            isCorrect: false,
            selectedOption: optionKey,
            firstChoice: currentQState?.firstChoice || optionKey,
            wrongChoices: [...wrongChoices, optionKey],
            attemptsCount: attemptsCount + 1,
          },
        }));
        setLastFeedbackMessage('❌ Your answer is wrong. Please try again.');
      }
    } finally {
      setCheckingAnswer(false);
    }
  };

  // Next Question button handler (enabled ONLY when correct - Spec 13 & 16)
  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setLastFeedbackMessage(null);
      setQuestionSeconds(0);
    }
  };

  // Previous Question button handler
  const handlePreviousQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setLastFeedbackMessage(null);
      setQuestionSeconds(0);
    }
  };

  // Jump to specific question from Question Navigator
  const handleJumpToQuestion = (idx: number) => {
    if (idx >= 0 && idx < questions.length) {
      setCurrentIndex(idx);
      setLastFeedbackMessage(null);
      setQuestionSeconds(0);
    }
  };

  // Restart practice session (Spec 17)
  const handleRestartSession = async () => {
    if (confirm('Restart practice from Question 1? Your progress will be reset.')) {
      try {
        await examService.restartPracticeSession(selectedCourse, currentUser?.id);
      } catch (e) {}
      setQuestionProgress({});
      setCurrentIndex(0);
      setLastFeedbackMessage(null);
      setQuestionSeconds(0);
      setSessionId(`session-${Date.now()}`);
    }
  };

  // Calculations for progress panel matching user screenshot (e.g. 29 / 90)
  const totalQuestionsCount = questions.length || 90;
  const pageCount = Math.max(1, Math.ceil(questions.length / questionsPerPage));
  const navigatorStart = navigatorPage * questionsPerPage;
  const navigatorQuestions = questions.slice(navigatorStart, navigatorStart + questionsPerPage);
  const completedCorrectCount = Object.keys(questionProgress).filter(
    (id) => questionProgress[id]?.isCorrect
  ).length;
  const progressPercent =
    totalQuestionsCount > 0 ? Math.round((completedCorrectCount / totalQuestionsCount) * 100) : 0;

  useEffect(() => {
    const nextPage = Math.min(pageCount - 1, Math.floor(currentIndex / questionsPerPage));
    setNavigatorPage(nextPage);
  }, [currentIndex, questionsPerPage, pageCount]);

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* TOP HEADER MATCHING USER REFERENCE SCREENSHOT                      */}
      {/* "PDF மாதிரித் தொகுப்பு 01" / "Restart Practice ↺"                */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
              DHA Registered Nurse Exam Preparation — Interactive Practice
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Clinical Examination Question Bank • {totalQuestionsCount} Real Clinical Scenarios • Immediate Feedback
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRestartSession}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart Practice ↺</span>
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* TWO-COLUMN LAYOUT STRICTLY MATCHING SCREENSHOT                    */}
      {/* Left: Progress Panel & Navigator | Right: Question Card           */}
      {/* ----------------------------------------------------------------- */}
      {loading ? (
        <div className="py-24 text-center text-xs text-slate-400">Loading interactive practice questions...</div>
      ) : questions.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-800 bg-[#111b21] p-8">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">No Questions in Question Bank</h3>
          <p className="text-xs text-slate-400 mt-1">Please add questions from the Question Bank module.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ============================================================= */}
          {/* LEFT COLUMN: PROGRESS PANEL & QUESTION NAVIGATOR (Spec 10 & 11) */}
          {/* ============================================================= */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-[#111b21] p-5 space-y-5 shadow-xl">
            {/* Header: "Your Progress" */}
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Your Progress
              </span>
              {/* Big bold fraction: 29 / 90 */}
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl sm:text-4xl font-black text-white">{completedCorrectCount}</span>
                <span className="text-lg font-bold text-slate-500">/ {totalQuestionsCount}</span>
              </div>
              <span className="text-xs text-slate-400 mt-0.5 block">
                Questions Answered Correctly
              </span>

              {/* Progress Bar */}
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-teal-400 mt-1 block">
                {progressPercent}% Completed
              </span>
            </div>

            {/* Section Indicator Pill */}
            <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-3 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold text-teal-300 block">Clinical MCQs Section →</span>
                <span className="text-[11px] text-slate-400">Questions 1–{totalQuestionsCount}</span>
              </div>
              <Sparkles className="w-4 h-4 text-teal-400" />
            </div>

            {/* Question Navigator Grid (Spec 10 & 11) */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span>▼ Question Navigator</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  Q{currentIndex + 1} Active
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <label className="flex items-center gap-2">
                  <span>Questions per page</span>
                  <select
                    value={questionsPerPage}
                    onChange={(event) => {
                      setQuestionsPerPage(Number(event.target.value));
                      setNavigatorPage(0);
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-white focus:border-teal-500 focus:outline-none"
                    aria-label="Questions per page"
                  >
                    <option value={20}>20 Questions</option>
                    <option value={50}>50 Questions</option>
                    <option value={100}>100 Questions</option>
                  </select>
                </label>
                <span>Page {navigatorPage + 1} • {questions.length ? navigatorStart + 1 : 0}–{Math.min(navigatorStart + questionsPerPage, questions.length)} of {questions.length}</span>
              </div>

              {/* Grid of Number Badges: 1 to N */}
              <div className="grid grid-cols-5 sm:grid-cols-5 gap-1.5 max-h-80 overflow-y-auto pr-1">
                {navigatorQuestions.map((q, pageIndex) => {
                  const idx = navigatorStart + pageIndex;
                  const state = questionProgress[q.id];
                  const isCurrent = currentIndex === idx;
                  const isCorrect = state?.isCorrect;
                  const isWrongAttempt = !isCorrect && (state?.wrongChoices?.length || 0) > 0;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleJumpToQuestion(idx)}
                      className={`h-9 rounded-lg font-mono text-xs font-black transition-all flex items-center justify-center cursor-pointer shadow-xs ${
                        isCurrent
                          ? 'border-2 border-teal-400 text-white bg-teal-500/20 ring-2 ring-teal-500/20'
                          : isCorrect
                          ? 'bg-emerald-600 text-white'
                          : isWrongAttempt
                          ? 'bg-rose-600 text-white animate-shake'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                <button
                  type="button"
                  onClick={() => setNavigatorPage((page) => Math.max(0, page - 1))}
                  disabled={navigatorPage === 0}
                  className="rounded-lg border border-slate-700 px-2.5 py-1.5 hover:border-teal-500 hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous page
                </button>
                <span>{pageCount} page{pageCount === 1 ? '' : 's'}</span>
                <button
                  type="button"
                  onClick={() => setNavigatorPage((page) => Math.min(pageCount - 1, page + 1))}
                  disabled={navigatorPage >= pageCount - 1}
                  className="rounded-lg border border-slate-700 px-2.5 py-1.5 hover:border-teal-500 hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next page
                </button>
              </div>

              {/* Legend matching screenshot */}
              <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Correct</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Retry</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-md border border-teal-400" />
                  <span>Current</span>
                </span>
              </div>

              {/* Session Auto-save Note (Spec 17) */}
              <div className="pt-2 text-[11px] text-slate-500 leading-tight">
                Progress is automatically saved in your session. Continue anytime from where you left off.
              </div>
            </div>
          </div>

          {/* ============================================================= */}
          {/* RIGHT COLUMN: MAIN QUESTION SCREEN (Spec 9 & 12 - 15)          */}
          {/* ============================================================= */}
          {currentQuestion && (
            <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-[#111b21] p-6 sm:p-8 space-y-6 shadow-xl">
              {/* Question Pill & Header */}
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 px-3 py-1 font-bold">
                  Question {currentIndex + 1} / {totalQuestionsCount}
                </span>

                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Immediate Feedback</span>
                </span>
              </div>

              {/* Question Text */}
              <div className="space-y-2">
                <h2 className="text-base sm:text-lg font-black text-white leading-relaxed">
                  {currentQuestion.questionText}
                </h2>
                <p className="text-xs text-slate-400">
                  Select the correct or most appropriate answer.
                </p>
              </div>

              {/* Optional Question Image (Spec 85) */}
              {currentQuestion.questionImage && (
                <div className="rounded-xl overflow-hidden border border-slate-800 max-h-72 bg-slate-950 flex items-center justify-center">
                  <img
                    src={resolveMediaUrl(currentQuestion.questionImage)}
                    alt={currentQuestion.title || 'Question illustration'}
                    className="max-h-72 object-contain"
                  />
                </div>
              )}

              {/* 5 Options: A, B, C, D, E (1 to 5) (Spec 9 & 12) */}
              <div className="space-y-3 pt-2">
                {[
                  { key: 'A' as const, num: 1, text: currentQuestion.optionA },
                  { key: 'B' as const, num: 2, text: currentQuestion.optionB },
                  { key: 'C' as const, num: 3, text: currentQuestion.optionC },
                  { key: 'D' as const, num: 4, text: currentQuestion.optionD },
                  { key: 'E' as const, num: 5, text: currentQuestion.optionE },
                ].map((opt) => {
                  const isSelected = currentQState?.selectedOption === opt.key;
                  const isWrong = wrongChoices.includes(opt.key);
                  const isCorrect = isCurrentQCorrect && opt.key === (currentQState?.serverFeedback?.correctAnswer || currentQuestion.correctAnswer);

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={isCurrentQCorrect || isWrong || checkingAnswer}
                      onClick={() => handleSelectOption(opt.key)}
                      className={`w-full text-left flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer ${
                        isCorrect
                          ? 'border-emerald-500 bg-emerald-500/15 text-white ring-1 ring-emerald-500 shadow-md shadow-emerald-500/10'
                          : isWrong
                          ? 'border-rose-500/80 bg-rose-500/15 text-rose-200 opacity-80 cursor-not-allowed'
                          : 'border-slate-800 bg-slate-900/60 text-slate-200 hover:border-slate-700 hover:bg-slate-800/60 active:bg-slate-800'
                      }`}
                    >
                      {/* Bubble Number (1, 2, 3, 4, 5) */}
                      <span
                        className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 transition-all ${
                          isCorrect
                            ? 'bg-emerald-500 text-slate-950 font-black'
                            : isWrong
                            ? 'bg-rose-500 text-white font-bold'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {isCorrect ? <Check className="w-4 h-4 stroke-[3]" /> : opt.num}
                      </span>

                      {/* Option Text */}
                      <span className="text-xs sm:text-sm font-medium pt-0.5 leading-normal flex-1">
                        {opt.text}
                      </span>

                      {isCorrect && (
                        <span className="shrink-0 text-[10px] uppercase font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded">
                          Correct
                        </span>
                      )}
                      {isWrong && (
                        <span className="shrink-0 text-[10px] uppercase font-bold bg-rose-500 text-white px-2 py-0.5 rounded">
                          Wrong
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ----------------------------------------------------------- */}
              {/* WRONG ANSWER BANNER (Spec 12: ❌ Your answer is wrong...)    */}
              {/* ----------------------------------------------------------- */}
              {!isCurrentQCorrect && wrongChoices.length > 0 && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-rose-300 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-200">
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <div>
                    <p className="text-sm font-black text-rose-200">
                      ❌ Your answer is wrong. Please try again.
                    </p>
                    <p className="text-[11px] text-rose-300/80 font-normal mt-0.5">
                      Review the clinical scenario and select another option to continue.
                    </p>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------------- */}
              {/* CORRECT ANSWER SECTION & REMEMBER NOTES (Spec 13 & 14)      */}
              {/* ----------------------------------------------------------- */}
              {isCurrentQCorrect && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Success Banner */}
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-emerald-300 text-xs font-bold flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm font-black text-emerald-200">
                        ✅ Your answer is correct.
                      </p>
                      <p className="text-[11px] text-emerald-300/80 font-normal mt-0.5">
                        High-yield learning points recorded. Review the Remember Notes below before proceeding.
                      </p>
                    </div>
                  </div>

                  {/* 3 Remember Notes Card */}
                  <div className="rounded-2xl border border-teal-500/40 bg-gradient-to-br from-teal-950/20 via-slate-900 to-slate-900 p-5 space-y-3 shadow-lg">
                    <div className="flex items-center gap-2 text-teal-400">
                      <Sparkles className="w-4 h-4" />
                      <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                        ✓ Correct! • Remember Notes
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs sm:text-sm text-slate-200 font-medium">
                      <p className="flex items-start gap-2">
                        <span className="font-bold text-teal-400">1.</span>
                        <span>{currentQState?.serverFeedback?.rememberNotes?.[0] || currentQuestion.rememberNote1}</span>
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="font-bold text-teal-400">2.</span>
                        <span>{currentQState?.serverFeedback?.rememberNotes?.[1] || currentQuestion.rememberNote2}</span>
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="font-bold text-teal-400">3.</span>
                        <span>{currentQState?.serverFeedback?.rememberNotes?.[2] || currentQuestion.rememberNote3}</span>
                      </p>
                    </div>

                    {/* Detailed Explanation */}
                    {(currentQState?.serverFeedback?.detailedExplanation || currentQuestion.detailedExplanation) && (
                      <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                        <span className="font-bold text-slate-300">Detailed Rationale:</span>
                        <p className="mt-0.5 leading-relaxed">
                          {currentQState?.serverFeedback?.detailedExplanation || currentQuestion.detailedExplanation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Navigation Footer: Previous & Next Question (Spec 16) */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={handlePreviousQuestion}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous Question</span>
                </button>

                <button
                  type="button"
                  disabled={!isCurrentQCorrect}
                  onClick={handleNextQuestion}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer ${
                    isCurrentQCorrect
                      ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-lg shadow-teal-500/20'
                      : 'bg-slate-800 text-slate-500 border border-slate-700/60 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
