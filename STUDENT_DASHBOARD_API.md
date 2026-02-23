# Student Dashboard API Documentation

**Endpoint:** `/assessment-answer/dashboard`
**Method:** `POST`
**Controller:** `AssessmentAnswerController`
**Created:** 2026-02-06

---

## Overview

This comprehensive endpoint retrieves all assessment-related data for a specific student to power a complete student dashboard. It aggregates data from multiple tables to provide a single, unified response containing:

- Student basic information
- All assessments the student has taken
- All answers with selected options and their Measured Quality Type (MQT) scores
- Aggregated raw scores by MQT for each assessment

---

## Request

### Endpoint URL
```
POST /assessment-answer/dashboard
```

### Headers
```
Content-Type: application/json
Accept: application/json
```

### Request Body

```json
{
  "userStudentId": 123
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userStudentId` | Long | Yes | The unique identifier for the user student |

---

## Response

### Success Response (200 OK)

The response contains a comprehensive `StudentDashboardResponse` object with the following structure:

```json
{
  "studentInfo": {
    "userStudentId": 123,
    "userId": 456,
    "instituteName": "ABC University",
    "instituteCode": 100
  },
  "assessments": [
    {
      "assessmentId": 1,
      "assessmentName": "Big Five Personality Test",
      "status": "completed",
      "isActive": true,
      "startDate": "2024-01-01",
      "endDate": "2024-12-31",
      "studentAssessmentMappingId": 789,
      "answers": [
        {
          "assessmentAnswerId": 1001,
          "questionnaireQuestionId": 50,
          "rankOrder": null,
          "selectedOption": {
            "optionId": 201,
            "optionText": "I enjoy meeting new people",
            "optionDescription": "Indicates extraverted behavior",
            "isCorrect": false,
            "mqtScores": [
              {
                "scoreId": 5001,
                "score": 5,
                "measuredQualityType": {
                  "measuredQualityTypeId": 1,
                  "name": "Extraversion",
                  "description": "Tendency to seek stimulation and enjoy company of others",
                  "displayName": "Extraversion",
                  "measuredQuality": {
                    "measuredQualityId": 1,
                    "name": "Personality",
                    "description": "Big Five Personality Traits",
                    "displayName": "Personality Traits"
                  }
                }
              },
              {
                "scoreId": 5002,
                "score": 2,
                "measuredQualityType": {
                  "measuredQualityTypeId": 2,
                  "name": "Openness",
                  "description": "Appreciation for art, emotion, adventure, and unusual ideas",
                  "displayName": "Openness to Experience",
                  "measuredQuality": {
                    "measuredQualityId": 1,
                    "name": "Personality",
                    "description": "Big Five Personality Traits",
                    "displayName": "Personality Traits"
                  }
                }
              }
            ]
          }
        }
      ],
      "rawScores": [
        {
          "assessmentRawScoreId": 3001,
          "rawScore": 78,
          "measuredQualityType": {
            "measuredQualityTypeId": 1,
            "name": "Extraversion",
            "description": "Tendency to seek stimulation and enjoy company of others",
            "displayName": "Extraversion",
            "measuredQuality": {
              "measuredQualityId": 1,
              "name": "Personality",
              "description": "Big Five Personality Traits",
              "displayName": "Personality Traits"
            }
          },
          "measuredQuality": {
            "measuredQualityId": 1,
            "name": "Personality",
            "description": "Big Five Personality Traits",
            "displayName": "Personality Traits"
          }
        }
      ]
    }
  ]
}
```

### Response Object Structure

#### StudentDashboardResponse

| Field | Type | Description |
|-------|------|-------------|
| `studentInfo` | StudentBasicInfo | Student's basic information |
| `assessments` | List\<AssessmentData\> | All assessments taken by the student |

#### StudentBasicInfo

| Field | Type | Description |
|-------|------|-------------|
| `userStudentId` | Long | User student unique identifier |
| `userId` | Long | User account identifier |
| `instituteName` | String | Name of the institute |
| `instituteCode` | Integer | Institute code/identifier |

#### AssessmentData

