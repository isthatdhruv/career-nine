# Counselling Scheduling System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted Calendly-like counselling scheduling system where students book anonymous time slots, admins assign counsellors, counsellors confirm sessions with auto-generated Google Meet links, and both parties get email + in-app notifications throughout the lifecycle.

**Architecture:** Hybrid templates + materialized slots approach. Recurring weekly availability templates are stored as rules; a daily `@Scheduled` job materializes them into concrete `CounsellingSlot` rows for a 4-week rolling window. Bookings reference concrete slot rows. 7 new JPA entities, 6 new controllers, 9 new services, and ~25 new React components across student/counsellor/admin views.

**Tech Stack:** Spring Boot 2.5.5, Java 11, JPA/Hibernate, MySQL, React 18, TypeScript, Axios, Mandrill (email), Google Calendar API (Meet links), CSS custom properties (existing `--sp-*` theme)

**Spec:** `docs/superpowers/specs/2026-04-02-counselling-scheduling-design.md`

---

## File Map

### Backend — New Files

```
spring-social/src/main/java/com/kccitm/api/
├── model/career9/counselling/
│   ├── Counsellor.java
│   ├── AvailabilityTemplate.java
│   ├── CounsellingSlot.java
│   ├── CounsellingAppointment.java
│   ├── SessionNotes.java
│   ├── AppointmentAuditLog.java
│   └── Notification.java
├── repository/Career9/counselling/
│   ├── CounsellorRepository.java
│   ├── AvailabilityTemplateRepository.java
│   ├── CounsellingSlotRepository.java
│   ├── CounsellingAppointmentRepository.java
│   ├── SessionNotesRepository.java
│   ├── AppointmentAuditLogRepository.java
│   └── NotificationRepository.java
├── controller/career9/counselling/
│   ├── CounsellorController.java
│   ├── AvailabilityTemplateController.java
│   ├── CounsellingSlotController.java
│   ├── CounsellingAppointmentController.java
│   ├── SessionNotesController.java
│   └── NotificationController.java
├── service/counselling/
│   ├── CounsellorService.java
│   ├── SlotMaterializationService.java
│   ├── BookingService.java
│   ├── AppointmentService.java
│   ├── MeetingLinkService.java
│   ├── SessionNotesService.java
│   ├── CounsellingNotificationService.java
│   ├── ReminderSchedulerService.java
│   └── AuditLogService.java
```

### Backend — Modified Files

```
spring-social/src/main/resources/application.yml  (add Google Calendar scope)
spring-social/pom.xml  (add google-api-services-calendar dependency)
```

### Frontend — New Files

```
react-social/src/app/pages/Counselling/
├── student/
│   ├── StudentCounsellingPage.tsx
│   ├── SlotBookingPage.tsx
│   └── components/
│       ├── UpcomingSessionCard.tsx
│       ├── PastSessionCard.tsx
│       ├── SlotGrid.tsx
│       └── BookingForm.tsx
├── counsellor/
│   ├── CounsellorDashboardPage.tsx
│   ├── AvailabilityManagerPage.tsx
│   ├── SessionNotesPage.tsx
│   └── components/
│       ├── ScheduleCard.tsx
│       ├── RecurringTemplateForm.tsx
│       ├── ManualSlotForm.tsx
│       ├── BlockDateForm.tsx
│       └── SessionNotesForm.tsx
├── admin/
│   ├── AdminCounsellingQueuePage.tsx
│   ├── CounsellorManagementPage.tsx
│   └── components/
│       ├── RequestQueueTable.tsx
│       ├── StatsBar.tsx
│       ├── AssignCounsellorDropdown.tsx
│       └── CounsellorForm.tsx
├── shared/
│   ├── NotificationBell.tsx
│   ├── StatusBadge.tsx
│   └── CountdownTimer.tsx
├── API/
│   ├── CounsellorAPI.ts
│   ├── SlotAPI.ts
│   ├── AppointmentAPI.ts
│   ├── SessionNotesAPI.ts
│   └── NotificationAPI.ts
└── Counselling.css
```

### Frontend — Modified Files

```
react-social/src/app/pages/StudentDashboard/student-portal/components/BookCounselling.tsx  (replace placeholder)
react-social/src/app/routing/StudentRoutes.tsx  (add counselling route)
react-social/src/app/routing/PrivateRoutes.tsx  (add counsellor + admin routes)
react-social/src/_metronic/layout/components/aside/AsideMenuMain.tsx  (add menu items)
```

---

## Phase 1: Backend Entities & Repositories

### Task 1: Counsellor Entity & Repository

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/model/career9/counselling/Counsellor.java`
- Create: `spring-social/src/main/java/com/kccitm/api/repository/Career9/counselling/CounsellorRepository.java`

- [ ] **Step 1: Create the Counsellor entity**

```java
package com.kccitm.api.model.career9.counselling;

