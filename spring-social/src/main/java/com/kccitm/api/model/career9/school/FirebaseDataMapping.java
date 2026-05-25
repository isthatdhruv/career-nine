package com.kccitm.api.model.career9.school;

import java.time.LocalDateTime;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.Table;

@Entity
@Table(name = "firebase_data_mapping")
public class FirebaseDataMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String firebaseId;

    private String firebaseName;

    @Column(nullable = false)
    private String firebaseType; // SCHOOL | SESSION | GRADE | SECTION

    private Long newEntityId;

    private String newEntityName;

    private Long parentMappingId;

    private LocalDateTime mappedAt;

    @PrePersist
    protected void onCreate() {
        mappedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFirebaseId() { return firebaseId; }
    public void setFirebaseId(String firebaseId) { this.firebaseId = firebaseId; }

    public String getFirebaseName() { return firebaseName; }
    public void setFirebaseName(String firebaseName) { this.firebaseName = firebaseName; }

    public String getFirebaseType() { return firebaseType; }
    public void setFirebaseType(String firebaseType) { this.firebaseType = firebaseType; }

    public Long getNewEntityId() { return newEntityId; }
    public void setNewEntityId(Long newEntityId) { this.newEntityId = newEntityId; }

    public String getNewEntityName() { return newEntityName; }
    public void setNewEntityName(String newEntityName) { this.newEntityName = newEntityName; }

    public Long getParentMappingId() { return parentMappingId; }
    public void setParentMappingId(Long parentMappingId) { this.parentMappingId = parentMappingId; }

    public LocalDateTime getMappedAt() { return mappedAt; }
    public void setMappedAt(LocalDateTime mappedAt) { this.mappedAt = mappedAt; }
}
