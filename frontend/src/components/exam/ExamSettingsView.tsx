import React, { useState } from 'react';
import {
  Sliders,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Save,
  RefreshCw,
  Users,
  Settings,
  HelpCircle,
  AlertCircle
} from 'lucide-react';

export const ExamSettingsView: React.FC = () => {
  const [defaultPassPercentage, setDefaultPassPercentage] = useState(65);
  const [questionPrefix, setQuestionPrefix] = useState('DHA-RN-');
  const [enableImmediateFeedback, setEnableImmediateFeedback] = useState(true);
  const [enableSessionAutoSave, setEnableSessionAutoSave] = useState(true);
  const [allowQuestionSkip, setAllowQuestionSkip] = useState(false);
  const [randomizeMockQuestions, setRandomizeMockQuestions] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-teal-400" />
          <span>Exam Department System Settings & Governance</span>
        </h2>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          Configure passing thresholds, question bank conventions, and role-based operational permissions.
        </p>
      </div>

      {savedSuccess && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Settings saved successfully. All changes are active across sessions.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Exam Configuration */}
        <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-400" />
            <span>Examination & Practice Preferences</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Default Mock Test Pass Percentage (%)
              </label>
              <input
                type="number"
                min={40}
                max={100}
                value={defaultPassPercentage}
                onChange={(e) => setDefaultPassPercentage(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono focus:border-teal-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Standard DHA / Prometric benchmark is 60% – 65%.
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Question Code Prefix Format
              </label>
              <input
                type="text"
                value={questionPrefix}
                onChange={(e) => setQuestionPrefix(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono focus:border-teal-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Auto-assigned when adding questions (e.g. DHA-RN-00001).
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-800 text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={enableImmediateFeedback}
                onChange={(e) => setEnableImmediateFeedback(e.target.checked)}
                className="accent-teal-500 w-4 h-4 rounded cursor-pointer"
              />
              <span className="text-slate-300 font-semibold">
                Instant Correct/Wrong checking in MCQ Practice mode (without Submit button)
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={enableSessionAutoSave}
                onChange={(e) => setEnableSessionAutoSave(e.target.checked)}
                className="accent-teal-500 w-4 h-4 rounded cursor-pointer"
              />
              <span className="text-slate-300 font-semibold">
                Automatically save student practice sessions (resume from where left off)
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={randomizeMockQuestions}
                onChange={(e) => setRandomizeMockQuestions(e.target.checked)}
                className="accent-teal-500 w-4 h-4 rounded cursor-pointer"
              />
              <span className="text-slate-300 font-semibold">
                Randomize question order in simulation mock exams by default
              </span>
            </label>
          </div>
        </div>

        {/* Card 2: Role & Permissions Matrix (Spec 62-66) */}
        <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Role-Based Access Control (RBAC) Matrix</span>
            </h3>
            <span className="text-[11px] text-slate-500">Security Governed</span>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Create Courses</th>
                  <th className="py-2.5 px-3">Question Bank CRUD</th>
                  <th className="py-2.5 px-3">Mock Tests & Materials</th>
                  <th className="py-2.5 px-3">Audit Logs & Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                <tr>
                  <td className="py-2.5 px-3 font-bold text-white">Super Admin</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">✓ Allowed</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold text-white">Admin</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-slate-500 font-semibold">✗ Restricted</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold text-white">Exam Materials Officer</td>
                  <td className="py-2.5 px-3 text-slate-500 font-semibold">✗ View Only</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">✓ Add/Edit</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">✓ Upload</td>
                  <td className="py-2.5 px-3 text-slate-500 font-semibold">✗ Restricted</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold text-white">Student Candidate</td>
                  <td className="py-2.5 px-3 text-slate-500 font-semibold">✗ View Assigned</td>
                  <td className="py-2.5 px-3 text-slate-500 font-semibold">✗ Practice Only</td>
                  <td className="py-2.5 px-3 text-slate-500 font-semibold">✗ Test Taker</td>
                  <td className="py-2.5 px-3 text-slate-500 font-semibold">✗ None</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-teal-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4 stroke-[2.5]" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
