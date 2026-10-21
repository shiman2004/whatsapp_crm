import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Edit3, 
  Trash2, 
  MapPin, 
  Clock, 
  Users, 
  Sparkles, 
  RotateCw, 
  AlertCircle,
  Filter,
  CheckCircle2,
  CalendarDays,
  DoorOpen
} from 'lucide-react';
import { Branch, Room, Appointment, AvailabilityBlock } from '../../types';
import { appointmentService } from '../../services/appointmentService';
import { BookUpdateAppointmentModal } from './BookUpdateAppointmentModal';
import { RoomManagerModal } from './RoomManagerModal';
import { useCrm } from '../../context/CrmContext';
import { getAppointmentStatusConfig } from '../../utils/appointmentStatusUtils';

// 30-Minute Visual Slots from 08:00 to 20:00 (24 slots of 30 mins)
const TIME_SLOTS: string[] = [];
for (let h = 8; h <= 20; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 20) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
  }
}

const SLOT_HEIGHT = 56; // 56px per 30-minute interval

export const AppointmentSchedulerView: React.FC = () => {
  const { treatments, setSelectedLeadId, setActiveNavTab, currentUser } = useCrm();

  // State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Mobile View Room Tab
  const [activeMobileRoomId, setActiveMobileRoomId] = useState<string>('');

  // Modals state
  const [isBookingOpen, setIsBookingOpen] = useState<boolean>(false);
  const [bookingRoom, setBookingRoom] = useState<Room | null>(null);
  const [bookingStartTime, setBookingStartTime] = useState<string>('09:00');

  const [roomModalMode, setRoomModalMode] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selectedRoomToEdit, setSelectedRoomToEdit] = useState<Room | null>(null);

  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);

  // Live current-time indicator
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 1. Initial Load: Branches & Doctors
  useEffect(() => {
    const initData = async () => {
      try {
        const [branchList, doctorList] = await Promise.all([
          appointmentService.getBranches(),
          appointmentService.getDoctors()
        ]);
        setBranches(branchList);
        if (branchList.length > 0 && !selectedBranchId) {
          // Default to current user's branch or first
          const userBranchMatch = branchList.find(b => b.name.toLowerCase().includes((currentUser?.branch || '').toLowerCase()));
          setSelectedBranchId(userBranchMatch?.id || branchList[0].id);
        }
        setDoctors(doctorList);
      } catch (err: any) {
        console.warn('Initial branch/doctor load warning:', err.message);
      }
    };
    initData();
  }, [currentUser]);

  // 2. Fetch Rooms & Appointments when Branch or Date changes
  const fetchSchedule = async () => {
    if (!selectedBranchId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [roomList, apptList, blockList] = await Promise.all([
        appointmentService.getRooms(selectedBranchId),
        appointmentService.getAppointments({ branchId: selectedBranchId, date: selectedDate }),
        appointmentService.getAvailabilityBlocks(selectedBranchId)
      ]);
      setRooms(roomList);
      if (roomList.length > 0 && (!activeMobileRoomId || !roomList.some(r => r.id === activeMobileRoomId))) {
        setActiveMobileRoomId(roomList[0].id);
      }
      setAppointments(apptList);
      setAvailabilityBlocks(blockList);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch schedule data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [selectedBranchId, selectedDate]);

  // Active Branch
  const selectedBranch = branches.find(b => b.id === selectedBranchId) || branches[0] || null;

  // Date Navigation
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Check if viewing today
  const isViewingToday = useMemo(() => {
    return selectedDate === new Date().toISOString().split('T')[0];
  }, [selectedDate]);

  // Compute Current Time Indicator Position
  const currentTimeTop = useMemo(() => {
    if (!isViewingToday) return null;
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    if (currentH < 8 || currentH > 20) return null;
    const minutesFrom8AM = ((currentH - 8) * 60) + currentM;
    return (minutesFrom8AM / 30) * SLOT_HEIGHT;
  }, [isViewingToday, now]);

  // Open booking modal for a specific slot
  const handleSlotClick = (room: Room, timeSlot: string) => {
    setBookingRoom(room);
    setBookingStartTime(timeSlot);
    setIsBookingOpen(true);
  };

  // Helper to calculate top & height of appointment card on the 30-min grid
  const getCardStyle = (startTimeStr: string, endTimeStr: string) => {
    const s = new Date(startTimeStr);
    const e = new Date(endTimeStr);

    const startH = s.getHours();
    const startM = s.getMinutes();
    const endH = e.getHours();
    const endM = e.getMinutes();

    const startMinutesFrom8 = ((startH - 8) * 60) + startM;
    const durationMinutes = Math.max(15, ((endH * 60) + endM) - ((startH * 60) + startM));

    const top = (startMinutesFrom8 / 30) * SLOT_HEIGHT;
    const height = Math.max(38, (durationMinutes / 30) * SLOT_HEIGHT) - 2;

    return { top: `${top}px`, height: `${height}px` };
  };

  const getStatusColor = (status: string, roomColor?: string) => {
    const config = getAppointmentStatusConfig(status);
    return config.schedulerCardClass || 'bg-blue-950/70 border-blue-500/70 text-blue-100 hover:border-blue-400';
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100 select-none">
      
      {/* 1. Header Toolbar matching design */}
      <header className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Title & Branch Selector */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white tracking-wide font-sans">Book Appointment</h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Live Scheduler
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Clinical Suite & Room Management Calendar</p>
          </div>

          {/* Branch Dropdown */}
          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-slate-800">
            <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Navigation & Actions */}
        <div className="flex items-center flex-wrap gap-2">
          
          {/* Date Navigator */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToday}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                isViewingToday ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              Today
            </button>

            <button
              type="button"
              onClick={handleNextDay}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-0 text-slate-200 text-xs font-semibold px-2 py-1 outline-none cursor-pointer font-mono"
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchSchedule}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors cursor-pointer"
            title="Refresh Schedule"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
          </button>

          {/* Room Action Buttons */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
            <button
              type="button"
              onClick={() => {
                setSelectedRoomToEdit(null);
                setRoomModalMode('create');
              }}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-teal-900/30 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Create Room</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRoomToEdit(rooms[0] || null);
                setRoomModalMode('edit');
              }}
              disabled={rooms.length === 0}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-800 transition-colors cursor-pointer disabled:opacity-40"
              title="Edit Room"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden md:inline ml-1">Edit Room</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRoomToEdit(rooms[0] || null);
                setRoomModalMode('delete');
              }}
              disabled={rooms.length === 0}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 rounded-xl text-xs font-semibold border border-slate-800 transition-colors cursor-pointer disabled:opacity-40"
              title="Deactivate Room"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline ml-1">Delete Room</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Switcher for Rooms (when screen is very narrow) */}
      <div className="md:hidden flex items-center overflow-x-auto px-3 py-2 border-b border-slate-800/80 bg-slate-950/90 gap-1.5 shrink-0">
        {rooms.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setActiveMobileRoomId(r.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
              activeMobileRoomId === r.id 
                ? 'bg-teal-600 text-white shadow-xs' 
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {r.roomNumber} &bull; {r.name}
          </button>
        ))}
      </div>

      {/* 2. Main Calendar Grid Area */}
      <div className="flex-1 overflow-auto relative bg-[#0b1319]">
        {error ? (
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
            <h3 className="text-sm font-bold text-white">Error Loading Schedule</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">{error}</p>
            <button
              onClick={fetchSchedule}
              className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold"
            >
              Try Again
            </button>
          </div>
        ) : rooms.length === 0 && !isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <DoorOpen className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-sm font-bold text-white">No Clinical Rooms Configured</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              There are currently no active rooms registered for {selectedBranch?.name || 'this branch'}.
            </p>
            <button
              onClick={() => {
                setSelectedRoomToEdit(null);
                setRoomModalMode('create');
              }}
              className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Room</span>
            </button>
          </div>
        ) : (
          <div className="min-w-fit flex flex-col relative select-none">
            
            {/* Sticky Room Header Row */}
            <div className="sticky top-0 z-30 flex bg-slate-950 border-b border-slate-800 shadow-md">
              {/* Sticky Top-Left Corner (Time Column Label) */}
              <div className="sticky left-0 z-40 w-20 shrink-0 bg-slate-950 p-3 border-r border-slate-800 flex items-center justify-center text-[10px] font-black uppercase tracking-wider text-slate-400 shadow-xs">
                Time
              </div>

              {/* Room Columns */}
              <div className="flex flex-1">
                {rooms.map((r) => {
                  const isVisibleOnMobile = !activeMobileRoomId || activeMobileRoomId === r.id;
                  return (
                    <div
                      key={r.id}
                      className={`w-64 sm:w-72 shrink-0 border-r border-slate-800/80 p-3 bg-slate-950 flex flex-col justify-between ${
                        !isVisibleOnMobile ? 'hidden md:flex' : 'flex'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span 
                              className="w-2.5 h-2.5 rounded-full shrink-0" 
                              style={{ backgroundColor: r.color || '#0d9488' }} 
                            />
                            <span className="text-xs font-black text-white font-mono tracking-wide">{r.roomNumber}</span>
                          </div>
                          <h3 className="text-xs font-bold text-slate-200 truncate mt-0.5" title={r.name}>
                            {r.name}
                          </h3>
                        </div>

                        {/* Quick action to add appointment */}
                        <button
                          type="button"
                          onClick={() => handleSlotClick(r, '09:00')}
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-teal-400 transition-colors shrink-0 cursor-pointer"
                          title="Book into this room"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Supported Treatments Badges */}
                      <div className="mt-2 flex items-center gap-1 flex-wrap">
                        {r.treatments && r.treatments.length > 0 ? (
                          r.treatments.slice(0, 2).map((t) => (
                            <span
                              key={t.id}
                              className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-slate-900 text-slate-300 border border-slate-800 truncate max-w-[120px]"
                            >
                              {t.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[9px] text-slate-500">General Suite</span>
                        )}
                        {r.treatments && r.treatments.length > 2 && (
                          <span className="text-[9px] text-teal-400 font-bold">+{r.treatments.length - 2}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Time Slots & Scheduler Canvas */}
            <div className="flex relative">
              
              {/* Sticky Left Column: Time Labels */}
              <div className="sticky left-0 z-20 w-20 shrink-0 bg-slate-950/95 border-r border-slate-800 divide-y divide-slate-800/40 select-none shadow-xs">
                {TIME_SLOTS.map((slot) => (
                  <div
                    key={slot}
                    style={{ height: `${SLOT_HEIGHT}px` }}
                    className="flex items-start justify-center pt-2 text-[11px] font-mono font-bold text-slate-400"
                  >
                    {slot}
                  </div>
                ))}
              </div>

              {/* Room Grid Columns */}
              <div className="flex flex-1 relative">
                
                {/* Live Current Time Line (Across Entire Scheduler Canvas) */}
                {currentTimeTop !== null && (
                  <div
                    className="absolute left-0 right-0 z-25 pointer-events-none flex items-center"
                    style={{ top: `${currentTimeTop}px` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.5 shadow-sm shadow-rose-500/80 ring-2 ring-slate-950" />
                    <div className="flex-1 h-0.5 bg-rose-500 shadow-sm shadow-rose-500/50" />
                  </div>
                )}

                {rooms.map((r) => {
                  const isVisibleOnMobile = !activeMobileRoomId || activeMobileRoomId === r.id;
                  const roomAppts = appointments.filter(a => a.roomId === r.id);
                  const roomBlocks = availabilityBlocks.filter(b => b.roomId === r.id);

                  return (
                    <div
                      key={r.id}
                      className={`w-64 sm:w-72 shrink-0 border-r border-slate-800/60 relative divide-y divide-slate-800/30 ${
                        !isVisibleOnMobile ? 'hidden md:block' : 'block'
                      }`}
                    >
                      {/* 30-min Slot Drop Targets */}
                      {TIME_SLOTS.map((slot) => (
                        <div
                          key={slot}
                          style={{ height: `${SLOT_HEIGHT}px` }}
                          onClick={() => handleSlotClick(r, slot)}
                          className="group relative cursor-pointer hover:bg-slate-900/60 transition-colors"
                        >
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center pointer-events-none">
                            <span className="text-[10px] font-bold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded-md border border-teal-500/40">
                              + Book {slot}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Render Appointment Cards Absolute Overlay */}
                      {roomAppts.map((appt) => {
                        const style = getCardStyle(appt.startTime, appt.endTime);
                        const statusClass = getStatusColor(appt.status, r.color);

                        return (
                          <div
                            key={appt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedApptId(appt.id);
                            }}
                            style={{ top: style.top, height: style.height }}
                            className={`absolute left-1 right-1 rounded-xl p-2.5 border shadow-sm flex flex-col justify-between overflow-hidden cursor-pointer transition-all hover:scale-[1.01] hover:z-20 ${statusClass}`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-mono font-bold text-slate-300">
                                  {new Date(appt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {' - '}
                                  {new Date(appt.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-black/50 border border-white/10 flex items-center gap-1">
                                  <span>{getAppointmentStatusConfig(appt.status).iconEmoji}</span>
                                  <span>{getAppointmentStatusConfig(appt.status).label}</span>
                                </span>
                              </div>

                              <p className="font-black text-xs text-white truncate mt-0.5">
                                {appt.patientName || 'Patient'}
                              </p>
                              <p className="text-[10px] text-teal-300 truncate font-medium">
                                {appt.treatmentName}
                              </p>
                            </div>

                            <div className="flex items-center justify-between text-[9px] text-slate-300 mt-1 pt-1 border-t border-white/10">
                              <span className="truncate">👨‍⚕️ {appt.doctorName || 'Doctor'}</span>
                              {appt.patientPhone && (
                                <span className="font-mono text-slate-400 truncate max-w-[80px]">
                                  {appt.patientPhone.slice(-4)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Render Availability / Maintenance Blocks */}
                      {roomBlocks.map((blk) => {
                        const style = getCardStyle(blk.startTime, blk.endTime);
                        return (
                          <div
                            key={blk.id}
                            style={{ top: style.top, height: style.height }}
                            className="absolute left-1 right-1 rounded-xl p-2 bg-slate-900/90 border border-slate-700/80 text-slate-400 flex flex-col justify-center items-center text-center overflow-hidden z-10 pointer-events-none"
                          >
                            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">
                              Blocked
                            </span>
                            <span className="text-[9px] truncate text-slate-300 mt-0.5">
                              {blk.reason}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Book / Update Appointment Modal */}
      {(isBookingOpen || selectedApptId) && (
        <BookUpdateAppointmentModal
          isOpen={Boolean(isBookingOpen || selectedApptId)}
          onClose={() => {
            setIsBookingOpen(false);
            setSelectedApptId(null);
          }}
          onSuccess={() => {
            setIsBookingOpen(false);
            setSelectedApptId(null);
            fetchSchedule();
          }}
          appointmentId={selectedApptId}
          defaultBranchId={selectedBranchId}
          defaultDate={selectedDate}
          defaultStartTime={bookingStartTime}
          branches={branches}
          rooms={rooms}
          treatments={treatments}
          doctors={doctors}
        />
      )}

      {/* 4. Room Management Modals */}
      {roomModalMode && (
        <RoomManagerModal
          isOpen={!!roomModalMode}
          mode={roomModalMode}
          onClose={() => setRoomModalMode(null)}
          onSuccess={() => {
            fetchSchedule();
          }}
          branch={selectedBranch}
          roomToEdit={selectedRoomToEdit}
          rooms={rooms}
          treatments={treatments}
        />
      )}
    </div>
  );
};

