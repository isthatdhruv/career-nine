import axios from "axios";
import { LatestRelease, ScopeParams } from "../PrincipalDashboardRelease_APIs";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

/**
 * The Navigator Pro college dashboard reads the same release store as Navigator 360 —
 * scopes, statuses and publishing are shared — but asks for its own product's live
 * release, and resolves student names on request.
 */

export const ENGINE_NAVIGATOR_PRO = "navigator_pro";

/** The college's current Navigator Pro release, payload included. */
export function getLatestProRelease(instituteCode: number) {
  return axios.get<LatestRelease>(`${API_URL}/dashboard/principal/${instituteCode}/latest`, {
    params: { engine: ENGINE_NAVIGATOR_PRO },
  });
}

export interface StudentName {
  userStudentId: number;
  name: string;
  studentClass: string | null;
  rollNumber: string | null;
}

/**
 * Names for the students the scope in view was generated over.
 *
 * The stored payload carries ids and numbers only; names cross the wire once, when the
 * page first needs them for the list, the map or the queue.
 */
export function getScopeStudentNames(scope: ScopeParams) {
  return axios.get<StudentName[]>(
    `${API_URL}/dashboard/principal/${scope.instituteCode}/students`,
    {
      params: {
        assessmentId: scope.assessmentId,
        sessionId: scope.sessionId ?? undefined,
        classId: scope.classId ?? undefined,
        sectionId: scope.sectionId ?? undefined,
        groupId: scope.groupId ?? undefined,
      },
    }
  );
}