| Field | Type | Description |
|-------|------|-------------|
| `assessmentId` | Long | Assessment unique identifier |
| `assessmentName` | String | Name of the assessment |
| `status` | String | Status: "notstarted", "ongoing", "completed" |
| `isActive` | Boolean | Whether assessment is currently active |
| `startDate` | String | Assessment start date |
| `endDate` | String | Assessment end date |
| `studentAssessmentMappingId` | Long | Mapping record ID |
| `answers` | List\<AnswerDetail\> | All answers for this assessment |
| `rawScores` | List\<RawScoreData\> | Aggregated scores by MQT |

#### AnswerDetail

| Field | Type | Description |
|-------|------|-------------|
| `assessmentAnswerId` | Long | Answer record unique identifier |
| `questionnaireQuestionId` | Long | Question identifier in questionnaire |
| `rankOrder` | Integer | Rank order (for ranking questions, null otherwise) |
| `selectedOption` | OptionData | The option selected by the student |

#### OptionData

| Field | Type | Description |
|-------|------|-------------|
| `optionId` | Long | Option unique identifier |
| `optionText` | String | Text of the option |
| `optionDescription` | String | Description of the option |
| `isCorrect` | Boolean | Whether this is a correct answer (for knowledge tests) |
| `mqtScores` | List\<MQTScore\> | All MQT scores associated with this option |

#### MQTScore

| Field | Type | Description |
|-------|------|-------------|
| `scoreId` | Long | Score mapping unique identifier |
| `score` | Integer | Score value for this MQT |
| `measuredQualityType` | MQTData | The measured quality type details |

#### MQTData

| Field | Type | Description |
|-------|------|-------------|
| `measuredQualityTypeId` | Long | MQT unique identifier |
| `name` | String | MQT name (e.g., "Extraversion") |
| `description` | String | Detailed description |
| `displayName` | String | User-friendly display name |
| `measuredQuality` | MQData | Parent measured quality |

#### MQData

| Field | Type | Description |
|-------|------|-------------|
| `measuredQualityId` | Long | MQ unique identifier |
| `name` | String | MQ name (e.g., "Personality") |
| `description` | String | Detailed description |
| `displayName` | String | User-friendly display name |

#### RawScoreData

| Field | Type | Description |
|-------|------|-------------|
| `assessmentRawScoreId` | Long | Raw score record identifier |
| `rawScore` | Integer | Aggregated score value |
| `measuredQualityType` | MQTData | The measured quality type |
| `measuredQuality` | MQData | The measured quality |

---

## Error Responses

### 400 Bad Request - Missing userStudentId

```json
{
  "error": "Missing required field",
  "message": "userStudentId is required in request body"
}
```

### 500 Internal Server Error - Student Not Found

```json
{
  "error": "Failed to fetch student dashboard data",
  "message": "UserStudent not found with ID: 123"
}
```

### 500 Internal Server Error - General Error

```json
{
  "error": "Failed to fetch student dashboard data",
  "message": "Error message details"
}
```

---

## Database Tables Accessed

This endpoint performs optimized queries across the following tables:

1. **user_student** - Student basic info and institute linkage
2. **institute_detail_new** - Institute information
3. **student_assessment_mapping** - Links students to assessments with status
4. **assessment_table** - Assessment definitions
5. **assessment_answer** - Student answers to questions
6. **assessment_question_options** - Answer options
7. **score_based_on_measured_quality_types** - MQT scores for each option
8. **measured_quality_types** - MQT definitions
9. **measured_qualities** - Parent quality categories
10. **assessment_raw_score** - Aggregated scores by MQT per assessment

---

## Performance Considerations

### Optimizations Applied

1. **EAGER Loading**: Critical relationships are EAGER loaded to reduce N+1 queries
2. **Optimized Query**: Uses `findByUserStudentIdAndAssessmentIdWithDetails()` which performs JOIN FETCH for:
   - AssessmentAnswer
   - AssessmentQuestionOptions
   - OptionScoreBasedOnMEasuredQualityTypes
   - MeasuredQualityTypes
   - MeasuredQualities

