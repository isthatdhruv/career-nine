# Testing Patterns

**Analysis Date:** 2026-02-06

## Test Framework

**Runner (Backend):**
- JUnit (via Spring Boot Test)
- Version: Provided by Spring Boot 2.5.5 starter-test
- Config: No explicit configuration; uses defaults in `pom.xml`
- Status: **No active test files** (test directory empty: `/spring-social/src/test/java/`)

**Runner (Frontend):**
- React Testing Library + Jest
- Version: `@testing-library/react@13.1.1`, `@testing-library/jest-dom@5.16.4`, `@types/jest@27.4.1`
- Config: Uses react-scripts (embedded, no separate config file)
- Status: **No active test files** in `src/app/` (only node_modules dependencies)

**Run Commands (Backend):**
```bash
mvn test                          # Run all tests
mvn test -Dtest=ClassName        # Run single test class
mvn clean package -DskipTests     # Build without running tests
```

**Run Commands (Frontend):**
```bash
npm test                          # Run tests in watch mode
npm test -- --coverage           # Run with coverage report
# Note: No specific configuration visible; uses react-scripts defaults
```

## Test File Organization

**Location (Backend):**
- Expected: `src/test/java/` subdirectories matching source structure
- Actual: Directory exists but is empty (`/spring-social/src/test/java/`)
- Naming convention: Would follow `[ClassName]Test.java` pattern (not implemented)

**Location (Frontend):**
- Expected: Co-located with source files (`.test.tsx`, `.spec.tsx`) or separate `__tests__/` directory
- Actual: No test files found in `src/app/` (only in node_modules)
- Naming convention: Would follow `[FileName].test.tsx` pattern (not implemented)

**Structure (Expected):**
```
src/
├── app/
│   ├── pages/
│   │   └── Feature/
│   │       ├── Feature.tsx
│   │       ├── Feature.test.tsx
│   │       └── components/
│   │           ├── FeatureTable.tsx
│   │           └── FeatureTable.test.tsx
│   └── modules/
│       └── auth/
│           ├── core/
│           │   ├── Auth.tsx
│           │   └── Auth.test.tsx
│           └── __tests__/
│               └── auth.test.ts
```

## Test Structure

**Pattern (Expected - React Testing Library):**
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import AssessmentPage from './Assessment';

