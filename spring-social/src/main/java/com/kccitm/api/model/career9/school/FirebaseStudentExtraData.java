package com.kccitm.api.model.career9.school;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;

@Entity
@Table(name = "firebase_student_extra_data")
public class FirebaseStudentExtraData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_student_id")
    private Long userStudentId;

    @Column(nullable = false)
    private String dataType; // CAREER_ASPIRATION | SUBJECT_OF_INTEREST | VALUE

    @Column(nullable = false, columnDefinition = "TEXT")
    private String dataValue;

    private String firebaseDocId;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }

    public String getDataType() { return dataType; }
    public void setDataType(String dataType) { this.dataType = dataType; }

    public String getDataValue() { return dataValue; }
    public void setDataValue(String dataValue) { this.dataValue = dataValue; }

    public String getFirebaseDocId() { return firebaseDocId; }
    public void setFirebaseDocId(String firebaseDocId) { this.firebaseDocId = firebaseDocId; }
}
