# Assessment Data Flow & Scoring System

**Project:** Career-Nine Educational Platform
**Purpose:** Understanding student assessment data structure for calculations and conversions
**Generated:** 2026-02-06

---

## Table of Contents

1. [Overview](#overview)
2. [Data Flow Architecture](#data-flow-architecture)
3. [Entity Relationships](#entity-relationships)
4. [Scoring Mechanism](#scoring-mechanism)
5. [Data Retrieval Query Structure](#data-retrieval-query-structure)
6. [Sample Data Flow Example](#sample-data-flow-example)
7. [Key Fields Reference](#key-fields-reference)

---

## Overview

The Career-Nine assessment system captures student responses to psychometric assessments and converts them into scored measured quality dimensions. These scores are used for:
- Career guidance and recommendations
- Personality/aptitude profiling
- Academic counseling
- Student assessment reports

### Core Data Flow

```
Student Takes Assessment
    ↓
Assessment Answers Recorded (with selected options)
    ↓
Options Mapped to Measured Quality Type Scores
    ↓
Raw Scores Aggregated by Quality Type
    ↓
Final Assessment Results Calculated
```

---

## Data Flow Architecture

### 1. Student Identification

**Starting Points:**
- `userStudentId` - Unique identifier linking student to institute (from `user_student` table)
- `assessmentId` - Specific assessment instance (from `assessment_table`)

**Tables Involved:**
- `user_student` - Links student to institute and student_info
- `student_info` - Contains student demographic data
- `student_user` - Authentication and user profile

### 2. Assessment Configuration

**Questionnaire Structure:**
```
assessment_table (assessment instance)
    ↓ [OneToOne: questionnaire_id]
Questionire (questionnaire definition)
    ↓ [OneToMany: questionnaire sections]
Questionnaire_Section (sections within questionnaire)
    ↓ [OneToMany: questions in section]
Questionnaire_Question (questions with order/context)
    ↓ [ManyToOne: actual question data]
assessment_questions (question bank)
    ↓ [OneToMany: answer options]
assessment_question_options (possible answers)
```

### 3. Answer Recording

**When Student Submits Assessment:**

**Table:** `assessment_answer`
**Primary Key:** `assessment_answer_id`

**Columns:**
| Column | Type | Purpose |
|--------|------|---------|
| `assessment_answer_id` | Long | Unique answer record ID |
| `user_student_id` | Long | FK to user_student (who answered) |
| `assessment_id` | Long | FK to assessment_table (which assessment) |
| `questionnaire_question_id` | Long | FK to Questionnaire_Question (which question in context) |
| `option_id` | Long | FK to assessment_question_options (selected answer) |
| `created_at` | Timestamp | When answer was recorded |

**Relationships (All EAGER loaded):**
- @ManyToOne → UserStudent
- @ManyToOne → AssessmentTable
- @ManyToOne → QuestionnaireQuestion
- @ManyToOne → AssessmentQuestionOptions

### 4. Scoring Mapping

**Table:** `score_based_on_measured_quality_types`
**Purpose:** Links each answer option to psychometric dimension scores

**Columns:**
| Column | Type | Purpose |
|--------|------|---------|
| `scoreId` | Long | Unique score mapping ID |
| `fk_assessment_questions_option` | Long | FK to assessment_question_options |
| `fk_quality_type` | Long | FK to measured_quality_types |
| `score` | Integer/Double | Score value for this quality type |

**Example Mapping:**
```
Option: "I enjoy meeting new people" (optionId: 123)
    → Extraversion Score: +5
    → Openness Score: +2
    → Conscientiousness Score: 0

Option: "I prefer working alone" (optionId: 124)
    → Extraversion Score: -3
    → Openness Score: +1
    → Conscientiousness Score: +4
```

### 5. Measured Quality Types

**Table:** `measured_quality_types`
**Purpose:** Defines psychometric dimensions being measured

**Columns:**
| Column | Type | Purpose |
|--------|------|---------|
| `measured_quality_type_id` | Long | Unique type ID |
| `fk_measured_qualities` | Long | Parent quality category |
| `name` | String | Type name (e.g., "Openness") |
| `description` | String | Description of the trait |
| `displayName` | String | User-facing display name |

**Hierarchy:**
```
measured_qualities (High-level category)
    ↓ [OneToMany]
measured_quality_types (Specific dimensions)
    ↓ [ManyToMany: career mapping]
careers (Career recommendations)
```

**Example Quality Types:**
- **Personality Traits:** Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism (Big Five)
- **Cognitive Abilities:** Logical Reasoning, Spatial Reasoning, Verbal Ability
- **Career Interests:** Realistic, Investigative, Artistic, Social, Enterprising, Conventional (RIASEC)

### 6. Raw Score Aggregation

**Table:** `assessment_raw_score`
**Purpose:** Stores final aggregated scores per quality type per assessment

**Columns:**
| Column | Type | Purpose |
|--------|------|---------|
| `assessment_raw_score_id` | Long | Unique score record ID |
| `student_assessment_id` | Long | FK to student_assessment_mapping |
| `measured_quality_type_id` | Long | FK to measured_quality_types |
| `measured_quality_id` | Long | FK to measured_qualities |
| `raw_score` | Integer/Double | Aggregated raw score |

**Calculation Process:**
1. For each `userStudentId` + `assessmentId` combination
2. Retrieve all answers from `assessment_answer` table
3. For each answer, lookup `option_id` in `score_based_on_measured_quality_types`
4. Aggregate scores by `measured_quality_type_id`
5. Save aggregated scores to `assessment_raw_score`

---

## Entity Relationships

### Complete Scoring Chain

```mermaid-style diagram:

UserStudent (user_student_id)
    |
    ├─[answers]─> AssessmentAnswer
    |                  |
    |                  ├─[assessment_id]─> AssessmentTable
    |                  |                        |
    |                  |                        └─[questionnaire_id]─> Questionnaire
    |                  |
    |                  ├─[questionnaire_question_id]─> QuestionnaireQuestion
    |                  |                                    |
    |                  |                                    └─[question_id]─> AssessmentQuestions
    |                  |
    |                  └─[option_id]─> AssessmentQuestionOptions
    |                                       |
    |                                       └─[OneToMany]─> OptionScoreBasedOnMEasuredQualityTypes
    |                                                             |
    |                                                             └─[fk_quality_type]─> MeasuredQualityTypes
    |                                                                                         |
    |                                                                                         ├─[parent]─> MeasuredQualities
    |                                                                                         |
    |                                                                                         └─[ManyToMany]─> Career
    |
    └─[scores]─> AssessmentRawScore
                      |
                      ├─[measured_quality_type_id]─> MeasuredQualityTypes
                      └─[measured_quality_id]─> MeasuredQualities
```

---

## Scoring Mechanism

### Step-by-Step Score Calculation

**Input Parameters:**
- `userStudentId` (Long) - From `user_student.user_student_id`
- `assessmentId` (Long) - From `assessment_table.assessment_id`

### Step 1: Retrieve All Student Answers

**Query Logic:**
```sql
SELECT
    aa.assessment_answer_id,
    aa.option_id,
    aa.questionnaire_question_id
FROM assessment_answer aa
WHERE aa.user_student_id = ?
  AND aa.assessment_id = ?
ORDER BY aa.questionnaire_question_id
```

**Returns:** List of all selected option IDs for this assessment attempt

### Step 2: Lookup Option Scores

For each `option_id` from Step 1:

**Query Logic:**
```sql
SELECT
    os.scoreId,
    os.fk_quality_type,
    os.score,
    mqt.name as quality_type_name,
    mqt.displayName,
    mq.measured_quality_id,
    mq.name as quality_category_name
FROM score_based_on_measured_quality_types os
INNER JOIN measured_quality_types mqt
    ON os.fk_quality_type = mqt.measured_quality_type_id
INNER JOIN measured_qualities mq
    ON mqt.fk_measured_qualities = mq.measured_quality_id
WHERE os.fk_assessment_questions_option = ?
```

**Returns:** All quality type scores for this option

### Step 3: Aggregate Scores by Quality Type

**Aggregation Logic:**
```
For each measured_quality_type_id:
    raw_score = SUM(all scores for that quality_type_id from all answered options)
```

**Example Calculation:**

**Student answers 5 questions:**

| Question | Option Selected | Extraversion Score | Openness Score | Conscientiousness Score |
|----------|----------------|-------------------|----------------|------------------------|
| Q1 | Option A | +5 | +2 | 0 |
| Q2 | Option C | -3 | +4 | +2 |
| Q3 | Option B | +2 | -1 | +5 |
| Q4 | Option A | +4 | +3 | -2 |
| Q5 | Option D | -2 | +5 | +3 |
| **TOTAL** | | **+6** | **+13** | **+8** |

**Result:**
- Extraversion: 6
- Openness: 13
- Conscientiousness: 8

### Step 4: Save Raw Scores

**Insert into `assessment_raw_score`:**

For each quality type with aggregated score:

```sql
INSERT INTO assessment_raw_score (
    student_assessment_id,
    measured_quality_type_id,
    measured_quality_id,
    raw_score
) VALUES (?, ?, ?, ?)
```

**Note:** `student_assessment_id` comes from `student_assessment_mapping` table (links userStudentId + assessmentId)

### Step 5: Delete Old Scores (If Re-taking)

**Before inserting new scores:**
```sql
DELETE FROM assessment_raw_score
WHERE student_assessment_id = ?
```

This ensures only the latest attempt's scores are stored.

---

## Data Retrieval Query Structure

### Get Complete Assessment Data for a Student

**JPA Repository Method Structure:**

```java
// 1. Find student assessment mapping
StudentAssessmentMapping mapping = studentAssessmentMappingRepository
    .findByUserStudentIdAndAssessmentId(userStudentId, assessmentId);

// 2. Get all answers for this attempt
List<AssessmentAnswer> answers = assessmentAnswerRepository
    .findByUserStudentIdAndAssessmentId(userStudentId, assessmentId);

// 3. For each answer, get option details
for (AssessmentAnswer answer : answers) {
    AssessmentQuestionOptions option = answer.getOption(); // EAGER loaded

    // 4. Get all quality type scores for this option
    List<OptionScoreBasedOnMEasuredQualityTypes> optionScores =
        optionScoreRepository.findByQuestionOption(option);

    // 5. Accumulate scores by quality type
    for (OptionScoreBasedOnMEasuredQualityTypes score : optionScores) {
        MeasuredQualityTypes qualityType = score.getMeasuredQualityType(); // EAGER loaded
        Integer scoreValue = score.getScore();

        // Aggregate logic here
        scoreMap.merge(qualityType.getMeasuredQualityTypeId(),
                      scoreValue,
                      Integer::sum);
    }
}

// 6. Save aggregated scores
for (Map.Entry<Long, Integer> entry : scoreMap.entrySet()) {
    AssessmentRawScore rawScore = new AssessmentRawScore();
    rawScore.setStudentAssessmentMapping(mapping);
    rawScore.setMeasuredQualityTypeId(entry.getKey());
    rawScore.setRawScore(entry.getValue());
    assessmentRawScoreRepository.save(rawScore);
}
```

---

## Sample Data Flow Example

### Scenario: John Takes a Personality Assessment

**Given:**
- `userStudentId`: 12345
- `assessmentId`: 67890
- Assessment Type: Big Five Personality Test
- Questions: 50 questions total

**Step 1: Assessment Submission**

John submits 50 answers via `/assessment-answer/submit` endpoint.

**Records Created in `assessment_answer`:**

| assessment_answer_id | user_student_id | assessment_id | questionnaire_question_id | option_id |
|---------------------|-----------------|---------------|---------------------------|-----------|
| 1001 | 12345 | 67890 | 1 | 501 |
| 1002 | 12345 | 67890 | 2 | 507 |
| 1003 | 12345 | 67890 | 3 | 512 |
| ... | ... | ... | ... | ... |
| 1050 | 12345 | 67890 | 50 | 698 |

**Step 2: Score Lookup**

For `option_id: 501` (Question 1's answer):

**Query `score_based_on_measured_quality_types`:**

| scoreId | fk_assessment_questions_option | fk_quality_type | score |
|---------|-------------------------------|-----------------|-------|
| 8001 | 501 | 1 | +5 |
| 8002 | 501 | 2 | +2 |
| 8003 | 501 | 5 | 0 |

**Quality Type Mapping:**
- fk_quality_type: 1 → Extraversion (+5)
- fk_quality_type: 2 → Openness (+2)
- fk_quality_type: 5 → Neuroticism (0)

**Step 3: Score Aggregation**

After processing all 50 answers:

**Aggregated Scores:**

| measured_quality_type_id | Quality Type Name | Raw Score |
|-------------------------|-------------------|-----------|
| 1 | Extraversion | 78 |
| 2 | Openness | 85 |
| 3 | Conscientiousness | 92 |
| 4 | Agreeableness | 71 |
| 5 | Neuroticism | 45 |

**Step 4: Save Final Scores**

**Records Created in `assessment_raw_score`:**

| assessment_raw_score_id | student_assessment_id | measured_quality_type_id | measured_quality_id | raw_score |
|------------------------|-----------------------|-------------------------|-------------------|-----------|
| 5001 | 345 | 1 | 1 | 78 |
| 5002 | 345 | 2 | 1 | 85 |
| 5003 | 345 | 3 | 1 | 92 |
| 5004 | 345 | 4 | 1 | 71 |
| 5005 | 345 | 5 | 1 | 45 |

*Note: student_assessment_id: 345 is from student_assessment_mapping table*

**Step 5: Career Matching (Next Phase)**

Using the raw scores, the system can:
1. Normalize scores to percentiles
2. Match quality types to careers via `measured_quality_type_career_mapping`
3. Generate career recommendations
4. Create assessment report

---

## Key Fields Reference

### Assessment Answer Fields

**Table:** `assessment_answer`

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `assessment_answer_id` | Long | NO | Primary key |
| `user_student_id` | Long | NO | FK to user_student |
| `assessment_id` | Long | NO | FK to assessment_table |
| `questionnaire_question_id` | Long | NO | FK to Questionnaire_Question |
| `option_id` | Long | NO | FK to assessment_question_options |
| `created_at` | Timestamp | YES | Answer timestamp |

### Option Score Fields

**Table:** `score_based_on_measured_quality_types`

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `scoreId` | Long | NO | Primary key |
| `fk_assessment_questions_option` | Long | NO | FK to assessment_question_options |
| `fk_quality_type` | Long | NO | FK to measured_quality_types |
| `score` | Integer/Double | NO | Score value for this quality dimension |

### Measured Quality Type Fields

**Table:** `measured_quality_types`

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `measured_quality_type_id` | Long | NO | Primary key |
| `fk_measured_qualities` | Long | YES | FK to parent quality category |
| `name` | String | NO | Type name (e.g., "Extraversion") |
| `description` | String | YES | Full description |
| `displayName` | String | YES | User-friendly display name |

### Raw Score Fields

**Table:** `assessment_raw_score`

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `assessment_raw_score_id` | Long | NO | Primary key |
| `student_assessment_id` | Long | NO | FK to student_assessment_mapping |
| `measured_quality_type_id` | Long | NO | FK to measured_quality_types |
| `measured_quality_id` | Long | NO | FK to measured_qualities |
| `raw_score` | Integer/Double | NO | Aggregated score value |

---

## Current Implementation

### AssessmentAnswerController `/submit` Endpoint

**Location:** `controller/career9/AssessmentAnswerController.java`

**Key Features:**
- Validates UserStudent and AssessmentTable existence
- Creates/updates StudentAssessmentMapping with status
- Saves each answer to AssessmentAnswer table
- Accumulates scores from OptionScoreBasedOnMEasuredQualityTypes
- Deletes old AssessmentRawScore entries for the mapping
- Saves new AssessmentRawScore entries per MeasuredQualityType

**Process Flow:**
1. Validate student and assessment exist
2. Create/update mapping with status "completed"
3. Save all answers
4. Calculate raw scores
5. Delete old scores (if retaking)
6. Save new raw scores
7. Return success response

---

## Next Steps

**Ready for:**
- Score normalization algorithms
- Percentile calculation logic
- Career matching rules
- Word-to-meaning conversions for report generation
- Sentence generation for assessment reports

**Please specify:**
1. What calculations need to be performed on the raw scores?
2. What words/terms need conversion to meanings/sentences?
3. What is the desired output format?
4. Are there normalization tables or reference data needed?

---

**Document End**

*This document provides the foundation for understanding assessment data flow. Next steps will involve specific calculation logic and report generation algorithms.*
