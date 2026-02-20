import { WEEKDAYS, type EnforcementWindow, type Weekday } from "../models/types";

export function weekdayFromDate(date: Date): Weekday {
  return WEEKDAYS[date.getDay()] ?? "sun";
}

export function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function includesDay(days: Weekday[], day: Weekday): boolean {
  return days.includes(day);
}

function previousDay(day: Weekday): Weekday {
  const idx = WEEKDAYS.indexOf(day);
  if (idx <= 0) {
    return "sat";
  }

  return WEEKDAYS[idx - 1] ?? "sat";
}

export function isWithinWindow(date: Date, window: EnforcementWindow): boolean {
  const day = weekdayFromDate(date);
  const minute = minuteOfDay(date);

  // start == end is treated as 24-hour enforcement for selected days.
  if (window.startMinute === window.endMinute) {
    return includesDay(window.days, day);
  }

  // Standard same-day range: [start, end)
  if (window.startMinute < window.endMinute) {
    return (
      includesDay(window.days, day) &&
      minute >= window.startMinute &&
      minute < window.endMinute
    );
  }

  // Cross-midnight range: day start .. 23:59 OR 00:00 .. next day end.
  const inCurrentDayTail = includesDay(window.days, day) && minute >= window.startMinute;
  const inPreviousDayCarry =
    includesDay(window.days, previousDay(day)) && minute < window.endMinute;

  return inCurrentDayTail || inPreviousDayCarry;
}

export function isProfileActive(date: Date, windows: EnforcementWindow[]): boolean {
  if (windows.length === 0) {
    return true;
  }

  return windows.some((window) => isWithinWindow(date, window));
}
