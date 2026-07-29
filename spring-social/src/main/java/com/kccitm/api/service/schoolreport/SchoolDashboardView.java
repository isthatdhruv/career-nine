package com.kccitm.api.service.schoolreport;

import java.util.ArrayList;
import java.util.List;

/**
 * Everything the School Dashboard page renders for one institute: the
 * assessment-participation headline (which is mapping-level and spans every
 * assessment) plus the Navigator360 dashboard computed from the students who
 * actually completed one.
 *
 * <p>The two halves count different things on purpose. {@link Participation}
 * counts <em>student-assessment mappings</em> — a student sitting three
 * assessments contributes three rows — because "how far along is the school"
 * is a question about assessments taken. {@link #scoredStudents} counts the
 * rows that produced a scoreable profile, which is the denominator for every
 * percentage inside {@link #dashboard}.
 */
public class SchoolDashboardView {

    public Integer instituteCode;
    public String instituteName;

    /** Which class filter produced {@link #dashboard}: "All", or a class number. */
    public String classFilter;

    /**
     * Every class that has a scoreable student, ascending — the filter row only
     * offers classes that would actually return something.
     */
    public java.util.SortedSet<Integer> classesPresent = new java.util.TreeSet<>();

    /** Headline cards: completion across every assessment in the institute. */
    public Participation participation = new Participation();

    /** Per-assessment breakdown, most-attempted first. */
    public List<AssessmentParticipation> assessments = new ArrayList<>();

    /** How many completed rows produced a scoreable profile — the dashboard's denominator. */
    public int scoredStudents;

    /** Completed rows that could not be scored (partial answers, missing sections). */
    public int unscoredStudents;

    /** Distinct students in the institute, however many assessments each one sat. */
    public int distinctStudents;

    /** The nine-sheet dashboard, or null when nobody has completed anything yet. */
    public SchoolDashboard dashboard;

    /** Completion counts over student-assessment mappings. */
    public static class Participation {
        /** Every mapping in the institute. */
        public int total;
        /** status = "completed". */
        public int completed;
        /** status = "ongoing" (also counts the legacy "inprogress"). */
        public int ongoing;
        /** status = "notstarted", plus anything with no status at all. */
        public int notStarted;
        /** {@link #completed} as a whole percent of {@link #total}. */
        public int completedPct;
    }

    /** One assessment's slice of {@link Participation}. */
    public static class AssessmentParticipation {
        public Long assessmentId;
        public String assessmentName;
        public int total;
        public int completed;
        public int ongoing;
        public int notStarted;
        public int completedPct;
        /** How many of this assessment's completed rows fed the dashboard. */
        public int scored;
    }
}
