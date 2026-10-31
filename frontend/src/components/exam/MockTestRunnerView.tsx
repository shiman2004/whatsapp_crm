import React, { useState, useEffect, useRef } from 'react';
import {
  FileCheck2,
  Clock,
  AlertTriangle,
  Flag,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  RotateCcw,
  Eye,
  ShieldCheck,
  Check,
  Sparkles,
  Plus,
  X
} from 'lucide-react';
import {
  examService,
  ExamMockTestPlatform,
  ExamMockTestAttemptRecord
} from '../../services/examService';

interface MockTestRunnerViewProps {
  initialCourseId?: string;
  currentUser?: { id?: string; fullName?: string };
  onNavigateToPractice?: () => void;
  onNavigateToQuestionBank?: () => void;
}

export const MockTestRunnerView: React.FC<MockTestRunnerViewProps> = ({
  initialCourseId = 'course-dha-rn',
  currentUser,
  onNavigateToPractice,
  onNavigateToQuestionBank,
}) => {
  const [mockTests, setMockTests] = useState<ExamMockTestPlatform[]>([]);
  const [mockQuestionCount, setMockQuestionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMockTitle, setNewMockTitle] = useState('DHA Registered Nurse Mock Examination 01');
  const [newMockQuestions, setNewMockQuestions] = useState(2);
  const [newMockDuration, setNewMockDuration] = useState(30);
  const [newPerQuestionSeconds, setNewPerQuestionSeconds] = useState(0);
  const [newPassingScore, setNewPassingScore] = useState(65);
  const [creatingMock, setCreatingMock] = useState(false);

  // Active Test State
  const [activeTest, setActiveTest] = useState<ExamMockTestPlatform | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120 * 60);
  const [questionSecondsRemaining, setQuestionSecondsRemaining] = useState<number>(0);
  const [timeTakenSeconds, setTimeTakenSeconds] = useState<number>(0);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Completed Attempt / Results State
  const [testResult, setTestResult] = useState<ExamMockTestAttemptRecord | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);

  const timerRef = useRef<any>(null);

  // Load available mock tests
  const loadMockTests = async () => {
    try {
      setLoading(true);
      const [mockResult, questionResult] = await Promise.all([
        examService.getMockTests(),
        examService.getQuestionBank({ courseId: initialCourseId, questionType: 'Mock Test' }).catch(() => []),
      ]);
      setMockTests(mockResult.map((test) => ({
        id: test.id,
        courseId: initialCourseId,
        mockTestName: test.title,
        subjectScope: test.targetProfession || 'Registered Nurse',
        durationMinutes: test.durationMinutes,
        perQuestionSeconds: test.perQuestionSeconds,
        totalQuestions: test.totalQuestions,
        passPercentage: test.passingScore,
        randomQuestionOrder: true,
        randomAnswerOrder: false,
        allowBackNavigation: true,
        showResults: 'Immediately',
        status: test.isActive === false ? 'Draft' : 'Published',
      })));
      setMockQuestionCount(questionResult.length);
    } catch (err) {
      console.error('Failed to load mock tests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePublishedMock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMockTitle.trim()) return;
    try {
      setCreatingMock(true);
      await examService.createMockTest({
        title: newMockTitle.trim(),
        categoryId: 'cat-dha',
        categoryName: 'DHA',
        targetProfession: 'Registered Nurse',
        totalQuestions: newMockQuestions,
        durationMinutes: newMockDuration,
        perQuestionSeconds: newPerQuestionSeconds > 0 ? newPerQuestionSeconds : undefined,
        passingScore: newPassingScore,
        difficulty: 'Medium',
      });
      setIsCreateModalOpen(false);
      await loadMockTests();
    } catch (error: any) {
      alert(error.message || 'Unable to publish mock test');
    } finally {
      setCreatingMock(false);
    }
  };

  useEffect(() => {
    loadMockTests();
  }, []);

  // Countdown Timer
  useEffect(() => {
    if (activeTest && !testResult) {
      const perQuestionSeconds = Number(activeTest.perQuestionSeconds) || 0;
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
        setTimeTakenSeconds((prev) => prev + 1);
        if (perQuestionSeconds > 0) {
          setQuestionSecondsRemaining((prev) => {
            if (prev <= 1) {
              const questionCount = activeTest.questions?.length || 0;
              if (currentQIndex + 1 < questionCount) {
                setCurrentQIndex((index) => index + 1);
                return perQuestionSeconds;
              }
              clearInterval(timerRef.current);
              handleAutoSubmit();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTest, testResult, currentQIndex]);

  const handleStartTest = async (testId: string) => {
    try {
      setLoading(true);
      const data = await examService.getMockTestForTaker(testId);
      setActiveTest(data);
      setCurrentQIndex(0);
      setSelectedAnswers({});
      setFlaggedQuestions({});
      setSecondsRemaining((data.durationMinutes || 120) * 60);
      setQuestionSecondsRemaining(Number(data.perQuestionSeconds) || 0);
      setTimeTakenSeconds(0);
      setTestResult(null);
      setIsReviewMode(false);
    } catch (err: any) {
      alert(err.message || 'Failed to start mock test');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = (optionKey: string) => {
    if (!activeTest || !activeTest.questions) return;
    const qId = activeTest.questions[currentQIndex]?.id;
    if (!qId) return;

    setSelectedAnswers((prev) => ({
      ...prev,
      [qId]: optionKey,
    }));
  };

  const handleToggleFlag = () => {
    if (!activeTest || !activeTest.questions) return;
    const qId = activeTest.questions[currentQIndex]?.id;
    if (!qId) return;

    setFlaggedQuestions((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const jumpToMockQuestion = (index: number) => {
    setCurrentQIndex(index);
    if (activeTest?.perQuestionSeconds) setQuestionSecondsRemaining(activeTest.perQuestionSeconds);
  };

  const handleFinalSubmit = async () => {
    if (!activeTest) return;
    try {
      setIsSubmitting(true);
      const result = await examService.submitMockTest(activeTest.id, {
        answers: selectedAnswers,
        studentName: currentUser?.fullName || 'Candidate Student',
        studentId: currentUser?.id,
        timeTakenSeconds,
      });

      setTestResult(result);
      setIsSubmitModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to submit mock exam');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = () => {
    alert('⏱ Time is up! Your mock test is being submitted automatically.');
    handleFinalSubmit();
  };

  // Format time as HH:MM:SS
  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const questionsList = activeTest?.questions || [];
  const currentQ = questionsList[currentQIndex];

  const answeredCount = Object.keys(selectedAnswers).length;
  const unansweredCount = questionsList.length - answeredCount;
  const flaggedCount = Object.values(flaggedQuestions).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* SCENARIO 1: POST-TEST RESULTS SCREEN (Spec 27 & Spec 28)           */}
      {/* ----------------------------------------------------------------- */}
      {testResult ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-6 sm:p-8 shadow-2xl text-center max-w-3xl mx-auto space-y-6">
            <div
              className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center shadow-xl ${
                testResult.result === 'PASS'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-emerald-500/20'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-rose-500/20'
              }`}
            >
              {testResult.result === 'PASS' ? (
                <Award className="w-10 h-10 stroke-[2.5]" />
              ) : (
                <AlertTriangle className="w-10 h-10 stroke-[2.5]" />
              )}
            </div>

            <div>
              <span
                className={`inline-block px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-2 ${
                  testResult.result === 'PASS'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                RESULT: {testResult.result}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {testResult.mockTestName}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Candidate: <span className="font-bold text-white">{testResult.studentName}</span> • Time Taken:{' '}
                <span className="font-mono text-teal-400">{formatTime(testResult.timeTakenSeconds)}</span>
              </p>
            </div>

            {/* Score Metrics Grid (Spec 27) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Questions</span>
                <p className="text-xl font-black text-white mt-0.5">{testResult.totalQuestions}</p>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3">
                <span className="text-[10px] text-emerald-400 uppercase font-semibold">Correct Answers</span>
                <p className="text-xl font-black text-emerald-400 mt-0.5">{testResult.correctAnswers}</p>
              </div>

              <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3">
                <span className="text-[10px] text-rose-400 uppercase font-semibold">Wrong Answers</span>
                <p className="text-xl font-black text-rose-400 mt-0.5">{testResult.wrongAnswers}</p>
              </div>

              <div className="rounded-xl border border-teal-500/20 bg-teal-950/20 p-3">
                <span className="text-[10px] text-teal-400 uppercase font-semibold">Final Score</span>
                <p className="text-xl font-black text-teal-300 mt-0.5">{testResult.percentage}%</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsReviewMode(!isReviewMode)}
                className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>{isReviewMode ? 'Hide Answer Review' : 'Review Full Answers & Remember Notes'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTest(null);
                  setTestResult(null);
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Return to Mock Tests</span>
              </button>
            </div>
          </div>

          {/* Answer Review Section (Spec 28) */}
          {isReviewMode && testResult.answersSnapshot && (
            <div className="space-y-4 max-w-4xl mx-auto pt-4 animate-in slide-in-from-top-4 duration-300">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                <span>Question-by-Question Clinical Examination Review</span>
              </h3>

              {testResult.answersSnapshot.map((ans, idx) => (
                <div
                  key={ans.questionId}
                  className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${
                    ans.isCorrect
                      ? 'border-emerald-500/40 bg-emerald-950/10'
                      : 'border-rose-500/40 bg-rose-950/10'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="font-mono text-teal-400">
                      Question {idx + 1} • {ans.questionCode}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase ${
                        ans.isCorrect
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {ans.isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-white leading-relaxed">{ans.questionText}</p>

                  {/* Options Comparison */}
                  <div className="space-y-2 text-xs">
                    {[
                      { k: 'A', t: ans.optionA },
                      { k: 'B', t: ans.optionB },
                      { k: 'C', t: ans.optionC },
                      { k: 'D', t: ans.optionD },
                      { k: 'E', t: ans.optionE },
                    ].map((opt) => {
                      const isStudent = ans.studentAnswer === opt.k;
                      const isCorrect = ans.correctAnswer === opt.k;

                      return (
                        <div
                          key={opt.k}
                          className={`p-3 rounded-xl border flex items-center justify-between ${
                            isCorrect
                              ? 'border-emerald-500 bg-emerald-500/15 text-white font-bold'
                              : isStudent && !isCorrect
                              ? 'border-rose-500 bg-rose-500/15 text-white font-bold'
                              : 'border-slate-800 bg-slate-900/60 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-6 h-6 rounded-md font-black text-xs flex items-center justify-center ${
                                isCorrect
                                  ? 'bg-emerald-500 text-slate-950'
                                  : isStudent
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {opt.k}
                            </span>
                            <span>{opt.t}</span>
                          </div>

                          {isCorrect && (
                            <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                              Correct Answer
                            </span>
                          )}
                          {isStudent && !isCorrect && (
                            <span className="text-[10px] uppercase font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded">
                              Your Choice
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Remember Notes */}
                  {ans.rememberNotes && ans.rememberNotes.length > 0 && (
                    <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-4 text-xs space-y-1.5 text-slate-300">
                      <span className="text-teal-400 font-bold flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                        <Sparkles className="w-3.5 h-3.5" />
                        Remember Notes:
                      </span>
                      {ans.rememberNotes.map((note, nIdx) => (
                        <p key={nIdx}>
                          {nIdx + 1}. {note}
                        </p>
                      ))}
                    </div>
                  )}

                  {ans.detailedExplanation && (
                    <div className="text-xs text-slate-400">
                      <span className="font-bold text-slate-300">Explanation:</span>
                      <p className="mt-0.5 leading-relaxed">{ans.detailedExplanation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTest ? (
        /* ----------------------------------------------------------------- */
        /* SCENARIO 2: LIVE SIMULATION EXAM RUNNER (Spec 22-26)              */
        /* ----------------------------------------------------------------- */
        <div className="space-y-4">
          {/* Simulation Header & Countdown Bar */}
          <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 text-[11px] font-mono font-bold">
                  {activeTest.mockTestName}
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  Question {currentQIndex + 1} of {questionsList.length}
                </span>
              </div>
            </div>

            {/* Countdown Timer with Warnings (Spec 24) */}
            <div className="flex items-center gap-4">
              <div
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono font-bold text-sm ${
                  secondsRemaining <= 300
                    ? 'border-rose-500/60 bg-rose-500/20 text-rose-300 animate-pulse'
                    : secondsRemaining <= 1800
                    ? 'border-amber-500/60 bg-amber-500/20 text-amber-300'
                    : 'border-slate-700 bg-slate-900 text-teal-400'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                <span>{formatTime(secondsRemaining)}</span>
              </div>

              {activeTest.perQuestionSeconds && (
                <div className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-xs font-bold ${
                  questionSecondsRemaining <= 10
                    ? 'border-rose-500/60 bg-rose-500/20 text-rose-300 animate-pulse'
                    : 'border-teal-500/40 bg-teal-950/30 text-teal-300'
                }`}>
                  <span>Question time</span>
                  <span>{formatTime(questionSecondsRemaining)}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer"
              >
                Submit Exam
              </button>
            </div>
          </div>

          {/* Timed Warning Banner (Spec 24: 30m, 10m, 5m, 1m) */}
          {secondsRemaining <= 300 && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-rose-300 text-xs font-bold flex items-center gap-2 animate-bounce">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>⚠️ Less than 5 minutes remaining! Finish your review and prepare for submission.</span>
            </div>
          )}

          {/* Two-Column Test Layout: Navigator & Question Area */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Left/Sidebar: Question Navigator (Spec 25) */}
            <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-4 space-y-4 shadow-lg order-2 lg:order-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Question Navigator</span>
                <span className="text-teal-400 font-mono font-bold">
                  {answeredCount} / {questionsList.length}
                </span>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-5 gap-1.5 max-h-72 overflow-y-auto pr-1">
                {questionsList.map((q, idx) => {
                  const isAnswered = !!selectedAnswers[q.id];
                  const isFlagged = !!flaggedQuestions[q.id];
                  const isCurrent = currentQIndex === idx;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => jumpToMockQuestion(idx)}
                      className={`h-8 rounded-lg font-mono text-xs font-bold flex items-center justify-center transition-all cursor-pointer relative ${
                        isCurrent
                          ? 'ring-2 ring-teal-400 border-white text-white bg-slate-800'
                          : isAnswered
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {idx + 1}
                      {isFlagged && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-1 ring-slate-900" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Status Legend */}
              <div className="space-y-1.5 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-emerald-600" />
                  <span>Answered ({answeredCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-slate-800" />
                  <span>Not Answered ({unansweredCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-amber-400" />
                  <span>Flagged for Review ({flaggedCount})</span>
                </div>
              </div>
            </div>

            {/* Main Question Card (Spec 22 & Spec 23) */}
            {currentQ && (
              <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-[#111b21] p-6 sm:p-7 space-y-6 shadow-xl order-1 lg:order-2 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Top Question Row */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-teal-400">
                      Question {currentQIndex + 1} • {currentQ.questionCode}
                    </span>

                    <button
                      type="button"
                      onClick={handleToggleFlag}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        flaggedQuestions[currentQ.id]
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>{flaggedQuestions[currentQ.id] ? 'Flagged for Review' : 'Flag for Review'}</span>
                    </button>
                  </div>

                  {/* Question Text */}
                  <p className="text-sm sm:text-base font-bold text-white leading-relaxed">
                    {currentQ.questionText}
                  </p>

                  {/* Answer Options: A, B, C, D, E (No immediate feedback in Mock Mode!) */}
                  <div className="space-y-2.5 pt-2">
                    {[
                      { key: 'A', text: currentQ.optionA },
                      { key: 'B', text: currentQ.optionB },
                      { key: 'C', text: currentQ.optionC },
                      { key: 'D', text: currentQ.optionD },
                      { key: 'E', text: currentQ.optionE },
                    ].map((opt) => {
                      const isSelected = selectedAnswers[currentQ.id] === opt.key;

                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => handleSelectAnswer(opt.key)}
                          className={`w-full text-left flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-teal-500 bg-teal-500/15 text-white ring-1 ring-teal-500 shadow-md'
                              : 'border-slate-800 bg-slate-900/60 text-slate-200 hover:border-slate-700 hover:bg-slate-800/60'
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-teal-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {opt.key}
                          </span>
                          <span className="text-xs sm:text-sm font-medium pt-0.5 leading-normal">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question Navigation Controls */}
                <div className="flex items-center justify-between pt-6 border-t border-slate-800/80">
                  <button
                    type="button"
                    disabled={currentQIndex === 0}
                    onClick={() => jumpToMockQuestion(currentQIndex - 1)}
                    className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  {currentQIndex + 1 < questionsList.length ? (
                    <button
                      type="button"
                      onClick={() => jumpToMockQuestion(currentQIndex + 1)}
                      className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <span>Next Question</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsSubmitModalOpen(true)}
                      className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
                    >
                      <span>Review & Submit</span>
                      <Check className="w-4 h-4 stroke-[3]" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* CONFIRMATION MODAL BEFORE SUBMISSION (Spec 26)                */}
          {/* ------------------------------------------------------------- */}
          {isSubmitModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-6 w-full max-w-md shadow-2xl text-center space-y-5">
                <div className="w-12 h-12 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="text-lg font-black text-white">Submit Mock Examination?</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Please review your completion status before submitting your final answers for scoring.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold">Answered</span>
                    <p className="text-lg font-black text-white">{answeredCount}</p>
                  </div>
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-2.5">
                    <span className="text-[10px] text-rose-400 uppercase font-bold">Unanswered</span>
                    <p className="text-lg font-black text-white">{unansweredCount}</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5">
                    <span className="text-[10px] text-amber-400 uppercase font-bold">Flagged</span>
                    <p className="text-lg font-black text-white">{flaggedCount}</p>
                  </div>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSubmitModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold text-xs"
                  >
                    Return to Test
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleFinalSubmit}
                    className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/20 cursor-pointer"
                  >
                    {isSubmitting ? 'Scoring Exam...' : 'Submit Final'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ----------------------------------------------------------------- */
        /* SCENARIO 3: MOCK TEST CATALOG LIST                                */
        /* ----------------------------------------------------------------- */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#111B21] dark:text-[#E9EDEF] tracking-tight flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-teal-400" />
                <span>Simulation Mock Examinations</span>
              </h2>
              <p className="text-xs text-[#667781] dark:text-[#8696A0] font-medium mt-0.5">
                Real exam conditions with timed countdown, single attempt, and official passing benchmarks.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-teal-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Publish Mock Test</span>
              </button>
              <button
                type="button"
                onClick={onNavigateToPractice}
                className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Switch to Practice Mode</span>
                <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
              </button>
            </div>
          </div>

          {mockTests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-[#111b21] p-8 sm:p-12 text-center shadow-xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-500/30 bg-teal-500/10 text-teal-300">
                <FileCheck2 className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">No timed mock examination has been published</h3>
              <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-slate-400">
                Build and review a question paper before publishing a timed exam. The nurse question bank currently has {mockQuestionCount} Mock Test question{mockQuestionCount === 1 ? '' : 's'} ready for review.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-teal-500/20 transition hover:bg-teal-400"
                >
                  <Plus className="h-4 w-4" />
                  Publish Mock Test
                </button>
                {onNavigateToQuestionBank && (
                  <button
                    type="button"
                    onClick={onNavigateToQuestionBank}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-teal-500/20 transition hover:bg-teal-400"
                  >
                    Review Question Bank
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                {onNavigateToPractice && (
                  <button
                    type="button"
                    onClick={onNavigateToPractice}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700"
                  >
                    Switch to Practice Mode
                    <ArrowRight className="h-4 w-4 text-teal-400" />
                  </button>
                )}
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {mockTests.map((test) => (
              <div
                key={test.id}
                className="rounded-2xl border border-slate-800 bg-[#111b21] p-5 sm:p-6 shadow-xl flex flex-col justify-between hover:border-teal-500/50 transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded-full">
                      {test.subjectScope || 'Comprehensive Exam'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      {test.durationMinutes} Mins
                    </span>
                  </div>

                  <h3 className="text-base font-black text-white group-hover:text-teal-400 transition-colors">
                    {test.mockTestName}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {test.description || 'Simulate official licensing board examination with high-yield clinical questions.'}
                  </p>

                  <div className="pt-2 flex items-center gap-4 text-xs text-slate-300 font-semibold">
                    <span>{test.totalQuestions} Questions</span>
                    <span>•</span>
                    <span>Pass Score: {test.passPercentage}%</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartTest(test.id)}
                  className="mt-6 w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-slate-950 font-black text-xs transition-all shadow-md shadow-teal-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Start Timed Mock Exam</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </button>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg space-y-5 rounded-2xl border border-slate-700 bg-[#111b21] p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white">Publish Nurse Mock Test</h3>
                <p className="mt-1 text-xs text-slate-400">Set the exam duration and optional time allowed for each question.</p>
              </div>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white" aria-label="Close publish mock test dialog">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreatePublishedMock} className="space-y-4">
              <label className="block text-xs font-semibold text-slate-300">
                Mock test title
                <input value={newMockTitle} onChange={(event) => setNewMockTitle(event.target.value)} required className="mt-1 w-full rounded-xl border border-slate-700 bg-[#202c33] px-3 py-2 text-sm text-white" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Questions
                  <input type="number" min={1} value={newMockQuestions} onChange={(event) => setNewMockQuestions(Math.max(1, Number(event.target.value)))} className="mt-1 w-full rounded-xl border border-slate-700 bg-[#202c33] px-3 py-2 text-sm text-white" />
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  Total duration (minutes)
                  <input type="number" min={1} value={newMockDuration} onChange={(event) => setNewMockDuration(Math.max(1, Number(event.target.value)))} className="mt-1 w-full rounded-xl border border-slate-700 bg-[#202c33] px-3 py-2 text-sm text-white" />
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-300">
                Time per question (seconds, optional)
                <input type="number" min={0} value={newPerQuestionSeconds} onChange={(event) => setNewPerQuestionSeconds(Math.max(0, Number(event.target.value)))} className="mt-1 w-full rounded-xl border border-slate-700 bg-[#202c33] px-3 py-2 text-sm text-white" />
                <span className="mt-1 block text-[11px] font-normal text-slate-500">Use 0 to use only the total exam countdown.</span>
              </label>
              <label className="block text-xs font-semibold text-slate-300">
                Passing score (%)
                <input type="number" min={1} max={100} value={newPassingScore} onChange={(event) => setNewPassingScore(Math.min(100, Math.max(1, Number(event.target.value))))} className="mt-1 w-full rounded-xl border border-slate-700 bg-[#202c33] px-3 py-2 text-sm text-white" />
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800">Cancel</button>
                <button type="submit" disabled={creatingMock} className="rounded-xl bg-teal-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-teal-400 disabled:opacity-50">{creatingMock ? 'Publishing…' : 'Publish Mock Test'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
