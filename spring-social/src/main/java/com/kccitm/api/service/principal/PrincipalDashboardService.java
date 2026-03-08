package com.kccitm.api.service.principal;

import java.util.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.AssessmentRawScore;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

@Service
public class PrincipalDashboardService {

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private AssessmentRawScoreRepository assessmentRawScoreRepository;

    /**
     * Get institute-wide overview statistics
     */
    public Map<String, Object> getInstituteOverview() {
        Map<String, Object> overview = new HashMap<>();

        // Real counts
        long totalStudents = userStudentRepository.count();
        long totalAssessments = assessmentTableRepository.count();
        long activeAssessments = assessmentTableRepository.findAll().stream()
                .filter(a -> Boolean.TRUE.equals(a.getIsActive()))
                .count();

        // Calculate total completions across all assessments
        int totalCompletions = 0;
        int totalAssigned = 0;

        List<AssessmentTable> allAssessments = assessmentTableRepository.findAll();
        for (AssessmentTable assessment : allAssessments) {
            try {
                List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                        .findAllByAssessmentId(assessment.getId());

                // Filter valid mappings
                List<StudentAssessmentMapping> validMappings = new ArrayList<>();
                for (StudentAssessmentMapping mapping : mappings) {
                    try {
                        if (mapping.getUserStudent() != null &&
                            mapping.getUserStudent().getUserStudentId() != null) {
                            validMappings.add(mapping);
                        }
                    } catch (Exception e) {
                        continue;
                    }
                }

                totalAssigned += validMappings.size();
                totalCompletions += validMappings.stream()
                        .filter(m -> "completed".equals(m.getStatus()))
                        .count();
            } catch (Exception e) {
                continue;
            }
        }

        double overallCompletionRate = totalAssigned > 0 ?
                (totalCompletions * 100.0 / totalAssigned) : 0.0;

        overview.put("totalStudents", totalStudents);
        overview.put("totalTeachers", 15); // Dummy - no teacher table yet
        overview.put("totalAssessments", totalAssessments);
        overview.put("activeAssessments", activeAssessments);
        overview.put("totalClasses", 8); // Dummy
        overview.put("overallCompletionRate", overallCompletionRate);
        overview.put("averagePerformance", 76.5); // Dummy
        overview.put("studentsNeedingAttention", 12); // Dummy

        return overview;
    }

    /**
     * Get assessment performance across all students
     */
    public Map<String, Object> getAssessmentPerformance(Long assessmentId) {
        Map<String, Object> performance = new HashMap<>();

        if (assessmentId == null) {
            // Return dummy data if no assessment selected
            performance.put("message", "Please select an assessment to view performance");
            return performance;
        }

        try {
            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId).orElse(null);
            if (assessment == null) {
                performance.put("error", "Assessment not found");
                return performance;
            }

            List<UserStudent> allStudents = userStudentRepository.findAll();
            List<Integer> scores = new ArrayList<>();
            int completedCount = 0;
            int inProgressCount = 0;
            int notStartedCount = 0;

            for (UserStudent student : allStudents) {
                try {
                    Optional<StudentAssessmentMapping> mappingOpt = studentAssessmentMappingRepository
                            .findFirstByUserStudentUserStudentIdAndAssessmentId(
                                    student.getUserStudentId(), assessmentId);

                    if (mappingOpt.isPresent()) {
                        StudentAssessmentMapping mapping = mappingOpt.get();
                        String status = mapping.getStatus();

                        if ("completed".equals(status)) {
                            completedCount++;
                            List<AssessmentRawScore> rawScores = assessmentRawScoreRepository
                                    .findByStudentAssessmentMappingStudentAssessmentId(
                                            mapping.getStudentAssessmentId());

                            if (!rawScores.isEmpty()) {
                                int totalScore = rawScores.stream()
                                        .mapToInt(AssessmentRawScore::getRawScore).sum();
                                int avgScore = totalScore / rawScores.size();
                                scores.add(avgScore);
                            }
                        } else if ("ongoing".equals(status)) {
                            inProgressCount++;
                        } else {
                            notStartedCount++;
                        }
                    }
                } catch (Exception e) {
                    continue;
                }
            }

            // Calculate statistics
            Map<String, Object> stats = new HashMap<>();
            if (!scores.isEmpty()) {
                Collections.sort(scores);
                stats.put("averageScore", scores.stream().mapToInt(Integer::intValue).average().orElse(0));
                stats.put("highestScore", scores.get(scores.size() - 1));
                stats.put("lowestScore", scores.get(0));
                stats.put("medianScore", scores.get(scores.size() / 2));
            } else {
                stats.put("averageScore", 0);
                stats.put("highestScore", 0);
                stats.put("lowestScore", 0);
                stats.put("medianScore", 0);
            }

            performance.put("assessmentName", assessment.getAssessmentName());
            performance.put("statistics", stats);
            performance.put("completedCount", completedCount);
            performance.put("inProgressCount", inProgressCount);
            performance.put("notStartedCount", notStartedCount);
            performance.put("totalStudents", allStudents.size());

            // Performance distribution
            List<Map<String, Object>> distribution = new ArrayList<>();
            long excellent = scores.stream().filter(s -> s >= 90).count();
            long good = scores.stream().filter(s -> s >= 80 && s < 90).count();
            long average = scores.stream().filter(s -> s >= 70 && s < 80).count();
            long belowAvg = scores.stream().filter(s -> s >= 60 && s < 70).count();
            long needsImprovement = scores.stream().filter(s -> s < 60).count();
            int total = scores.size();

            if (total > 0) {
                distribution.add(createDistribution("Excellent (90-100)", (int) excellent, (excellent * 100.0 / total)));
                distribution.add(createDistribution("Good (80-89)", (int) good, (good * 100.0 / total)));
                distribution.add(createDistribution("Average (70-79)", (int) average, (average * 100.0 / total)));
                distribution.add(createDistribution("Below Average (60-69)", (int) belowAvg, (belowAvg * 100.0 / total)));
                distribution.add(createDistribution("Needs Improvement (<60)", (int) needsImprovement,
                        (needsImprovement * 100.0 / total)));
            }
            performance.put("distribution", distribution);

        } catch (Exception e) {
            performance.put("error", "Error fetching assessment performance: " + e.getMessage());
        }

