import React, { useState, useEffect } from 'react';
import { X, DoorOpen, Palette, Clock, FileText, AlertCircle, Check, Trash2, Edit3, ShieldAlert } from 'lucide-react';
import { Room, Branch } from '../../types';
import { appointmentService } from '../../services/appointmentService';

interface RoomManagerModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'delete';
  onClose: () => void;
  onSuccess: (room?: Room) => void;
  branch: Branch | null;
  roomToEdit?: Room | null;
  rooms: Room[];
  treatments: any[];
}

const COLOR_PRESETS = [
  '#0d9488', // Teal
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#ef4444'  // Rose
];

export const RoomManagerModal: React.FC<RoomManagerModalProps> = ({
  isOpen,
  mode,
  onClose,
  onSuccess,
  branch,
  roomToEdit,
  rooms,
  treatments,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(roomToEdit?.id || rooms[0]?.id || '');
  const [name, setName] = useState<string>('');
  const [roomNumber, setRoomNumber] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [color, setColor] = useState<string>('#0d9488');
  const [operatingStart, setOperatingStart] = useState<string>('08:00');
  const [operatingEnd, setOperatingEnd] = useState<string>('20:00');
  const [selectedTreatmentIds, setSelectedTreatmentIds] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (mode === 'edit' && roomToEdit) {
        setSelectedRoomId(roomToEdit.id);
        setName(roomToEdit.name);
        setRoomNumber(roomToEdit.roomNumber);
        setDescription(roomToEdit.description || '');
        setColor(roomToEdit.color || '#0d9488');
        setOperatingStart(roomToEdit.operatingStart || '08:00');
        setOperatingEnd(roomToEdit.operatingEnd || '20:00');
        setSelectedTreatmentIds(roomToEdit.treatmentIds || []);
      } else if (mode === 'create') {
        setName('');
        setRoomNumber(`R-${100 + rooms.length + 1}`);
        setDescription('');
        setColor(COLOR_PRESETS[rooms.length % COLOR_PRESETS.length]);
        setOperatingStart('08:00');
        setOperatingEnd('20:00');
        setSelectedTreatmentIds([]);
      } else if (mode === 'delete' && roomToEdit) {
        setSelectedRoomId(roomToEdit.id);
      }
    }
  }, [isOpen, mode, roomToEdit, rooms]);

  if (!isOpen) return null;

  const currentSelectedRoom = rooms.find(r => r.id === selectedRoomId) || roomToEdit;

  const toggleTreatment = (id: string) => {
    if (selectedTreatmentIds.includes(id)) {
      setSelectedTreatmentIds(selectedTreatmentIds.filter(t => t !== id));
    } else {
      setSelectedTreatmentIds([...selectedTreatmentIds, id]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (mode === 'delete') {
      if (!selectedRoomId) return;
      setIsSubmitting(true);
      try {
        const res = await appointmentService.deleteRoom(selectedRoomId);
        if (res.success) {
          onSuccess();
          onClose();
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Cannot deactivate room: Future active appointments exist.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!name.trim() || !roomNumber.trim()) {
      setErrorMessage('Room name and room number are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        const res = await appointmentService.createRoom({
          name: name.trim(),
          roomNumber: roomNumber.trim(),
          branchId: branch?.id || 'branch-colombo',
          color,
          description: description.trim(),
          operatingStart,
          operatingEnd,
          treatmentIds: selectedTreatmentIds
        });
        if (res.success) {
          onSuccess(res.room);
          onClose();
        }
      } else if (mode === 'edit' && selectedRoomId) {
        const res = await appointmentService.updateRoom(selectedRoomId, {
          name: name.trim(),
          roomNumber: roomNumber.trim(),
          color,
          description: description.trim(),
          operatingStart,
          operatingEnd,
          treatmentIds: selectedTreatmentIds
        });
        if (res.success) {
          onSuccess(res.room);
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save room details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col my-auto text-slate-100">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              mode === 'delete' 
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' 
                : 'bg-teal-500/20 text-teal-400 border-teal-500/30'
            }`}>
              {mode === 'delete' ? <Trash2 className="w-5 h-5" /> : mode === 'edit' ? <Edit3 className="w-5 h-5" /> : <DoorOpen className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-wide">
                {mode === 'create' ? 'Create New Clinical Room' : mode === 'edit' ? 'Edit Clinical Room' : 'Deactivate Clinical Room'}
              </h3>
              <p className="text-xs text-slate-400">
                {branch?.name || 'Clinic'} Branch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'delete' ? (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-300">Safe Deactivation Policy</p>
                  <p className="text-[11px] text-amber-200/80 mt-1">
                    Deactivating a room will preserve all historical records and past appointments. 
                    However, if any active future appointments exist in this room, deactivation will be prevented until those appointments are rescheduled or cancelled.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Select Room to Deactivate</label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomNumber} &bull; {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <>
              {mode === 'edit' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Select Room to Edit</label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => {
                      setSelectedRoomId(e.target.value);
                      const target = rooms.find(r => r.id === e.target.value);
                      if (target) {
                        setName(target.name);
                        setRoomNumber(target.roomNumber);
                        setDescription(target.description || '');
                        setColor(target.color || '#0d9488');
                        setOperatingStart(target.operatingStart || '08:00');
                        setOperatingEnd(target.operatingEnd || '20:00');
                        setSelectedTreatmentIds(target.treatmentIds || []);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.roomNumber} &bull; {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Room Number & Room Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Room Number</label>
                  <input
                    type="text"
                    placeholder="e.g. R-101"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-mono font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Room Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Laser & Skin Therapy Suite"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Color Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
                  <Palette className="w-3.5 h-3.5 text-teal-400" />
                  <span>Calendar Color Badge</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                        color === c ? 'scale-110 border-white shadow-md' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer p-0 ml-1"
                    title="Choose custom color"
                  />
                </div>
              </div>

              {/* Operating Hours */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800">
                <div>
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-400" />
                    <span>Operating Start</span>
                  </label>
                  <input
                    type="time"
                    value={operatingStart}
                    onChange={(e) => setOperatingStart(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-400" />
                    <span>Operating End</span>
                  </label>
                  <input
                    type="time"
                    value={operatingEnd}
                    onChange={(e) => setOperatingEnd(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-400" />
                  <span>Description</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Clinical equipment, specialized suite purpose..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              {/* Supported Treatments Multi-Select */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Supported Treatments in this Room</label>
                <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                  {treatments.map((t) => {
                    const isChecked = selectedTreatmentIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTreatment(t.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                          isChecked ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30' : 'hover:bg-slate-800/60 text-slate-300'
                        }`}
                      >
                        <span className="font-medium truncate">{t.name}</span>
                        {isChecked && <Check className="w-4 h-4 text-teal-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${
                mode === 'delete' 
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/30' 
                  : 'bg-teal-600 hover:bg-teal-500 shadow-teal-900/30'
              }`}
            >
              {isSubmitting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'delete' ? (
                <Trash2 className="w-4 h-4" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{mode === 'delete' ? 'Deactivate Room' : mode === 'edit' ? 'Save Changes' : 'Create Room'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