import com.kccitm.api.model.User;
import com.fasterxml.jackson.annotation.JsonProperty;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "counsellor")
public class Counsellor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String email;

    private String phone;

    @Column(columnDefinition = "TEXT")
    private String specializations;

    @Column(columnDefinition = "TEXT")
    private String bio;

    @Column(name = "is_external", columnDefinition = "BOOLEAN DEFAULT FALSE")
    @JsonProperty("isExternal")
    private Boolean isExternal = false;

    @Column(name = "onboarding_status", columnDefinition = "VARCHAR(20) DEFAULT 'PENDING'")
    private String onboardingStatus = "PENDING";

    @Column(name = "is_active", columnDefinition = "BOOLEAN DEFAULT TRUE")
    @JsonProperty("isActive")
    private Boolean isActive = true;

    @Column(name = "profile_image_url", length = 500)
    private String profileImageUrl;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Counsellor() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getSpecializations() { return specializations; }
    public void setSpecializations(String specializations) { this.specializations = specializations; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public Boolean getIsExternal() { return isExternal; }
    public void setIsExternal(Boolean isExternal) { this.isExternal = isExternal; }

    public String getOnboardingStatus() { return onboardingStatus; }
    public void setOnboardingStatus(String onboardingStatus) { this.onboardingStatus = onboardingStatus; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public String getProfileImageUrl() { return profileImageUrl; }
    public void setProfileImageUrl(String profileImageUrl) { this.profileImageUrl = profileImageUrl; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
```

- [ ] **Step 2: Create the CounsellorRepository**

```java
package com.kccitm.api.repository.Career9.counselling;

import com.kccitm.api.model.career9.counselling.Counsellor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CounsellorRepository extends JpaRepository<Counsellor, Long> {

    List<Counsellor> findByIsActiveTrue();

    Optional<Counsellor> findByUserId(Long userId);

    Optional<Counsellor> findByEmail(String email);

    List<Counsellor> findByOnboardingStatus(String status);

    List<Counsellor> findByIsActiveTrueAndOnboardingStatus(String status);
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /home/kccsw/Projects/career-nine/spring-social && mvn compile -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add spring-social/src/main/java/com/kccitm/api/model/career9/counselling/Counsellor.java spring-social/src/main/java/com/kccitm/api/repository/Career9/counselling/CounsellorRepository.java
git commit -m "feat(counselling): add Counsellor entity and repository"
```

---

### Task 2: AvailabilityTemplate Entity & Repository

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/model/career9/counselling/AvailabilityTemplate.java`
- Create: `spring-social/src/main/java/com/kccitm/api/repository/Career9/counselling/AvailabilityTemplateRepository.java`

- [ ] **Step 1: Create the AvailabilityTemplate entity**

```java
package com.kccitm.api.model.career9.counselling;

import com.fasterxml.jackson.annotation.JsonProperty;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "availability_template")
public class AvailabilityTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "counsellor_id", nullable = false)
    private Counsellor counsellor;

    @Column(name = "day_of_week", nullable = false)
    private String dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "default_slot_duration", nullable = false)
    private Integer defaultSlotDuration;

    @Column(name = "is_active", columnDefinition = "BOOLEAN DEFAULT TRUE")
    @JsonProperty("isActive")
    private Boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public AvailabilityTemplate() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Counsellor getCounsellor() { return counsellor; }
    public void setCounsellor(Counsellor counsellor) { this.counsellor = counsellor; }

    public String getDayOfWeek() { return dayOfWeek; }
    public void setDayOfWeek(String dayOfWeek) { this.dayOfWeek = dayOfWeek; }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    public Integer getDefaultSlotDuration() { return defaultSlotDuration; }
    public void setDefaultSlotDuration(Integer defaultSlotDuration) { this.defaultSlotDuration = defaultSlotDuration; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
```

- [ ] **Step 2: Create the AvailabilityTemplateRepository**

```java
package com.kccitm.api.repository.Career9.counselling;

import com.kccitm.api.model.career9.counselling.AvailabilityTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AvailabilityTemplateRepository extends JpaRepository<AvailabilityTemplate, Long> {

    List<AvailabilityTemplate> findByCounsellorId(Long counsellorId);

    List<AvailabilityTemplate> findByCounsellorIdAndIsActiveTrue(Long counsellorId);

    List<AvailabilityTemplate> findByIsActiveTrue();
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /home/kccsw/Projects/career-nine/spring-social && mvn compile -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add spring-social/src/main/java/com/kccitm/api/model/career9/counselling/AvailabilityTemplate.java spring-social/src/main/java/com/kccitm/api/repository/Career9/counselling/AvailabilityTemplateRepository.java
git commit -m "feat(counselling): add AvailabilityTemplate entity and repository"
```

---

### Task 3: CounsellingSlot Entity & Repository

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/model/career9/counselling/CounsellingSlot.java`
- Create: `spring-social/src/main/java/com/kccitm/api/repository/Career9/counselling/CounsellingSlotRepository.java`

- [ ] **Step 1: Create the CounsellingSlot entity**

```java
package com.kccitm.api.model.career9.counselling;

import com.fasterxml.jackson.annotation.JsonProperty;

import javax.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "counselling_slot")
public class CounsellingSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "counsellor_id", nullable = false)
    private Counsellor counsellor;

    @ManyToOne
    @JoinColumn(name = "template_id")
    private AvailabilityTemplate template;

    @Column(nullable = false)
    private LocalDate date;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    @Column(nullable = false, columnDefinition = "VARCHAR(20) DEFAULT 'AVAILABLE'")
    private String status = "AVAILABLE";

    @Column(name = "is_manually_created", columnDefinition = "BOOLEAN DEFAULT FALSE")
    @JsonProperty("isManuallyCreated")
    private Boolean isManuallyCreated = false;

    @Column(name = "is_blocked", columnDefinition = "BOOLEAN DEFAULT FALSE")
    @JsonProperty("isBlocked")
    private Boolean isBlocked = false;

    @Column(name = "block_reason")
    private String blockReason;

    @Version
    private Integer version;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public CounsellingSlot() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Counsellor getCounsellor() { return counsellor; }
    public void setCounsellor(Counsellor counsellor) { this.counsellor = counsellor; }

    public AvailabilityTemplate getTemplate() { return template; }
    public void setTemplate(AvailabilityTemplate template) { this.template = template; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    public Integer getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Boolean getIsManuallyCreated() { return isManuallyCreated; }
    public void setIsManuallyCreated(Boolean isManuallyCreated) { this.isManuallyCreated = isManuallyCreated; }

    public Boolean getIsBlocked() { return isBlocked; }
    public void setIsBlocked(Boolean isBlocked) { this.isBlocked = isBlocked; }

    public String getBlockReason() { return blockReason; }
    public void setBlockReason(String blockReason) { this.blockReason = blockReason; }

    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
```

- [ ] **Step 2: Create the CounsellingSlotRepository**

```java
package com.kccitm.api.repository.Career9.counselling;

import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface CounsellingSlotRepository extends JpaRepository<CounsellingSlot, Long> {

    List<CounsellingSlot> findByStatusAndDateBetween(String status, LocalDate start, LocalDate end);

    List<CounsellingSlot> findByCounsellorIdAndDateBetween(Long counsellorId, LocalDate start, LocalDate end);

    List<CounsellingSlot> findByCounsellorId(Long counsellorId);

    @Query("SELECT s FROM CounsellingSlot s WHERE s.status = 'AVAILABLE' AND s.isBlocked = false AND s.date BETWEEN :start AND :end ORDER BY s.date, s.startTime")
    List<CounsellingSlot> findAvailableSlots(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT s FROM CounsellingSlot s WHERE s.counsellor.id = :counsellorId AND s.date = :date AND s.template.id = :templateId")
    List<CounsellingSlot> findByCounsellorIdAndDateAndTemplateId(
        @Param("counsellorId") Long counsellorId,
        @Param("date") LocalDate date,
        @Param("templateId") Long templateId
    );

    List<CounsellingSlot> findByCounsellorIdAndDateAndIsBlockedTrue(Long counsellorId, LocalDate date);
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /home/kccsw/Projects/career-nine/spring-social && mvn compile -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add spring-social/src/main/java/com/kccitm/api/model/career9/counselling/CounsellingSlot.java spring-social/src/main/java/com/kccitm/api/repository/Career9/counselling/CounsellingSlotRepository.java
git commit -m "feat(counselling): add CounsellingSlot entity with optimistic locking and repository"
```

---

### Task 4: CounsellingAppointment Entity & Repository

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/model/career9/counselling/CounsellingAppointment.java`
- Create: `spring-social/src/main/java/com/kccitm/api/repository/Career9/counselling/CounsellingAppointmentRepository.java`

- [ ] **Step 1: Create the CounsellingAppointment entity**

```java
package com.kccitm.api.model.career9.counselling;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.UserStudent;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "counselling_appointment")
public class CounsellingAppointment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "slot_id", nullable = false)
    private CounsellingSlot slot;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private UserStudent student;

    @ManyToOne
    @JoinColumn(name = "counsellor_id")
    private Counsellor counsellor;

    @ManyToOne
    @JoinColumn(name = "assigned_by")
    private User assignedBy;

    @Column(nullable = false, columnDefinition = "VARCHAR(20) DEFAULT 'PENDING'")
    private String status = "PENDING";

    @Column(name = "student_reason", columnDefinition = "TEXT")
    private String studentReason;

    @Column(name = "meeting_link", length = 500)
    private String meetingLink;

    @Column(name = "meeting_link_source", columnDefinition = "VARCHAR(10) DEFAULT 'AUTO'")
    private String meetingLinkSource = "AUTO";

    @Column(name = "reminder_24h_sent", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean reminder24hSent = false;

    @Column(name = "reminder_1h_sent", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean reminder1hSent = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public CounsellingAppointment() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public CounsellingSlot getSlot() { return slot; }
    public void setSlot(CounsellingSlot slot) { this.slot = slot; }

    public UserStudent getStudent() { return student; }
    public void setStudent(UserStudent student) { this.student = student; }

    public Counsellor getCounsellor() { return counsellor; }
    public void setCounsellor(Counsellor counsellor) { this.counsellor = counsellor; }

    public User getAssignedBy() { return assignedBy; }
    public void setAssignedBy(User assignedBy) { this.assignedBy = assignedBy; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getStudentReason() { return studentReason; }
    public void setStudentReason(String studentReason) { this.studentReason = studentReason; }

    public String getMeetingLink() { return meetingLink; }
    public void setMeetingLink(String meetingLink) { this.meetingLink = meetingLink; }

    public String getMeetingLinkSource() { return meetingLinkSource; }
    public void setMeetingLinkSource(String meetingLinkSource) { this.meetingLinkSource = meetingLinkSource; }

    public Boolean getReminder24hSent() { return reminder24hSent; }
    public void setReminder24hSent(Boolean reminder24hSent) { this.reminder24hSent = reminder24hSent; }

    public Boolean getReminder1hSent() { return reminder1hSent; }
    public void setReminder1hSent(Boolean reminder1hSent) { this.reminder1hSent = reminder1hSent; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
```

- [ ] **Step 2: Create the CounsellingAppointmentRepository**

```java
package com.kccitm.api.repository.Career9.counselling;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Repository
public interface CounsellingAppointmentRepository extends JpaRepository<CounsellingAppointment, Long> {

    List<CounsellingAppointment> findByStatus(String status);

    List<CounsellingAppointment> findByStudentUserStudentId(Long userStudentId);

    List<CounsellingAppointment> findByCounsellorId(Long counsellorId);

    @Query("SELECT a FROM CounsellingAppointment a WHERE a.student.userStudentId = :studentId ORDER BY a.slot.date DESC, a.slot.startTime DESC")
    List<CounsellingAppointment> findByStudentIdOrdered(@Param("studentId") Long studentId);

    @Query("SELECT a FROM CounsellingAppointment a WHERE a.counsellor.id = :counsellorId AND a.slot.date = :date ORDER BY a.slot.startTime")
    List<CounsellingAppointment> findByCounsellorIdAndDate(@Param("counsellorId") Long counsellorId, @Param("date") LocalDate date);

    @Query("SELECT a FROM CounsellingAppointment a WHERE a.status = 'CONFIRMED' AND a.reminder24hSent = false AND a.slot.date = :targetDate")
    List<CounsellingAppointment> findNeedingReminder24h(@Param("targetDate") LocalDate targetDate);

    @Query("SELECT a FROM CounsellingAppointment a WHERE a.status = 'CONFIRMED' AND a.reminder1hSent = false AND a.slot.date = :targetDate AND a.slot.startTime BETWEEN :startTime AND :endTime")
    List<CounsellingAppointment> findNeedingReminder1h(@Param("targetDate") LocalDate targetDate, @Param("startTime") LocalTime startTime, @Param("endTime") LocalTime endTime);

    @Query("SELECT COUNT(a) FROM CounsellingAppointment a WHERE a.status = :status")
    Long countByStatus(@Param("status") String status);

    @Query("SELECT COUNT(a) FROM CounsellingAppointment a WHERE a.slot.date BETWEEN :start AND :end AND a.status NOT IN ('CANCELLED', 'RESCHEDULED')")
    Long countActiveInWeek(@Param("start") LocalDate start, @Param("end") LocalDate end);
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /home/kccsw/Projects/career-nine/spring-social && mvn compile -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add spring-social/src/main/java/com/kccitm/api/model/career9/counselling/CounsellingAppointment.java spring-social/src/main/java/com/kccitm/api/repository/Career9/counselling/CounsellingAppointmentRepository.java
git commit -m "feat(counselling): add CounsellingAppointment entity and repository"
```

---

### Task 5: SessionNotes, AuditLog, Notification Entities & Repositories

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/model/career9/counselling/SessionNotes.java`
- Create: `spring-social/src/main/java/com/kccitm/api/model/career9/counselling/AppointmentAuditLog.java`
- Create: `spring-social/src/main/java/com/kccitm/api/model/career9/counselling/Notification.java`
- Create: `spring-social/src/main/java/com/kccitm/api/repository/Career9/counselling/SessionNotesRepository.java`
- Create: `spring-social/src/main/java/com/kccitm/api/repository/Career9/counselling/AppointmentAuditLogRepository.java`
- Create: `spring-social/src/main/java/com/kccitm/api/repository/Career9/counselling/NotificationRepository.java`

- [ ] **Step 1: Create SessionNotes entity**

```java
package com.kccitm.api.model.career9.counselling;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "session_notes")
public class SessionNotes {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "appointment_id", nullable = false)
    private CounsellingAppointment appointment;

    @Column(name = "key_discussion_points", columnDefinition = "TEXT")
    private String keyDiscussionPoints;

    @Column(name = "action_items", columnDefinition = "TEXT")
    private String actionItems;

    @Column(name = "recommended_next_session")
    private String recommendedNextSession;

    @Column(name = "followup_required", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean followupRequired = false;

    @Column(name = "public_remarks", columnDefinition = "TEXT")
    private String publicRemarks;

    @Column(name = "private_notes", columnDefinition = "TEXT")
    private String privateNotes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public SessionNotes() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public CounsellingAppointment getAppointment() { return appointment; }
    public void setAppointment(CounsellingAppointment appointment) { this.appointment = appointment; }

    public String getKeyDiscussionPoints() { return keyDiscussionPoints; }
    public void setKeyDiscussionPoints(String keyDiscussionPoints) { this.keyDiscussionPoints = keyDiscussionPoints; }

    public String getActionItems() { return actionItems; }
    public void setActionItems(String actionItems) { this.actionItems = actionItems; }

    public String getRecommendedNextSession() { return recommendedNextSession; }
    public void setRecommendedNextSession(String recommendedNextSession) { this.recommendedNextSession = recommendedNextSession; }

    public Boolean getFollowupRequired() { return followupRequired; }
    public void setFollowupRequired(Boolean followupRequired) { this.followupRequired = followupRequired; }

    public String getPublicRemarks() { return publicRemarks; }
    public void setPublicRemarks(String publicRemarks) { this.publicRemarks = publicRemarks; }

    public String getPrivateNotes() { return privateNotes; }
    public void setPrivateNotes(String privateNotes) { this.privateNotes = privateNotes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
```

- [ ] **Step 2: Create AppointmentAuditLog entity**

```java
package com.kccitm.api.model.career9.counselling;

import com.kccitm.api.model.User;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "appointment_audit_log")
public class AppointmentAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "appointment_id", nullable = false)
    private CounsellingAppointment appointment;

    @Column(nullable = false)
    private String action;

    @ManyToOne
    @JoinColumn(name = "performed_by")
    private User performedBy;

    @Column(name = "old_values", columnDefinition = "TEXT")
    private String oldValues;

    @Column(name = "new_values", columnDefinition = "TEXT")
    private String newValues;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    public AppointmentAuditLog() {}

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public CounsellingAppointment getAppointment() { return appointment; }
    public void setAppointment(CounsellingAppointment appointment) { this.appointment = appointment; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public User getPerformedBy() { return performedBy; }
    public void setPerformedBy(User performedBy) { this.performedBy = performedBy; }

    public String getOldValues() { return oldValues; }
    public void setOldValues(String oldValues) { this.oldValues = oldValues; }

    public String getNewValues() { return newValues; }
    public void setNewValues(String newValues) { this.newValues = newValues; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
}
```

- [ ] **Step 3: Create Notification entity**

```java
package com.kccitm.api.model.career9.counselling;

import com.kccitm.api.model.User;
import com.fasterxml.jackson.annotation.JsonProperty;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "counselling_notification")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "reference_type", length = 50)
    private String referenceType;

    @Column(name = "is_read", columnDefinition = "BOOLEAN DEFAULT FALSE")
    @JsonProperty("isRead")
    private Boolean isRead = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public Notification() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Long getReferenceId() { return referenceId; }
    public void setReferenceId(Long referenceId) { this.referenceId = referenceId; }

    public String getReferenceType() { return referenceType; }
    public void setReferenceType(String referenceType) { this.referenceType = referenceType; }

    public Boolean getIsRead() { return isRead; }
    public void setIsRead(Boolean isRead) { this.isRead = isRead; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
```

- [ ] **Step 4: Create the three repositories**

**SessionNotesRepository.java:**
```java
package com.kccitm.api.repository.Career9.counselling;

import com.kccitm.api.model.career9.counselling.SessionNotes;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SessionNotesRepository extends JpaRepository<SessionNotes, Long> {
    Optional<SessionNotes> findByAppointmentId(Long appointmentId);
}
```

**AppointmentAuditLogRepository.java:**
```java
package com.kccitm.api.repository.Career9.counselling;

import com.kccitm.api.model.career9.counselling.AppointmentAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AppointmentAuditLogRepository extends JpaRepository<AppointmentAuditLog, Long> {
    List<AppointmentAuditLog> findByAppointmentIdOrderByTimestampDesc(Long appointmentId);
}
```

**NotificationRepository.java:**
```java
package com.kccitm.api.repository.Career9.counselling;

import com.kccitm.api.model.career9.counselling.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);

    Long countByUserIdAndIsReadFalse(Long userId);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId AND n.isRead = false")
    void markAllReadByUserId(@Param("userId") Long userId);
}
```

- [ ] **Step 5: Verify compilation**

Run: `cd /home/kccsw/Projects/career-nine/spring-social && mvn compile -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 6: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add spring-social/src/main/java/com/kccitm/api/model/career9/counselling/SessionNotes.java spring-social/src/main/java/com/kccitm/api/model/career9/counselling/AppointmentAuditLog.java spring-social/src/main/java/com/kccitm/api/model/career9/counselling/Notification.java spring-social/src/main/java/com/kccitm/api/repository/Career9/counselling/SessionNotesRepository.java spring-social/src/main/java/com/kccitm/api/repository/Career9/counselling/AppointmentAuditLogRepository.java spring-social/src/main/java/com/kccitm/api/repository/Career9/counselling/NotificationRepository.java
git commit -m "feat(counselling): add SessionNotes, AuditLog, Notification entities and repositories"
```

---

## Phase 2: Backend Services

### Task 6: AuditLogService & CounsellorService

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/counselling/AuditLogService.java`
- Create: `spring-social/src/main/java/com/kccitm/api/service/counselling/CounsellorService.java`

- [ ] **Step 1: Create AuditLogService**

```java
package com.kccitm.api.service.counselling;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.AppointmentAuditLog;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.repository.Career9.counselling.AppointmentAuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AuditLogService {

    private static final Logger logger = LoggerFactory.getLogger(AuditLogService.class);

    @Autowired
    private AppointmentAuditLogRepository auditLogRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Async
    public void log(CounsellingAppointment appointment, String action, User performedBy, String reason,
                    Map<String, Object> oldValues, Map<String, Object> newValues) {
        try {
            AppointmentAuditLog log = new AppointmentAuditLog();
            log.setAppointment(appointment);
            log.setAction(action);
            log.setPerformedBy(performedBy);
            log.setReason(reason);
            log.setOldValues(oldValues != null ? objectMapper.writeValueAsString(oldValues) : null);
            log.setNewValues(newValues != null ? objectMapper.writeValueAsString(newValues) : null);
            auditLogRepository.save(log);
            logger.info("Audit log created: {} for appointment {}", action, appointment.getId());
        } catch (Exception e) {
            logger.error("Failed to create audit log for appointment {}: {}", appointment.getId(), e.getMessage());
        }
    }

    public void logSimple(CounsellingAppointment appointment, String action, User performedBy, String reason) {
        Map<String, Object> newValues = new HashMap<>();
        newValues.put("status", appointment.getStatus());
        log(appointment, action, performedBy, reason, null, newValues);
    }

    public List<AppointmentAuditLog> getLogsForAppointment(Long appointmentId) {
        return auditLogRepository.findByAppointmentIdOrderByTimestampDesc(appointmentId);
    }
}
```

- [ ] **Step 2: Create CounsellorService**

```java
package com.kccitm.api.service.counselling;

import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class CounsellorService {

    private static final Logger logger = LoggerFactory.getLogger(CounsellorService.class);

    @Autowired
    private CounsellorRepository counsellorRepository;

    public Counsellor create(Counsellor counsellor) {
        logger.info("Creating counsellor: {}", counsellor.getEmail());
        return counsellorRepository.save(counsellor);
    }

    public List<Counsellor> getAllActive() {
        return counsellorRepository.findByIsActiveTrueAndOnboardingStatus("ACTIVE");
    }

    public List<Counsellor> getAll() {
        return counsellorRepository.findAll();
    }

    public Optional<Counsellor> getById(Long id) {
        return counsellorRepository.findById(id);
    }

    public Optional<Counsellor> getByUserId(Long userId) {
        return counsellorRepository.findByUserId(userId);
    }

    public Counsellor update(Long id, Counsellor updated) {
        Counsellor existing = counsellorRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Counsellor not found: " + id));

        if (updated.getName() != null) existing.setName(updated.getName());
        if (updated.getEmail() != null) existing.setEmail(updated.getEmail());
        if (updated.getPhone() != null) existing.setPhone(updated.getPhone());
        if (updated.getSpecializations() != null) existing.setSpecializations(updated.getSpecializations());
        if (updated.getBio() != null) existing.setBio(updated.getBio());
        if (updated.getProfileImageUrl() != null) existing.setProfileImageUrl(updated.getProfileImageUrl());

        return counsellorRepository.save(existing);
    }

    public Counsellor toggleActive(Long id) {
        Counsellor counsellor = counsellorRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Counsellor not found: " + id));
        counsellor.setIsActive(!counsellor.getIsActive());
        return counsellorRepository.save(counsellor);
    }
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /home/kccsw/Projects/career-nine/spring-social && mvn compile -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add spring-social/src/main/java/com/kccitm/api/service/counselling/AuditLogService.java spring-social/src/main/java/com/kccitm/api/service/counselling/CounsellorService.java
git commit -m "feat(counselling): add AuditLogService and CounsellorService"
```

---

### Task 7: CounsellingNotificationService

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/counselling/CounsellingNotificationService.java`

- [ ] **Step 1: Create the notification service**

This service creates in-app notifications and sends emails via Mandrill. It follows the existing `MandrillApi` bean pattern from `MandrillConfig.java`.

```java
package com.kccitm.api.service.counselling;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.Notification;
import com.kccitm.api.repository.Career9.counselling.NotificationRepository;
import com.microtripit.mandrillapp.lutung.MandrillApi;
import com.microtripit.mandrillapp.lutung.view.MandrillMessage;
import com.microtripit.mandrillapp.lutung.view.MandrillMessageStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import javax.transaction.Transactional;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
public class CounsellingNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingNotificationService.class);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMMM d, yyyy");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("h:mm a");

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private MandrillApi mandrillApi;

    public void createInAppNotification(User user, String type, String title, String message,
                                         Long referenceId, String referenceType) {
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setReferenceId(referenceId);
        notification.setReferenceType(referenceType);
        notificationRepository.save(notification);
        logger.info("In-app notification created for user {}: {}", user.getId(), type);
    }

    @Async
    public void sendBookingReceivedEmail(CounsellingAppointment appointment) {
        String subject = "Counselling Request Received";
        String date = appointment.getSlot().getDate().format(DATE_FMT);
        String time = appointment.getSlot().getStartTime().format(TIME_FMT);
        String body = String.format(
            "Dear %s,\n\nYour counselling session request has been received.\n\n" +
            "Requested Slot: %s at %s (%d minutes)\n\n" +
            "We will process your request and assign a counsellor shortly. " +
            "You will receive a confirmation email once the session is confirmed.\n\n" +
            "Best regards,\nCareer-Nine Team",
            appointment.getStudent().getUser().getName(), date, time,
            appointment.getSlot().getDurationMinutes()
        );
        sendEmail(appointment.getStudent().getUser().getEmail(), subject, body);
    }

    @Async
    public void sendAssignedToCounsellorEmail(CounsellingAppointment appointment) {
        String subject = "New Counselling Session Assigned to You";
        String date = appointment.getSlot().getDate().format(DATE_FMT);
        String time = appointment.getSlot().getStartTime().format(TIME_FMT);
        String body = String.format(
            "Dear %s,\n\nA new counselling session has been assigned to you.\n\n" +
            "Student: %s\nDate: %s\nTime: %s (%d minutes)\nReason: %s\n\n" +
            "Please log in to your dashboard to confirm or decline this session.\n\n" +
            "Best regards,\nCareer-Nine Team",
            appointment.getCounsellor().getName(),
            appointment.getStudent().getUser().getName(),
            date, time, appointment.getSlot().getDurationMinutes(),
            appointment.getStudentReason()
        );
        sendEmail(appointment.getCounsellor().getEmail(), subject, body);
    }

    @Async
    public void sendConfirmedToStudentEmail(CounsellingAppointment appointment) {
        String subject = "Counselling Session Confirmed";
        String date = appointment.getSlot().getDate().format(DATE_FMT);
        String time = appointment.getSlot().getStartTime().format(TIME_FMT);
        String meetLink = appointment.getMeetingLink() != null ? appointment.getMeetingLink() : "Link will be shared soon";
        String body = String.format(
            "Dear %s,\n\nYour counselling session has been confirmed!\n\n" +
            "Date: %s\nTime: %s (%d minutes)\nMeeting Link: %s\n\n" +
            "Please join the meeting at the scheduled time.\n\n" +
            "Best regards,\nCareer-Nine Team",
            appointment.getStudent().getUser().getName(),
            date, time, appointment.getSlot().getDurationMinutes(), meetLink
        );
        sendEmail(appointment.getStudent().getUser().getEmail(), subject, body);
    }

    @Async
    public void sendCancellationEmail(CounsellingAppointment appointment, String cancelledByName, String recipientEmail, String recipientName) {
        String subject = "Counselling Session Cancelled";
        String date = appointment.getSlot().getDate().format(DATE_FMT);
        String time = appointment.getSlot().getStartTime().format(TIME_FMT);
        String body = String.format(
            "Dear %s,\n\nThe counselling session scheduled for %s at %s has been cancelled by %s.\n\n" +
            "If you need to book a new session, please visit your dashboard.\n\n" +
            "Best regards,\nCareer-Nine Team",
            recipientName, date, time, cancelledByName
        );
        sendEmail(recipientEmail, subject, body);
    }

    @Async
    public void sendRescheduleEmail(CounsellingAppointment oldAppointment, CounsellingAppointment newAppointment) {
        String subject = "Counselling Session Rescheduled";
        String oldDate = oldAppointment.getSlot().getDate().format(DATE_FMT);
        String oldTime = oldAppointment.getSlot().getStartTime().format(TIME_FMT);
        String newDate = newAppointment.getSlot().getDate().format(DATE_FMT);
        String newTime = newAppointment.getSlot().getStartTime().format(TIME_FMT);
        String meetLink = newAppointment.getMeetingLink() != null ? newAppointment.getMeetingLink() : "Link will be shared soon";
        String body = String.format(
            "Dear %s,\n\nYour counselling session has been rescheduled.\n\n" +
            "Previous: %s at %s\nNew: %s at %s\nMeeting Link: %s\n\n" +
            "Best regards,\nCareer-Nine Team",
            newAppointment.getStudent().getUser().getName(),
            oldDate, oldTime, newDate, newTime, meetLink
        );
        sendEmail(newAppointment.getStudent().getUser().getEmail(), subject, body);
    }

    @Async
    public void sendReminderEmail(CounsellingAppointment appointment, String period) {
        String subject = "Reminder: Counselling Session " + period;
        String date = appointment.getSlot().getDate().format(DATE_FMT);
        String time = appointment.getSlot().getStartTime().format(TIME_FMT);
        String meetLink = appointment.getMeetingLink() != null ? appointment.getMeetingLink() : "Check your dashboard";
        String body = String.format(
            "This is a reminder that your counselling session is %s.\n\n" +
            "Date: %s\nTime: %s\nMeeting Link: %s\n\n" +
            "Best regards,\nCareer-Nine Team",
            period, date, time, meetLink
        );

        // Send to student
        sendEmail(appointment.getStudent().getUser().getEmail(), subject, body);

        // Send to counsellor
        if (appointment.getCounsellor() != null) {
            sendEmail(appointment.getCounsellor().getEmail(), subject, body);
        }
    }

    @Async
    public void sendSessionCompleteEmail(CounsellingAppointment appointment) {
        String subject = "Session Complete — View Counsellor Remarks";
        String body = String.format(
            "Dear %s,\n\nYour counselling session has been completed. " +
            "Your counsellor has added remarks and action items for you.\n\n" +
            "Please visit your dashboard to view the session notes.\n\n" +
            "Best regards,\nCareer-Nine Team",
            appointment.getStudent().getUser().getName()
        );
        sendEmail(appointment.getStudent().getUser().getEmail(), subject, body);
    }

    public List<Notification> getNotificationsForUser(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public Long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    public void markAsRead(Long notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setIsRead(true);
            notificationRepository.save(n);
        });
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.markAllReadByUserId(userId);
    }

    private void sendEmail(String toEmail, String subject, String body) {
        try {
            MandrillMessage message = new MandrillMessage();
            message.setSubject(subject);
            message.setText(body);
            message.setAutoText(true);
            message.setFromEmail("noreply@kccitm.edu.in");
            message.setFromName("Career-Nine");

            ArrayList<MandrillMessage.Recipient> recipients = new ArrayList<>();
            MandrillMessage.Recipient recipient = new MandrillMessage.Recipient();
            recipient.setEmail(toEmail);
            recipient.setType(MandrillMessage.Recipient.Type.TO);
            recipients.add(recipient);
            message.setTo(recipients);
            message.setPreserveRecipients(true);

            MandrillMessageStatus[] statuses = mandrillApi.messages().send(message, false);
            for (MandrillMessageStatus status : statuses) {
                if ("rejected".equalsIgnoreCase(status.getStatus()) || "invalid".equalsIgnoreCase(status.getStatus())) {
                    logger.warn("Email to {} was {}: {}", toEmail, status.getStatus(), status.getRejectReason());
                }
            }
            logger.info("Email sent to {}: {}", toEmail, subject);
        } catch (Exception e) {
            logger.error("Failed to send email to {}: {}", toEmail, e.getMessage());
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /home/kccsw/Projects/career-nine/spring-social && mvn compile -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add spring-social/src/main/java/com/kccitm/api/service/counselling/CounsellingNotificationService.java
git commit -m "feat(counselling): add CounsellingNotificationService with email and in-app notifications"
```

---

### Task 8: SlotMaterializationService

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/counselling/SlotMaterializationService.java`

- [ ] **Step 1: Create the slot materialization service**

```java
package com.kccitm.api.service.counselling;

import com.kccitm.api.model.career9.counselling.AvailabilityTemplate;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.AvailabilityTemplateRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Service
public class SlotMaterializationService {

    private static final Logger logger = LoggerFactory.getLogger(SlotMaterializationService.class);
    private static final int WEEKS_AHEAD = 4;

    @Autowired
    private AvailabilityTemplateRepository templateRepository;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Scheduled(cron = "0 0 0 * * *") // Midnight daily
    public void materializeSlots() {
        logger.info("Starting slot materialization...");
        List<AvailabilityTemplate> activeTemplates = templateRepository.findByIsActiveTrue();
        LocalDate startDate = LocalDate.now().plusDays(1); // Start from tomorrow
        LocalDate endDate = startDate.plusWeeks(WEEKS_AHEAD);

        int slotsCreated = 0;

        for (AvailabilityTemplate template : activeTemplates) {
            DayOfWeek targetDay = DayOfWeek.valueOf(template.getDayOfWeek().toUpperCase());

            for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
                if (date.getDayOfWeek() != targetDay) continue;

                // Check if date is blocked for this counsellor
                List<CounsellingSlot> blockedSlots = slotRepository
                    .findByCounsellorIdAndDateAndIsBlockedTrue(template.getCounsellor().getId(), date);
                if (!blockedSlots.isEmpty()) {
                    logger.debug("Skipping blocked date {} for counsellor {}", date, template.getCounsellor().getId());
                    continue;
                }

                // Check if slots already exist for this template + date
                List<CounsellingSlot> existingSlots = slotRepository
                    .findByCounsellorIdAndDateAndTemplateId(
                        template.getCounsellor().getId(), date, template.getId());
                if (!existingSlots.isEmpty()) continue;

                // Generate slots from template
                LocalTime slotStart = template.getStartTime();
                while (slotStart.plusMinutes(template.getDefaultSlotDuration()).compareTo(template.getEndTime()) <= 0) {
                    LocalTime slotEnd = slotStart.plusMinutes(template.getDefaultSlotDuration());

                    CounsellingSlot slot = new CounsellingSlot();
                    slot.setCounsellor(template.getCounsellor());
                    slot.setTemplate(template);
                    slot.setDate(date);
                    slot.setStartTime(slotStart);
                    slot.setEndTime(slotEnd);
                    slot.setDurationMinutes(template.getDefaultSlotDuration());
                    slot.setStatus("AVAILABLE");
                    slot.setIsManuallyCreated(false);
                    slot.setIsBlocked(false);
                    slotRepository.save(slot);
                    slotsCreated++;

                    slotStart = slotEnd;
                }
            }
        }

        logger.info("Slot materialization complete. Created {} slots.", slotsCreated);
    }

    // Manual trigger for admin to regenerate slots
    public int materializeSlotsForCounsellor(Long counsellorId) {
        List<AvailabilityTemplate> templates = templateRepository.findByCounsellorIdAndIsActiveTrue(counsellorId);
        LocalDate startDate = LocalDate.now().plusDays(1);
        LocalDate endDate = startDate.plusWeeks(WEEKS_AHEAD);
        int slotsCreated = 0;

        for (AvailabilityTemplate template : templates) {
            DayOfWeek targetDay = DayOfWeek.valueOf(template.getDayOfWeek().toUpperCase());

            for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
                if (date.getDayOfWeek() != targetDay) continue;

                List<CounsellingSlot> blockedSlots = slotRepository
                    .findByCounsellorIdAndDateAndIsBlockedTrue(template.getCounsellor().getId(), date);
                if (!blockedSlots.isEmpty()) continue;

                List<CounsellingSlot> existingSlots = slotRepository
                    .findByCounsellorIdAndDateAndTemplateId(
                        template.getCounsellor().getId(), date, template.getId());
                if (!existingSlots.isEmpty()) continue;

                LocalTime slotStart = template.getStartTime();
                while (slotStart.plusMinutes(template.getDefaultSlotDuration()).compareTo(template.getEndTime()) <= 0) {
                    LocalTime slotEnd = slotStart.plusMinutes(template.getDefaultSlotDuration());

                    CounsellingSlot slot = new CounsellingSlot();
                    slot.setCounsellor(template.getCounsellor());
                    slot.setTemplate(template);
                    slot.setDate(date);
                    slot.setStartTime(slotStart);
                    slot.setEndTime(slotEnd);
                    slot.setDurationMinutes(template.getDefaultSlotDuration());
                    slot.setStatus("AVAILABLE");
                    slot.setIsManuallyCreated(false);
                    slot.setIsBlocked(false);
                    slotRepository.save(slot);
                    slotsCreated++;

                    slotStart = slotEnd;
                }
            }
        }

        return slotsCreated;
    }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /home/kccsw/Projects/career-nine/spring-social && mvn compile -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add spring-social/src/main/java/com/kccitm/api/service/counselling/SlotMaterializationService.java
git commit -m "feat(counselling): add SlotMaterializationService with daily cron job"
```

---

### Task 9: BookingService & AppointmentService

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/counselling/BookingService.java`
- Create: `spring-social/src/main/java/com/kccitm/api/service/counselling/AppointmentService.java`

- [ ] **Step 1: Create BookingService**

```java
package com.kccitm.api.service.counselling;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.transaction.Transactional;
import java.time.LocalDate;
import java.util.List;

@Service
public class BookingService {

    private static final Logger logger = LoggerFactory.getLogger(BookingService.class);

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private AuditLogService auditLogService;

    public List<CounsellingSlot> getAvailableSlots(LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(6);
        return slotRepository.findAvailableSlots(weekStart, weekEnd);
    }

    @Transactional
    public CounsellingAppointment bookSlot(Long slotId, UserStudent student, String reason) {
        CounsellingSlot slot = slotRepository.findById(slotId)
            .orElseThrow(() -> new RuntimeException("Slot not found: " + slotId));

        if (!"AVAILABLE".equals(slot.getStatus())) {
            throw new RuntimeException("Slot is no longer available");
        }

        // Update slot status (optimistic lock via @Version will prevent concurrent booking)
        slot.setStatus("REQUESTED");
        slotRepository.save(slot);

        // Create appointment
        CounsellingAppointment appointment = new CounsellingAppointment();
        appointment.setSlot(slot);
        appointment.setStudent(student);
        appointment.setStudentReason(reason);
        appointment.setStatus("PENDING");
        appointment = appointmentRepository.save(appointment);

        // Send notifications
        notificationService.sendBookingReceivedEmail(appointment);
        notificationService.createInAppNotification(
            student.getUser(), "BOOKING_RECEIVED",
            "Counselling Request Received",
            "Your request for " + slot.getDate() + " at " + slot.getStartTime() + " has been received.",
            appointment.getId(), "APPOINTMENT"
        );

        // Audit log
        auditLogService.logSimple(appointment, "CREATED", student.getUser(), "Student booked slot");

        logger.info("Slot {} booked by student {}", slotId, student.getUserStudentId());
        return appointment;
    }
}
```

- [ ] **Step 2: Create AppointmentService**

```java
package com.kccitm.api.service.counselling;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.transaction.Transactional;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AppointmentService {

    private static final Logger logger = LoggerFactory.getLogger(AppointmentService.class);
    private static final int CANCELLATION_WINDOW_HOURS = 4;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private CounsellorRepository counsellorRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private MeetingLinkService meetingLinkService;

    public List<CounsellingAppointment> getPendingQueue() {
        return appointmentRepository.findByStatus("PENDING");
    }

    public List<CounsellingAppointment> getByStudent(Long studentId) {
        return appointmentRepository.findByStudentIdOrdered(studentId);
    }

    public List<CounsellingAppointment> getByCounsellor(Long counsellorId) {
        return appointmentRepository.findByCounsellorId(counsellorId);
    }

    public List<CounsellingAppointment> getByCounsellorAndDate(Long counsellorId, LocalDate date) {
        return appointmentRepository.findByCounsellorIdAndDate(counsellorId, date);
    }

    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("pending", appointmentRepository.countByStatus("PENDING"));
        stats.put("assigned", appointmentRepository.countByStatus("ASSIGNED"));
        stats.put("confirmed", appointmentRepository.countByStatus("CONFIRMED"));
        LocalDate weekStart = LocalDate.now();
        LocalDate weekEnd = weekStart.plusDays(6);
        stats.put("thisWeek", appointmentRepository.countActiveInWeek(weekStart, weekEnd));
        return stats;
    }

    @Transactional
    public CounsellingAppointment assign(Long appointmentId, Long counsellorId, User admin) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
            .orElseThrow(() -> new RuntimeException("Appointment not found: " + appointmentId));

        Counsellor counsellor = counsellorRepository.findById(counsellorId)
            .orElseThrow(() -> new RuntimeException("Counsellor not found: " + counsellorId));

        String oldStatus = appointment.getStatus();
        appointment.setCounsellor(counsellor);
        appointment.setAssignedBy(admin);
        appointment.setStatus("ASSIGNED");
        appointment.getSlot().setStatus("ASSIGNED");

        slotRepository.save(appointment.getSlot());
        appointment = appointmentRepository.save(appointment);

        // Notify counsellor
        notificationService.sendAssignedToCounsellorEmail(appointment);
        notificationService.createInAppNotification(
            counsellor.getUser(), "ASSIGNED",
            "New Session Assigned",
            "A counselling session on " + appointment.getSlot().getDate() + " has been assigned to you.",
            appointment.getId(), "APPOINTMENT"
        );

        // Audit
        Map<String, Object> oldValues = new HashMap<>();
        oldValues.put("status", oldStatus);
        Map<String, Object> newValues = new HashMap<>();
        newValues.put("status", "ASSIGNED");
        newValues.put("counsellorId", counsellorId);
        auditLogService.log(appointment, "ASSIGNED", admin, "Admin assigned counsellor", oldValues, newValues);

        return appointment;
    }

    @Transactional
    public CounsellingAppointment confirm(Long appointmentId, User counsellorUser) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
            .orElseThrow(() -> new RuntimeException("Appointment not found: " + appointmentId));

        appointment.setStatus("CONFIRMED");
        appointment.getSlot().setStatus("CONFIRMED");

        // Generate meeting link
        String meetLink = meetingLinkService.generateMeetLink(appointment);
        appointment.setMeetingLink(meetLink);
        appointment.setMeetingLinkSource(meetLink != null ? "AUTO" : "MANUAL");

        slotRepository.save(appointment.getSlot());
        appointment = appointmentRepository.save(appointment);

        // Notify student
        notificationService.sendConfirmedToStudentEmail(appointment);
        notificationService.createInAppNotification(
            appointment.getStudent().getUser(), "CONFIRMED",
            "Session Confirmed",
            "Your counselling session on " + appointment.getSlot().getDate() + " has been confirmed.",
            appointment.getId(), "APPOINTMENT"
        );

        auditLogService.logSimple(appointment, "CONFIRMED", counsellorUser, "Counsellor confirmed session");

        return appointment;
    }

    @Transactional
    public CounsellingAppointment decline(Long appointmentId, User counsellorUser, String reason) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
            .orElseThrow(() -> new RuntimeException("Appointment not found: " + appointmentId));

        // Reset to PENDING so admin can reassign
        appointment.setStatus("PENDING");
        appointment.setCounsellor(null);
        appointment.setAssignedBy(null);
        appointment.getSlot().setStatus("REQUESTED");

        slotRepository.save(appointment.getSlot());
        appointment = appointmentRepository.save(appointment);

        auditLogService.logSimple(appointment, "DECLINED", counsellorUser, reason);

        return appointment;
    }

    @Transactional
    public CounsellingAppointment cancel(Long appointmentId, User cancelledBy, String reason) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
            .orElseThrow(() -> new RuntimeException("Appointment not found: " + appointmentId));

        // Enforce 4-hour rule
        LocalDateTime sessionTime = LocalDateTime.of(appointment.getSlot().getDate(), appointment.getSlot().getStartTime());
        if (LocalDateTime.now().plusHours(CANCELLATION_WINDOW_HOURS).isAfter(sessionTime)) {
            throw new RuntimeException("Cannot cancel within " + CANCELLATION_WINDOW_HOURS + " hours of session start");
        }

        String oldStatus = appointment.getStatus();
        appointment.setStatus("CANCELLED");
        appointment.getSlot().setStatus("CANCELLED");

        slotRepository.save(appointment.getSlot());
        appointment = appointmentRepository.save(appointment);

        // Notify all parties
        String cancellerName = cancelledBy.getName();

        // Notify student (if canceller is not the student)
        if (!cancelledBy.getId().equals(appointment.getStudent().getUser().getId())) {
            notificationService.sendCancellationEmail(appointment, cancellerName,
                appointment.getStudent().getUser().getEmail(), appointment.getStudent().getUser().getName());
            notificationService.createInAppNotification(
                appointment.getStudent().getUser(), "CANCELLED",
                "Session Cancelled",
                "Your session on " + appointment.getSlot().getDate() + " has been cancelled by " + cancellerName,
                appointment.getId(), "APPOINTMENT"
            );
        }

        // Notify counsellor (if assigned and canceller is not the counsellor)
        if (appointment.getCounsellor() != null && appointment.getCounsellor().getUser() != null
            && !cancelledBy.getId().equals(appointment.getCounsellor().getUser().getId())) {
            notificationService.sendCancellationEmail(appointment, cancellerName,
                appointment.getCounsellor().getEmail(), appointment.getCounsellor().getName());
            notificationService.createInAppNotification(
                appointment.getCounsellor().getUser(), "CANCELLED",
                "Session Cancelled",
                "Session on " + appointment.getSlot().getDate() + " has been cancelled by " + cancellerName,
                appointment.getId(), "APPOINTMENT"
            );
        }

        Map<String, Object> oldValues = new HashMap<>();
        oldValues.put("status", oldStatus);
        Map<String, Object> newValues = new HashMap<>();
        newValues.put("status", "CANCELLED");
        auditLogService.log(appointment, "CANCELLED", cancelledBy, reason, oldValues, newValues);

        return appointment;
    }

    @Transactional
    public CounsellingAppointment reschedule(Long appointmentId, Long newSlotId, User counsellorUser) {
        CounsellingAppointment oldAppointment = appointmentRepository.findById(appointmentId)
            .orElseThrow(() -> new RuntimeException("Appointment not found: " + appointmentId));

        CounsellingSlot newSlot = slotRepository.findById(newSlotId)
            .orElseThrow(() -> new RuntimeException("New slot not found: " + newSlotId));

        if (!"AVAILABLE".equals(newSlot.getStatus())) {
            throw new RuntimeException("New slot is not available");
        }

        // Enforce 4-hour rule on old appointment
        LocalDateTime sessionTime = LocalDateTime.of(oldAppointment.getSlot().getDate(), oldAppointment.getSlot().getStartTime());
        if (LocalDateTime.now().plusHours(CANCELLATION_WINDOW_HOURS).isAfter(sessionTime)) {
            throw new RuntimeException("Cannot reschedule within " + CANCELLATION_WINDOW_HOURS + " hours of session start");
        }

        // Mark old appointment as rescheduled
        oldAppointment.setStatus("RESCHEDULED");
        oldAppointment.getSlot().setStatus("CANCELLED");
        slotRepository.save(oldAppointment.getSlot());
        appointmentRepository.save(oldAppointment);

        // Create new appointment on new slot
        newSlot.setStatus("CONFIRMED");
        slotRepository.save(newSlot);

        CounsellingAppointment newAppointment = new CounsellingAppointment();
        newAppointment.setSlot(newSlot);
        newAppointment.setStudent(oldAppointment.getStudent());
        newAppointment.setCounsellor(oldAppointment.getCounsellor());
        newAppointment.setAssignedBy(oldAppointment.getAssignedBy());
        newAppointment.setStatus("CONFIRMED");
        newAppointment.setStudentReason(oldAppointment.getStudentReason());

        // Generate new meeting link
        String meetLink = meetingLinkService.generateMeetLink(newAppointment);
        newAppointment.setMeetingLink(meetLink);
        newAppointment.setMeetingLinkSource(meetLink != null ? "AUTO" : "MANUAL");

        newAppointment = appointmentRepository.save(newAppointment);

        // Notify student
        notificationService.sendRescheduleEmail(oldAppointment, newAppointment);
        notificationService.createInAppNotification(
            oldAppointment.getStudent().getUser(), "RESCHEDULED",
            "Session Rescheduled",
            "Your session has been moved to " + newSlot.getDate() + " at " + newSlot.getStartTime(),
            newAppointment.getId(), "APPOINTMENT"
        );

        // Audit both
        auditLogService.logSimple(oldAppointment, "RESCHEDULED", counsellorUser, "Rescheduled to appointment " + newAppointment.getId());
        auditLogService.logSimple(newAppointment, "CREATED", counsellorUser, "Rescheduled from appointment " + oldAppointment.getId());

        return newAppointment;
    }
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /home/kccsw/Projects/career-nine/spring-social && mvn compile -q 2>&1 | tail -5`
Expected: May fail because `MeetingLinkService` doesn't exist yet — that's expected. Proceed to Task 10.

- [ ] **Step 4: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add spring-social/src/main/java/com/kccitm/api/service/counselling/BookingService.java spring-social/src/main/java/com/kccitm/api/service/counselling/AppointmentService.java
git commit -m "feat(counselling): add BookingService and AppointmentService with 4hr cancellation rule"
```

