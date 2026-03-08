package com.kccitm.api.service.teacher;

import java.util.*;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.AssessmentRawScore;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

@Service
public class ClassTeacherDashboardService {

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private AssessmentRawScoreRepository assessmentRawScoreRepository;

    /**
     * Get class overview statistics (fetches real student count, rest is dummy data)
     */
    public Map<String, Object> getClassOverview(Long teacherId) {
        Map<String, Object> overview = new HashMap<>();

        // Get real student count
        long totalStudents = userStudentRepository.count();

        // Get total assessments
        long totalAssessments = assessmentTableRepository.count();

        // Class information
        overview.put("teacherName", "Class Teacher");
        overview.put("className", "All Students");
        overview.put("totalStudents", totalStudents);
        overview.put("presentToday", (int)(totalStudents * 0.9)); // 90% attendance (dummy)
        overview.put("absentToday", (int)(totalStudents * 0.1)); // 10% absent (dummy)
        overview.put("averageAttendance", 90.0);

        // Recent activity
        Map<String, Object> recentActivity = new HashMap<>();
        recentActivity.put("lastAssessmentDate", "2025-02-03");
        recentActivity.put("assessmentsThisMonth", totalAssessments > 0 ? Math.min(totalAssessments, 5) : 0);
        recentActivity.put("pendingGrading", 8);
        recentActivity.put("newAlerts", 2);
        overview.put("recentActivity", recentActivity);

        return overview;
    }

    /**
     * Get student performance summary (fetches real student data if assessmentId provided)
     */
    public Map<String, Object> getStudentPerformance(Long teacherId, Long assessmentId) {
        Map<String, Object> performance = new HashMap<>();

        if (assessmentId != null) {
            // Fetch real student performance data
            List<UserStudent> allStudents = userStudentRepository.findAll();
            List<Map<String, Object>> studentScores = new ArrayList<>();

            for (UserStudent userStudent : allStudents) {
                try {
                    StudentInfo studentInfo = userStudent.getStudentInfo();
                    if (studentInfo == null) continue;

                    // Find mapping for this assessment
                    java.util.Optional<StudentAssessmentMapping> mappingOpt = studentAssessmentMappingRepository
                            .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudent.getUserStudentId(), assessmentId);

                    if (mappingOpt.isPresent() && "completed".equals(mappingOpt.get().getStatus())) {
                        StudentAssessmentMapping mapping = mappingOpt.get();

                        // Get raw scores
                        List<AssessmentRawScore> rawScores = assessmentRawScoreRepository
                                .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

                        if (!rawScores.isEmpty()) {
                            int totalScore = rawScores.stream().mapToInt(AssessmentRawScore::getRawScore).sum();
                            int avgScore = totalScore / rawScores.size();

                            Map<String, Object> studentData = new HashMap<>();
                            studentData.put("name", studentInfo.getName());
                            studentData.put("score", avgScore);
                            studentScores.add(studentData);
                        }
                    }
                } catch (Exception e) {
                    // Skip students with invalid data or missing relationships
                    System.err.println("Error processing student " + userStudent.getUserStudentId() + ": " + e.getMessage());
                    continue;
                }
            }

            // Calculate statistics if we have data
            if (!studentScores.isEmpty()) {
                List<Integer> scores = studentScores.stream()
                        .map(s -> (Integer) s.get("score"))
                        .sorted()
                        .collect(Collectors.toList());

                Map<String, Object> classStats = new HashMap<>();
                classStats.put("averageScore", scores.stream().mapToInt(Integer::intValue).average().orElse(0));
                classStats.put("highestScore", scores.get(scores.size() - 1));
                classStats.put("lowestScore", scores.get(0));
                classStats.put("medianScore", scores.get(scores.size() / 2));
                performance.put("classStats", classStats);

                // Performance distribution
                List<Map<String, Object>> distribution = new ArrayList<>();
                long excellent = scores.stream().filter(s -> s >= 90).count();
                long good = scores.stream().filter(s -> s >= 80 && s < 90).count();
                long average = scores.stream().filter(s -> s >= 70 && s < 80).count();
                long belowAvg = scores.stream().filter(s -> s >= 60 && s < 70).count();
                long needsImprovement = scores.stream().filter(s -> s < 60).count();
                int total = scores.size();

                distribution.add(createDistribution("Excellent (90-100)", (int) excellent, (excellent * 100.0 / total)));
                distribution.add(createDistribution("Good (80-89)", (int) good, (good * 100.0 / total)));
                distribution.add(createDistribution("Average (70-79)", (int) average, (average * 100.0 / total)));
                distribution.add(createDistribution("Below Average (60-69)", (int) belowAvg, (belowAvg * 100.0 / total)));
                distribution.add(createDistribution("Needs Improvement (<60)", (int) needsImprovement, (needsImprovement * 100.0 / total)));
                performance.put("distribution", distribution);

                // Top performers (sort by score descending)
                List<Map<String, Object>> topPerformers = studentScores.stream()
                        .sorted((a, b) -> Integer.compare((Integer) b.get("score"), (Integer) a.get("score")))
                        .limit(3)
                        .map(s -> createStudent((String) s.get("name"), (Integer) s.get("score"), "Excellent work"))
                        .collect(Collectors.toList());
                performance.put("topPerformers", topPerformers);

                // Students needing attention (lowest scores)
                List<Map<String, Object>> needsAttention = studentScores.stream()
                        .sorted((a, b) -> Integer.compare((Integer) a.get("score"), (Integer) b.get("score")))
                        .limit(3)
                        .map(s -> createStudent((String) s.get("name"), (Integer) s.get("score"), "Needs support"))
                        .collect(Collectors.toList());
                performance.put("needsAttention", needsAttention);

                return performance;
            }
        }

