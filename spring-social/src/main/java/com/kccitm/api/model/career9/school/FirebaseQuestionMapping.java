package com.kccitm.api.model.career9.school;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "firebase_question_mapping")
public class FirebaseQuestionMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long assessmentId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String firebaseQuestion;

    @Column(nullable = false)
    private String category; // ability, multipleIntelligence, personality

    private Long systemQuestionId;

    @Column(nullable = false)
    private String firebaseAnswer;

    private Long systemOptionId;

    private LocalDateTime mappedAt;

    @PrePersist
    public void prePersist() {
        if (mappedAt == null) mappedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public String getFirebaseQuestion() { return firebaseQuestion; }
    public void setFirebaseQuestion(String firebaseQuestion) { this.firebaseQuestion = firebaseQuestion; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public Long getSystemQuestionId() { return systemQuestionId; }
    public void setSystemQuestionId(Long systemQuestionId) { this.systemQuestionId = systemQuestionId; }

    public String getFirebaseAnswer() { return firebaseAnswer; }
    public void setFirebaseAnswer(String firebaseAnswer) { this.firebaseAnswer = firebaseAnswer; }

    public Long getSystemOptionId() { return systemOptionId; }
    public void setSystemOptionId(Long systemOptionId) { this.systemOptionId = systemOptionId; }

    public LocalDateTime getMappedAt() { return mappedAt; }
    public void setMappedAt(LocalDateTime mappedAt) { this.mappedAt = mappedAt; }
}