---

### Task 10: MeetingLinkService, SessionNotesService, ReminderSchedulerService

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/counselling/MeetingLinkService.java`
- Create: `spring-social/src/main/java/com/kccitm/api/service/counselling/SessionNotesService.java`
- Create: `spring-social/src/main/java/com/kccitm/api/service/counselling/ReminderSchedulerService.java`

- [ ] **Step 1: Create MeetingLinkService**

Since the project doesn't have Google Calendar API integration yet, this service will start with a placeholder UUID-based link and can be enhanced later with Google Calendar API.

```java
package com.kccitm.api.service.counselling;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class MeetingLinkService {

    private static final Logger logger = LoggerFactory.getLogger(MeetingLinkService.class);

    /**
     * Generates a meeting link for the appointment.
     * Currently generates a placeholder Google Meet-style link.
     * TODO: Integrate with Google Calendar API when calendar scope is added to OAuth2 config.
     *
     * To integrate: add google-api-services-calendar dependency to pom.xml,
     * add https://www.googleapis.com/auth/calendar scope to application.yml,
     * and use Calendar.Events.insert() to create a calendar event with conferenceData.
     */
    public String generateMeetLink(CounsellingAppointment appointment) {
        try {
            // Generate a unique meeting room identifier
            String roomId = UUID.randomUUID().toString().substring(0, 12).replaceAll("-", "");
            String formattedRoom = roomId.substring(0, 3) + "-" + roomId.substring(3, 7) + "-" + roomId.substring(7);
            String meetLink = "https://meet.google.com/" + formattedRoom;
            logger.info("Generated meeting link for appointment {}: {}", appointment.getId(), meetLink);
            return meetLink;
        } catch (Exception e) {
            logger.error("Failed to generate meeting link for appointment {}: {}", appointment.getId(), e.getMessage());
            return null;
        }
    }

    /**
     * Sets a manual meeting link (Zoom, Teams, custom).
     */
    public void setManualLink(CounsellingAppointment appointment, String link) {
        appointment.setMeetingLink(link);
        appointment.setMeetingLinkSource("MANUAL");
    }
}
```

- [ ] **Step 2: Create SessionNotesService**

```java
package com.kccitm.api.service.counselling;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.SessionNotes;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.repository.Career9.counselling.SessionNotesRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.transaction.Transactional;
import java.util.Optional;

