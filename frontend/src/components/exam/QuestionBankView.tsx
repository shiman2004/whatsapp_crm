import React, { useState, useEffect } from 'react';
import { useCrm } from '../../context/CrmContext';
import { displayCourseName } from './courseDisplayName';
import {
  HelpCircle,
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  Trash2,
  Edit3,
  Copy,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  BookOpen,
  Eye,
  Check,
  X,
  Sparkles,
  Layers
} from 'lucide-react';
import {
  examService,
  ExamPlatformQuestion,
  ExamCourse,
  ExamSubject
} from '../../services/examService';

interface QuestionBankViewProps {
  initialCourseId?: string;
}

export const QuestionBankView: React.FC<QuestionBankViewProps> = ({ initialCourseId }) => {
  const { currentUser } = useCrm();
  const isAcademicAdmin = ['super_admin', 'exam_department_manager'].includes(currentUser?.role || '');
  const [questions, setQuestions] = useState<ExamPlatformQuestion[]>([]);
  const [courses, setCourses] = useState<ExamCourse[]>([]);
  const [subjects, setSubjects] = useState<ExamSubject[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(initialCourseId || 'all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCourseId, setFormCourseId] = useState('course-dha-rn');
  const [formSubjectId, setFormSubjectId] = useState('subj-clinical-proc');
  const [formTopic, setFormTopic] = useState('Clinical Assessment');
  const [formQuestionCode, setFormQuestionCode] = useState('DHA-RN-00011');
  const [formTitle, setFormTitle] = useState('');
  const [formQuestionText, setFormQuestionText] = useState('');
  const [formQuestionImage, setFormQuestionImage] = useState('');
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
  const [formQuestionType, setFormQuestionType] = useState<'Practice' | 'Mock Test' | 'Both'>('Both');
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive' | 'Draft'>('Active');
  const [saving, setSaving] = useState(false);

  // Bulk Import Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [validationReport, setValidationReport] = useState<{
    totalRows: number;
    validQuestions: any[];
    invalidRows: any[];
    duplicateCodes: string[];
  } | null>(null);
  const [importing, setImporting] = useState(false);

  // Question Preview Drawer Modal
  const [previewQuestion, setPreviewQuestion] = useState<ExamPlatformQuestion | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [qs, cs, subs] = await Promise.all([
        examService.getQuestionBank({
          courseId: selectedCourse,
          subjectId: selectedSubject,
          difficulty: selectedDifficulty,
          questionType: selectedType,
          search
        }),
        examService.getCourses().catch(() => []),
        examService.getCourseSubjects().catch(() => [])
      ]);
      setQuestions(qs);
      setCourses(cs);
      setSubjects(subs);
    } catch (err) {
      console.error('Failed to load question bank data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCourse, selectedSubject, selectedDifficulty, selectedType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormCourseId(selectedCourse !== 'all' ? selectedCourse : (courses[0]?.id || 'course-dha-rn'));
    setFormSubjectId(subjects[0]?.id || 'subj-clinical-proc');
    setFormTopic('Clinical Nursing Protocol');
    setFormQuestionCode(`DHA-RN-${String(questions.length + 1).padStart(5, '0')}`);
    setFormTitle(`Question ${questions.length + 1} — Clinical Scenario`);
    setFormQuestionText('');
    setFormQuestionImage('');
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
    setFormQuestionType('Both');
    setFormStatus('Active');
    setIsModalOpen(true);
  };

  const openEditModal = (q: ExamPlatformQuestion) => {
    setEditingId(q.id);
    setFormCourseId(q.courseId || 'course-dha-rn');
    setFormSubjectId(q.subjectId || 'subj-clinical-proc');
    setFormTopic(q.topic || '');
    setFormQuestionCode(q.questionCode || '');
    setFormTitle(q.title || '');
    setFormQuestionText(q.questionText || '');
    setFormQuestionImage(q.questionImage || '');
    setFormOptionA(q.optionA || '');
    setFormOptionB(q.optionB || '');
    setFormOptionC(q.optionC || '');
    setFormOptionD(q.optionD || '');
    setFormOptionE(q.optionE || '');
    setFormCorrectAnswer(q.correctAnswer || 'C');
    setFormRememberNote1(q.rememberNote1 || '');
    setFormRememberNote2(q.rememberNote2 || '');
    setFormRememberNote3(q.rememberNote3 || '');
    setFormExplanation(q.detailedExplanation || '');
    setFormDifficulty(q.difficulty || 'Medium');
    setFormQuestionType(q.questionType || 'Both');
    setFormStatus(q.status || 'Active');
    setIsModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formQuestionText.trim() || !formOptionA.trim() || !formOptionB.trim() || !formOptionC.trim()) {
      alert('Please fill question text and at least options A, B, and C');
      return;
    }

    try {
      setSaving(true);
      const payload: Partial<ExamPlatformQuestion> = {
        questionCode: formQuestionCode.trim(),
        courseId: formCourseId,
        subjectId: formSubjectId,
        topic: formTopic.trim(),
        title: formTitle.trim() || `Question ${formQuestionCode}`,
        questionText: formQuestionText.trim(),
        questionImage: formQuestionImage.trim(),
        optionA: formOptionA.trim(),
        optionB: formOptionB.trim(),
        optionC: formOptionC.trim(),
        optionD: formOptionD.trim(),
        optionE: formOptionE.trim(),
        correctAnswer: formCorrectAnswer,
        rememberNote1: formRememberNote1.trim(),
        rememberNote2: formRememberNote2.trim(),
        rememberNote3: formRememberNote3.trim(),
        detailedExplanation: formExplanation.trim(),
        difficulty: formDifficulty,
        questionType: formQuestionType,
        status: formStatus
      };

      if (editingId) {
        await examService.updateQuestionBankItem(editingId, payload);
      } else {
        await examService.createQuestionBankItem(payload);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this question from the Question Bank?')) {
      try {
        await examService.deleteQuestionBankItem(id);
        await loadData();
      } catch (err: any) {
        alert(err.message || 'Failed to delete question');
      }
    }
  };

  // ---------------------------------------------------------------------------
  // BULK IMPORT PARSER & VALIDATOR (Spec 55-58)
  // ---------------------------------------------------------------------------
  const handleValidateCsv = () => {
    if (!bulkCsvText.trim()) {
      alert('Please paste CSV content');
      return;
    }

    const lines = bulkCsvText.trim().split('\n');
    if (lines.length <= 1) {
      alert('CSV must contain a header and at least one question row.');
      return;
    }

    const existingCodes = new Set(questions.map((q) => q.questionCode.toLowerCase()));
    const validQuestions: any[] = [];
    const invalidRows: any[] = [];
    const duplicateCodes: string[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle simple CSV splitting with quoted comma support
      const cols = line.split('\t').length > 1 ? line.split('\t') : line.split(',');
      const cleaned = cols.map((c) => c.replace(/^["']|["']$/g, '').trim());

      const code = cleaned[0] || `DHA-RN-IMP${i}`;
      const course = cleaned[1] || selectedCourse || 'course-dha-rn';
      const subject = cleaned[2] || 'Clinical Nursing';
      const topic = cleaned[3] || 'General';
      const text = cleaned[4] || '';
      const optA = cleaned[6] || cleaned[5] || '';
      const optB = cleaned[7] || cleaned[6] || '';
      const optC = cleaned[8] || cleaned[7] || '';
      const optD = cleaned[9] || cleaned[8] || '';
      const optE = cleaned[10] || cleaned[9] || '';
      const correct = (cleaned[11] || cleaned[10] || 'C').toUpperCase() as any;
      const note1 = cleaned[12] || cleaned[11] || '';
      const note2 = cleaned[13] || cleaned[12] || '';
      const note3 = cleaned[14] || cleaned[13] || '';
      const expl = cleaned[15] || cleaned[14] || '';

      if (existingCodes.has(code.toLowerCase())) {
        duplicateCodes.push(code);
        invalidRows.push({ rowNumber: i + 1, code, reason: 'Duplicate question code already exists' });
        continue;
      }

      if (!text || !optA || !optB || !optC || !['A', 'B', 'C', 'D', 'E'].includes(correct)) {
        invalidRows.push({ rowNumber: i + 1, code, reason: 'Missing question text, options, or invalid correct answer' });
        continue;
      }

      validQuestions.push({
        questionCode: code,
        courseId: course.startsWith('course-') ? course : 'course-dha-rn',
        subjectId: 'subj-clinical-proc',
        topic,
        title: `Question ${code}`,
        questionText: text,
        optionA: optA,
        optionB: optB,
        optionC: optC,
        optionD: optD,
        optionE: optE,
        correctAnswer: correct,
        rememberNote1: note1 || 'Core clinical fundamental principle.',
        rememberNote2: note2 || 'Protocol action priority step.',
        rememberNote3: note3 || 'Licensing exam high-yield tip.',
        detailedExplanation: expl || '',
        difficulty: 'Medium',
        questionType: 'Both',
        status: 'Active'
      });
    }

    setValidationReport({
      totalRows: lines.length - 1,
      validQuestions,
      invalidRows,
      duplicateCodes
    });
  };

  const handleExecuteImport = async () => {
    if (!validationReport || validationReport.validQuestions.length === 0) return;

    try {
      setImporting(true);
      await examService.bulkImportQuestions(validationReport.validQuestions);
      alert(`Successfully imported ${validationReport.validQuestions.length} questions into Question Bank!`);
      setIsBulkModalOpen(false);
      setBulkCsvText('');
      setValidationReport(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Bulk import failed');
    } finally {
      setImporting(false);
    }
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      'Question Code,Course,Subject,Topic,Question,Image URL,Option A,Option B,Option C,Option D,Option E,Correct Answer,Remember Note 1,Remember Note 2,Remember Note 3,Detailed Explanation,Difficulty,Question Type,Status\n' +
      'DHA-RN-00101,course-dha-rn,Clinical Nursing,Emergency,Fifteen minutes after transfusion patient develops chills?,http://...,Slow down,Give Tylenol,Stop immediately and start saline,Notify blood bank,Increase rate,C,Stop transfusion immediately,Keep IV open with 0.9% NS,Assess vitals and notify provider,Acute hemolytic reaction requires immediate cessation.,Medium,Both,Active\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'question_bank_template.csv';
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-[#111B21] dark:text-[#E9EDEF] tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-400" />
            <span>Centralized Question Bank</span>
          </h2>
          <p className="text-xs text-[#667781] dark:text-[#8696A0] font-medium mt-0.5">
            Manage single source of truth questions used across MCQ Practice and Timed Mock Tests.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Upload className="w-4 h-4 text-teal-400" />
            <span>Bulk Import (CSV/Excel)</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-teal-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-800 bg-[#111b21] p-3 text-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code (e.g. DHA-RN-00001), keywords, or clinical scenario..."
            className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold cursor-pointer shrink-0"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">Course:</span>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white focus:outline-none"
            >
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode} - {displayCourseName(c)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">Difficulty:</span>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white focus:outline-none"
            >
              <option value="all">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">Type:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="Practice">Practice Mode Only</option>
              <option value="Mock Test">Mock Test Only</option>
              <option value="Both">Both (Practice & Mock)</option>
            </select>
          </div>

          <span className="ml-auto text-slate-400 font-mono">
            Total Questions: <span className="text-teal-400 font-bold">{questions.length}</span>
          </span>
        </div>
      </div>

      {/* Questions Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#111b21] overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading Question Bank...</div>
        ) : questions.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No questions match your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Subject / Topic</th>
                  <th className="py-3 px-4">Question Scenario</th>
                  <th className="py-3 px-4">Correct</th>
                  <th className="py-3 px-4">Difficulty</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {questions.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-teal-400 whitespace-nowrap">
                      {q.questionCode}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-white block">{q.subject || 'Clinical Nursing'}</span>
                      <span className="text-[11px] text-slate-400">{q.topic || 'General Assessment'}</span>
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="line-clamp-2 leading-relaxed text-slate-300 font-medium">{q.questionText}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black inline-flex items-center justify-center">
                        {q.correctAnswer}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          q.difficulty === 'Hard'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : q.difficulty === 'Easy'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400 font-medium">
                      {q.questionType}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewQuestion(q)}
                          title="Preview Question & Remember Notes"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(q)}
                          title="Edit Question"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-teal-400 hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {(isAcademicAdmin || (q.status === 'Draft')) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(q.id)}
                            title="Delete Question"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* MODAL 1: ADD / EDIT QUESTION (Spec 7)                              */}
      {/* ----------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-6 w-full max-w-3xl shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-teal-400" />
                <span>{editingId ? 'Edit Question Bank Item' : 'Add Centralized Question'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Course *</label>
                  <select
                    value={formCourseId}
                    onChange={(e) => setFormCourseId(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.courseCode} - {c.profession}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Question Code *</label>
                  <input
                    type="text"
                    required
                    value={formQuestionCode}
                    onChange={(e) => setFormQuestionCode(e.target.value)}
                    placeholder="e.g. DHA-RN-00001"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Topic *</label>
                  <input
                    type="text"
                    required
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    placeholder="e.g. Blood Transfusion Safety"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Question Text (Clinical Scenario) *</label>
                <textarea
                  rows={3}
                  required
                  value={formQuestionText}
                  onChange={(e) => setFormQuestionText(e.target.value)}
                  placeholder="Fifteen minutes after starting a blood transfusion, a patient develops chills..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white leading-relaxed focus:border-teal-500 focus:outline-none"
                />
              </div>

              {/* 5 Options: A, B, C, D, E */}
              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                <label className="block text-slate-200 font-bold">5 Answer Options & Correct Selection *</label>
                {(['A', 'B', 'C', 'D', 'E'] as const).map((key) => {
                  const val =
                    key === 'A'
                      ? formOptionA
                      : key === 'B'
                      ? formOptionB
                      : key === 'C'
                      ? formOptionC
                      : key === 'D'
                      ? formOptionD
                      : formOptionE;
                  const setVal =
                    key === 'A'
                      ? setFormOptionA
                      : key === 'B'
                      ? setFormOptionB
                      : key === 'C'
                      ? setFormOptionC
                      : key === 'D'
                      ? setFormOptionD
                      : setFormOptionE;

                  return (
                    <div key={key} className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                        <input
                          type="radio"
                          name="correct_answer_choice"
                          checked={formCorrectAnswer === key}
                          onChange={() => setFormCorrectAnswer(key)}
                          className="accent-teal-500 w-4 h-4 cursor-pointer"
                        />
                        <span
                          className={`w-6 h-6 rounded-md font-bold text-xs flex items-center justify-center ${
                            formCorrectAnswer === key
                              ? 'bg-teal-500 text-slate-950 font-black'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {key}
                        </span>
                      </label>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder={`Option ${key} text...`}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-white focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>

              {/* 3 Remember Notes (Spec 7 & Spec 14) */}
              <div className="space-y-2 rounded-xl border border-teal-500/30 bg-teal-950/15 p-3.5">
                <div className="flex items-center gap-2 text-teal-400">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-black uppercase tracking-wider text-[11px]">3 High-Yield Remember Notes</span>
                </div>
                <input
                  type="text"
                  value={formRememberNote1}
                  onChange={(e) => setFormRememberNote1(e.target.value)}
                  placeholder="1. Suspected acute reaction → STOP the infusion immediately."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-white focus:outline-none"
                />
                <input
                  type="text"
                  value={formRememberNote2}
                  onChange={(e) => setFormRememberNote2(e.target.value)}
                  placeholder="2. Maintain IV access with 0.9% normal saline using new tubing."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-white focus:outline-none"
                />
                <input
                  type="text"
                  value={formRememberNote3}
                  onChange={(e) => setFormRememberNote3(e.target.value)}
                  placeholder="3. Monitor vitals and immediately report to provider & blood bank."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Detailed Explanation (Optional)</label>
                <textarea
                  rows={2}
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                  placeholder="Deep clinical pharmacology or pathophysiological rationale..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Difficulty</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Question Type</label>
                  <select
                    value={formQuestionType}
                    onChange={(e) => setFormQuestionType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="Both">Both (Practice & Mock)</option>
                    <option value="Practice">Practice Mode Only</option>
                    <option value="Mock Test">Mock Test Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-md cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODAL 2: BULK QUESTION IMPORT (Spec 55-58)                        */}
      {/* ----------------------------------------------------------------- */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-black text-white">Bulk Question Import (CSV / Excel)</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBulkModalOpen(false);
                  setValidationReport(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <p>Upload hundreds or thousands of clinical questions in one step.</p>
              <button
                type="button"
                onClick={downloadSampleTemplate}
                className="inline-flex items-center gap-1.5 text-teal-400 hover:text-teal-300 font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample CSV Template</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-slate-300 font-bold">Paste CSV Rows Below (or drag & drop text)</label>
              <textarea
                rows={7}
                value={bulkCsvText}
                onChange={(e) => setBulkCsvText(e.target.value)}
                placeholder="Question Code,Course,Subject,Topic,Question,Image URL,Option A,Option B,Option C,Option D,Option E,Correct Answer,Remember Note 1,Remember Note 2,Remember Note 3,Detailed Explanation..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white font-mono text-[11px] focus:outline-none"
              />
            </div>

            {/* Validation Trigger Button */}
            {!validationReport && (
              <button
                type="button"
                onClick={handleValidateCsv}
                className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer"
              >
                Validate Import Data & Check Duplicates
              </button>
            )}

            {/* Validation Report Screen (Spec 57) */}
            {validationReport && (
              <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs animate-in fade-in duration-200">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg bg-slate-800 p-2">
                    <span className="text-[10px] text-slate-400 uppercase">Total Rows</span>
                    <p className="text-base font-black text-white">{validationReport.totalRows}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/20 text-emerald-400 p-2">
                    <span className="text-[10px] uppercase font-bold">Valid Questions</span>
                    <p className="text-base font-black">{validationReport.validQuestions.length}</p>
                  </div>
                  <div className="rounded-lg bg-rose-500/20 text-rose-400 p-2">
                    <span className="text-[10px] uppercase font-bold">Invalid</span>
                    <p className="text-base font-black">{validationReport.invalidRows.length}</p>
                  </div>
                  <div className="rounded-lg bg-amber-500/20 text-amber-400 p-2">
                    <span className="text-[10px] uppercase font-bold">Duplicate Codes</span>
                    <p className="text-base font-black">{validationReport.duplicateCodes.length}</p>
                  </div>
                </div>

                {validationReport.invalidRows.length > 0 && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300 space-y-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      Validation Issues Detected:
                    </span>
                    {validationReport.invalidRows.slice(0, 3).map((inv, idx) => (
                      <p key={idx} className="text-[11px]">
                        Row {inv.rowNumber} ({inv.code}): {inv.reason}
                      </p>
                    ))}
                    {validationReport.invalidRows.length > 3 && (
                      <p className="text-[10px] text-slate-400">...and {validationReport.invalidRows.length - 3} more</p>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setValidationReport(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold"
                  >
                    Re-edit CSV
                  </button>

                  <button
                    type="button"
                    disabled={importing || validationReport.validQuestions.length === 0}
                    onClick={handleExecuteImport}
                    className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black shadow-lg shadow-teal-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {importing ? 'Importing...' : `Import ${validationReport.validQuestions.length} Valid Questions`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* DRAWER / MODAL 3: PREVIEW QUESTION                                */}
      {/* ----------------------------------------------------------------- */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-6 w-full max-w-xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-teal-500/20 text-teal-300 font-mono font-bold px-2 py-0.5 text-xs">
                  {previewQuestion.questionCode}
                </span>
                <span className="text-xs text-slate-400">{previewQuestion.topic}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-sm font-bold text-white leading-relaxed">{previewQuestion.questionText}</p>

            <div className="space-y-1.5 text-xs">
              {[
                { k: 'A', t: previewQuestion.optionA },
                { k: 'B', t: previewQuestion.optionB },
                { k: 'C', t: previewQuestion.optionC },
                { k: 'D', t: previewQuestion.optionD },
                { k: 'E', t: previewQuestion.optionE },
              ].map((opt) => (
                <div
                  key={opt.k}
                  className={`p-2.5 rounded-lg border flex items-center gap-2.5 ${
                    opt.k === previewQuestion.correctAnswer
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 font-bold'
                      : 'border-slate-800 bg-slate-900/60 text-slate-300'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded font-bold text-xs flex items-center justify-center ${
                      opt.k === previewQuestion.correctAnswer
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {opt.k}
                  </span>
                  <span>{opt.t}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-3 text-xs space-y-1 text-slate-300">
              <span className="text-teal-400 font-bold block mb-1">High-Yield Remember Notes:</span>
              <p>1. {previewQuestion.rememberNote1}</p>
              <p>2. {previewQuestion.rememberNote2}</p>
              <p>3. {previewQuestion.rememberNote3}</p>
            </div>

            {previewQuestion.detailedExplanation && (
              <div className="text-xs text-slate-400">
                <span className="font-bold text-slate-300">Detailed Explanation:</span>
                <p className="mt-0.5 leading-relaxed">{previewQuestion.detailedExplanation}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