describe('AssessmentPage', () => {
  it('should fetch and display assessment data on mount', async () => {
    render(<AssessmentPage />);

    // Assert initial loading state
    expect(screen.getByText(/Please wait/i)).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/Assessments/i)).toBeInTheDocument();
    });
  });

  it('should handle fetch errors gracefully', async () => {
    // Mock API error
    jest.mock('./API/Create_Assessment_APIs', () => ({
      ReadAssessmentList: jest.fn(() => Promise.reject(new Error('API Error')))
    }));

    render(<AssessmentPage />);
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

**Pattern (Expected - Spring Boot/JUnit):**
```java
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class AssessmentTableControllerTest {

  @Autowired
  private MockMvc mockMvc;

  @Test
  public void testGetAllAssessments_ReturnsOkStatus() throws Exception {
    mockMvc.perform(get("/assessments/getAll"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[0].id").exists());
  }

  @Test
  public void testGetAssessmentById_WithInvalidId_ReturnsNotFound() throws Exception {
    mockMvc.perform(get("/assessments/get/999"))
      .andExpect(status().isNotFound());
  }
}
```

## Mocking

**Framework (Backend):**
- Mockito (via Spring Boot Test)
- Version: Provided by spring-boot-starter-test
- Not yet implemented in codebase

**Framework (Frontend):**
- Jest (built-in mocking)
- Potentially: `jest.mock()` or `jest.fn()`
- Not yet implemented in codebase

**Patterns (Expected - TypeScript):**
```typescript
// Mock module
jest.mock('./API/Question_APIs', () => ({
  ReadMeasuredQualityTypes: jest.fn(() => Promise.resolve({
    data: [
      { id: 1, name: 'Analytical Ability' },
      { id: 2, name: 'Problem Solving' }
    ]
  }))
}));

// Mock component
jest.mock('./QuestionLanguageModal', () => ({
  __esModule: true,
  default: () => <div>Mock Modal</div>
}));

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
mockedAxios.get.mockResolvedValue({ data: [] });
```

**Patterns (Expected - Java):**
```java
import static org.mockito.Mockito.*;

@SpringBootTest
class AssessmentQuestionControllerTest {

  @MockBean
  private AssessmentQuestionRepository questionRepository;

  @InjectMocks
  private AssessmentQuestionController controller;

  @Test
  void testGetAllQuestions() {
    // Arrange
    List<AssessmentQuestion> questions = Arrays.asList(
      new AssessmentQuestion("Q1", "What is the capital of France?")
    );
    when(questionRepository.findAll()).thenReturn(questions);

    // Act
    ResponseEntity<?> response = controller.getAllQuestions();

    // Assert
    assertThat(response.getBody()).isEqualTo(questions);
    verify(questionRepository, times(1)).findAll();
  }
}
```

**What to Mock:**
- External API calls (to avoid network requests during tests)
- Database calls (repository methods) - use `@MockBean`
- Time-dependent operations (use fake timers)
- File system operations
- Network requests (axios, fetch)

**What NOT to Mock:**
- Core business logic functions
- Utility functions
- Component rendering (test actual rendering)
- State management logic

## Fixtures and Factories

**Test Data Pattern (Expected - TypeScript):**
```typescript
// fixtures/assessmentData.ts
export const mockAssessmentData = [
  {
    id: 1,
    AssessmentName: 'Aptitude Test',
    isActive: true,
    starDate: '2026-01-01',
    endDate: '2026-01-31'
  },
  {
    id: 2,
    AssessmentName: 'Career Guidance Assessment',
    isActive: false,
    starDate: '2026-02-01',
    endDate: '2026-02-28'
  }
];

export const mockQuestionData = [
  {
    id: 1,
    questionText: 'Sample question 1?',
    questionType: 'MCQ',
    sectionId: 1,
    options: [
      { id: 1, optionText: 'Option A', isCorrect: true },
      { id: 2, optionText: 'Option B', isCorrect: false }
    ]
  }
];
```

**Factory Pattern (Expected - Java):**
```java
// factory/AssessmentQuestionFactory.java
public class AssessmentQuestionFactory {

  public static AssessmentQuestion createBasicQuestion() {
    AssessmentQuestion question = new AssessmentQuestion();
    question.setQuestionText("What is 2+2?");
    question.setQuestionType("MCQ");
    question.setMaxOptionsAllowed(4);
    return question;
  }

  public static AssessmentQuestion createWithOptions(String text, String... optionTexts) {
    AssessmentQuestion question = createBasicQuestion();
    question.setQuestionText(text);
    question.setOptions(Arrays.stream(optionTexts)
      .map(opt -> new AssessmentQuestionOptions(opt, false))
      .collect(Collectors.toList()));
    return question;
  }
}
```

**Location:**
- Frontend: Would be in `src/__fixtures__/` or `src/app/__tests__/fixtures/`
- Backend: Would be in `src/test/java/com/kccitm/api/factory/`

## Coverage

**Requirements (Current):**
- No coverage enforcement configured
- No coverage target defined

**View Coverage (Commands):**

**Frontend:**
```bash
npm test -- --coverage              # Generate coverage report
# Generates: coverage/lcov-report/index.html (open in browser)
```

**Backend:**
```bash
mvn test jacoco:report              # Generate Jacoco report
# Generates: target/site/jacoco/index.html
```

**Ideal Targets (Not enforced):**
- Unit tests: 70%+ coverage for critical paths
- Integration tests: Key user flows
- E2E tests: Critical business processes

## Test Types

**Unit Tests:**
- Scope: Individual functions, components, or methods
- Approach: Test in isolation with mocks for dependencies
- Framework: Jest (Frontend), JUnit (Backend)
- Example: Testing `ReadMeasuredQualityTypes()` API function with mocked axios
- Duration: <100ms per test

**Integration Tests:**
- Scope: Multiple components/services working together
- Approach: Use real database (with rollback) or test container
- Framework: Spring Boot Test with `@SpringBootTest`
- Example: Testing assessment submission flow: Controller → Service → Repository → Database
- Duration: 100-500ms per test

**E2E Tests:**
- Scope: Full user workflows from UI to database
- Framework: **Not yet implemented** (could use Cypress, Playwright, or Selenium)
- Example: "User creates assessment → adds questions → students submit answers → scores calculated"
- Would need: Real deployment environment, test data setup/teardown
- Duration: 1-5 seconds per test

## Common Patterns

**Async Testing (TypeScript):**

```typescript
// Pattern 1: Using waitFor
it('should load data asynchronously', async () => {
  render(<AssessmentPage />);

  await waitFor(() => {
    expect(screen.getByText(/Assessments/i)).toBeInTheDocument();
  });
});

// Pattern 2: Using async/await with findBy
it('should display fetched data', async () => {
  render(<AssessmentPage />);

  const title = await screen.findByText(/Assessments/i);
  expect(title).toBeInTheDocument();
});

// Pattern 3: Mocking async API
jest.mock('./API/Create_Assessment_APIs', () => ({
  ReadAssessmentList: jest.fn().mockResolvedValue({
    data: [{ id: 1, AssessmentName: 'Test' }]
  })
}));
```

**Async Testing (Java):**

```java
@Test
public void testAsyncOperation() throws Exception {
  mockMvc.perform(post("/assessment-answer/submit")
    .contentType(MediaType.APPLICATION_JSON)
    .content(objectMapper.writeValueAsString(submissionData)))
    .andDo(print())
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.status").value("submitted"));
}
```

**Error Testing (TypeScript):**

```typescript
it('should handle API errors gracefully', async () => {
  // Mock error response
  jest.mock('./API/Question_APIs', () => ({
    ReadQuestionsData: jest.fn(() =>
      Promise.reject(new Error('Network error'))
    )
  }));

  render(<QuestionTable data={[]} sections={[]} />);

  await waitFor(() => {
    expect(console.error).toHaveBeenCalledWith(
      'Error fetching questions:',
      expect.any(Error)
    );
  });
});
```

**Error Testing (Java):**

```java
@Test
public void testInvalidInput_ReturnsBadRequest() throws Exception {
  String invalidJson = "{ invalid json }";

  mockMvc.perform(post("/assessment-questions/create")
    .contentType(MediaType.APPLICATION_JSON)
    .content(invalidJson))
    .andExpect(status().isBadRequest());
}

@Test
public void testMissingResource_ReturnsNotFound() throws Exception {
  when(questionRepository.findById(999L)).thenReturn(Optional.empty());

  mockMvc.perform(get("/assessment-questions/get/999"))
    .andExpect(status().isNotFound());
}
```

## Current Testing Status

**Backend:**
- ✗ No unit tests implemented
- ✗ No integration tests implemented
- ✗ No E2E tests implemented
- ✓ Test framework (JUnit, Mockito, MockMvc) configured in pom.xml
- ✓ Spring Security Test available for auth testing

**Frontend:**
- ✗ No unit tests implemented
- ✗ No component tests implemented
- ✗ No E2E tests implemented
- ✓ Test framework (Jest, React Testing Library) configured in package.json
- ✓ Ready for test implementation

## Testing Recommendations

**Quick Wins:**
1. Add unit tests for API functions in `src/app/pages/*/API/*.ts` files
2. Add component tests for high-traffic components (AssessmentPage, QuestionTable)
3. Test error handling paths with mocked failures

**Critical Paths to Test:**
1. Assessment submission flow (AssessmentAnswerController.submitAssessmentAnswers)
2. Question upload/creation (QuestionBulkUploadModal)
3. Authentication flow (Auth context, login flow)
4. Measured quality type scoring logic

---

*Testing analysis: 2026-02-06*