@Service
public class SessionNotesService {

    private static final Logger logger = LoggerFactory.getLogger(SessionNotesService.class);

    @Autowired
    private SessionNotesRepository sessionNotesRepository;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private AuditLogService auditLogService;

    @Transactional
    public SessionNotes create(SessionNotes notes, User counsellorUser) {
        CounsellingAppointment appointment = notes.getAppointment();

        // Mark appointment as completed
        appointment.setStatus("COMPLETED");
        appointment.getSlot().setStatus("COMPLETED");
        slotRepository.save(appointment.getSlot());
        appointmentRepository.save(appointment);

        SessionNotes saved = sessionNotesRepository.save(notes);

        // Notify student
        notificationService.sendSessionCompleteEmail(appointment);
        notificationService.createInAppNotification(
            appointment.getStudent().getUser(), "SESSION_COMPLETE",
            "Session Notes Available",
            "Your counsellor has added remarks for your session on " + appointment.getSlot().getDate(),
            appointment.getId(), "APPOINTMENT"
        );

        auditLogService.logSimple(appointment, "NOTES_ADDED", counsellorUser, "Counsellor added session notes");

        logger.info("Session notes created for appointment {}", appointment.getId());
        return saved;
    }

    public Optional<SessionNotes> getByAppointmentId(Long appointmentId) {
        return sessionNotesRepository.findByAppointmentId(appointmentId);
    }

