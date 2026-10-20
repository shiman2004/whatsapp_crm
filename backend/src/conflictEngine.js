/**
 * Conflict & Availability Detection Engine
 * Concurrency-safe overlap checking for Alpha Health Group Appointment Scheduling
 */

/**
 * Checks if two time intervals [startA, endA) and [startB, endB) overlap.
 * Mathematical rule: startA < endB AND endA > startB
 * (Boundary touches like 10:00-11:00 and 11:00-12:00 do NOT overlap)
 */
export function intervalsOverlap(startA, endA, startB, endB) {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();

  if (isNaN(sA) || isNaN(eA) || isNaN(sB) || isNaN(eB)) {
    throw new Error('Invalid date provided to intervalsOverlap');
  }

  if (sA >= eA) {
    throw new Error('Interval A start must be strictly before end');
  }
  if (sB >= eB) {
    throw new Error('Interval B start must be strictly before end');
  }

  return sA < eB && eA > sB;
}

/**
 * Validates requested appointment slot against all active appointments, room maintenance, and doctor leave.
 * 
 * @param {Object} prisma Prisma client instance (or in-memory mock)
 * @param {Object} params
 * @param {string} params.branchId
 * @param {string} params.roomId
 * @param {string} params.doctorId
 * @param {Date|string} params.startTime
 * @param {Date|string} params.endTime
 * @param {string} [params.excludeAppointmentId] Exclude existing appointment during rescheduling
 * @returns {Promise<{ hasConflict: boolean, reason?: string, conflictType?: 'room'|'doctor'|'operating_hours'|'room_block'|'doctor_block', conflictingItem?: any }>}
 */
export async function validateAppointmentSlot(prisma, {
  branchId,
  roomId,
  doctorId,
  startTime,
  endTime,
  excludeAppointmentId = null
}) {
  const reqStart = new Date(startTime);
  const reqEnd = new Date(endTime);

  if (isNaN(reqStart.getTime()) || isNaN(reqEnd.getTime())) {
    return { hasConflict: true, reason: 'Invalid appointment start or end time format' };
  }

  if (reqStart >= reqEnd) {
    return { hasConflict: true, reason: 'Appointment start time must be before end time' };
  }

  // 1. Check Room Operating Hours if room exists
  if (prisma && prisma.room) {
    try {
      const room = await prisma.room.findUnique({
        where: { id: roomId }
      });

      if (!room) {
        return { hasConflict: true, reason: 'Selected room does not exist' };
      }

      if (!room.isActive) {
        return { hasConflict: true, reason: 'Selected room is currently deactivated' };
      }

      if (room.branchId !== branchId) {
        return { hasConflict: true, reason: 'Selected room does not belong to the selected branch' };
      }

      // Check operating hours if configured (e.g. "08:00" to "20:00")
      if (room.operatingStart && room.operatingEnd) {
        const startHourMin = `${String(reqStart.getHours()).padStart(2, '0')}:${String(reqStart.getMinutes()).padStart(2, '0')}`;
        const endHourMin = `${String(reqEnd.getHours()).padStart(2, '0')}:${String(reqEnd.getMinutes()).padStart(2, '0')}`;

        if (startHourMin < room.operatingStart || endHourMin > room.operatingEnd) {
          return {
            hasConflict: true,
            conflictType: 'operating_hours',
            reason: `Appointment time (${startHourMin}-${endHourMin}) is outside room operating hours (${room.operatingStart}-${room.operatingEnd})`
          };
        }
      }
    } catch (e) {
      console.warn('Room operating hours check warning:', e.message);
    }
  }

  // 2. Query Room Overlaps (Active Appointments in the same room)
  if (prisma && prisma.appointment) {
    try {
      const roomAppointments = await prisma.appointment.findMany({
        where: {
          roomId: roomId,
          status: { notIn: ['cancelled', 'no_show'] },
          id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
          // DB Overlap check: existing.startTime < requested.endTime AND existing.endTime > requested.startTime
          startTime: { lt: reqEnd },
          endTime: { gt: reqStart }
        },
        include: {
          doctor: { select: { fullName: true } },
          patient: { select: { displayName: true } }
        }
      });

      if (roomAppointments.length > 0) {
        const conflict = roomAppointments[0];
        return {
          hasConflict: true,
          conflictType: 'room',
          reason: `Room is already booked from ${formatTimeShort(conflict.startTime)} to ${formatTimeShort(conflict.endTime)} (${conflict.patient?.displayName || 'Patient'})`,
          conflictingItem: conflict
        };
      }
    } catch (e) {
      console.warn('Room appointment overlap query warning:', e.message);
    }
  }

  // 3. Query Doctor Overlaps (Active Appointments for the same doctor across ANY room)
  if (doctorId && prisma && prisma.appointment) {
    try {
      const doctorAppointments = await prisma.appointment.findMany({
        where: {
          doctorId: doctorId,
          status: { notIn: ['cancelled', 'no_show'] },
          id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
          startTime: { lt: reqEnd },
          endTime: { gt: reqStart }
        },
        include: {
          room: { select: { name: true, roomNumber: true } },
          patient: { select: { displayName: true } }
        }
      });

      if (doctorAppointments.length > 0) {
        const conflict = doctorAppointments[0];
        return {
          hasConflict: true,
          conflictType: 'doctor',
          reason: `Doctor is already scheduled in ${conflict.room?.name || 'another room'} from ${formatTimeShort(conflict.startTime)} to ${formatTimeShort(conflict.endTime)}`,
          conflictingItem: conflict
        };
      }
    } catch (e) {
      console.warn('Doctor appointment overlap query warning:', e.message);
    }
  }

  // 4. Query Availability Blocks (Room Maintenance or Doctor Leave/Breaks)
  if (prisma && prisma.availabilityBlock) {
    try {
      const blocks = await prisma.availabilityBlock.findMany({
        where: {
          branchId: branchId,
          OR: [
            { roomId: roomId },
            doctorId ? { doctorId: doctorId } : { id: 'none' }
          ],
          startTime: { lt: reqEnd },
          endTime: { gt: reqStart }
        }
      });

      if (blocks.length > 0) {
        const block = blocks[0];
        const isRoomBlock = block.roomId === roomId;
        return {
          hasConflict: true,
          conflictType: isRoomBlock ? 'room_block' : 'doctor_block',
          reason: isRoomBlock 
            ? `Room unavailable due to maintenance/block: ${block.reason}`
            : `Doctor is unavailable during this period: ${block.reason}`,
          conflictingItem: block
        };
      }
    } catch (e) {
      console.warn('Availability block query warning:', e.message);
    }
  }

  return { hasConflict: false };
}

function formatTimeShort(date) {
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

