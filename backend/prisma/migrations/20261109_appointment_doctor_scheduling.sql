-- Appointment Room module: doctor-centric scheduling.
-- Migration: 20261109_appointment_doctor_scheduling.sql
--
-- Rooms are no longer required for booking: doctor, clinic branch and time are
-- authoritative. Historical room_id values are preserved. New columns and the
-- two scheduling tables are additive and safe to re-run.

-- 1. Appointments no longer require a physical room.
ALTER TABLE public.appointments ALTER COLUMN room_id DROP NOT NULL;

-- 2. Coordinator / lead linkage, appointment type and request idempotency.
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS lead_id VARCHAR(50);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS coordinator_id VARCHAR(50);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50) DEFAULT 'consultation';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120);

-- 3. Booking lookup indexes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_idempotency_key
  ON public.appointments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_lead ON public.appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_coordinator ON public.appointments(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_appointments_branch_time ON public.appointments(branch_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_room_time ON public.appointments(room_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_time ON public.appointments(doctor_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);

-- 4. Recurring doctor working windows (day_of_week: 0 = Sunday … 6 = Saturday).
CREATE TABLE IF NOT EXISTS public.doctor_weekly_schedules (
  id VARCHAR(50) PRIMARY KEY,
  doctor_id VARCHAR(50) NOT NULL,
  branch_id VARCHAR(50) NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doctor_weekly_doctor_day
  ON public.doctor_weekly_schedules(doctor_id, day_of_week, is_active);
CREATE INDEX IF NOT EXISTS idx_doctor_weekly_branch
  ON public.doctor_weekly_schedules(branch_id);

-- 5. Dated exceptions: leave, breaks and unavailable windows.
CREATE TABLE IF NOT EXISTS public.doctor_schedule_exceptions (
  id VARCHAR(50) PRIMARY KEY,
  doctor_id VARCHAR(50) NOT NULL,
  branch_id VARCHAR(50) NOT NULL,
  exception_type VARCHAR(20) NOT NULL DEFAULT 'leave',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time VARCHAR(5),
  end_time VARCHAR(5),
  reason VARCHAR(255),
  created_by_id VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doctor_exceptions_range
  ON public.doctor_schedule_exceptions(doctor_id, start_date, end_date);