    /**
     * Returns notes with private_notes filtered out (for student access).
     */
    public Optional<SessionNotes> getByAppointmentIdForStudent(Long appointmentId) {
        Optional<SessionNotes> notes = sessionNotesRepository.findByAppointmentId(appointmentId);
        notes.ifPresent(n -> n.setPrivateNotes(null));
        return notes;
    }

    public SessionNotes update(Long id, SessionNotes updated) {
        SessionNotes existing = sessionNotesRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Session notes not found: " + id));

        if (updated.getKeyDiscussionPoints() != null) existing.setKeyDiscussionPoints(updated.getKeyDiscussionPoints());
        if (updated.getActionItems() != null) existing.setActionItems(updated.getActionItems());
        if (updated.getRecommendedNextSession() != null) existing.setRecommendedNextSession(updated.getRecommendedNextSession());
        if (updated.getFollowupRequired() != null) existing.setFollowupRequired(updated.getFollowupRequired());
        if (updated.getPublicRemarks() != null) existing.setPublicRemarks(updated.getPublicRemarks());
        if (updated.getPrivateNotes() != null) existing.setPrivateNotes(updated.getPrivateNotes());

        return sessionNotesRepository.save(existing);
    }
}
```

- [ ] **Step 3: Create ReminderSchedulerService**

```java
package com.kccitm.api.service.counselling;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Service
public class ReminderSchedulerService {

    private static final Logger logger = LoggerFactory.getLogger(ReminderSchedulerService.class);

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Scheduled(cron = "0 0 * * * *") // Every hour
    public void sendReminders() {
        logger.info("Running reminder scheduler...");
        send24hReminders();
        send1hReminders();
    }

    private void send24hReminders() {
        LocalDate targetDate = LocalDate.now().plusDays(1);
        List<CounsellingAppointment> appointments = appointmentRepository.findNeedingReminder24h(targetDate);

        for (CounsellingAppointment appointment : appointments) {
            try {
                notificationService.sendReminderEmail(appointment, "Tomorrow");

                // In-app notifications
                notificationService.createInAppNotification(
                    appointment.getStudent().getUser(), "REMINDER_24H",
                    "Session Tomorrow",
                    "Your counselling session is tomorrow at " + appointment.getSlot().getStartTime(),
                    appointment.getId(), "APPOINTMENT"
                );
                if (appointment.getCounsellor() != null && appointment.getCounsellor().getUser() != null) {
                    notificationService.createInAppNotification(
                        appointment.getCounsellor().getUser(), "REMINDER_24H",
                        "Session Tomorrow",
                        "You have a counselling session tomorrow at " + appointment.getSlot().getStartTime(),
                        appointment.getId(), "APPOINTMENT"
                    );
                }

                appointment.setReminder24hSent(true);
                appointmentRepository.save(appointment);
                logger.info("24h reminder sent for appointment {}", appointment.getId());
            } catch (Exception e) {
                logger.error("Failed to send 24h reminder for appointment {}: {}", appointment.getId(), e.getMessage());
            }
        }
    }

    private void send1hReminders() {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();
        LocalTime oneHourLater = now.plusHours(1);

        // Find appointments starting within the next hour
        List<CounsellingAppointment> appointments = appointmentRepository.findNeedingReminder1h(today, now, oneHourLater);

        for (CounsellingAppointment appointment : appointments) {
            try {
                notificationService.sendReminderEmail(appointment, "in 1 Hour");

                notificationService.createInAppNotification(
                    appointment.getStudent().getUser(), "REMINDER_1H",
                    "Session in 1 Hour",
                    "Your counselling session starts in 1 hour at " + appointment.getSlot().getStartTime(),
                    appointment.getId(), "APPOINTMENT"
                );
                if (appointment.getCounsellor() != null && appointment.getCounsellor().getUser() != null) {
                    notificationService.createInAppNotification(
                        appointment.getCounsellor().getUser(), "REMINDER_1H",
                        "Session in 1 Hour",
                        "Your counselling session starts in 1 hour at " + appointment.getSlot().getStartTime(),
                        appointment.getId(), "APPOINTMENT"
                    );
                }

                appointment.setReminder1hSent(true);
                appointmentRepository.save(appointment);
                logger.info("1h reminder sent for appointment {}", appointment.getId());
            } catch (Exception e) {
                logger.error("Failed to send 1h reminder for appointment {}: {}", appointment.getId(), e.getMessage());
            }
        }
    }
}
```

- [ ] **Step 4: Verify full backend compilation**

Run: `cd /home/kccsw/Projects/career-nine/spring-social && mvn compile -q 2>&1 | tail -10`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add spring-social/src/main/java/com/kccitm/api/service/counselling/MeetingLinkService.java spring-social/src/main/java/com/kccitm/api/service/counselling/SessionNotesService.java spring-social/src/main/java/com/kccitm/api/service/counselling/ReminderSchedulerService.java
git commit -m "feat(counselling): add MeetingLinkService, SessionNotesService, and ReminderSchedulerService"
```

---

## Phase 3: Backend Controllers

### Task 11: CounsellorController & AvailabilityTemplateController

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/CounsellorController.java`
- Create: `spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/AvailabilityTemplateController.java`

- [ ] **Step 1: Create CounsellorController**

```java
package com.kccitm.api.controller.career9.counselling;

