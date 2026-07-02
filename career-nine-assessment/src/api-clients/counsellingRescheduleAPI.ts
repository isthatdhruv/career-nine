import http from '../api/http';

// Public, token-gated counselling reschedule (no login). Reached from the link emailed to a
// student when their counsellor becomes unavailable. The backend path contains "/public/", so
// http.ts treats it as a public endpoint (no permission-denied redirect on 401/403).

export interface RescheduleSlot {
  slotId: number;
  date: string;       // yyyy-MM-dd
  startTime: string;  // HH:mm:ss
  endTime: string;
  mode?: string;      // ONLINE | OFFLINE
}

export interface RescheduleContext {
  actionable: boolean;      // false once the session has already been rescheduled
  status: string;
  studentName?: string;
  counsellorName?: string;
  previousDate?: string;
  previousTime?: string;
  slots: RescheduleSlot[];
}

export interface RescheduleResult {
  appointmentId: number;
  date?: string;
  startTime?: string;
  endTime?: string;
  mode?: string;
  meetingLink?: string;
  location?: string;
}

export function getRescheduleContext(token: string) {
  return http.get<RescheduleContext>(`/counselling/public/reschedule/${token}`);
}

export function confirmReschedule(token: string, slotId: number) {
  return http.post<RescheduleResult>(`/counselling/public/reschedule/${token}`, { slotId });
}
