import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Sparkles, 
  Stethoscope, 
  FileText, 
  AlertCircle, 
  Check, 
  Search, 
  UserPlus, 
  Phone,
  DoorOpen
} from 'lucide-react';
import { Room, Branch } from '../../types';
import { appointmentService } from '../../services/appointmentService';

interface AppointmentBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newAppt: any) => void;
  branch: Branch | null;
  room: Room | null;
  rooms: Room[];
  selectedDate: string; // YYYY-MM-DD
  initialStartTime?: string; // HH:mm e.g. "10:00"
  treatments: any[];
  doctors: any[];
}

export const AppointmentBookingModal: React.FC<AppointmentBookingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  branch,
  room,
  rooms,
  selectedDate,
  initialStartTime = '09:00',
  treatments,
  doctors,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(room?.id || rooms[0]?.id || '');
  const [date, setDate] = useState<string>(selectedDate);
  const [startTime, setStartTime] = useState<string>(initialStartTime);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  // Patient state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isQuickRegister, setIsQuickRegister] = useState<boolean>(false);
  const [quickName, setQuickName] = useState<string>('');
  const [quickPhone, setQuickPhone] = useState<string>('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync props when opening
  useEffect(() => {
    if (isOpen) {
      if (room?.id) setSelectedRoomId(room.id);
      else if (rooms[0]?.id) setSelectedRoomId(rooms[0].id);
      setDate(selectedDate);
      setStartTime(initialStartTime);
      setErrorMessage(null);
      setSelectedPatient(null);
      setSearchQuery('');
      setIsQuickRegister(false);
      setQuickName('');
      setQuickPhone('');
      setNotes('');
      if (treatments.length > 0 && !selectedTreatmentId) {
        setSelectedTreatmentId(treatments[0].id);
      }
      if (doctors.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(doctors[0].id);
      }
    }
  }, [isOpen, room, selectedDate, initialStartTime, treatments, doctors]);

  // Selected Treatment & auto-calculated duration
  const activeTreatment = treatments.find(t => t.id === selectedTreatmentId) || treatments[0];
  const treatmentDurationMinutes = activeTreatment?.durationMinutes || 45;

  // Calculate End Time based on Start Time + Treatment Duration
  const calculateEndTime = (startStr: string, durationMin: number): string => {
    const [hours, minutes] = startStr.split(':').map(Number);
    const totalMinutes = (hours * 60) + minutes + durationMin;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  const endTime = calculateEndTime(startTime, treatmentDurationMinutes);

  // Debounced Patient Search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await appointmentService.searchPatients(searchQuery.trim());
        setSearchResults(results);
      } catch (e) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Doctors filtered by branch & active status
  const currentRoom = rooms.find(r => r.id === selectedRoomId) || room;
  const filteredDoctors = doctors.filter(doc => {
    if (!branch?.name) return true;
    if (doc.branch && doc.branch.toLowerCase() !== branch.name.toLowerCase() && !doc.branch.includes(branch.name)) {
      return false;
    }
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedRoomId) {
      setErrorMessage('Please select a room.');
      return;
    }
    if (!selectedTreatmentId) {
      setErrorMessage('Please select a treatment.');
      return;
    }
    if (!selectedDoctorId) {
      setErrorMessage('Please select a doctor/specialist.');
      return;
    }

    let finalPatientId = selectedPatient?.id;
    let finalPatientName = selectedPatient?.displayName;
    let finalPatientPhone = selectedPatient?.whatsappNumber || selectedPatient?.phoneNumber;

    if (isQuickRegister) {
      if (!quickName.trim() || !quickPhone.trim()) {
        setErrorMessage('Please enter both patient full name and WhatsApp phone number.');
        return;
      }
      finalPatientName = quickName.trim();
      finalPatientPhone = quickPhone.trim();
    } else if (!selectedPatient) {
      setErrorMessage('Please select an existing patient or click "Quick Register" to create one.');
      return;
    }

    const startISO = new Date(`${date}T${startTime}:00.000Z`).toISOString();
    const endISO = new Date(`${date}T${endTime}:00.000Z`).toISOString();

    setIsSubmitting(true);
    try {
      const result = await appointmentService.createAppointment({
        branchId: branch?.id || currentRoom?.branchId || 'branch-colombo',
        roomId: selectedRoomId,
        doctorId: selectedDoctorId,
        treatmentId: selectedTreatmentId,
        startTime: startISO,
        endTime: endISO,
        patientId: finalPatientId,
        patientName: finalPatientName,
        patientPhone: finalPatientPhone,
        notes: notes.trim()
      });

      if (result.success) {
        onSuccess(result.appointment);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Booking conflict detected. Please choose another slot or room.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col my-auto text-slate-100">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-wide">Book New Appointment</h3>
              <p className="text-xs text-slate-400">
                {branch?.name || 'Main Clinic'} &bull; {currentRoom?.roomNumber ? `${currentRoom.roomNumber} - ${currentRoom.name}` : 'Select Room'}
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in shake duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Room & Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <DoorOpen className="w-3.5 h-3.5 text-teal-400" />
                <span>Room</span>
              </label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber} &bull; {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-400" />
                <span>Appointment Date</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Time Slot (Start Time + Auto-Calculated End Time) */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/80">
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                <span>Start Time</span>
              </label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              >
                {Array.from({ length: 25 }, (_, i) => {
                  const h = Math.floor(i / 2) + 8; // 08:00 to 20:00
                  const m = (i % 2) * 30;
                  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                  return (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Calculated End Time</span>
              </label>
              <div className="w-full bg-slate-900/60 border border-slate-800/60 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono font-bold flex items-center justify-between">
                <span>{endTime}</span>
                <span className="text-[10px] text-slate-400">({treatmentDurationMinutes} min)</span>
              </div>
            </div>
          </div>

          {/* Treatment Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span>Clinical Treatment / Service</span>
              </span>
              {activeTreatment?.startingPrice && (
                <span className="text-[11px] text-emerald-400 font-medium font-mono">
                  From LKR {Number(activeTreatment.startingPrice).toLocaleString()}
                </span>
              )}
            </label>
            <select
              value={selectedTreatmentId}
              onChange={(e) => setSelectedTreatmentId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            >
              {treatments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.durationMinutes ? `(${t.durationMinutes} mins)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Doctor Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-teal-400" />
              <span>Assigned Doctor / Specialist</span>
            </label>
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            >
              {filteredDoctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.fullName} {doc.roleTitle ? `— ${doc.roleTitle}` : ''} ({doc.branch || 'General'})
                </option>
              ))}
            </select>
          </div>

          {/* Patient Selection & Quick Registration */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-400" />
                <span>Patient</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsQuickRegister(!isQuickRegister);
                  setSelectedPatient(null);
                }}
                className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
              >
                <UserPlus className="w-3 h-3" />
                <span>{isQuickRegister ? 'Search Existing Patient' : 'Quick Register New Patient'}</span>
              </button>
            </div>

            {isQuickRegister ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 animate-in fade-in duration-150">
                <div>
                  <span className="text-[10px] text-slate-400 mb-1 block">Full Name</span>
                  <input
                    type="text"
                    placeholder="e.g. Ruwan Wickramasinghe"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 mb-1 block">WhatsApp Phone Number</span>
                  <input
                    type="tel"
                    placeholder="e.g. +94771234567"
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="relative">
                {selectedPatient ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
                        {selectedPatient.displayName?.charAt(0) || 'P'}
                      </div>
                      <div>
                        <p className="font-bold text-white">{selectedPatient.displayName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{selectedPatient.whatsappNumber || selectedPatient.phoneNumber}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(null)}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search patient by name or WhatsApp number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    {isSearching && (
                      <p className="text-[10px] text-slate-500 mt-1 pl-1">Searching patients...</p>
                    )}

                    {searchResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-xl overflow-hidden z-20 max-h-40 overflow-y-auto">
                        {searchResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPatient(p);
                              setSearchResults([]);
                              setSearchQuery('');
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-slate-800/80 flex items-center justify-between text-xs transition-colors cursor-pointer border-b border-slate-900 last:border-0"
                          >
                            <span className="font-bold text-slate-200">{p.displayName}</span>
                            <span className="text-[10px] text-teal-400 font-mono">{p.whatsappNumber || p.phoneNumber}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clinical Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-400" />
              <span>Notes & Clinical Instructions (Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Patient allergic to penicillin, first session, skin sensitivity check required..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
            />
          </div>

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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Checking Availability...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirm Appointment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