        // Fallback to dummy data if no assessmentId or no completed assessments
        Map<String, Object> classStats = new HashMap<>();
        classStats.put("averageScore", 78.5);
        classStats.put("highestScore", 95);
        classStats.put("lowestScore", 52);
        classStats.put("medianScore", 80);
        performance.put("classStats", classStats);

        List<Map<String, Object>> distribution = new ArrayList<>();
        distribution.add(createDistribution("Excellent (90-100)", 8, 25.0));
        distribution.add(createDistribution("Good (80-89)", 12, 37.5));
        distribution.add(createDistribution("Average (70-79)", 7, 21.9));
        distribution.add(createDistribution("Below Average (60-69)", 3, 9.4));
        distribution.add(createDistribution("Needs Improvement (<60)", 2, 6.2));
        performance.put("distribution", distribution);

        List<Map<String, Object>> topPerformers = new ArrayList<>();
        topPerformers.add(createStudent("Alice Johnson", 95, "Excellent progress"));
        topPerformers.add(createStudent("Bob Smith", 92, "Consistent performer"));
        topPerformers.add(createStudent("Carol Davis", 90, "Great improvement"));
        performance.put("topPerformers", topPerformers);

        List<Map<String, Object>> needsAttention = new ArrayList<>();
        needsAttention.add(createStudent("David Brown", 58, "Struggling with concepts"));
        needsAttention.add(createStudent("Emma Wilson", 52, "Needs extra support"));
        performance.put("needsAttention", needsAttention);

