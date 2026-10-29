import React, { useState, useEffect } from 'react';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  BookOpen,
  FileText,
  Database,
  FileCheck2,
  RefreshCw,
  Send,
  X
} from 'lucide-react';
import { examService } from '../../services/examService';

export const ApprovalQueueView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [queue, setQueue] = useState<{
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

  // Modal for Requesting Changes
  const [changesModal, setChangesModal] = useState<{
    isOpen: boolean;
    entityType: 'course' | 'material' | 'question' | 'mock_test';
    entityId: string;
    title: string;
    comments: string;
  }>({
    isOpen: false,
    entityType: 'course',
    entityId: '',
    title: '',
    comments: '',
  });

  const loadQueue = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await examService.getApprovalQueue();
      setQueue(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load approval queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleApproveAndPublish = async (entityType: 'course' | 'material' | 'question' | 'mock_test', entityId: string) => {
    try {
      setProcessingId(entityId);
      setActionMessage('');
      await examService.transitionAcademicContent(entityType, entityId, 'publish');
      setActionMessage('Item approved and published successfully! It is now live in the student catalog.');
      await loadQueue();
    } catch (err: any) {
      setError(err.message || 'Failed to approve item.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmChanges = async () => {
    if (!changesModal.comments.trim()) {
      alert('Please enter review comments explaining what revisions are required.');
      return;
    }
    try {
      setProcessingId(changesModal.entityId);
      setActionMessage('');
      await examService.transitionAcademicContent(
        changesModal.entityType,
        changesModal.entityId,
        'request_changes',
        changesModal.comments.trim()
      );
      setActionMessage('Item returned to author with requested changes.');
      setChangesModal({ isOpen: false, entityType: 'course', entityId: '', title: '', comments: '' });
      await loadQueue();
    } catch (err: any) {
      setError(err.message || 'Failed to return item.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Inbox className="w-5 h-5 text-teal-400" />
            <span>Academic Approval Queue</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Review submissions from Exam Coordinators and Providing Officers. Approve to publish or request revisions.
          </p>
        </div>

        <button
          type="button"
          onClick={loadQueue}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue ({queue.total})</span>
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

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Checking pending submissions...</div>
      ) : queue.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center space-y-3 bg-[#111b21]/40">
          <CheckCircle2 className="w-8 h-8 text-teal-400 mx-auto" />
          <p className="text-sm font-bold text-slate-200">Approval queue is clear</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All submitted courses, materials, questions, and mock tests have been reviewed and published.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Courses Pending */}
          {queue.courses.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-teal-400" /> Courses Awaiting Approval ({queue.courses.length})
              </h3>
              <div className="space-y-3">
                {queue.courses.map(course => (
                  <div key={course.id} className="rounded-xl border border-slate-800 bg-[#111b21] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-teal-400">{course.courseCode}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">Pending Review</span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-1">{course.courseName}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{course.profession} • {course.examAuthority} • Submitted by: {course.createdBy || 'Exam Coordinator'}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setChangesModal({ isOpen: true, entityType: 'course', entityId: course.id, title: course.courseName, comments: '' })}
                        disabled={processingId === course.id}
                        className="px-3 py-1.5 rounded-lg border border-rose-500/40 hover:bg-rose-500/10 text-rose-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Request Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveAndPublish('course', course.id)}
                        disabled={processingId === course.id}
                        className="px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-teal-500/20 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Publish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Study Materials Pending */}
          {queue.materials.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-400" /> Study Materials Awaiting Approval ({queue.materials.length})
              </h3>
              <div className="space-y-3">
                {queue.materials.map(mat => (
                  <div key={mat.id} className="rounded-xl border border-slate-800 bg-[#111b21] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-teal-400">{mat.materialType || 'PDF'}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">Pending Review</span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-1">{mat.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{mat.topic || 'Resource'} • Author: {mat.uploadedBy || 'Staff'}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setChangesModal({ isOpen: true, entityType: 'material', entityId: mat.id, title: mat.title, comments: '' })}
                        disabled={processingId === mat.id}
                        className="px-3 py-1.5 rounded-lg border border-rose-500/40 hover:bg-rose-500/10 text-rose-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Request Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveAndPublish('material', mat.id)}
                        disabled={processingId === mat.id}
                        className="px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-teal-500/20 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Publish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Questions Pending */}
          {queue.questions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-teal-400" /> Questions Awaiting Approval ({queue.questions.length})
              </h3>
              <div className="space-y-3">
                {queue.questions.map(q => (
                  <div key={q.id} className="rounded-xl border border-slate-800 bg-[#111b21] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-teal-400">{q.questionCode}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">Pending Review</span>
                      </div>
                      <h4 className="text-sm font-bold text-white line-clamp-2 mt-1">{q.title || q.questionText}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{q.subject} • Correct Answer: {q.correctAnswer}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setChangesModal({ isOpen: true, entityType: 'question', entityId: q.id, title: q.title || q.questionText, comments: '' })}
                        disabled={processingId === q.id}
                        className="px-3 py-1.5 rounded-lg border border-rose-500/40 hover:bg-rose-500/10 text-rose-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Request Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveAndPublish('question', q.id)}
                        disabled={processingId === q.id}
                        className="px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-teal-500/20 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Publish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mock Tests Pending */}
          {queue.mockTests.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-teal-400" /> Mock Tests Awaiting Approval ({queue.mockTests.length})
              </h3>
              <div className="space-y-3">
                {queue.mockTests.map(mock => (
                  <div key={mock.id} className="rounded-xl border border-slate-800 bg-[#111b21] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-teal-400">{mock.durationMinutes || 60} Mins</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">Pending Review</span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-1">{mock.mockTestName || mock.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{mock.subjectScope || 'Exam Simulation'}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setChangesModal({ isOpen: true, entityType: 'mock_test', entityId: mock.id, title: mock.mockTestName || mock.title, comments: '' })}
                        disabled={processingId === mock.id}
                        className="px-3 py-1.5 rounded-lg border border-rose-500/40 hover:bg-rose-500/10 text-rose-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Request Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveAndPublish('mock_test', mock.id)}
                        disabled={processingId === mock.id}
                        className="px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-teal-500/20 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Publish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Request Changes / Feedback */}
      {changesModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#111b21] p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>Request Revisions from Author</span>
              </h3>
              <button
                type="button"
                onClick={() => setChangesModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium">Item under review:</p>
              <p className="text-sm font-bold text-slate-200 truncate">{changesModal.title}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Detailed Feedback / Required Corrections: *
              </label>
              <textarea
                value={changesModal.comments}
                onChange={e => setChangesModal(prev => ({ ...prev, comments: e.target.value }))}
                rows={4}
                placeholder="Explain what needs to be revised before publication (e.g. clarify question explanation, add guideline reference, check formatting)..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-xs text-white placeholder:text-slate-500 focus:border-rose-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setChangesModal(prev => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmChanges}
                disabled={processingId === changesModal.entityId || !changesModal.comments.trim()}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-rose-500/20 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Return with Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

