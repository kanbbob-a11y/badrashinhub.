import { Registration, ShiftType } from './types';

export interface SlotStatus {
  totalSlots: number;
  slotsUsed: number;
  remaining: number;
  num24: number;
  numLong: number;
  numNight: number;
  pairedCount: number;
  unpairedLong: number;
  unpairedNight: number;
  can24: boolean;
  canLong: boolean;
  canNight: boolean;
  isDayClosed: boolean;
  percentage: number;
}

export function calcSlotStatus(registrations: Registration[]): SlotStatus {
  const num24 = registrations.filter(r => r.shiftType === '24').length;
  const numLong = registrations.filter(r => r.shiftType === 'long').length;
  const numNight = registrations.filter(r => r.shiftType === 'night').length;

  const totalSlots = 21;
  const pairedCount = Math.min(numLong, numNight);
  const unpairedLong = numLong - pairedCount;
  const unpairedNight = numNight - pairedCount;

  // Slots used = 24h people + max(long, night)
  // Because each Long takes a slot, each Night takes a slot, and paired ones share slots
  const slotsUsed = num24 + Math.max(numLong, numNight);
  const remaining = totalSlots - slotsUsed;

  // Availability
  const can24 = remaining > 0;
  const canLong = remaining > 0 || unpairedNight > 0;
  const canNight = remaining > 0 || unpairedLong > 0;

  const isDayClosed = !can24 && !canLong && !canNight;
  const percentage = Math.min((slotsUsed / totalSlots) * 100, 100);

  return {
    totalSlots,
    slotsUsed,
    remaining,
    num24,
    numLong,
    numNight,
    pairedCount,
    unpairedLong,
    unpairedNight,
    can24,
    canLong,
    canNight,
    isDayClosed,
    percentage,
  };
}

export function getAvailableShifts(registrations: Registration[]): ShiftType[] {
  const status = calcSlotStatus(registrations);
  const available: ShiftType[] = [];
  if (status.canLong) available.push('long');
  if (status.canNight) available.push('night');
  if (status.can24) available.push('24');
  return available;
}