        return performance;
    }

    /**
     * Get assessment completion rates (fetches real assessment names and completion data)
     */
    public Map<String, Object> getAssessmentCompletion(Long teacherId) {
        Map<String, Object> completion = new HashMap<>();

        // Get real assessments from database
        List<AssessmentTable> allAssessments = assessmentTableRepository.findAll();
        long totalStudents = userStudentRepository.count();

        if (allAssessments.isEmpty() || totalStudents == 0) {
            // Fallback to dummy data
            completion.put("overallCompletionRate", 87.5);
            completion.put("totalAssignments", 2);
            completion.put("completedAssignments", 35);
            completion.put("pendingAssignments", 5);

            List<Map<String, Object>> assessments = new ArrayList<>();
            assessments.add(createAssessment("Sample Assessment 1", 20, 19, 95.0, "2025-02-01"));
            assessments.add(createAssessment("Sample Assessment 2", 20, 17, 85.0, "2025-02-03"));
            completion.put("assessments", assessments);

            List<Map<String, Object>> trend = new ArrayList<>();
            trend.add(createTrendPoint("Sample Assessment 1", 95.0));
            trend.add(createTrendPoint("Sample Assessment 2", 85.0));
            completion.put("trend", trend);

            return completion;
        }

        // Calculate real completion rates
        int totalAssignments = 0;
        int completedAssignments = 0;
        int pendingAssignments = 0;

        List<Map<String, Object>> assessments = new ArrayList<>();
        List<Map<String, Object>> trend = new ArrayList<>();

        // Take up to 6 most recent assessments
        List<AssessmentTable> recentAssessments = allAssessments.stream()
                .limit(6)
                .collect(Collectors.toList());

        for (AssessmentTable assessment : recentAssessments) {
            try {
                String assessmentName = assessment.getAssessmentName() != null ?
                    assessment.getAssessmentName() : "Assessment #" + assessment.getId();

                // Get all mappings for this assessment (wrap in try-catch for orphaned records)
                List<StudentAssessmentMapping> mappings = new ArrayList<>();
                try {
                    mappings = studentAssessmentMappingRepository.findAllByAssessmentId(assessment.getId());
                } catch (javax.persistence.EntityNotFoundException e) {
                    System.err.println("EntityNotFoundException for assessment " + assessment.getId() + ": " + e.getMessage());
                    mappings = new ArrayList<>(); // Use empty list
                } catch (Exception e) {
                    System.err.println("Error fetching mappings for assessment " + assessment.getId() + ": " + e.getMessage());
                    mappings = new ArrayList<>(); // Use empty list
                }

                // Filter out mappings with invalid user student references
                List<StudentAssessmentMapping> validMappings = new ArrayList<>();
                for (StudentAssessmentMapping mapping : mappings) {
                    try {
                        // Try to access the user student to check if it exists
                        UserStudent student = mapping.getUserStudent();
                        if (student != null && student.getUserStudentId() != null) {
                            validMappings.add(mapping);
                        }
                    } catch (javax.persistence.EntityNotFoundException e) {
                        // Skip mappings pointing to deleted students
                        System.err.println("Skipping mapping with deleted student: " + e.getMessage());
                    } catch (Exception e) {
                        // Skip other invalid mappings
                        System.err.println("Skipping invalid mapping: " + e.getMessage());
                    }
                }

                int assigned = validMappings.size();
                long completed = validMappings.stream()
                        .filter(m -> "completed".equals(m.getStatus()))
                        .count();
                int pending = assigned - (int) completed;

                double completionRate = assigned > 0 ? (completed * 100.0 / assigned) : 0.0;

                totalAssignments += assigned;
                completedAssignments += completed;
                pendingAssignments += pending;

                assessments.add(createAssessment(
                    assessmentName,
                    assigned,
                    (int) completed,
                    completionRate,
                    assessment.getStarDate() != null ? assessment.getStarDate() : "N/A"
                ));

                trend.add(createTrendPoint(assessmentName, completionRate));
            } catch (Exception e) {
                // Skip assessment if there's an error
                System.err.println("Error processing assessment " + assessment.getId() + ": " + e.getMessage());
                continue;
            }
        }

        // Overall completion rate
        double overallCompletionRate = totalAssignments > 0 ?
                (completedAssignments * 100.0 / totalAssignments) : 0.0;

        completion.put("overallCompletionRate", overallCompletionRate);
        completion.put("totalAssignments", recentAssessments.size());
        completion.put("completedAssignments", completedAssignments);
        completion.put("pendingAssignments", pendingAssignments);
        completion.put("assessments", assessments);
        completion.put("trend", trend);

        return completion;
    }

    /**
     * Get all assessments for dropdown selection
     */
    public List<Map<String, Object>> getAllAssessments() {
        List<Map<String, Object>> assessmentsList = new ArrayList<>();

        List<AssessmentTable> assessments = assessmentTableRepository.findAll();

        for (AssessmentTable assessment : assessments) {
            Map<String, Object> assessmentData = new HashMap<>();
            assessmentData.put("assessmentId", assessment.getId());
            assessmentData.put("assessmentName", assessment.getAssessmentName() != null ?
                assessment.getAssessmentName() : "Assessment #" + assessment.getId());
            assessmentData.put("isActive", assessment.getIsActive());
            assessmentsList.add(assessmentData);
        }

        return assessmentsList;
    }

    /**
     * Get cognitive development trends (dummy data)
     */
    public Map<String, Object> getCognitiveTrends(Long teacherId) {
        Map<String, Object> trends = new HashMap<>();

        // Cognitive skills average scores
        Map<String, Object> cognitiveScores = new HashMap<>();
        cognitiveScores.put("attention", 75.5);
        cognitiveScores.put("workingMemory", 72.3);
        cognitiveScores.put("cognitiveFlexibility", 78.8);
        cognitiveScores.put("problemSolving", 80.2);
        trends.put("averageScores", cognitiveScores);

        // Social-emotional scores
        Map<String, Object> socialScores = new HashMap<>();
        socialScores.put("socialInsight", 82.1);
        socialScores.put("emotionalRegulation", 76.5);
        socialScores.put("selfEfficacy", 79.3);
        trends.put("socialScores", socialScores);

        // Class strengths
        List<Map<String, Object>> strengths = new ArrayList<>();
        strengths.add(createSkillArea("Problem Solving", 80.2, "strong"));
        strengths.add(createSkillArea("Social Insight", 82.1, "strong"));
        strengths.add(createSkillArea("Cognitive Flexibility", 78.8, "good"));
        trends.put("strengths", strengths);

        // Areas for improvement
        List<Map<String, Object>> improvements = new ArrayList<>();
        improvements.add(createSkillArea("Working Memory", 72.3, "needs-improvement"));
        improvements.add(createSkillArea("Attention", 75.5, "average"));
        trends.put("areasForImprovement", improvements);

        // Progress over time (last 4 assessments)
        List<Map<String, Object>> progressTrend = new ArrayList<>();
        progressTrend.add(createProgressPoint("Sep 2025", 70.5, 75.2, 72.8));
        progressTrend.add(createProgressPoint("Oct 2025", 72.8, 76.5, 74.5));
        progressTrend.add(createProgressPoint("Nov 2025", 74.2, 78.3, 76.8));
        progressTrend.add(createProgressPoint("Dec 2025", 75.5, 80.2, 78.8));
        trends.put("progressTrend", progressTrend);

        return trends;
    }

    // Helper methods to create data structures
    private Map<String, Object> createDistribution(String category, int count, double percentage) {
        Map<String, Object> dist = new HashMap<>();
        dist.put("category", category);
        dist.put("count", count);
        dist.put("percentage", percentage);
        return dist;
    }

    private Map<String, Object> createStudent(String name, int score, String notes) {
        Map<String, Object> student = new HashMap<>();
        student.put("name", name);
        student.put("score", score);
        student.put("notes", notes);
        return student;
    }

    private Map<String, Object> createAssessment(String name, int total, int completed, double rate, String date) {
        Map<String, Object> assessment = new HashMap<>();
        assessment.put("name", name);
        assessment.put("totalStudents", total);
        assessment.put("completed", completed);
        assessment.put("completionRate", rate);
        assessment.put("dueDate", date);
        return assessment;
    }

    private Map<String, Object> createTrendPoint(String label, double value) {
        Map<String, Object> point = new HashMap<>();
        point.put("label", label);
        point.put("completionRate", value);
        return point;
    }

    private Map<String, Object> createSkillArea(String skill, double score, String level) {
        Map<String, Object> area = new HashMap<>();
        area.put("skill", skill);
        area.put("score", score);
        area.put("level", level);
        return area;
    }

    private Map<String, Object> createProgressPoint(String month, double cognitive, double social, double overall) {
        Map<String, Object> point = new HashMap<>();
        point.put("month", month);
        point.put("cognitive", cognitive);
        point.put("social", social);
        point.put("overall", overall);
        return point;
    }
}
