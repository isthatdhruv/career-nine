import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../modules/auth";
import { getAssessmentMappingsByInstitute } from "../pages/AssessmentMapping/API/AssessmentMapping_APIs";
import { getUserCollegeMappings } from "../pages/Users/API/UserMapping_APIs";
import { Assessment } from "../pages/StudentInformation/StudentInfo_APIs";

/**
 * Narrow a list of assessments to those mapped to a single institute.
 *
 * Behaviour matches the Reports Hub baseline:
 *   - selectedInstitute === "" → returns `allAssessments` untouched (no institute picked).
 *   - mapping fetch fails OR returns zero active rows → returns `allAssessments` (fail-open
 *     fallback — better to show all than to silently hide everything from the user).
 *   - mapping returns N active rows → intersection with `allAssessments`.
 *
 * The institute mapping is the source of truth; we never *add* assessments the institute
 * isn't mapped to, only narrow.
 */
export function useAssessmentsForInstitute(
  selectedInstitute: number | "",
  allAssessments: Assessment[]
): { assessments: Assessment[]; loading: boolean } {
  const [mappedIds, setMappedIds] = useState<Set<number> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedInstitute === "") {
      setMappedIds(null);
      return;
    }
    setLoading(true);
    getAssessmentMappingsByInstitute(Number(selectedInstitute))
      .then((res) => {
        const ids = new Set<number>(
          (res.data || [])
            .filter((m: any) => m.isActive !== false)
            .map((m: any) => Number(m.assessmentId))
        );
        setMappedIds(ids);
      })
      .catch(() => setMappedIds(new Set()))
      .finally(() => setLoading(false));
  }, [selectedInstitute]);

  const assessments = useMemo(() => {
    if (mappedIds && mappedIds.size > 0) {
      return allAssessments.filter((a) => mappedIds.has(a.id));
    }
    return allAssessments;
  }, [allAssessments, mappedIds]);

  return { assessments, loading };
}

/**
 * Narrow a list of assessments to those mapped to ANY institute the current user is
 * allotted to.
 *
 * Source of truth, in order:
 *   1. `currentUser.scopes` (user_role_scope rows from /auth/me) — the canonical place.
 *   2. `getUserCollegeMappings(userId)` (ContactPerson rows) — fallback because the
 *      legacy "Map to College" UI writes here and not to user_role_scope. Until those
 *      two systems are reconciled (see BE notes from earlier), reading both lets the
 *      filter honour either source.
 *
 * Behaviour:
 *   - Super-admin → returns `allAssessments` untouched.
 *   - User has any wildcard scope (s.i == null) → returns `allAssessments`.
 *   - No institute info from either source → returns `allAssessments` (fail-open;
 *     a freshly-onboarded user shouldn't see an empty page).
 *   - Otherwise → union of mapped assessment IDs across the user's institutes,
 *     intersected with `allAssessments`. If the union is empty (institutes have no
 *     active assessment mappings), fall back to `allAssessments`.
 */
export function useAssessmentsForCurrentUser(
  allAssessments: Assessment[]
): { assessments: Assessment[]; loading: boolean; allowedInstituteCodes: Set<number> | null } {
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.superAdmin === true;
  const userId = currentUser?.id;

  // Stable reference so downstream useMemos don't fire every render.
  const scopeRows = useMemo(() => currentUser?.scopes ?? [], [currentUser]);

  const [contactInstitutes, setContactInstitutes] = useState<Set<number> | null>(null);
  const [mappedAssessmentIds, setMappedAssessmentIds] = useState<Set<number> | null>(null);
  const [loading, setLoading] = useState(false);

  // Pull ContactPerson-based institutes for the current user. Skip for super-admins
  // (they'd see everything anyway) and when there's no logged-in user yet.
  useEffect(() => {
    if (isSuperAdmin || userId == null) {
      setContactInstitutes(null);
      return;
    }
    getUserCollegeMappings(userId)
      .then((res) => {
        const ids = new Set<number>(
          (res.data || [])
            .map((cp: any) => Number(cp.institute?.instituteCode ?? cp.instituteCode))
            .filter((v: number) => Number.isFinite(v))
        );
        setContactInstitutes(ids);
      })
      .catch(() => setContactInstitutes(new Set()));
  }, [isSuperAdmin, userId]);

  // null = "no restriction" (super-admin or any wildcard scope).
  // Set of codes otherwise (union of scopes.i and ContactPerson institutes).
  const allowedInstituteCodes = useMemo<Set<number> | null>(() => {
    if (isSuperAdmin) return null;
    const hasWildcardScope = scopeRows.some((s) => s.i == null);
    if (hasWildcardScope) return null;

    const fromScopes = scopeRows
      .map((s) => s.i)
      .filter((v): v is number => v != null);
    const merged = new Set<number>(fromScopes);
    if (contactInstitutes) contactInstitutes.forEach((v) => merged.add(v));

    // No info at all → fail-open. Distinguishes "user has no scope" (legacy session,
    // show everything) from "user has scope but it's an empty set" (which would be
    // dead-on-arrival UX). The BE list endpoints are the authoritative deny gate.
    if (merged.size === 0) return null;
    return merged;
  }, [isSuperAdmin, scopeRows, contactInstitutes]);

  // Fetch assessment mappings for every allowed institute and union the IDs.
  useEffect(() => {
    if (allowedInstituteCodes == null) {
      setMappedAssessmentIds(null);
      return;
    }
    if (allowedInstituteCodes.size === 0) {
      setMappedAssessmentIds(new Set());
      return;
    }
    setLoading(true);
    const codes = Array.from(allowedInstituteCodes);
    Promise.all(
      codes.map((code) =>
        getAssessmentMappingsByInstitute(code)
          .then((res) =>
            (res.data || [])
              .filter((m: any) => m.isActive !== false)
              .map((m: any) => Number(m.assessmentId))
          )
          .catch(() => [] as number[])
      )
    )
      .then((perInstitute) => {
        const union = new Set<number>();
        for (const ids of perInstitute) {
          for (const id of ids) union.add(id);
        }
        setMappedAssessmentIds(union);
      })
      .finally(() => setLoading(false));
  }, [allowedInstituteCodes]);

  const assessments = useMemo(() => {
    if (allowedInstituteCodes == null) return allAssessments; // no restriction
    if (mappedAssessmentIds == null) return allAssessments; // still loading first pass
    if (mappedAssessmentIds.size === 0) return allAssessments; // fail-open
    return allAssessments.filter((a) => mappedAssessmentIds.has(a.id));
  }, [allAssessments, allowedInstituteCodes, mappedAssessmentIds]);

  return { assessments, loading, allowedInstituteCodes };
}
