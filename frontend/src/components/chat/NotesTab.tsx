import React, { useState } from 'react';
import { Lead } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { FileText, Plus, User, Clock, Send } from 'lucide-react';

interface NotesTabProps {
  lead: Lead;
}

export const NotesTab: React.FC<NotesTabProps> = ({ lead }) => {
  const { notes, addLeadNote, currentUser } = useCrm();
  const [noteText, setNoteText] = useState('');

  const isCras = lead.company === 'CRAS';
  const leadNotes = notes.filter(n => n.leadId === lead.id);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    addLeadNote(lead.id, noteText);
    setNoteText('');
  };

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <form onSubmit={handleAddNote} className="space-y-2 bg-slate-900 p-3 rounded-xl border border-slate-800">
        <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
          <FileText className={`w-3.5 h-3.5 ${isCras ? 'text-rose-400' : 'text-teal-400'}`} />
          <span>{isCras ? 'Internal Academic / Inquiry Note' : 'Internal Clinical / Patient Note'} (Not visible to customer)</span>
        </label>
        <textarea
          rows={3}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder={isCras 
            ? "Add academic background, course requirements, or tuition fee quotes..." 
            : "Add clinical observations, consultant availability, or price quotes..."}
          className={`w-full bg-slate-950 border border-slate-700/80 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none resize-none ${
            isCras ? 'focus:border-rose-500' : 'focus:border-teal-500'
          }`}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!noteText.trim()}
            className={`px-3 py-1.5 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:bg-slate-800 disabled:text-slate-500 ${
              isCras ? 'bg-rose-600 hover:bg-rose-500' : 'bg-teal-600 hover:bg-teal-500'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save Note</span>
          </button>
        </div>
      </form>

      {/* Notes timeline list */}
      <div className="space-y-2.5">
        {leadNotes.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            <p>No internal notes added yet.</p>
          </div>
        ) : (
          leadNotes.map((note) => (
            <div key={note.id} className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800/80 pb-1">
                <span className={`font-semibold flex items-center gap-1 ${isCras ? 'text-rose-300' : 'text-teal-300'}`}>
                  <User className="w-3 h-3" /> {note.authorName}
                </span>
                <span className="font-mono flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(note.createdAt).toLocaleDateString()} {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-slate-200 leading-relaxed whitespace-pre-line text-xs">{note.note}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
