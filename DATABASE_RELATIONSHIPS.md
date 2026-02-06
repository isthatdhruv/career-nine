# Database Relationships & Entity Mappings

**Project:** Career-Nine Educational Platform
**Generated:** 2026-02-06
**Total Entities:** 29 tables

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Entity Relationship Diagrams](#entity-relationship-diagrams)
3. [Detailed Entity Mappings](#detailed-entity-mappings)
4. [Join Tables](#join-tables)
5. [Cascade Behaviors](#cascade-behaviors)
6. [Unique Constraints](#unique-constraints)
7. [Quick Reference](#quick-reference)

---

## Overview

This document provides a comprehensive mapping of all database tables, their relationships, foreign keys, and entity mappings for the Career-Nine platform.

### Entity Categories

- **User & Student Management:** 3 entities
- **Assessment System:** 10 entities
- **Questionnaire System:** 5 entities
- **Scoring & Quality Measurement:** 4 entities
- **Career & Tools:** 3 entities
- **Language Support:** 3 entities
- **School Management:** 4 entities

---

## Entity Relationship Diagrams

### Core User & Assessment Flow

```
User (student_user)
  |
  ├──[1:1]──> StudentInfo (student_info)
  |             |
  |             └──[1:N]──> UserStudent (user_student)
  |                           |
  |                           ├──[N:1]──> InstituteDetail (institute_detail_new)
  |                           └──[1:N]──> StudentAssessmentMapping (student_assessment_mapping)
  |                                         |
  |                                         └──[1:N]──> AssessmentRawScore (assessment_raw_score)
  |
  └──[N:M]──> Group (user_group_mapping)
```

### Assessment & Questionnaire System

```
AssessmentTable (assessment_table)
  |
  └──[1:1]──> Questionnaire (Questionire)
                |
                ├──[N:1]──> Tool (tools)
                |             |
                |             └──[N:M]──> MeasuredQualities (measured_qualities)
                |                           |
                |                           └──[1:N]──> MeasuredQualityTypes (measured_quality_types)
                |                                         |
                |                                         └──[N:M]──> Career (careers)
                |
                ├──[1:N]──> QuestionnaireSection (Questionnaire_Section)
                |             |
                |             ├──[N:1]──> QuestionSection (question_sections)
                |             |             |
                |             |             └──[1:N]──> AssessmentQuestions (assessment_questions)
                |             |                           |
                |             |                           └──[1:N]──> AssessmentQuestionOptions
                |             |                                         |
                |             |                                         ├──[1:1]──> GameTable (game_table)
                |             |                                         └──[1:N]──> OptionScoreBasedOnMEasuredQualityTypes
                |             |
                |             ├──[1:N]──> QuestionnaireSectionInstruction
                |             └──[1:N]──> QuestionnaireQuestion (Questionnaire_Question)
                |
                └──[1:N]──> QuestionnaireLanguage (questionnaire_language)
                              |
                              └──[N:1]──> LanguagesSupported (Language_Table)
```

### Multi-Language Support System

```
AssessmentQuestions (assessment_questions)
  |
  └──[1:N]──> LanguageQuestion (language_question)
                |
                ├──[N:1]──> LanguagesSupported (Language_Table)
                └──[1:N]──> LanguageOption (language_option)
                              |
                              ├──[N:1]──> LanguagesSupported
                              └──[N:1]──> AssessmentQuestionOptions
```

### School Hierarchy

```
InstituteDetail (institute_detail_new)
  |
  ├──[1:N]──> SchoolSession (school_session)
  |             |
  |             └──[1:N]──> SchoolClasses (school_classes)
  |                           |
  |                           └──[1:N]──> SchoolSections (school_sections)
  |
  ├──[1:N]──> ContactPerson
  └──[1:N]──> InstituteCourse
```

---

## Detailed Entity Mappings

### 1. USER ENTITY

**Table:** `student_user`
**Primary Key:** `id` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `student_info_id` | student_info | OneToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @OneToOne | StudentInfo | `student_info_id` | - | LAZY |
| @OneToMany | UserRoleGroupMapping | `user` | - | EAGER |
| @ManyToMany | Group | Join Table: `user_group_mapping` | - | LAZY |

#### Important Notes
- Central authentication entity
- Links to student profile via OneToOne
- Supports role-based access control via UserRoleGroupMapping
- Group membership via many-to-many mapping

---

### 2. STUDENTINFO ENTITY

**Table:** `student_info`
**Primary Key:** `id` (Integer, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `user_id` | student_user | OneToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @OneToOne | User | `user_id` | ALL | LAZY |

#### Important Notes
- Stores student demographic and academic information
- Cascades ALL operations to User (bidirectional sync)
- Contains `institute_id` as simple column (no FK relationship)

---

### 3. USERSTUDENT ENTITY

**Table:** `user_student`
**Primary Key:** `user_student_id` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `institute_id` | institute_detail_new | ManyToOne |
| `id` | student_info | ManyToOne |
| `user_id` | - | Simple column (no FK) |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | InstituteDetail | `institute_id` → `institute_code` | - | EAGER |
| @ManyToOne | StudentInfo | `id` → `id` | - | LAZY |

#### Important Notes
- Links students to their institute
- Referenced column for InstituteDetail is `institute_code` (not primary key)
- Used extensively in assessment mappings

---

### 4. ASSESSMENTTABLE ENTITY

**Table:** `assessment_table`
**Primary Key:** `assessment_id` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `questionnaire_id` | Questionire | OneToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @OneToOne | Questionnaire | `questionnaire_id` | ALL | LAZY |

#### Important Notes
- Main assessment instance/deployment entity
- Links to structured questionnaire definition
- Cascades ALL operations to Questionnaire

---

### 5. QUESTIONNAIRE ENTITY

**Table:** `Questionire`
**Primary Key:** `questionnaire_id` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `tool_id` | tools | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | Tool | `tool_id` → `tool_id` | - | EAGER |
| @OneToMany | QuestionnaireLanguage | `questionnaire` | ALL | LAZY |
| @OneToMany | QuestionnaireSection | `questionnaire` | ALL | LAZY |

#### Important Notes
- Structured questionnaire definition
- Associates with psychometric tools
- Supports multi-language configurations
- Cascades to sections and language settings

---

### 6. QUESTIONNAIRESECTION ENTITY

**Table:** `Questionnaire_Section`
**Primary Key:** `questionnaire_section_id` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `section_id` | question_sections | ManyToOne |
| `questionnaire_id` | Questionire | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | QuestionSection | `section_id` | - | EAGER |
| @ManyToOne | Questionnaire | `questionnaire_id` | - | EAGER |
| @OneToMany | QuestionnaireSectionInstruction | `section` | ALL | EAGER |
| @OneToMany | QuestionnaireQuestion | `section` | ALL | LAZY |

#### Important Notes
- Links questionnaires to reusable question sections
- Supports section-specific instructions
- orphanRemoval=true for instructions and questions
- Eager loads section metadata

---

### 7. QUESTIONNAIREQUESTION ENTITY

**Table:** `Questionnaire_Question`
**Primary Key:** `questionnaire_question_id` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `questionnaire_section_id` | Questionnaire_Section | ManyToOne |
| `question_id` | assessment_questions | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | QuestionnaireSection | `questionnaire_section_id` | - | EAGER |
| @ManyToOne | AssessmentQuestions | `question_id` | - | EAGER |

#### Important Notes
- Junction entity linking questionnaires to questions
- Enables question reuse across multiple questionnaires
- Both relationships are eagerly loaded

---

### 8. QUESTIONNAIRELANGUAGE ENTITY

**Table:** `questionnaire_language`
**Primary Key:** `id` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `questionnaire_id` | Questionire | ManyToOne |
| `languageId` | Language_Table | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | Questionnaire | `questionnaire_id` | - | LAZY |
| @ManyToOne | LanguagesSupported | `languageId` | - | LAZY |

#### Important Notes
- Defines supported languages for questionnaires
- Enables multi-language assessment delivery

---

### 9. QUESTIONNAIRESECTIONINSTRUCTION ENTITY

**Table:** `Questionnaire_Section_Instruction`
**Primary Key:** `questionnaire_section_instruction_id` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `questionnaire_section_id` | Questionnaire_Section | ManyToOne |
| `language_id` | Language_Table | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | QuestionnaireSection | `questionnaire_section_id` | - | EAGER |
| @ManyToOne | LanguagesSupported | `language_id` | - | EAGER |

#### Important Notes
- Stores localized instructions per section
- Supports multi-language section guidance
- Eagerly loaded with section data

---

### 10. QUESTIONSECTION ENTITY

**Table:** `question_sections`
**Primary Key:** `sectionId` (Long, Auto-generated)

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @OneToMany | AssessmentQuestions | `section` | ALL | EAGER |

#### Important Notes
- Reusable question section definitions
- Groups related questions together
- Cascades ALL operations to questions
- Eagerly loads all section questions

---

### 11. ASSESSMENTQUESTIONS ENTITY

**Table:** `assessment_questions`
**Primary Key:** `questionId` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `section_id` | question_sections | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | QuestionSection | `section_id` | - | LAZY |
| @OneToMany | AssessmentQuestionOptions | `question` | ALL | LAZY |
| @OneToMany | LanguageQuestion | `assessmentQuestion` | ALL | LAZY |

#### Important Notes
- Core question entity in assessment system
- Supports multiple answer options
- Multi-language support via LanguageQuestion
- Cascades to options and translations

---

### 12. ASSESSMENTQUESTIONOPTIONS ENTITY

**Table:** `assessment_question_options`
**Primary Key:** `optionId` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `fk_assessment_questions` | assessment_questions | ManyToOne |
| `fk_game_table` | game_table | OneToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | AssessmentQuestions | `fk_assessment_questions` | ALL | LAZY |
| @OneToMany | OptionScoreBasedOnMEasuredQualityTypes | `question_option` | ALL | LAZY |
| @OneToOne | GameTable | `fk_game_table` | - | LAZY |

#### Important Notes
- Answer options for questions
- Can optionally link to game-based assessment
- Stores option images (LONGBLOB, @JsonIgnore)
- Cascades to scoring definitions
- `isGame` flag indicates game-based option

---

### 13. OPTIONSCOREBASEDONMEASUREDQUALITYTYPES ENTITY

**Table:** `score_based_on_measured_quality_types`
**Primary Key:** `scoreId` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `fk_assessment_questions_option` | assessment_question_options | ManyToOne |
| `fk_quality_type` | measured_quality_types | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | AssessmentQuestionOptions | `fk_assessment_questions_option` | - | LAZY |
| @ManyToOne | MeasuredQualityTypes | `fk_quality_type` | - | LAZY |

#### Important Notes
- Defines psychometric scores for answer options
- Links options to measured quality dimensions
- Core of the scoring algorithm
- JsonBackReference on option relationship

---

### 14. GAMETABLE ENTITY

**Table:** `game_table`
**Primary Key:** `gameId` (Long, Auto-generated)

#### Relationships
None - No foreign keys or JPA relationships

#### Important Notes
- Stores game-based assessment metadata
- Standalone entity referenced by AssessmentQuestionOptions
- No cascade relationships

---

### 15. LANGUAGESSUPPORTED ENTITY

**Table:** `Language_Table`
**Primary Key:** `languageId` (Long, Auto-generated)

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @OneToMany | LanguageQuestion | `language` | ALL | LAZY |
| @OneToMany | LanguageOption | FK_LanguageOption | ALL | LAZY |

#### Important Notes
- Defines available languages for the platform
- Central entity for multi-language support
- orphanRemoval=true for language questions
- Cascades deletions to translations

---

### 16. LANGUAGEQUESTION ENTITY

**Table:** `language_question`
**Primary Key:** `LanguageQuestionId` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `original_question_id` | assessment_questions | ManyToOne |
| `language_id` | Language_Table | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | AssessmentQuestions | `original_question_id` | - | LAZY |
| @ManyToOne | LanguagesSupported | `language_id` | - | LAZY |
| @OneToMany | LanguageOption | `languageQuestion` | ALL | LAZY |

#### Important Notes
- Stores translated question text
- Links to original English question
- Cascades to translated options
- orphanRemoval=true for options

---

### 17. LANGUAGEOPTION ENTITY

**Table:** `language_option`
**Primary Key:** `LanguageOptionId` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `language_id` | Language_Table | ManyToOne |
| `language_question_id` | language_question | ManyToOne |
| `assessment_option_id` | assessment_question_options | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | LanguagesSupported | `language_id` | - | LAZY |
| @ManyToOne | LanguageQuestion | `language_question_id` | - | LAZY |
| @ManyToOne | AssessmentQuestionOptions | `assessment_option_id` | - | LAZY |

#### Important Notes
- Translated answer options
- Links to original option for scoring
- All foreign keys are non-nullable
- JsonIgnore on languageQuestion relationship

---

### 18. STUDENTASSESSMENTMAPPING ENTITY

**Table:** `student_assessment_mapping`
**Primary Key:** `student_assessment_id` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `user_student_id` | user_student | ManyToOne |
| `assessment_id` | - | Simple column (no FK) |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | UserStudent | `user_student_id` → `user_student_id` | - | EAGER |

#### Important Notes
- Tracks student-assessment assignments
- **Unique constraint:** (user_student_id + assessment_id)
- Stores assessment status: "notstarted", "ongoing", "completed"
- Default status set via @PrePersist
- assessment_id is simple column (no ORM relationship)

---

### 19. ASSESSMENTRAWSCORE ENTITY

**Table:** `assessment_raw_score`
**Primary Key:** `assessment_raw_score_id` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `student_assessment_id` | student_assessment_mapping | ManyToOne |
| `measured_quality_type_id` | measured_quality_types | ManyToOne |
| `measured_quality_id` | measured_qualities | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | StudentAssessmentMapping | `student_assessment_id` → `student_assessment_id` | - | EAGER |
| @ManyToOne | MeasuredQualityTypes | `measured_quality_type_id` → `measured_quality_type_id` | - | EAGER |
| @ManyToOne | MeasuredQualities | `measured_quality_id` → `measured_quality_id` | - | EAGER |

#### Important Notes
- Stores calculated psychometric scores
- One record per quality type per assessment attempt
- All relationships eagerly loaded
- Created after assessment submission

---

### 20. ASSESSMENTANSWER ENTITY

**Table:** `assessment_answer`
**Primary Key:** `assessment_answer_id` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `user_student_id` | user_student | ManyToOne |
| `assessment_id` | assessment_table | ManyToOne |
| `questionnaire_question_id` | Questionnaire_Question | ManyToOne |
| `option_id` | assessment_question_options | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | UserStudent | `user_student_id` → `user_student_id` | - | EAGER |
| @ManyToOne | AssessmentTable | `assessment_id` → `assessment_id` | - | EAGER |
| @ManyToOne | QuestionnaireQuestion | `questionnaire_question_id` | - | EAGER |
| @ManyToOne | AssessmentQuestionOptions | `option_id` | - | EAGER |

#### Important Notes
- Stores student's selected answers
- Links to specific question in questionnaire context
- All relationships eagerly loaded
- Used for score calculation

---

### 21. TOOL ENTITY

**Table:** `tools`
**Primary Key:** `tool_id` (Long, Auto-generated)

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToMany | MeasuredQualities | `tools` (inverse side) | - | LAZY |

#### Important Notes
- Psychometric assessment tools
- Linked to measured qualities via join table
- Price defaults to 0 if marked as free
- JsonIgnore on relationship

---

### 22. MEASUREDQUALITIES ENTITY

**Table:** `measured_qualities`
**Primary Key:** `measured_quality_id` (Long, Auto-generated)

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @OneToMany | MeasuredQualityTypes | `measuredQuality` | - | LAZY |
| @ManyToMany | Tool | Join Table: `tool_measured_quality_mapping` | - | LAZY |

#### Important Notes
- High-level quality dimensions (e.g., "Personality", "Intelligence")
- Parent of quality types
- Many-to-many with tools
- JsonIgnore on relationships

---

### 23. MEASUREDQUALITYTYPES ENTITY

**Table:** `measured_quality_types`
**Primary Key:** `measured_quality_type_id` (Long, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `fk_measured_qualities` | measured_qualities | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | MeasuredQualities | `fk_measured_qualities` | - | LAZY |
| @ManyToMany | Career | Join Table: `measured_quality_type_career_mapping` | - | LAZY |
| @OneToMany | OptionScoreBasedOnMEasuredQualityTypes | `measuredQualityType` | - | LAZY |

#### Important Notes
- Specific quality dimensions (e.g., "Openness", "Conscientiousness")
- Child of MeasuredQualities
- Links to careers via many-to-many
- Referenced in scoring system
- JsonIgnore on all relationships

---

### 24. CAREER ENTITY

**Table:** `careers`
**Primary Key:** `career_id` (Long, Auto-generated)

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToMany | MeasuredQualityTypes | `careers` (inverse side) | - | LAZY |

#### Important Notes
- Career recommendations
- Linked to quality types for career matching
- JsonIgnore on relationship
- Used in career guidance features

---

### 25. INSTITUTEDETAIL ENTITY

**Table:** `institute_detail_new`
**Primary Key:** `institute_code` (Integer, Auto-generated)

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @OneToMany | ContactPerson | `institute` | ALL | LAZY |
| @OneToMany | InstituteCourse | `institute` | ALL | LAZY |
| @OneToMany | SchoolSession | `institute` | ALL | LAZY |

#### Important Notes
- Institute/school master data
- Primary key is `institute_code` (not typical `id`)
- Cascades ALL to dependent entities
- JsonManagedReference for ContactPerson

---

### 26. SCHOOLSESSION ENTITY

**Table:** `school_session`
**Primary Key:** `id` (Integer, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `institute_id` | institute_detail_new | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | InstituteDetail | `institute_id` → `institute_code` | - | LAZY |
| @OneToMany | SchoolClasses | `schoolSession` | ALL | LAZY |

#### Important Notes
- Academic year/session definitions
- References institute by `institute_code`
- orphanRemoval=true for classes
- JsonIgnore on institute relationship

---

### 27. SCHOOLCLASSES ENTITY

**Table:** `school_classes`
**Primary Key:** `id` (Integer, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `school_session_id` | school_session | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | SchoolSession | `school_session_id` | - | LAZY |
| @OneToMany | SchoolSections | `schoolClasses` | ALL | LAZY |

#### Important Notes
- Class/grade definitions within sessions
- Cascades to sections
- JsonIgnore on session relationship

---

### 28. SCHOOLSECTIONS ENTITY

**Table:** `school_sections`
**Primary Key:** `id` (Integer, Auto-generated)

#### Foreign Keys
| Column | Target Table | Relationship |
|--------|--------------|--------------|
| `school_classes_id` | school_classes | ManyToOne |

#### Relationships
| Type | Target Entity | Mapped By / Join Column | Cascade | Fetch |
|------|---------------|-------------------------|---------|-------|
| @ManyToOne | SchoolClasses | `school_classes_id` | - | LAZY |

#### Important Notes
- Section divisions within classes (e.g., Section A, B, C)
- Leaf entity in school hierarchy
- JsonIgnore on classes relationship

---

### 29. USERTEMDATA ENTITY

**Table:** N/A (Empty class)
**Status:** Empty entity with no fields or relationships defined

---

## Join Tables

### 1. user_group_mapping

**Purpose:** Many-to-Many relationship between Users and Groups

| Column | Type | References |
|--------|------|------------|
| `user_id` | Long | student_user.id |
| `group_id` | Long | groups.id |

**Owning Entity:** User
**Inverse Entity:** Group

---

### 2. tool_measured_quality_mapping

**Purpose:** Many-to-Many relationship between Tools and Measured Qualities

| Column | Type | References |
|--------|------|------------|
| `measured_quality_id` | Long | measured_qualities.measured_quality_id |
| `tool_id` | Long | tools.tool_id |

**Owning Entity:** MeasuredQualities
**Inverse Entity:** Tool

---

### 3. measured_quality_type_career_mapping

**Purpose:** Many-to-Many relationship between Measured Quality Types and Careers

| Column | Type | References |
|--------|------|------------|
| `measured_quality_type_id` | Long | measured_quality_types.measured_quality_type_id |
| `career_id` | Long | careers.career_id |

**Owning Entity:** MeasuredQualityTypes
**Inverse Entity:** Career

---

## Cascade Behaviors

### Cascade.ALL (Full propagation)

| Parent Entity | Child Entities |
|---------------|----------------|
| User | UserRoleGroupMapping |
| StudentInfo | User |
| AssessmentTable | Questionnaire |
| Questionnaire | QuestionnaireLanguage, QuestionnaireSection |
| QuestionnaireSection | QuestionnaireSectionInstruction, QuestionnaireQuestion |
| QuestionSection | AssessmentQuestions |
| AssessmentQuestions | AssessmentQuestionOptions, LanguageQuestion |
| AssessmentQuestionOptions | OptionScoreBasedOnMEasuredQualityTypes |
| LanguagesSupported | LanguageQuestion, LanguageOption |
| LanguageQuestion | LanguageOption |
| InstituteDetail | ContactPerson, InstituteCourse, SchoolSession |
| SchoolSession | SchoolClasses |
| SchoolClasses | SchoolSections |

### orphanRemoval=true

Entities that automatically delete orphaned children:

- QuestionnaireSection → QuestionnaireSectionInstruction
- QuestionnaireSection → QuestionnaireQuestion
- LanguagesSupported → LanguageQuestion
- LanguageQuestion → LanguageOption
- SchoolSession → SchoolClasses

---

## Unique Constraints

| Entity | Constraint Type | Columns | Purpose |
|--------|----------------|---------|---------|
| StudentAssessmentMapping | Composite Unique | user_student_id + assessment_id | Prevent duplicate assessment assignments |

---

## Quick Reference

### Entity-to-Table Mapping

| # | Entity Class | Table Name |
|---|--------------|------------|
| 1 | User | student_user |
| 2 | StudentInfo | student_info |
| 3 | UserStudent | user_student |
| 4 | AssessmentTable | assessment_table |
| 5 | Questionnaire | Questionire |
| 6 | QuestionnaireSection | Questionnaire_Section |
| 7 | QuestionnaireQuestion | Questionnaire_Question |
| 8 | QuestionnaireLanguage | questionnaire_language |
| 9 | QuestionnaireSectionInstruction | Questionnaire_Section_Instruction |
| 10 | QuestionSection | question_sections |
| 11 | AssessmentQuestions | assessment_questions |
| 12 | AssessmentQuestionOptions | assessment_question_options |
| 13 | OptionScoreBasedOnMEasuredQualityTypes | score_based_on_measured_quality_types |
| 14 | GameTable | game_table |
| 15 | LanguagesSupported | Language_Table |
| 16 | LanguageQuestion | language_question |
| 17 | LanguageOption | language_option |
| 18 | StudentAssessmentMapping | student_assessment_mapping |
| 19 | AssessmentRawScore | assessment_raw_score |
| 20 | AssessmentAnswer | assessment_answer |
| 21 | Tool | tools |
| 22 | MeasuredQualities | measured_qualities |
| 23 | MeasuredQualityTypes | measured_quality_types |
| 24 | Career | careers |
| 25 | InstituteDetail | institute_detail_new |
| 26 | SchoolSession | school_session |
| 27 | SchoolClasses | school_classes |
| 28 | SchoolSections | school_sections |
| 29 | UserTempData | N/A (empty) |

### Primary Key Reference

| Entity | Primary Key Column | Type |
|--------|-------------------|------|
| User | id | Long |
| StudentInfo | id | Integer |
| UserStudent | user_student_id | Long |
| AssessmentTable | assessment_id | Long |
| Questionnaire | questionnaire_id | Long |
| QuestionnaireSection | questionnaire_section_id | Long |
| QuestionnaireQuestion | questionnaire_question_id | Long |
| QuestionnaireLanguage | id | Long |
| QuestionnaireSectionInstruction | questionnaire_section_instruction_id | Long |
| QuestionSection | sectionId | Long |
| AssessmentQuestions | questionId | Long |
| AssessmentQuestionOptions | optionId | Long |
| OptionScoreBasedOnMEasuredQualityTypes | scoreId | Long |
| GameTable | gameId | Long |
| LanguagesSupported | languageId | Long |
| LanguageQuestion | LanguageQuestionId | Long |
| LanguageOption | LanguageOptionId | Long |
| StudentAssessmentMapping | student_assessment_id | Long |
| AssessmentRawScore | assessment_raw_score_id | Long |
| AssessmentAnswer | assessment_answer_id | Long |
| Tool | tool_id | Long |
| MeasuredQualities | measured_quality_id | Long |
| MeasuredQualityTypes | measured_quality_type_id | Long |
| Career | career_id | Long |
| InstituteDetail | institute_code | Integer |
| SchoolSession | id | Integer |
| SchoolClasses | id | Integer |
| SchoolSections | id | Integer |

---

## Notes & Observations

### Naming Conventions
- **Inconsistent table naming:** Some use snake_case (`student_user`), some PascalCase (`Questionire`, `Questionnaire_Section`)
- **Typo in table name:** `Questionire` should be `Questionnaire`
- **Mixed primary key naming:** Some use `id`, others use entity-specific names (`questionId`, `user_student_id`)

### Architectural Patterns
- **Bidirectional relationships** extensively used (careful with infinite recursion)
- **JsonIgnore/JsonBackReference/JsonManagedReference** used to prevent serialization loops
- **Eager loading** used selectively for frequently accessed relationships
- **Cascade.ALL** used generously - be cautious with deletions
- **orphanRemoval=true** ensures clean deletion of dependent entities

### Data Integrity
- **Unique constraints:** Only StudentAssessmentMapping has explicit unique constraint
- **Nullable foreign keys:** Many relationships allow null (e.g., QuestionSection, GameTable)
- **Non-standard referenced columns:** InstituteDetail uses `institute_code` instead of `id`

### Performance Considerations
- **Eager loading chains:** Some entities (AssessmentRawScore) eagerly load multiple relationships
- **Lazy loading:** Most collections use LAZY fetch to avoid N+1 queries
- **LONGBLOB fields:** AssessmentQuestionOptions contains image data (consider external storage)

---

**Document End**

*For questions or updates, contact the development team.*
