# Coding Conventions

**Analysis Date:** 2026-02-06

## Naming Patterns

**Files (Java):**
- Controllers: PascalCase + "Controller" suffix (e.g., `AssessmentTableController.java`, `LanguageQuestionController.java`)
- Services: PascalCase + "Service" or "ServiceImpl" suffix (e.g., `PdfService.java`, `PdfServiceImpl.java`)
- Models/Entities: PascalCase (e.g., `AssessmentTable.java`, `Questionnaire.java`)
- Repositories: PascalCase + "Repository" suffix (e.g., `AssessmentTableRepository.java`)

**Files (TypeScript/React):**
- Page components: PascalCase + "Page.tsx" suffix (e.g., `AssessmentPage.tsx`)
- Feature components: PascalCase + ".tsx" (e.g., `QuestionTable.tsx`, `QuestionBulkUploadModal.tsx`)
- API files: camelCase + "_APIs.ts" suffix (e.g., `Question_APIs.ts`, `Create_Assessment_APIs.ts`)
- Hooks/utilities: camelCase + ".ts" (e.g., `AuthHelpers.ts`)

**Functions (Java):**
- camelCase with verb prefix (e.g., `getAllAssessments()`, `getAssessmentById()`, `convertHtmlToPdf()`, `generateIdCard()`)
- Controller methods match REST patterns: `getAll()`, `get()`, `create()`, `update()`, `delete()`

**Functions (TypeScript):**
- camelCase with verb prefix (e.g., `fetchAssessmentList()`, `handleExportToExcel()`, `setShowModal()`)
- React hooks: `use` prefix for custom hooks (e.g., `useAuth()`)

**Variables (Java):**
- Instance variables: camelCase (e.g., `assessmentTableRepository`, `userStudentRepository`)
- Parameters: camelCase (e.g., `submissionData`, `userStudentId`)
- Constants: UPPER_SNAKE_CASE (not consistently enforced in codebase)

**Variables (TypeScript):**
- camelCase (e.g., `assessmentData`, `showCreateModal`, `pageLoading`)
- State variables: camelCase (e.g., `[loading, setLoading]`, `[showLanguageModal, setShowLanguageModal]`)

**Types (TypeScript):**
- Interfaces/Types: PascalCase (e.g., `AuthModel`, `User`, `CollegeRow`, `ModalData`)
- Props types: Component name + "Props" (e.g., `AuthContextProps`, `QuestionTableProps`)

**Classes & Models (Java):**
- PascalCase (e.g., `UserPrincipal`, `GoogleOAuth2UserInfo`, `StudentAssessmentMapping`)
- Inconsistency: `AssessmentTable` has mixed case fields (`AssessmentName` should be `assessmentName`)

## Code Style

**Formatting:**
- Frontend: Prettier 2.6.2 configured via `package.json`
- Run: `npm run format` (write) or `npm run lint` (check)
- No custom `.prettierrc` file found; uses default Prettier settings

**Linting:**
- Frontend: ESLint via `react-scripts` (extends `react-app` and `react-app/jest`)
- No custom ESLint configuration file found
- Backend: No linting tool configured (relies on Maven)

**Indentation:**
- TypeScript: 2 spaces (Prettier default)
- Java: 4 spaces (Maven/Java convention)

## Import Organization

**Order (TypeScript/React):**
1. React/Core library imports (e.g., `import React, { useState }`)
2. Third-party library imports (e.g., `import axios from "axios"`)
3. UI library imports (e.g., `import { Button } from "react-bootstrap"`)
4. Icon library imports (e.g., `import { MdQuestionAnswer } from "react-icons/md"`)
5. Internal component imports (e.g., `import { QuestionTable } from "./components"`)
6. Local relative imports (e.g., `import { ReadAssessmentList } from "./API/Create_Assessment_APIs"`)

Example from `QuestionTable.tsx`:
```typescript
import { MDBDataTableV5 } from "mdbreact";
import { useEffect, useState } from "react";
import { AiFillEdit } from "react-icons/ai";
import { FaLightbulb, FaFileDownload } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import {
  AssignMeasuredQualityTypeToQuestion,
  DeleteQuestionData,
  // ... other imports
} from "../API/Question_APIs";
import QuestionLanguageModal from "./QuestionLanguageModal";
import QuestionBulkUploadModal from "./QuestionBulkUploadModal";
import * as XLSX from "xlsx";
```

**Path Aliases (TypeScript):**
- Not consistently used; mostly relative imports
- Some absolute imports to `_metronic/` framework (e.g., `import { LayoutSplashScreen } from "../../../../_metronic/layout/core"`)

**Order (Java):**
1. Package declaration
2. Standard library imports (java.*, javax.*)
3. Third-party imports (org.springframework.*, com.google.*, etc.)
4. Local package imports (com.kccitm.api.*)

Example from `AssessmentAnswerController.java`:
```java
package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
// ... more Spring imports
import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
```

## Error Handling

**Patterns (Java):**
- Try-catch blocks in controller methods
- Generic `catch (Exception e)` pattern (not specific exception types)
- Returns `ResponseEntity.badRequest().build()` or `ResponseEntity.internalServerError().body("message")`
- Stack trace printing with `e.printStackTrace()` (anti-pattern found in `LanguageQuestionController`)

Example from `AssessmentQuestionOptionsController.java`:
```java
try {
    // Validate that the question exists if provided
    if (assessmentQuestionOptions.getQuestion() != null
        && assessmentQuestionOptions.getQuestion().getQuestionId() != null) {
        // Process...
    }
} catch (Exception e) {
    return ResponseEntity.badRequest().build();
}
```

**Patterns (TypeScript/React):**
- Try-catch in async functions
- `console.error()` for logging errors
- Catch blocks often log error and set empty fallback state