        return performance;
    }

    /**
     * Get class-wise performance overview
     */
    public Map<String, Object> getClasswisePerformance() {
        Map<String, Object> classPerformance = new HashMap<>();

        // Dummy class data - in real implementation, would fetch from class/section tables
        List<Map<String, Object>> classes = new ArrayList<>();
        classes.add(createClassPerformance("Class 10-A", 35, 82.5, 95, 78));
        classes.add(createClassPerformance("Class 10-B", 32, 78.3, 92, 80));
        classes.add(createClassPerformance("Class 9-A", 38, 75.8, 88, 75));
        classes.add(createClassPerformance("Class 9-B", 36, 79.2, 90, 82));
        classes.add(createClassPerformance("Class 8-A", 40, 73.5, 85, 70));

        classPerformance.put("classes", classes);
        classPerformance.put("totalClasses", classes.size());

        return classPerformance;
    }

    /**
     * Get teacher activity metrics
     */
    public Map<String, Object> getTeacherActivity() {
        Map<String, Object> activity = new HashMap<>();

        // Dummy teacher data
        List<Map<String, Object>> teachers = new ArrayList<>();
        teachers.add(createTeacherActivity("Mrs. Sharma", "10-A, 10-B", 3, 95.0, 85.2));
        teachers.add(createTeacherActivity("Mr. Kumar", "9-A, 9-B", 2, 88.0, 78.5));
        teachers.add(createTeacherActivity("Ms. Patel", "8-A", 2, 92.0, 76.8));
        teachers.add(createTeacherActivity("Mr. Singh", "10-A", 1, 90.0, 80.1));
        teachers.add(createTeacherActivity("Mrs. Verma", "9-A, 8-A", 2, 87.0, 74.3));

        activity.put("teachers", teachers);
        activity.put("totalTeachers", teachers.size());
        activity.put("averageEngagement", 90.4);

        return activity;
    }

    /**
     * Get enrollment trends over time
     */
    public Map<String, Object> getEnrollmentTrends() {
        Map<String, Object> trends = new HashMap<>();

        long currentStudents = userStudentRepository.count();

        // Dummy trend data - in real implementation, would track enrollment over time
        List<Map<String, Object>> monthlyTrends = new ArrayList<>();
        monthlyTrends.add(createEnrollmentPoint("Jan 2025", 145, 12));
        monthlyTrends.add(createEnrollmentPoint("Feb 2025", 157, 15));
        monthlyTrends.add(createEnrollmentPoint("Mar 2025", 163, 8));
        monthlyTrends.add(createEnrollmentPoint("Apr 2025", 175, 14));
        monthlyTrends.add(createEnrollmentPoint("May 2025", (int) currentStudents, 6));

        trends.put("currentTotal", currentStudents);
        trends.put("monthlyTrends", monthlyTrends);
        trends.put("growthRate", 8.5); // percentage
        trends.put("projectedNextMonth", (int) (currentStudents * 1.04));

        return trends;
    }

    /**
     * Get all assessments for dropdown
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

    // Helper methods
    private Map<String, Object> createDistribution(String range, int count, double percentage) {
        Map<String, Object> dist = new HashMap<>();
        dist.put("range", range);
        dist.put("count", count);
        dist.put("percentage", percentage);
        return dist;
    }

    private Map<String, Object> createClassPerformance(String className, int students,
            double avgScore, int attendance, int completionRate) {
        Map<String, Object> classData = new HashMap<>();
        classData.put("className", className);
        classData.put("totalStudents", students);
        classData.put("averageScore", avgScore);
        classData.put("attendanceRate", attendance);
        classData.put("completionRate", completionRate);
        return classData;
    }

    private Map<String, Object> createTeacherActivity(String name, String classes,
            int assessmentsCreated, double engagementRate, double classAverage) {
        Map<String, Object> teacher = new HashMap<>();
        teacher.put("teacherName", name);
        teacher.put("classes", classes);
        teacher.put("assessmentsCreated", assessmentsCreated);
        teacher.put("engagementRate", engagementRate);
        teacher.put("classAverage", classAverage);
        return teacher;
    }

    private Map<String, Object> createEnrollmentPoint(String month, int students, int newEnrollments) {
        Map<String, Object> point = new HashMap<>();
        point.put("month", month);
        point.put("totalStudents", students);
        point.put("newEnrollments", newEnrollments);
        return point;
    }
}
