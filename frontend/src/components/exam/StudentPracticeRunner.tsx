import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Flag, GraduationCap } from 'lucide-react';

type Question = { id: string; code: string; questionText: string; options: Record<string, string> };
type Request = (path: string, method?: string, body?: unknown) => Promise<any>;

export function StudentPracticeRunner({ courseId, mode = 'practice', request, onClose }: { courseId: string; mode?: 'practice' | 'mock'; request: Request; onClose: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    request('/assessments?courseId=' + encodeURIComponent(courseId) + '&mode=' + mode)
      .then(data => { if (alive) setQuestions(data.questions || []); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Assessment set unavailable.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [courseId, mode, request]);

  useEffect(() => {
    if (result || loading) return;
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [result, loading]);

  const current = questions[index];
  const answered = Object.keys(answers).length;
  const formatTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

  async function submit() {
    try {
      setLoading(true);
      setError('');
      setResult(await request('/assessments/attempts', 'POST', {
        courseId,
        mode,
        elapsedSeconds: seconds,
        answers: questions.map(q => ({ questionId: q.id, answer: answers[q.id] || null })),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit assessment.');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !questions.length && !result) {
    return <section className="rounded-3xl bg-[#f7f6ee] p-8 text-[#1d4d47]">Loading reviewed question set…</section>;
  }

  if (error && !questions.length) {
    return (
      <section className="rounded-3xl border border-red-300 bg-[#fff8f4] p-8 text-red-800">
        <p>{error}</p>
        <button className="mt-4 underline" onClick={onClose}>Return to portal</button>
      </section>
    );
  }

  return (
    <section lang="en" className="overflow-hidden rounded-3xl bg-[#f7f6ee] text-[#244e49] shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dfe2d7] px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#195a50] text-[#f8df91]"><GraduationCap className="h-5 w-5" /></div>
          <div>
            <p className="text-sm font-bold tracking-wide">Alpha Health Group</p>
            <p className="text-xs text-[#6e817a]">Healthcare Licensing Exam Preparation</p>
          </div>
        </div>
        <button className="rounded-full border border-[#d6ddd0] px-4 py-2 text-xs font-semibold" onClick={onClose}>Exit</button>
      </header>

      <div className="border-b border-[#e5e5db] px-5 pb-7 pt-6 sm:px-8 sm:pt-8">
        <p className="text-xs font-semibold tracking-wide text-[#63867a]">Part I · {questions.length} questions · {mode === 'mock' ? 'Mock Exam' : 'Practice Set'}</p>
        <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">One question.</h1>
            <h1 className="text-3xl font-semibold tracking-tight text-[#5e8a76] sm:text-5xl">Clear understanding.</h1>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[#6f7f76]">Understanding why an answer is correct matters as much as knowing the answer.</p>
        </div>
        <div className="mt-6 border-l-4 border-[#b99a54] bg-[#fffaf0] px-4 py-4 text-sm leading-7 text-[#6f756d]">
          <strong className="text-[#536c60]">{mode === 'mock' ? 'Mock Test' : 'Practice Session'}</strong><br />Choose the best answer for each question.
        </div>
      </div>

      <div className="grid lg:grid-cols-[250px_1fr]">
        <aside className="border-b border-[#dfe2d7] bg-[#eef1e7] p-5 lg:border-b-0 lg:border-r sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#70817b]">Your Progress</p>
          <div className="mt-3 rounded-2xl bg-white/70 p-4">
            <div className="flex items-end justify-between"><span className="text-4xl font-medium">{answered}</span><span className="pb-1 text-sm text-[#74837b]">/ {questions.length}</span></div>
            <p className="mt-1 text-xs text-[#74837b]">Questions answered</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dce2d7]"><div className="h-full rounded-full bg-[#5a8a78] transition-all" style={{ width: questions.length ? `${answered / questions.length * 100}%` : '0%' }} /></div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4" /> Time · {formatTime(seconds)}</div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-[#71827a]">Choose a question</p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {questions.map((question, questionIndex) => (
              <button key={question.id} aria-label={`Question ${questionIndex + 1}`} onClick={() => setIndex(questionIndex)} className={`h-9 rounded-lg border text-xs font-semibold transition ${questionIndex === index ? 'border-[#1b5b51] bg-[#fffdf4] text-[#1b5b51] shadow-sm' : answers[question.id] ? 'border-[#a7c5b4] bg-[#dcebe0]' : 'border-[#d8ded3] bg-white/70 text-[#708078]'}`}>{questionIndex + 1}</button>
            ))}
          </div>
        </aside>

        <div className="p-5 sm:p-8 lg:p-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#70917f]">Question {questions.length ? index + 1 : 0} / {questions.length}</p>
              <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">{mode === 'mock' ? 'Mock Exam' : 'Practice Question'}</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#6e817a]"><span className="h-2 w-2 rounded-full bg-[#86af96]" /> {mode === 'mock' ? 'Exam Mode' : 'Practice Mode'}</div>
          </div>

          {current ? (
            <div className="mt-8 rounded-3xl border border-[#dce1d6] bg-white p-5 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-lg bg-[#edf4ed] px-3 py-1.5 text-xs font-semibold">Question {index + 1} / {questions.length}</span>
                <button className="flex items-center gap-2 text-xs text-[#71827a]" title="Flag question"><Flag className="h-4 w-4" /> Flag</button>
              </div>
              <h3 className="mt-8 text-xl font-medium leading-relaxed sm:text-2xl">{current.questionText}</h3>
              <p className="mt-3 text-sm text-[#7a8981]">Select the correct or best answer.</p>
              <div className="mt-7 space-y-3">
                {Object.entries(current.options).filter(([, value]) => value).map(([key, value]) => (
                  <button key={key} onClick={() => setAnswers(previous => ({ ...previous, [current.id]: key }))} className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition sm:p-5 ${answers[current.id] === key ? 'border-[#2f7662] bg-[#edf7ee] shadow-sm' : 'border-[#dde2dc] bg-white hover:border-[#92b7a0]'}`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d5ddd4] bg-[#fafbf7] text-sm font-semibold">{key}</span>
                    <span className="pt-1 text-sm leading-relaxed sm:text-base">{value}</span>
                  </button>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ebe3] pt-5">
                <button disabled={index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))} className="flex items-center gap-2 rounded-xl border border-[#d6ddd2] px-4 py-2.5 text-sm disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Previous</button>
                {index === questions.length - 1 ? (
                  <button disabled={loading || !answered} onClick={() => void submit()} className="flex items-center gap-2 rounded-xl bg-[#1c6255] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Submit Answers <CheckCircle2 className="h-4 w-4" /></button>
                ) : (
                  <button onClick={() => setIndex(value => Math.min(questions.length - 1, value + 1))} className="flex items-center gap-2 rounded-xl bg-[#1c6255] px-5 py-2.5 text-sm font-semibold text-white">Next <ArrowRight className="h-4 w-4" /></button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-[#dce1d6] bg-white p-8 text-center text-[#71827a]">No reviewed questions have been published for this course yet.</div>
          )}

          {result && <div className="mt-6 rounded-2xl border border-[#8db89c] bg-[#edf7ee] p-5"><p className="text-xl font-semibold">Score: {result.score}/{result.total} ({result.percentage}%)</p><p className="mt-1 text-sm text-[#60776b]">Your result has been saved securely.</p></div>}
          {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </section>
  );
}