Example from `CreateAssessment/Assessment.tsx`:
```typescript
try {
    const response = await ReadAssessmentList();
    setAssessmentData(response.data || []);
} catch (error) {
    console.error("Error fetching assessments:", error);
    setAssessmentData([]);
} finally {
    setIsDataLoading(false);
}
```

Example from `AssessmentAnswerController.java`:
```java
@PostMapping(value = "/submit", headers = "Accept=application/json")
public ResponseEntity<?> submitAssessmentAnswers(@RequestBody Map<String, Object> submissionData) {
    try {
        Long userStudentId = ((Number) submissionData.get("userStudentId")).longValue();
        UserStudent userStudent = userStudentRepository.findById(userStudentId)
            .orElseThrow(() -> new RuntimeException("UserStudent not found"));
        // ... process answers
    } catch (Exception e) {
        return ResponseEntity.status(500).body("Error: " + e.getMessage());
    }
}
```

## Logging

**Framework (Java):**
- No dedicated logging framework detected (SLF4J/Log4j)
- Uses `System.out.println()` and `e.printStackTrace()` (anti-pattern)
- Stack traces printed directly in catch blocks

**Framework (TypeScript):**
- `console.log()` for general logging
- `console.error()` for errors
- Located in files: `Auth.tsx`, `AuthHelpers.ts`, `QuestionTable.tsx`, `Assessment.tsx`, etc.

**Patterns (TypeScript):**
- Logging API responses: `console.log("Fetched assessment data:", response.data)`
- Logging errors in catch: `console.error("Error fetching assessments:", error)`
- Debugging state changes: `console.log(roles)`

**When to log:**
- API response data (in async functions)
- Errors during fetch/submission
- State changes in modal handlers
- Not logged: Regular component renders (to avoid noise)

## Comments

**When to Comment (TypeScript):**
- Complex algorithms: Yes (e.g., Excel export logic with detailed comment blocks)
- API transformations: Yes (e.g., transforming option score data)
- Logic steps: Yes (with step numbering in try blocks)

**JSDoc/TSDoc Usage:**
- Used for function documentation in API files and complex components
- Format: `/** ... */` with `@param`, `@returns`, `@see` tags

Example from `Question_APIs.ts`:
```typescript
/**
 * Export all assessment questions to Excel file
 *
 * This function calls the backend API endpoint to generate and download an Excel file
 * containing all assessment questions with their complete details including:
 * - Question information (ID, text, type, section, max options)
 * - All options for each question
 * - Measured quality type scores for each option
 *
 * The response is a binary Excel file that is automatically downloaded to the user's device
 * with a timestamped filename.
 *
 * @returns Promise that resolves when the download is complete
 */
```

**When NOT to Comment (TypeScript):**
- Self-explanatory code (e.g., `const loading = true`)
- Standard React hooks setup
- Straightforward conditional logic

**Java Comments:**
- Minimal JSDoc usage in existing code
- TODO/FIXME comments: `// TODO Auto-generated catch block` (found in `PdfServiceImpl`)
- No comprehensive method-level documentation

## Function Design

**Size (Java):**
- Controllers: 40-100+ lines per method
- Services: 30-80 lines per method
- No strict line limit enforced

**Parameters (Java):**
- Controllers accept `@PathVariable`, `@RequestBody`, individual parameters
- Services use specific types (not generic Object)
- Maps used for flexible payloads (e.g., `Map<String, Object> submissionData`)

**Return Values (Java):**
- Controllers: `ResponseEntity<T>` for REST responses
- Services: Direct return types (List, Optional, entity objects)
- Pattern: `ResponseEntity.ok(data)`, `ResponseEntity.badRequest()`, `ResponseEntity.notFound().build()`

**Size (TypeScript):**
- Components: 50-200+ lines (functional components with hooks)
- API functions: 5-30 lines
- Event handlers: 10-40 lines

**Parameters (TypeScript):**
- Components: Props typed with interfaces (e.g., `QuestionTableProps`)
- Functions: Specific parameter types (not `any` where avoidable)
- Spread operator for props passing

**Return Values (TypeScript):**
- Async API calls: `axios.get/post/put/delete` promises
- Components: JSX elements
- Event handlers: void or state updates

## Module Design

**Exports (TypeScript):**
- Barrel exports from component `index.ts` files:
  ```typescript
  export { AssessmentTable };
  ```
- Direct function exports from API files:
  ```typescript
  export function ReadAssessmentList() { ... }
  export function CreateQuestion(values: any) { ... }
  ```

**Barrel Files:**
- Used in component directories: `src/app/pages/[Feature]/components/index.ts`
- Pattern: Simplifies imports to `import { ComponentName } from "./components"`

**Exports (Java):**
- Controllers: Public classes with `@RestController` and `@RequestMapping`
- Services: Interface + implementation pattern (e.g., `PdfService` interface, `PdfServiceImpl` class)
- Repositories: Spring Data JPA interfaces extending `JpaRepository<T, ID>`

## Structural Patterns

**Dependency Injection (Java):**
- Spring `@Autowired` on instance variables
- Constructor injection not used
- Service layer injected into controllers

**State Management (TypeScript):**
- React hooks: `useState` for local state
- Context API: `AuthContext` for global auth state
- Props drilling for passing data to child components
- Array-based state: `[pageLoading, setPageLoading]` passed as array in some cases (anti-pattern in `Assessment.tsx`)

**API Calls (TypeScript):**
- Axios library for HTTP calls
- Base URL from environment: `process.env.REACT_APP_API_URL`
- API functions centralized in `API/` subdirectories
- Pattern: Separate fetch logic from components

---

*Convention analysis: 2026-02-06*