import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.service.counselling.CounsellorService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/counsellor")
public class CounsellorController {

    private static final Logger logger = LoggerFactory.getLogger(CounsellorController.class);

    @Autowired
    private CounsellorService counsellorService;

    @PostMapping("/create")
    public ResponseEntity<Counsellor> create(@RequestBody Counsellor counsellor) {
        return ResponseEntity.ok(counsellorService.create(counsellor));
    }

    @GetMapping("/getAll")
    public ResponseEntity<List<Counsellor>> getAll() {
        return ResponseEntity.ok(counsellorService.getAll());
    }

    @GetMapping("/getActive")
    public ResponseEntity<List<Counsellor>> getActive() {
        return ResponseEntity.ok(counsellorService.getAllActive());
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<Counsellor> getById(@PathVariable Long id) {
        return counsellorService.getById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/get/by-user/{userId}")
    public ResponseEntity<Counsellor> getByUserId(@PathVariable Long userId) {
        return counsellorService.getByUserId(userId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<Counsellor> update(@PathVariable Long id, @RequestBody Counsellor counsellor) {
        return ResponseEntity.ok(counsellorService.update(id, counsellor));
    }

    @PutMapping("/toggle-active/{id}")
    public ResponseEntity<Counsellor> toggleActive(@PathVariable Long id) {
        return ResponseEntity.ok(counsellorService.toggleActive(id));
    }
}
```

- [ ] **Step 2: Create AvailabilityTemplateController**

```java
package com.kccitm.api.controller.career9.counselling;

import com.kccitm.api.model.career9.counselling.AvailabilityTemplate;
import com.kccitm.api.repository.Career9.counselling.AvailabilityTemplateRepository;
import com.kccitm.api.service.counselling.SlotMaterializationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/availability-template")
public class AvailabilityTemplateController {

    private static final Logger logger = LoggerFactory.getLogger(AvailabilityTemplateController.class);

    @Autowired
    private AvailabilityTemplateRepository templateRepository;

    @Autowired
    private SlotMaterializationService materializationService;

    @PostMapping("/create")
    public ResponseEntity<AvailabilityTemplate> create(@RequestBody AvailabilityTemplate template) {
        AvailabilityTemplate saved = templateRepository.save(template);
        // Immediately materialize slots for this counsellor
        int slotsCreated = materializationService.materializeSlotsForCounsellor(saved.getCounsellor().getId());
        logger.info("Template created, {} slots materialized", slotsCreated);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/get/by-counsellor/{counsellorId}")
    public ResponseEntity<List<AvailabilityTemplate>> getByCounsellor(@PathVariable Long counsellorId) {
        return ResponseEntity.ok(templateRepository.findByCounsellorId(counsellorId));
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<AvailabilityTemplate> update(@PathVariable Long id, @RequestBody AvailabilityTemplate updated) {
        AvailabilityTemplate existing = templateRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Template not found: " + id));

        if (updated.getDayOfWeek() != null) existing.setDayOfWeek(updated.getDayOfWeek());
        if (updated.getStartTime() != null) existing.setStartTime(updated.getStartTime());
        if (updated.getEndTime() != null) existing.setEndTime(updated.getEndTime());
        if (updated.getDefaultSlotDuration() != null) existing.setDefaultSlotDuration(updated.getDefaultSlotDuration());

        return ResponseEntity.ok(templateRepository.save(existing));
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        templateRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/toggle-active/{id}")
    public ResponseEntity<AvailabilityTemplate> toggleActive(@PathVariable Long id) {
        AvailabilityTemplate template = templateRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Template not found: " + id));
        template.setIsActive(!template.getIsActive());
        return ResponseEntity.ok(templateRepository.save(template));
    }
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /home/kccsw/Projects/career-nine/spring-social && mvn compile -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/CounsellorController.java spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/AvailabilityTemplateController.java
git commit -m "feat(counselling): add CounsellorController and AvailabilityTemplateController"
```

---

### Task 12: CounsellingSlotController & CounsellingAppointmentController

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/CounsellingSlotController.java`
- Create: `spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/CounsellingAppointmentController.java`

- [ ] **Step 1: Create CounsellingSlotController**

```java
package com.kccitm.api.controller.career9.counselling;

import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.service.counselling.BookingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/counselling-slot")
public class CounsellingSlotController {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingSlotController.class);

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private BookingService bookingService;

    @GetMapping("/available")
    public ResponseEntity<List<CounsellingSlot>> getAvailable(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week) {
        LocalDate weekStart = (week != null) ? week : LocalDate.now();
        return ResponseEntity.ok(bookingService.getAvailableSlots(weekStart));
    }

    @PostMapping("/create-manual")
    public ResponseEntity<CounsellingSlot> createManual(@RequestBody CounsellingSlot slot) {
        slot.setIsManuallyCreated(true);
        slot.setStatus("AVAILABLE");
        slot.setIsBlocked(false);
        return ResponseEntity.ok(slotRepository.save(slot));
    }

    @PostMapping("/block-date")
    public ResponseEntity<CounsellingSlot> blockDate(@RequestBody CounsellingSlot slot) {
        slot.setIsBlocked(true);
        slot.setStatus("CANCELLED");
        slot.setIsManuallyCreated(true);
        return ResponseEntity.ok(slotRepository.save(slot));
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        CounsellingSlot slot = slotRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Slot not found: " + id));
        if (!"AVAILABLE".equals(slot.getStatus()) && !slot.getIsBlocked()) {
            return ResponseEntity.badRequest().build();
        }
        slotRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/by-counsellor/{counsellorId}")
    public ResponseEntity<List<CounsellingSlot>> getByCounsellor(
            @PathVariable Long counsellorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        if (start != null && end != null) {
            return ResponseEntity.ok(slotRepository.findByCounsellorIdAndDateBetween(counsellorId, start, end));
        }
        return ResponseEntity.ok(slotRepository.findByCounsellorId(counsellorId));
    }
}
```

- [ ] **Step 2: Create CounsellingAppointmentController**

```java
package com.kccitm.api.controller.career9.counselling;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.security.CurrentUser;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.service.counselling.AppointmentService;
import com.kccitm.api.service.counselling.BookingService;
import com.kccitm.api.service.counselling.MeetingLinkService;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/counselling-appointment")
public class CounsellingAppointmentController {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingAppointmentController.class);

    @Autowired
    private BookingService bookingService;

    @Autowired
    private AppointmentService appointmentService;

    @Autowired
    private MeetingLinkService meetingLinkService;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/book")
    public ResponseEntity<?> book(@RequestBody Map<String, Object> request) {
        try {
            Long slotId = Long.valueOf(request.get("slotId").toString());
            Long studentId = Long.valueOf(request.get("studentId").toString());
            String reason = (String) request.get("reason");

            UserStudent student = userStudentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found: " + studentId));

            CounsellingAppointment appointment = bookingService.bookSlot(slotId, student, reason);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
    }

    @GetMapping("/queue")
    public ResponseEntity<List<CounsellingAppointment>> getQueue() {
        return ResponseEntity.ok(appointmentService.getPendingQueue());
    }

    @PutMapping("/assign/{id}")
    public ResponseEntity<?> assign(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            Long counsellorId = Long.valueOf(request.get("counsellorId").toString());
            Long adminUserId = Long.valueOf(request.get("adminUserId").toString());
            User admin = userRepository.findById(adminUserId)
                .orElseThrow(() -> new RuntimeException("Admin user not found"));
            return ResponseEntity.ok(appointmentService.assign(id, counsellorId, admin));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/confirm/{id}")
    public ResponseEntity<?> confirm(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            Long userId = Long.valueOf(request.get("userId").toString());
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
            return ResponseEntity.ok(appointmentService.confirm(id, user));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/decline/{id}")
    public ResponseEntity<?> decline(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            Long userId = Long.valueOf(request.get("userId").toString());
            String reason = (String) request.getOrDefault("reason", "");
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
            return ResponseEntity.ok(appointmentService.decline(id, user, reason));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/cancel/{id}")
    public ResponseEntity<?> cancel(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            Long userId = Long.valueOf(request.get("userId").toString());
            String reason = (String) request.getOrDefault("reason", "");
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
            return ResponseEntity.ok(appointmentService.cancel(id, user, reason));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/reschedule/{id}")
    public ResponseEntity<?> reschedule(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            Long newSlotId = Long.valueOf(request.get("newSlotId").toString());
            Long userId = Long.valueOf(request.get("userId").toString());
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
            return ResponseEntity.ok(appointmentService.reschedule(id, newSlotId, user));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/set-meeting-link/{id}")
    public ResponseEntity<?> setMeetingLink(@PathVariable Long id, @RequestBody Map<String, String> request) {
        CounsellingAppointment appointment = appointmentRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Appointment not found"));
        meetingLinkService.setManualLink(appointment, request.get("meetingLink"));
        return ResponseEntity.ok(appointmentRepository.save(appointment));
    }

    @GetMapping("/by-student/{studentId}")
    public ResponseEntity<List<CounsellingAppointment>> getByStudent(@PathVariable Long studentId) {
        return ResponseEntity.ok(appointmentService.getByStudent(studentId));
    }

    @GetMapping("/by-counsellor/{counsellorId}")
    public ResponseEntity<List<CounsellingAppointment>> getByCounsellor(@PathVariable Long counsellorId) {
        return ResponseEntity.ok(appointmentService.getByCounsellor(counsellorId));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(appointmentService.getStats());
    }
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /home/kccsw/Projects/career-nine/spring-social && mvn compile -q 2>&1 | tail -10`
Expected: BUILD SUCCESS (fix any import issues with UserStudentRepository or UserRepository — check existing package paths)

- [ ] **Step 4: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/CounsellingSlotController.java spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/CounsellingAppointmentController.java
git commit -m "feat(counselling): add CounsellingSlotController and CounsellingAppointmentController"
```

---

### Task 13: SessionNotesController & NotificationController

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/SessionNotesController.java`
- Create: `spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/NotificationController.java`

- [ ] **Step 1: Create SessionNotesController**

```java
package com.kccitm.api.controller.career9.counselling;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.SessionNotes;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.service.counselling.SessionNotesService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/session-notes")
public class SessionNotesController {

    private static final Logger logger = LoggerFactory.getLogger(SessionNotesController.class);

    @Autowired
    private SessionNotesService sessionNotesService;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/create")
    public ResponseEntity<?> create(@RequestBody SessionNotes notes, @RequestParam Long userId) {
        try {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
            return ResponseEntity.ok(sessionNotesService.create(notes, user));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/get/{appointmentId}")
    public ResponseEntity<?> getByAppointment(@PathVariable Long appointmentId,
                                                @RequestParam(defaultValue = "false") boolean isStudent) {
        if (isStudent) {
            return sessionNotesService.getByAppointmentIdForStudent(appointmentId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
        }
        return sessionNotesService.getByAppointmentId(appointmentId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<SessionNotes> update(@PathVariable Long id, @RequestBody SessionNotes notes) {
        return ResponseEntity.ok(sessionNotesService.update(id, notes));
    }
}
```

- [ ] **Step 2: Create NotificationController**

```java
package com.kccitm.api.controller.career9.counselling;

import com.kccitm.api.model.career9.counselling.Notification;
import com.kccitm.api.service.counselling.CounsellingNotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private CounsellingNotificationService notificationService;

    @GetMapping("/my")
    public ResponseEntity<List<Notification>> getMyNotifications(@RequestParam Long userId) {
        return ResponseEntity.ok(notificationService.getNotificationsForUser(userId));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@RequestParam Long userId) {
        return ResponseEntity.ok(Map.of("count", notificationService.getUnreadCount(userId)));
    }

    @PutMapping("/mark-read/{id}")
    public ResponseEntity<Void> markRead(@PathVariable Long id) {
        notificationService.markAsRead(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/mark-all-read")
    public ResponseEntity<Void> markAllRead(@RequestParam Long userId) {
        notificationService.markAllRead(userId);
        return ResponseEntity.ok().build();
    }
}
```

- [ ] **Step 3: Verify full backend compilation**

Run: `cd /home/kccsw/Projects/career-nine/spring-social && mvn compile -q 2>&1 | tail -10`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/SessionNotesController.java spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/NotificationController.java
git commit -m "feat(counselling): add SessionNotesController and NotificationController"
```

---

## Phase 4: Frontend API Layer & Shared Components

### Task 14: Frontend API Files

**Files:**
- Create: `react-social/src/app/pages/Counselling/API/CounsellorAPI.ts`
- Create: `react-social/src/app/pages/Counselling/API/SlotAPI.ts`
- Create: `react-social/src/app/pages/Counselling/API/AppointmentAPI.ts`
- Create: `react-social/src/app/pages/Counselling/API/SessionNotesAPI.ts`
- Create: `react-social/src/app/pages/Counselling/API/NotificationAPI.ts`

- [ ] **Step 1: Create all API files**

**CounsellorAPI.ts:**
```typescript
import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL

const COUNSELLOR_BASE = `${API_URL}/api/counsellor`

export function createCounsellor(data: any) {
  return axios.post(`${COUNSELLOR_BASE}/create`, data)
}

export function getAllCounsellors() {
  return axios.get(`${COUNSELLOR_BASE}/getAll`)
}

export function getActiveCounsellors() {
  return axios.get(`${COUNSELLOR_BASE}/getActive`)
}

export function getCounsellorById(id: number) {
  return axios.get(`${COUNSELLOR_BASE}/get/${id}`)
}

export function getCounsellorByUserId(userId: number) {
  return axios.get(`${COUNSELLOR_BASE}/get/by-user/${userId}`)
}

export function updateCounsellor(id: number, data: any) {
  return axios.put(`${COUNSELLOR_BASE}/update/${id}`, data)
}

export function toggleCounsellorActive(id: number) {
  return axios.put(`${COUNSELLOR_BASE}/toggle-active/${id}`)
}
```

**SlotAPI.ts:**
```typescript
import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL

const SLOT_BASE = `${API_URL}/api/counselling-slot`

export function getAvailableSlots(week?: string) {
  const params = week ? `?week=${week}` : ''
  return axios.get(`${SLOT_BASE}/available${params}`)
}

export function createManualSlot(data: any) {
  return axios.post(`${SLOT_BASE}/create-manual`, data)
}

export function blockDate(data: any) {
  return axios.post(`${SLOT_BASE}/block-date`, data)
}

export function deleteSlot(id: number) {
  return axios.delete(`${SLOT_BASE}/delete/${id}`)
}

export function getSlotsByCounsellor(counsellorId: number, start?: string, end?: string) {
  let params = ''
  if (start && end) params = `?start=${start}&end=${end}`
  return axios.get(`${SLOT_BASE}/by-counsellor/${counsellorId}${params}`)
}
```

**AppointmentAPI.ts:**
```typescript
import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL

const APPT_BASE = `${API_URL}/api/counselling-appointment`

export function bookSlot(slotId: number, studentId: number, reason: string) {
  return axios.post(`${APPT_BASE}/book`, { slotId, studentId, reason })
}

export function getQueue() {
  return axios.get(`${APPT_BASE}/queue`)
}

export function assignCounsellor(appointmentId: number, counsellorId: number, adminUserId: number) {
  return axios.put(`${APPT_BASE}/assign/${appointmentId}`, { counsellorId, adminUserId })
}

export function confirmAppointment(appointmentId: number, userId: number) {
  return axios.put(`${APPT_BASE}/confirm/${appointmentId}`, { userId })
}

export function declineAppointment(appointmentId: number, userId: number, reason: string) {
  return axios.put(`${APPT_BASE}/decline/${appointmentId}`, { userId, reason })
}

export function cancelAppointment(appointmentId: number, userId: number, reason: string) {
  return axios.put(`${APPT_BASE}/cancel/${appointmentId}`, { userId, reason })
}

export function rescheduleAppointment(appointmentId: number, newSlotId: number, userId: number) {
  return axios.put(`${APPT_BASE}/reschedule/${appointmentId}`, { newSlotId, userId })
}

export function setMeetingLink(appointmentId: number, meetingLink: string) {
  return axios.put(`${APPT_BASE}/set-meeting-link/${appointmentId}`, { meetingLink })
}

export function getStudentAppointments(studentId: number) {
  return axios.get(`${APPT_BASE}/by-student/${studentId}`)
}

export function getCounsellorAppointments(counsellorId: number) {
  return axios.get(`${APPT_BASE}/by-counsellor/${counsellorId}`)
}

export function getAppointmentStats() {
  return axios.get(`${APPT_BASE}/stats`)
}
```

**SessionNotesAPI.ts:**
```typescript
import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL

const NOTES_BASE = `${API_URL}/api/session-notes`

export function createSessionNotes(data: any, userId: number) {
  return axios.post(`${NOTES_BASE}/create?userId=${userId}`, data)
}

export function getSessionNotes(appointmentId: number, isStudent: boolean = false) {
  return axios.get(`${NOTES_BASE}/get/${appointmentId}?isStudent=${isStudent}`)
}

export function updateSessionNotes(id: number, data: any) {
  return axios.put(`${NOTES_BASE}/update/${id}`, data)
}
```

**NotificationAPI.ts:**
```typescript
import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL

const NOTIF_BASE = `${API_URL}/api/notifications`

export function getMyNotifications(userId: number) {
  return axios.get(`${NOTIF_BASE}/my?userId=${userId}`)
}

export function getUnreadCount(userId: number) {
  return axios.get(`${NOTIF_BASE}/unread-count?userId=${userId}`)
}

export function markNotificationRead(id: number) {
  return axios.put(`${NOTIF_BASE}/mark-read/${id}`)
}

export function markAllNotificationsRead(userId: number) {
  return axios.put(`${NOTIF_BASE}/mark-all-read?userId=${userId}`)
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add react-social/src/app/pages/Counselling/API/
git commit -m "feat(counselling): add frontend API layer for all counselling endpoints"
```

---

### Task 15: Shared Components (StatusBadge, CountdownTimer, NotificationBell) & CSS

**Files:**
- Create: `react-social/src/app/pages/Counselling/shared/StatusBadge.tsx`
- Create: `react-social/src/app/pages/Counselling/shared/CountdownTimer.tsx`
- Create: `react-social/src/app/pages/Counselling/shared/NotificationBell.tsx`
- Create: `react-social/src/app/pages/Counselling/Counselling.css`

- [ ] **Step 1: Create Counselling.css**

Uses existing `--sp-*` CSS variables from StudentPortal.css.

```css
/* Counselling Module Styles — uses existing --sp-* variables */

.cl-card {
  background: var(--sp-card, #fff);
  border: 1px solid var(--sp-border, #D1E5DF);
  border-radius: var(--sp-radius, 12px);
  padding: 20px;
  margin-bottom: 16px;
}

.cl-card-accent {
  border-left: 4px solid var(--sp-primary, #0C6B5A);
}

.cl-card-warning {
  border-left: 4px solid var(--sp-accent, #F59E0B);
}

.cl-card-info {
  border-left: 4px solid var(--sp-info, #3B82F6);
}

.cl-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--sp-border, #D1E5DF);
  margin-bottom: 20px;
}

.cl-tab {
  padding: 10px 20px;
  color: var(--sp-muted, #5C7A72);
  font-size: 14px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}

.cl-tab.active {
  color: var(--sp-primary, #0C6B5A);
  border-bottom-color: var(--sp-primary, #0C6B5A);
  font-weight: 600;
}

.cl-badge {
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  display: inline-block;
}

.cl-badge-confirmed { background: var(--sp-primary-light, #E0F2EE); color: #084A3E; }
.cl-badge-pending { background: #fef3c7; color: #92400e; }
.cl-badge-assigned { background: #dbeafe; color: #1d4ed8; }
.cl-badge-completed { background: #f0fdf4; color: #15803d; }
.cl-badge-cancelled { background: #fee2e2; color: #dc2626; }
.cl-badge-rescheduled { background: #fef3c7; color: #b45309; }
.cl-badge-needs-notes { background: #fef3c7; color: #b45309; }

.cl-btn-primary {
  background: var(--sp-primary, #0C6B5A);
  color: white;
  border: none;
  padding: 8px 18px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}

.cl-btn-primary:hover {
  background: var(--sp-primary-dark, #084A3E);
}

.cl-btn-outline {
  background: transparent;
  border: 1px solid var(--sp-border, #D1E5DF);
  color: var(--sp-muted, #5C7A72);
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}

.cl-btn-danger {
  background: transparent;
  border: 1px solid var(--sp-danger, #EF4444);
  color: var(--sp-danger, #EF4444);
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.cl-btn-warning {
  background: transparent;
  border: 1px solid var(--sp-accent, #F59E0B);
  color: #b45309;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.cl-btn-blue {
  background: var(--sp-info, #3B82F6);
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.cl-slot-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.cl-slot-day {
  background: var(--sp-bg, #F2F7F5);
  border-radius: 10px;
  padding: 14px;
  text-align: center;
}

.cl-slot-day-label {
  color: var(--sp-muted, #5C7A72);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0;
}

.cl-slot-day-date {
  color: var(--sp-text, #1A2B28);
  font-weight: 700;
  margin: 4px 0 14px 0;
}

.cl-slot-item {
  background: var(--sp-primary-light, #E0F2EE);
  color: var(--sp-primary, #0C6B5A);
  padding: 7px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
  margin-bottom: 6px;
}

.cl-slot-item:hover {
  background: var(--sp-primary, #0C6B5A);
  color: white;
}

.cl-slot-item.selected {
  background: var(--sp-primary, #0C6B5A);
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(12, 107, 90, 0.3);
}

.cl-stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: white;
  border-bottom: 1px solid var(--sp-border, #D1E5DF);
}

.cl-stat-item {
  padding: 18px;
  text-align: center;
  border-right: 1px solid var(--sp-border, #D1E5DF);
}

.cl-stat-item:last-child {
  border-right: none;
}

.cl-stat-label {
  color: var(--sp-muted, #5C7A72);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.cl-stat-value {
  font-size: 30px;
  font-weight: 700;
  margin: 6px 0 0 0;
}

.cl-notif-bell {
  position: relative;
  cursor: pointer;
}

.cl-notif-badge {
  position: absolute;
  top: -5px;
  right: -7px;
  background: var(--sp-danger, #EF4444);
  color: white;
  font-size: 10px;
  border-radius: 50%;
  width: 17px;
  height: 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.cl-notif-dropdown {
  position: absolute;
  top: 32px;
  right: 0;
  background: white;
  border: 1px solid var(--sp-border, #D1E5DF);
  border-radius: 10px;
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.cl-notif-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.cl-notif-item.unread {
  background: var(--sp-primary-light, #E0F2EE);
}

.cl-notif-item:hover {
  background: var(--sp-bg, #F2F7F5);
}

.cl-availability-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.cl-remarks-box {
  margin-top: 14px;
  padding: 14px;
  background: var(--sp-bg, #F2F7F5);
  border-radius: 8px;
}

.cl-countdown {
  color: var(--sp-primary, #0C6B5A);
  font-size: 26px;
  font-weight: 700;
}

@media (max-width: 768px) {
  .cl-slot-grid { grid-template-columns: repeat(2, 1fr); }
  .cl-availability-grid { grid-template-columns: 1fr; }
  .cl-stats-bar { grid-template-columns: repeat(2, 1fr); }
}
```

- [ ] **Step 2: Create StatusBadge.tsx**

```tsx
import React from 'react'
import '../Counselling.css'

interface StatusBadgeProps {
  status: string
}

const STATUS_CLASS_MAP: Record<string, string> = {
  CONFIRMED: 'cl-badge-confirmed',
  PENDING: 'cl-badge-pending',
  ASSIGNED: 'cl-badge-assigned',
  COMPLETED: 'cl-badge-completed',
  CANCELLED: 'cl-badge-cancelled',
  RESCHEDULED: 'cl-badge-rescheduled',
  NEEDS_NOTES: 'cl-badge-needs-notes',
  AVAILABLE: 'cl-badge-confirmed',
  REQUESTED: 'cl-badge-pending',
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const className = STATUS_CLASS_MAP[status] || 'cl-badge-pending'
  return <span className={`cl-badge ${className}`}>{status}</span>
}

export default StatusBadge
```

- [ ] **Step 3: Create CountdownTimer.tsx**

```tsx
import React, { useState, useEffect } from 'react'
import '../Counselling.css'

interface CountdownTimerProps {
  targetDate: string // ISO date string e.g. "2026-04-10"
  targetTime: string // e.g. "10:00"
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate, targetTime }) => {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const target = new Date(`${targetDate}T${targetTime}`)

    const updateTimer = () => {
      const now = new Date()
      const diff = target.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeLeft('Now')
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`)
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`)
      } else {
        setTimeLeft(`${minutes}m`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [targetDate, targetTime])

  return <span className="cl-countdown">{timeLeft}</span>
}

export default CountdownTimer
```

- [ ] **Step 4: Create NotificationBell.tsx**

```tsx
import React, { useState, useEffect } from 'react'
import { getUnreadCount, getMyNotifications, markNotificationRead, markAllNotificationsRead } from '../API/NotificationAPI'
import '../Counselling.css'

interface NotificationBellProps {
  userId: number
}

const NotificationBell: React.FC<NotificationBellProps> = ({ userId }) => {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000) // Poll every 30 seconds
    return () => clearInterval(interval)
  }, [userId])

  const fetchUnreadCount = () => {
    getUnreadCount(userId).then(res => {
      setUnreadCount(res.data.count)
    }).catch(err => console.error('Failed to fetch unread count', err))
  }

  const handleBellClick = () => {
    if (!showDropdown) {
      getMyNotifications(userId).then(res => {
        setNotifications(res.data)
      }).catch(err => console.error('Failed to fetch notifications', err))
    }
    setShowDropdown(!showDropdown)
  }

  const handleMarkRead = (id: number) => {
    markNotificationRead(id).then(() => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    })
  }

  const handleMarkAllRead = () => {
    markAllNotificationsRead(userId).then(() => {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    })
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="cl-notif-bell">
      <div onClick={handleBellClick}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5C7A72" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="cl-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </div>

      {showDropdown && (
        <div className="cl-notif-dropdown">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ color: '#1A2B28' }}>Notifications</strong>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', color: '#0C6B5A', fontSize: '12px', cursor: 'pointer' }}>
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No notifications</div>
          )}
          {notifications.slice(0, 20).map(n => (
            <div key={n.id} className={`cl-notif-item ${n.isRead ? '' : 'unread'}`} onClick={() => handleMarkRead(n.id)}>
              <p style={{ margin: '0 0 4px 0', fontWeight: n.isRead ? 400 : 600, color: '#1A2B28', fontSize: '13px' }}>{n.title}</p>
              <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>{n.message}</p>
              <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '11px' }}>{formatTime(n.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
```

- [ ] **Step 5: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add react-social/src/app/pages/Counselling/Counselling.css react-social/src/app/pages/Counselling/shared/
git commit -m "feat(counselling): add shared components (StatusBadge, CountdownTimer, NotificationBell) and CSS"
```

---

## Phase 5: Frontend Student Pages

### Task 16: StudentCounsellingPage & SlotBookingPage

**Files:**
- Create: `react-social/src/app/pages/Counselling/student/StudentCounsellingPage.tsx`
- Create: `react-social/src/app/pages/Counselling/student/SlotBookingPage.tsx`
- Create: `react-social/src/app/pages/Counselling/student/components/UpcomingSessionCard.tsx`
- Create: `react-social/src/app/pages/Counselling/student/components/PastSessionCard.tsx`
- Create: `react-social/src/app/pages/Counselling/student/components/SlotGrid.tsx`
- Create: `react-social/src/app/pages/Counselling/student/components/BookingForm.tsx`

This task is large but the components are simple — they follow the existing StudentPortal patterns with `useState`, `useEffect`, and CSS classes from `Counselling.css`. Each component renders data fetched from the API layer created in Task 14.

- [ ] **Step 1: Create all student components**

Create the files following the patterns shown in the mockups (Section 3 of the design). Each component uses:
- `useState` for local state
- `useEffect` for API calls
- CSS classes from `Counselling.css` (prefixed `cl-*`)
- Existing `--sp-*` CSS variables

Key component responsibilities:
- **StudentCounsellingPage**: Fetches student appointments, renders tabs (Upcoming / Past / Pending), delegates to child components
- **UpcomingSessionCard**: Shows confirmed session with countdown, meeting link, cancel button
- **PastSessionCard**: Shows completed session with "View Remarks" expand/collapse
- **SlotBookingPage**: Week-view calendar with SlotGrid and BookingForm
- **SlotGrid**: Renders available slots grouped by day, handles selection
- **BookingForm**: Reason textarea and Book Slot button, calls `bookSlot` API

- [ ] **Step 2: Update BookCounselling.tsx to link to the new page**

Replace the placeholder alert with a `useNavigate` link to `/student/counselling`.

- [ ] **Step 3: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add react-social/src/app/pages/Counselling/student/
git commit -m "feat(counselling): add student counselling page with slot booking"
```

---

## Phase 6: Frontend Counsellor Pages

### Task 17: CounsellorDashboardPage, AvailabilityManagerPage, SessionNotesPage

**Files:**
- Create: `react-social/src/app/pages/Counselling/counsellor/CounsellorDashboardPage.tsx`
- Create: `react-social/src/app/pages/Counselling/counsellor/AvailabilityManagerPage.tsx`
- Create: `react-social/src/app/pages/Counselling/counsellor/SessionNotesPage.tsx`
- Create: `react-social/src/app/pages/Counselling/counsellor/components/ScheduleCard.tsx`
- Create: `react-social/src/app/pages/Counselling/counsellor/components/RecurringTemplateForm.tsx`
- Create: `react-social/src/app/pages/Counselling/counsellor/components/ManualSlotForm.tsx`
- Create: `react-social/src/app/pages/Counselling/counsellor/components/BlockDateForm.tsx`
- Create: `react-social/src/app/pages/Counselling/counsellor/components/SessionNotesForm.tsx`

- [ ] **Step 1: Create all counsellor components**

Key component responsibilities:
- **CounsellorDashboardPage**: Tabs (My Schedule / Availability / Session History / Pending), fetches counsellor appointments
- **ScheduleCard**: Session card with Meet link, reschedule/cancel buttons, "Add Notes" for completed sessions
- **AvailabilityManagerPage**: Two-column layout — recurring templates on left, manual overrides on right
- **RecurringTemplateForm**: Modal/form to add/edit recurring weekly schedule (day, start, end, duration)
- **ManualSlotForm**: Form to add individual extra slots (date, start, end, duration)
- **BlockDateForm**: Form to block a date (date, reason)
- **SessionNotesPage**: Structured form with key discussion points, action items, follow-up, public remarks, private notes
- **SessionNotesForm**: The actual form fields component used by SessionNotesPage

- [ ] **Step 2: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add react-social/src/app/pages/Counselling/counsellor/
git commit -m "feat(counselling): add counsellor dashboard, availability manager, and session notes pages"
```

---

## Phase 7: Frontend Admin Pages

### Task 18: AdminCounsellingQueuePage & CounsellorManagementPage

**Files:**
- Create: `react-social/src/app/pages/Counselling/admin/AdminCounsellingQueuePage.tsx`
- Create: `react-social/src/app/pages/Counselling/admin/CounsellorManagementPage.tsx`
- Create: `react-social/src/app/pages/Counselling/admin/components/RequestQueueTable.tsx`
- Create: `react-social/src/app/pages/Counselling/admin/components/StatsBar.tsx`
- Create: `react-social/src/app/pages/Counselling/admin/components/AssignCounsellorDropdown.tsx`
- Create: `react-social/src/app/pages/Counselling/admin/components/CounsellorForm.tsx`

- [ ] **Step 1: Create all admin components**

Key component responsibilities:
- **AdminCounsellingQueuePage**: Stats bar at top + request queue table below
- **StatsBar**: Four stat cards (Pending, Assigned, Confirmed, This Week) using `cl-stats-bar` CSS
- **RequestQueueTable**: Table with student info, slot details, reason, status badge, assign dropdown + button
- **AssignCounsellorDropdown**: Select dropdown fetching active counsellors, calls `assignCounsellor` API
- **CounsellorManagementPage**: CRUD table for counsellors — create, edit, toggle active
- **CounsellorForm**: Modal form for creating/editing counsellor (name, email, phone, specializations, bio, isExternal)

- [ ] **Step 2: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add react-social/src/app/pages/Counselling/admin/
git commit -m "feat(counselling): add admin counselling queue and counsellor management pages"
```

---

## Phase 8: Routing & Menu Integration

### Task 19: Update StudentRoutes, PrivateRoutes, and AsideMenuMain

**Files:**
- Modify: `react-social/src/app/routing/StudentRoutes.tsx`
- Modify: `react-social/src/app/routing/PrivateRoutes.tsx`
- Modify: `react-social/src/_metronic/layout/components/aside/AsideMenuMain.tsx`
- Modify: `react-social/src/app/pages/StudentDashboard/student-portal/components/BookCounselling.tsx`

- [ ] **Step 1: Update StudentRoutes.tsx**

Add two new routes inside the `StudentAuthGuard` route group:

```tsx
// Add to lazy imports at top
const StudentCounsellingPage = lazy(() => import('../pages/Counselling/student/StudentCounsellingPage'))
const SlotBookingPage = lazy(() => import('../pages/Counselling/student/SlotBookingPage'))

// Add inside <Route element={<StudentAuthGuard />}> block:
<Route path='counselling' element={<StudentCounsellingPage />} />
<Route path='counselling/book' element={<SlotBookingPage />} />
```

- [ ] **Step 2: Update PrivateRoutes.tsx**

Add lazy imports and routes for counsellor and admin pages:

```tsx
// Add to lazy imports
const CounsellorDashboardPage = lazy(() => import('../pages/Counselling/counsellor/CounsellorDashboardPage'))
const AvailabilityManagerPage = lazy(() => import('../pages/Counselling/counsellor/AvailabilityManagerPage'))
const SessionNotesPage = lazy(() => import('../pages/Counselling/counsellor/SessionNotesPage'))
const AdminCounsellingQueuePage = lazy(() => import('../pages/Counselling/admin/AdminCounsellingQueuePage'))
const CounsellorManagementPage = lazy(() => import('../pages/Counselling/admin/CounsellorManagementPage'))

// Add routes (inside the MasterLayout routes)
<Route path='counsellor/dashboard' element={<CounsellorDashboardPage />} />
<Route path='counsellor/availability' element={<AvailabilityManagerPage />} />
<Route path='counsellor/session-notes/:id' element={<SessionNotesPage />} />
<Route path='admin/counselling-queue' element={<AdminCounsellingQueuePage />} />
<Route path='admin/counsellors' element={<CounsellorManagementPage />} />
```

- [ ] **Step 3: Update AsideMenuMain.tsx**

Add counselling menu section with permission checks:

```tsx
// Add permission check
const showCounselling = allowed("/admin/counselling-queue") || allowed("/admin/counsellors") || allowed("/counsellor/*");

// Add menu items (before or after existing sections)
{showCounselling && (
  <>
    <div className='menu-section'>
      <span className='menu-section-text'>Counselling</span>
    </div>
    <AsideMenuItemWithSub to='/counselling' title='Counselling' icon='/media/icons/duotune/general/gen049.svg'>
      {allowed("/admin/counselling-queue") && (
        <AsideMenuItem to='/admin/counselling-queue' title='Request Queue' hasBullet={true} />
      )}
      {allowed("/admin/counsellors") && (
        <AsideMenuItem to='/admin/counsellors' title='Manage Counsellors' hasBullet={true} />
      )}
      {allowed("/counsellor/dashboard") && (
        <AsideMenuItem to='/counsellor/dashboard' title='My Schedule' hasBullet={true} />
      )}
      {allowed("/counsellor/availability") && (
        <AsideMenuItem to='/counsellor/availability' title='My Availability' hasBullet={true} />
      )}
    </AsideMenuItemWithSub>
  </>
)}
```

- [ ] **Step 4: Update BookCounselling.tsx**

Replace the placeholder alerts with actual navigation:

```tsx
// Add at top
import { useNavigate } from 'react-router-dom'

// Inside component
const navigate = useNavigate()

// Replace alert('coming soon') with:
onClick={() => navigate('/student/counselling/book')}

// Replace "Request Appointment" alert with:
onClick={() => navigate('/student/counselling')}
```

- [ ] **Step 5: Commit**

```bash
cd /home/kccsw/Projects/career-nine
git add react-social/src/app/routing/StudentRoutes.tsx react-social/src/app/routing/PrivateRoutes.tsx react-social/src/_metronic/layout/components/aside/AsideMenuMain.tsx react-social/src/app/pages/StudentDashboard/student-portal/components/BookCounselling.tsx
git commit -m "feat(counselling): integrate routing, sidebar menu, and BookCounselling navigation"
```

---

## Phase 9: Final Integration & Verification

### Task 20: End-to-End Verification

- [ ] **Step 1: Start backend and verify entities are created**

Run: `cd /home/kccsw/Projects/career-nine/spring-social && mvn compile -q 2>&1 | tail -5`
Expected: BUILD SUCCESS — Hibernate will auto-create all 7 new tables on startup.

- [ ] **Step 2: Verify all API endpoints exist**

Test the key endpoints manually or with curl:
- `GET /api/counsellor/getAll` — should return empty list
- `GET /api/counselling-slot/available` — should return empty list
- `GET /api/counselling-appointment/stats` — should return zeroes
- `GET /api/notifications/unread-count?userId=1` — should return `{"count": 0}`

- [ ] **Step 3: Verify frontend compiles without TypeScript errors**

Run: `cd /home/kccsw/Projects/career-nine/react-social && npx tsc --noEmit 2>&1 | tail -20`
Fix any TypeScript errors.

- [ ] **Step 4: Final commit**

```bash
cd /home/kccsw/Projects/career-nine
git add -A
git commit -m "feat(counselling): complete counselling scheduling system integration"
```
