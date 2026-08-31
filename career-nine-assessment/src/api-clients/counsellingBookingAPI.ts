import http from '../api/http';

// Public, token-gated counselling booking (no login). Reached from the link emailed to a student
// who completed an assessment but never booked their session. Context-only: it resolves the token
// into the ids that MappingCounsellingSection (the thank-you page counselling component) runs on.
// The backend path contains "/public/", so http.ts treats it as a public endpoint.

export interface BookingContext {
  actionable: boolean;       // false once a session is already booked
  studentName?: string;
  userStudentId?: number;
  assessmentId?: number;
}

export function getBookingContext(token: string) {
  return http.get<BookingContext>(`/counselling/public/book/${token}`);
}