3. **Efficient Aggregation**: Raw scores are pre-calculated and stored, avoiding runtime aggregation

### Expected Performance

- **Single Assessment**: ~100-200ms
- **Multiple Assessments (3-5)**: ~300-600ms
- **Large Dataset (10+ assessments)**: ~1-2s

*Note: Performance may vary based on database load and network latency*

---

## Use Cases

This endpoint is designed for:

1. **Student Dashboard** - Display comprehensive assessment history
2. **Progress Tracking** - Show completion status and scores
3. **Report Generation** - Provide data for detailed student reports
4. **Analytics** - Enable analysis of student performance across assessments
5. **Career Guidance** - Use MQT scores for career recommendations

---

## Data Flow

```
Client Request (userStudentId)
    ↓
Validate Student Exists
    ↓
Fetch Student Basic Info (user_student, institute_detail_new)
    ↓
Fetch All Assessment Mappings (student_assessment_mapping)
    ↓
For Each Assessment:
    ├─ Fetch Assessment Details (assessment_table)
    ├─ Fetch All Answers with Optimized Query (assessment_answer + JOINs)
    │   └─ For Each Answer:
    │       ├─ Extract Option Details
    │       └─ Extract MQT Scores with Hierarchy
    └─ Fetch Aggregated Raw Scores (assessment_raw_score)
    ↓
Build Complete Response
    ↓
Return JSON
```

---

## Example cURL Request

```bash
curl -X POST http://localhost:8091/assessment-answer/dashboard \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "userStudentId": 123
  }'
```

---

## Example Usage in Frontend (TypeScript/React)

```typescript
interface DashboardRequest {
  userStudentId: number;
}

interface StudentDashboardResponse {
  studentInfo: StudentBasicInfo;
  assessments: AssessmentData[];
}

async function fetchStudentDashboard(userStudentId: number): Promise<StudentDashboardResponse> {
  const response = await fetch('/assessment-answer/dashboard', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ userStudentId }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch student dashboard');
  }

  return await response.json();
}

// Usage
const dashboard = await fetchStudentDashboard(123);
console.log('Student:', dashboard.studentInfo);
console.log('Assessments:', dashboard.assessments);
```

---

## Related Endpoints

- `POST /assessment-answer/submit` - Submit assessment answers
- `GET /assessments/student/{userStudentId}` - Get assessments for student
- `GET /assessment-answer/getByStudent/{studentId}` - Get answers by student

---

## Implementation Details

### Files Created/Modified

1. **DTO Created**: `/spring-social/src/main/java/com/kccitm/api/model/userDefinedModel/StudentDashboardResponse.java`
   - Comprehensive response structure with nested classes
   - Clean separation of concerns

2. **Controller Modified**: `/spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentAnswerController.java`
   - Added `getStudentDashboard()` endpoint
   - Validation and error handling
   - Optimized data fetching

---

## Future Enhancements

Potential improvements for this endpoint:

1. **Pagination** - For students with many assessments
2. **Filtering** - Filter by assessment type, status, date range
3. **Caching** - Cache results for frequently accessed students
4. **Partial Responses** - Allow clients to request only specific fields
5. **Sorting** - Sort assessments by date, score, name
6. **Export** - Add ability to export as PDF/Excel

---

## Testing Recommendations

### Unit Tests

```java
@Test
public void testGetStudentDashboard_Success() {
    // Test successful retrieval with valid userStudentId
}

@Test
public void testGetStudentDashboard_StudentNotFound() {
    // Test error handling for non-existent student
}

@Test
public void testGetStudentDashboard_MissingUserStudentId() {
    // Test validation for missing request parameter
}
```

### Integration Tests

1. Test with student who has no assessments
2. Test with student who has multiple completed assessments
3. Test with student who has incomplete assessments
4. Test with student who has assessments with no answers yet

---

## Changelog

**v1.0 - 2026-02-06**
- Initial implementation
- Comprehensive data aggregation
- Optimized query performance
- Complete MQT hierarchy inclusion
- Changed from GET with path parameter to POST with request body

---

**Document End**

*For questions or issues, please refer to the main project documentation or contact the development team.*
