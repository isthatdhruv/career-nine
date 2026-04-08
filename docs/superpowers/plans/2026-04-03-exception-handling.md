# Exception Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive, standardized exception handling across the entire Career-Nine stack — backend global handler + custom exceptions + controller cleanup, frontend axios interceptor + ErrorBoundary + react-toastify + component cleanup.

**Architecture:** Single `@RestControllerAdvice` global handler catches all exceptions and returns a standardized `ApiErrorResponse` JSON. Frontend axios response interceptor displays toast notifications for API errors. React ErrorBoundary catches render crashes. All 40+ controllers and 78+ frontend components cleaned up to use the new system.

**Tech Stack:** Spring Boot 2.5.5, Java 11, React 18, TypeScript, axios, react-toastify

**Spec:** `docs/superpowers/specs/2026-04-03-exception-handling-design.md`

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `spring-social/src/main/java/com/kccitm/api/exception/ApiErrorResponse.java` | Standardized error response DTO |
| `spring-social/src/main/java/com/kccitm/api/exception/GlobalExceptionHandler.java` | `@RestControllerAdvice` — all exception-to-response mapping |
| `spring-social/src/main/java/com/kccitm/api/exception/DuplicateResourceException.java` | 409 CONFLICT exception |
| `spring-social/src/main/java/com/kccitm/api/exception/UnauthorizedAccessException.java` | 403 FORBIDDEN exception |
| `spring-social/src/main/java/com/kccitm/api/exception/ServiceException.java` | 500 generic service failure exception |

### Backend — Modified Files
| File | Change |
|------|--------|
| `exception/BadRequestException.java` | Remove `@ResponseStatus` |
| `exception/EmailSendException.java` | Remove `@ResponseStatus` |
| `exception/ResourceNotFoundException.java` | Remove `@ResponseStatus` |
| `config/SecurityConfig.java` | Add `accessDeniedHandler` |
| 40+ controller files | Remove try-catch, use custom exceptions |
| 7 service files | Replace `RuntimeException` with custom exceptions |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `react-social/src/app/utils/toast.ts` | Toast helper functions |
| `react-social/src/app/modules/errors/ErrorBoundary.tsx` | React error boundary component |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `react-social/package.json` | Add `react-toastify` |
| `react-social/src/app/App.tsx` | Wrap with ErrorBoundary + ToastContainer |
| `react-social/src/app/modules/auth/core/AuthHelpers.ts` | Add axios response interceptor |
| 78+ component files | Replace `alert()` with toast |

---

## Task 1: Create ApiErrorResponse DTO

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/exception/ApiErrorResponse.java`

- [ ] **Step 1: Create the ApiErrorResponse class**

```java
package com.kccitm.api.exception;

import java.time.LocalDateTime;

public class ApiErrorResponse {
    private int status;
    private String error;
    private String message;
    private LocalDateTime timestamp;
    private String path;

    public ApiErrorResponse(int status, String error, String message, String path) {
        this.status = status;
        this.error = error;
        this.message = message;
        this.timestamp = LocalDateTime.now();
        this.path = path;
    }

    public int getStatus() { return status; }
    public void setStatus(int status) { this.status = status; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd spring-social && mvn compile -pl . -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/exception/ApiErrorResponse.java
git commit -m "feat: add ApiErrorResponse DTO for standardized error responses"
```

---

## Task 2: Create New Custom Exception Classes

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/exception/DuplicateResourceException.java`
- Create: `spring-social/src/main/java/com/kccitm/api/exception/UnauthorizedAccessException.java`
- Create: `spring-social/src/main/java/com/kccitm/api/exception/ServiceException.java`

- [ ] **Step 1: Create DuplicateResourceException**

```java
package com.kccitm.api.exception;

public class DuplicateResourceException extends RuntimeException {
    public DuplicateResourceException(String message) {
        super(message);
    }

    public DuplicateResourceException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

- [ ] **Step 2: Create UnauthorizedAccessException**

```java
package com.kccitm.api.exception;

public class UnauthorizedAccessException extends RuntimeException {
    public UnauthorizedAccessException(String message) {
        super(message);
    }

    public UnauthorizedAccessException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

- [ ] **Step 3: Create ServiceException**

```java
package com.kccitm.api.exception;

public class ServiceException extends RuntimeException {
    public ServiceException(String message) {
        super(message);
    }

    public ServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

- [ ] **Step 4: Verify all compile**

Run: `cd spring-social && mvn compile -pl . -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/exception/DuplicateResourceException.java \
       spring-social/src/main/java/com/kccitm/api/exception/UnauthorizedAccessException.java \
       spring-social/src/main/java/com/kccitm/api/exception/ServiceException.java
git commit -m "feat: add DuplicateResourceException, UnauthorizedAccessException, ServiceException"
```

---

## Task 3: Remove @ResponseStatus from Existing Exceptions

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/exception/BadRequestException.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/exception/EmailSendException.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/exception/ResourceNotFoundException.java`

The `@ResponseStatus` annotations must be removed because the `GlobalExceptionHandler` will control HTTP status codes. Having both causes conflicts — `@ResponseStatus` would bypass the handler's `ApiErrorResponse` formatting.

- [ ] **Step 1: Update BadRequestException.java**

Remove the `@ResponseStatus` annotation and its import. The file should become:

```java
package com.kccitm.api.exception;

public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }

    public BadRequestException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

- [ ] **Step 2: Update EmailSendException.java**

Remove the `@ResponseStatus` annotation and its import. The file should become:

```java
package com.kccitm.api.exception;

public class EmailSendException extends RuntimeException {
    public EmailSendException(String message) {
        super(message);
    }

    public EmailSendException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

- [ ] **Step 3: Update ResourceNotFoundException.java**

Remove the `@ResponseStatus` annotation and its import. The file should become:

```java
package com.kccitm.api.exception;

public class ResourceNotFoundException extends RuntimeException {
    private String resourceName;
    private String fieldName;
    private Object fieldValue;

    public ResourceNotFoundException(String resourceName, String fieldName, Object fieldValue) {
        super(String.format("%s not found with %s : '%s'", resourceName, fieldName, fieldValue));
        this.resourceName = resourceName;
        this.fieldName = fieldName;
        this.fieldValue = fieldValue;
    }

    public String getResourceName() {
        return resourceName;
    }

    public String getFieldName() {
        return fieldName;
    }

    public Object getFieldValue() {
        return fieldValue;
    }
}
```

- [ ] **Step 4: Verify all compile**

Run: `cd spring-social && mvn compile -pl . -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/exception/BadRequestException.java \
       spring-social/src/main/java/com/kccitm/api/exception/EmailSendException.java \
       spring-social/src/main/java/com/kccitm/api/exception/ResourceNotFoundException.java
git commit -m "refactor: remove @ResponseStatus from exception classes, global handler will manage status codes"
```

---

## Task 4: Create GlobalExceptionHandler

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/exception/GlobalExceptionHandler.java`

- [ ] **Step 1: Create the GlobalExceptionHandler class**

```java
package com.kccitm.api.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;

import javax.servlet.http.HttpServletRequest;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleResourceNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
        logger.error("Resource not found: {}", ex.getMessage());
        ApiErrorResponse response = new ApiErrorResponse(
                HttpStatus.NOT_FOUND.value(),
                HttpStatus.NOT_FOUND.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ApiErrorResponse> handleBadRequest(BadRequestException ex, HttpServletRequest request) {
        logger.error("Bad request: {}", ex.getMessage());
        ApiErrorResponse response = new ApiErrorResponse(
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ApiErrorResponse> handleDuplicateResource(DuplicateResourceException ex, HttpServletRequest request) {
        logger.error("Duplicate resource: {}", ex.getMessage());
        ApiErrorResponse response = new ApiErrorResponse(
                HttpStatus.CONFLICT.value(),
                HttpStatus.CONFLICT.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(response, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(UnauthorizedAccessException.class)
    public ResponseEntity<ApiErrorResponse> handleUnauthorizedAccess(UnauthorizedAccessException ex, HttpServletRequest request) {
        logger.error("Unauthorized access: {}", ex.getMessage());
        ApiErrorResponse response = new ApiErrorResponse(
                HttpStatus.FORBIDDEN.value(),
                HttpStatus.FORBIDDEN.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(response, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(EmailSendException.class)
    public ResponseEntity<ApiErrorResponse> handleEmailSendException(EmailSendException ex, HttpServletRequest request) {
        logger.error("Email send failed: {}", ex.getMessage());
        ApiErrorResponse response = new ApiErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(ServiceException.class)
    public ResponseEntity<ApiErrorResponse> handleServiceException(ServiceException ex, HttpServletRequest request) {
        logger.error("Service error: {}", ex.getMessage());
        ApiErrorResponse response = new ApiErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidationException(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b)
                .orElse("Validation failed");
        logger.error("Validation error: {}", message);
        ApiErrorResponse response = new ApiErrorResponse(
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                message,
                request.getRequestURI()
        );
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleMessageNotReadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        logger.error("Message not readable: {}", ex.getMessage());
        ApiErrorResponse response = new ApiErrorResponse(
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Malformed request body",
                request.getRequestURI()
        );
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNoHandlerFound(NoHandlerFoundException ex, HttpServletRequest request) {
        logger.error("No handler found: {}", ex.getMessage());
        ApiErrorResponse response = new ApiErrorResponse(
                HttpStatus.NOT_FOUND.value(),
                HttpStatus.NOT_FOUND.getReasonPhrase(),
                "Endpoint not found: " + request.getRequestURI(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
        logger.error("Method not supported: {}", ex.getMessage());
        ApiErrorResponse response = new ApiErrorResponse(
                HttpStatus.METHOD_NOT_ALLOWED.value(),
                HttpStatus.METHOD_NOT_ALLOWED.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(response, HttpStatus.METHOD_NOT_ALLOWED);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        logger.error("Access denied: {}", ex.getMessage());
        ApiErrorResponse response = new ApiErrorResponse(
                HttpStatus.FORBIDDEN.value(),
                HttpStatus.FORBIDDEN.getReasonPhrase(),
                "You do not have permission to perform this action",
                request.getRequestURI()
        );
        return new ResponseEntity<>(response, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleGenericException(Exception ex, HttpServletRequest request) {
        logger.error("Unexpected error at {}: {}", request.getRequestURI(), ex.getMessage(), ex);
        ApiErrorResponse response = new ApiErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                "An unexpected error occurred",
                request.getRequestURI()
        );
        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd spring-social && mvn compile -pl . -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/exception/GlobalExceptionHandler.java
git commit -m "feat: add GlobalExceptionHandler with @RestControllerAdvice for all exception types"
```

---

## Task 5: Update SecurityConfig with accessDeniedHandler

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java`

- [ ] **Step 1: Add accessDeniedHandler to the security config**

In `SecurityConfig.java`, find the `.exceptionHandling()` block at line 130-131 and add the `accessDeniedHandler` after the `authenticationEntryPoint`:

Change:
```java
                .exceptionHandling()
                .authenticationEntryPoint(new RestAuthenticationEntryPoint())
```

To:
```java
                .exceptionHandling()
                .authenticationEntryPoint(new RestAuthenticationEntryPoint())
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setContentType("application/json");
                    response.setStatus(403);
                    response.getWriter().write("{\"status\":403,\"error\":\"Forbidden\",\"message\":\"You do not have permission to perform this action\",\"path\":\"" + request.getRequestURI() + "\"}");
                })
```

- [ ] **Step 2: Verify it compiles**

Run: `cd spring-social && mvn compile -pl . -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java
git commit -m "feat: add accessDeniedHandler to SecurityConfig for standardized 403 responses"
```

---

## Task 6: Clean Up Backend Controllers — Career9 CRUD Controllers

These are the simpler CRUD controllers with `.orElse(null)` + null checks and `ResponseEntity.notFound()` patterns. Apply these transformations:

- `.orElse(null)` + null check → `.orElseThrow(() -> new ResourceNotFoundException("Entity", "id", id))`
- `ResponseEntity.notFound().build()` → `throw new ResourceNotFoundException("Entity", "id", id)`
- `throw new RuntimeException("X not found")` → `throw new ResourceNotFoundException("X", "id", id)`
- Try-catch that just returns `ResponseEntity.status(500)` → remove, let GlobalExceptionHandler catch it

**Files to modify (one at a time, read each file first, then apply transformations):**

- [ ] **Step 1: Clean up CareerController.java**

File: `spring-social/src/main/java/com/kccitm/api/controller/career9/CareerController.java`

Add import at top:
```java
import com.kccitm.api.exception.ResourceNotFoundException;
```

Line 33 — change `return careerRepository.findById(id).orElse(null);` to:
```java
return careerRepository.findById(id)
    .orElseThrow(() -> new ResourceNotFoundException("Career", "id", id));
```

Lines 42-43 — change `orElseThrow(() -> new RuntimeException("Career not found"))` to:
```java
.orElseThrow(() -> new ResourceNotFoundException("Career", "id", id));
```

Lines 53-57 — change the `.orElse(null)` + null check + `ResponseEntity.notFound()` block to:
```java
Career career = careerRepository.findById(id)
    .orElseThrow(() -> new ResourceNotFoundException("Career", "id", id));
```

Lines 68-71 — change the `.orElse(null)` + null check block to:
```java
Career career = careerRepository.findById(id)
    .orElseThrow(() -> new ResourceNotFoundException("Career", "id", id));
return new java.util.ArrayList<>(career.getMeasuredQualityTypes());
```

- [ ] **Step 2: Clean up ToolController.java**

File: `spring-social/src/main/java/com/kccitm/api/controller/career9/ToolController.java`

Add import at top:
```java
import com.kccitm.api.exception.ResourceNotFoundException;
```

Line 37 — change `return toolRepository.findById(id).orElse(null);` to:
```java
return toolRepository.findById(id)
    .orElseThrow(() -> new ResourceNotFoundException("Tool", "id", id));
```

Lines 60-82 — remove the try-catch block in `deleteTool`. Replace the `.orElse(null)` + null check with `.orElseThrow(...)`. The method becomes:
```java
public ResponseEntity<String> deleteTool(@PathVariable Long id) {
    Tool tool = toolRepository.findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("Tool", "id", id));

    for (MeasuredQualities quality : tool.getMeasuredQualities()) {
        quality.removeTool(tool);
        continue;
    }

    tool.getMeasuredQualities().clear();
    toolRepository.save(tool);

    toolRepository.deleteById(id);

    return ResponseEntity.ok("Tool deleted successfully");
}
```

Lines 88-89 — replace the `.orElse(null)` + null check pattern in `addMeasuredQualityToTool`:
```java
Tool tool = toolRepository.findById(toolId)
    .orElseThrow(() -> new ResourceNotFoundException("Tool", "id", toolId));
MeasuredQualities measuredQuality = measuredQualitiesRepository.findById(qualityId)
    .orElseThrow(() -> new ResourceNotFoundException("MeasuredQuality", "id", qualityId));
```
Remove the `if (tool == null || measuredQuality == null)` check entirely.

Apply the same pattern to `removeMeasuredQualityFromTool` (lines 102-107) and `getToolMeasuredQualities` (lines 117-122).

- [ ] **Step 3: Continue with remaining Career9 CRUD controllers**

Apply the same patterns to each of these controllers. For each file: read it first, then apply the transformations. The patterns are always the same:

1. `MeasuredQualitiesController.java` — `.orElse(null)` + null checks → `.orElseThrow(...)`
2. `MeasuredQualityTypesController.java` — `.orElse(null)` + null checks → `.orElseThrow(...)`
3. `OptionScoreController.java` — try-catch → remove, `.orElse(null)` → `.orElseThrow(...)`
4. `QuestionSectionController.java` — `.orElse(null)` + null checks → `.orElseThrow(...)`
5. `AssessmentQuestionController.java` — try-catch + `.orElse(null)` → `.orElseThrow(...)`
6. `AssessmentQuestionOptionsController.java` — `.orElse(null)` + null checks → `.orElseThrow(...)`
7. `AssessmentTableController.java` — `.orElse(null)` + null checks → `.orElseThrow(...)`
8. `LanguageQuestionController.java` — try-catch → remove
9. `LanguageOptionsController.java` — `.orElse(null)` → `.orElseThrow(...)`
10. `LanguagesSupportedController.java` — `.orElse(null)` → `.orElseThrow(...)`
11. `DemographicFieldController.java` — `ResponseEntity.notFound()` → `.orElseThrow(...)`
12. `LiveTrackingController.java` — `.orElse(null)` → `.orElseThrow(...)`
13. `SchoolSessionController.java` — `ResponseEntity.notFound()` → `.orElseThrow(...)`
14. `HeartbeatController.java` — try-catch → remove
15. `GameResultsController.java` — try-catch + `ResponseEntity.notFound()` → `.orElseThrow(...)`

For every file, add the import: `import com.kccitm.api.exception.ResourceNotFoundException;`

- [ ] **Step 4: Verify all compile**

Run: `cd spring-social && mvn compile -pl . -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/controller/career9/
git commit -m "refactor: clean up Career9 CRUD controllers to use ResourceNotFoundException"
```

---

## Task 7: Clean Up Backend Controllers — Counselling Controllers

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/CounsellingAppointmentController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/CounsellingSlotController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/SessionNotesController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/StudentCounsellorMappingController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/AvailabilityTemplateController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/CounsellorController.java`

- [ ] **Step 1: Read each counselling controller file**

Read all 6 files listed above to understand their current error handling patterns.

- [ ] **Step 2: Apply transformations to each counselling controller**

Apply the same patterns as Task 6:
- `.orElse(null)` + null check → `.orElseThrow(() -> new ResourceNotFoundException(...))`
- `ResponseEntity.notFound().build()` → `throw new ResourceNotFoundException(...)`
- Try-catch blocks that just format error responses → remove
- Keep try-catch blocks that do partial recovery (e.g., catch and log but continue)

Add imports to each file:
```java
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.exception.ServiceException;
```

- [ ] **Step 3: Verify compile**

Run: `cd spring-social && mvn compile -pl . -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/
git commit -m "refactor: clean up counselling controllers to use custom exceptions"
```

---

## Task 8: Clean Up Backend Controllers — Complex Controllers

These controllers have more complex error handling: `ResponseEntity.status(500)`, multiple try-catch blocks, and `RuntimeException` throws.

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentAnswerController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentProctoringController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/NavigatorReportDataController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/BetReportDataController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/ReportTemplateController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/GeneralAssessmentController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentInstituteMappingController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentDemographicMappingController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/OmrColumnMappingController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/StudentDemographicResponseController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/LeadController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/QuestionMediaController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/StudentController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/FirebaseDataMappingController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/Questionaire/QuestionnaireController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/Questionaire/QuestionnaireLanguageController.java`

- [ ] **Step 1: Read each complex controller file**

Read all files listed above to understand their specific error patterns.

- [ ] **Step 2: Apply transformations**

For `AssessmentAnswerController.java` (most complex, 56 try-catch blocks):
- Line 554: `throw new RuntimeException("Multiple students matched...")` → `throw new BadRequestException("Multiple students matched...")`
- Line 611: `throw new RuntimeException("Student name is required")` → `throw new BadRequestException("Student name is required")`
- Line 791: `throw new RuntimeException("Roll number is required")` → `throw new BadRequestException("Roll number is required")`
- Line 797: `throw new RuntimeException("No student found...")` → `throw new ResourceNotFoundException("Student", "rollNumber", rollNumber)`
- Line 805: `throw new RuntimeException("No student info found...")` → `throw new ResourceNotFoundException("StudentInfo", "rollNumber", rollNumber)`
- `.orElse(null)` patterns → `.orElseThrow(() -> new ResourceNotFoundException(...))`
- `ResponseEntity.status(500).body(...)` → `throw new ServiceException(...)`
- Try-catch blocks wrapping entire methods → remove if they just catch and return 500

For `AssessmentProctoringController.java`:
- `ResponseEntity.status(500).body(...)` → `throw new ServiceException(...)`

For `LeadController.java`:
- `ResponseEntity.status(500).body(...)` → `throw new ServiceException(...)`

For all other controllers: apply the standard `.orElse(null)` → `.orElseThrow(...)` and `ResponseEntity.notFound()` → `throw new ResourceNotFoundException(...)` patterns.

Add imports to each file:
```java
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ServiceException;
```

**Critical safety rule:** If a try-catch is wrapping a non-critical async operation (like activity logging or meeting link generation), KEEP it. Only remove try-catch blocks that exist solely to format error responses.

- [ ] **Step 3: Verify compile**

Run: `cd spring-social && mvn compile -pl . -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/controller/career9/
git commit -m "refactor: clean up complex Career9 controllers to use custom exceptions"
```

---

## Task 9: Clean Up Backend Controllers — Non-Career9 Controllers

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/UserController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/StudentInfoController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/AuthController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/EmailController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/RoleController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/FacultyContoller.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/CompilerController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/UniversityMarkController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/ReportGenerationController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/ContactPersonController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/dashboard/DashboardController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/teacher/ClassTeacherDashboardController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/principal/PrincipalDashboardController.java`

- [ ] **Step 1: Read each non-Career9 controller**

Read all files listed above.

- [ ] **Step 2: Apply transformations**

For `UserController.java`:
- Lines 213, 307: `ResponseEntity.status(500).body(...)` → `throw new ServiceException(...)`
- `.orElse(null)` + null check → `.orElseThrow(...)`

For `AuthController.java`:
- Keep the existing `BadRequestException` throws (already correct)
- Keep try-catch around async activity logging (partial recovery)
- Replace `DuplicateResourceException` where `BadRequestException` is used for "Email already in use" patterns

For `EmailController.java`:
- `ResponseEntity.status(500).body(...)` in catch block → remove try-catch, let GlobalExceptionHandler catch `EmailSendException`

For `DashboardController.java`, `ClassTeacherDashboardController.java`, `PrincipalDashboardController.java`:
- `ResponseEntity.status(500).body(...)` → `throw new ServiceException(...)`

For all remaining controllers: apply standard patterns.

Add imports to each file:
```java
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.exception.ServiceException;
```

- [ ] **Step 3: Verify compile**

Run: `cd spring-social && mvn compile -pl . -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/controller/
git commit -m "refactor: clean up non-Career9 controllers to use custom exceptions"
```

---

## Task 10: Clean Up Backend Service Layer

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/service/counselling/StudentCounsellorMappingService.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/service/counselling/AppointmentService.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/service/counselling/BookingService.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/service/GeneralAssessmentExportService.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/service/Navigator/NavigatorAISummaryService.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/service/OdooLeadService.java`

- [ ] **Step 1: Read each service file**

Read all 6 files listed above.

- [ ] **Step 2: Apply transformations**

For `StudentCounsellorMappingService.java`:
- Line 45: `throw new RuntimeException("Student X is already assigned...")` → `throw new DuplicateResourceException("Student " + studentId + " is already assigned to counsellor " + counsellorId)`
- Line 61: `.orElseThrow(() -> new RuntimeException("Student not found..."))` → `.orElseThrow(() -> new ResourceNotFoundException("Student", "id", studentId))`
- Line 64: `.orElseThrow(() -> new RuntimeException("Counsellor not found..."))` → `.orElseThrow(() -> new ResourceNotFoundException("Counsellor", "id", counsellorId))`
- Line 98: `.orElseThrow(() -> new RuntimeException("Mapping not found..."))` → `.orElseThrow(() -> new ResourceNotFoundException("StudentCounsellorMapping", "id", mappingId))`

For `AppointmentService.java`:
- All `.orElseThrow(() -> new RuntimeException("Appointment not found..."))` → `.orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId))`
- `.orElseThrow(() -> new RuntimeException("Counsellor not found..."))` → `.orElseThrow(() -> new ResourceNotFoundException("Counsellor", "id", counsellorId))`
- `.orElseThrow(() -> new RuntimeException("New slot not found..."))` → `.orElseThrow(() -> new ResourceNotFoundException("Slot", "id", newSlotId))`
- `throw new RuntimeException("Cannot cancel: session starts within...")` → `throw new BadRequestException("Cannot cancel: session starts within...")`
- `throw new RuntimeException("Cannot reschedule: session starts within...")` → `throw new BadRequestException("Cannot reschedule: session starts within...")`
- `throw new RuntimeException("New slot X is not available...")` → `throw new BadRequestException("New slot " + newSlotId + " is not available...")`
- Keep the try-catch around meeting link generation (partial recovery)

For `BookingService.java`:
- `.orElseThrow(() -> new RuntimeException("Slot not found..."))` → `.orElseThrow(() -> new ResourceNotFoundException("Slot", "id", slotId))`
- `throw new RuntimeException("Slot X is not available for booking...")` → `throw new BadRequestException("Slot " + slotId + " is not available for booking...")`

For `GeneralAssessmentExportService.java`:
- `.orElseThrow(() -> new RuntimeException("Assessment not found..."))` → `.orElseThrow(() -> new ResourceNotFoundException("Assessment", "id", assessmentId))`
- `.orElseThrow(() -> new RuntimeException("No mapping found..."))` → `.orElseThrow(() -> new ResourceNotFoundException("StudentAssessmentMapping", "studentId/assessmentId", userStudentId + "/" + assessmentId))`
- `throw new RuntimeException("No completed students found...")` → `throw new ResourceNotFoundException("CompletedStudents", "assessmentId", assessmentId)`

For `NavigatorAISummaryService.java`:
- `throw new RuntimeException("OpenAI API key not configured...")` → `throw new ServiceException("OpenAI API key not configured...")`

For `OdooLeadService.java`:
- `throw new RuntimeException("Odoo create failed...")` → `throw new ServiceException("Odoo create failed...")`

Add imports to each file:
```java
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.DuplicateResourceException;
import com.kccitm.api.exception.ServiceException;
```
(Only add the imports actually used in each file.)

- [ ] **Step 3: Verify compile**

Run: `cd spring-social && mvn compile -pl . -q 2>&1 | tail -5`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/service/
git commit -m "refactor: replace RuntimeException with custom exceptions in service layer"
```

---

## Task 11: Install react-toastify and Create Toast Utility

**Files:**
- Modify: `react-social/package.json`
- Create: `react-social/src/app/utils/toast.ts`

- [ ] **Step 1: Install react-toastify**

Run: `cd react-social && npm install react-toastify`

- [ ] **Step 2: Create toast utility**

Create `react-social/src/app/utils/toast.ts`:

```typescript
import { toast } from 'react-toastify';

export const showErrorToast = (message: string) => {
  toast.error(message, {
    position: 'top-right',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
  });
};

export const showSuccessToast = (message: string) => {
  toast.success(message, {
    position: 'top-right',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
  });
};

export const showWarningToast = (message: string) => {
  toast.warn(message, {
    position: 'top-right',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
  });
};
```

- [ ] **Step 3: Commit**

```bash
git add react-social/package.json react-social/package-lock.json react-social/src/app/utils/toast.ts
git commit -m "feat: install react-toastify and create toast utility helpers"
```

---

## Task 12: Create React ErrorBoundary Component

**Files:**
- Create: `react-social/src/app/modules/errors/ErrorBoundary.tsx`

- [ ] **Step 1: Create the ErrorBoundary component**

```tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'Arial, sans-serif',
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#333' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '1rem', color: '#666', marginBottom: '2rem' }}>
            An unexpected error occurred. Please try reloading the page.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '10px 24px',
              fontSize: '1rem',
              backgroundColor: '#263B6A',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

- [ ] **Step 2: Commit**

```bash
git add react-social/src/app/modules/errors/ErrorBoundary.tsx
git commit -m "feat: add React ErrorBoundary component for uncaught render errors"
```

---

## Task 13: Add Axios Response Interceptor

**Files:**
- Modify: `react-social/src/app/modules/auth/core/AuthHelpers.ts`

- [ ] **Step 1: Update setupAxios to add response interceptor**

The existing `setupAxios` function (lines 50-63) currently only has a request interceptor. Add a response interceptor after it. The complete function should become:

```typescript
export function setupAxios(axios: any) {
  axios.defaults.headers.Accept = "application/json";
  axios.interceptors.request.use(
    (config: { headers: { Authorization: string } }) => {
      const auth = getAuth();
      if (auth && auth.api_token) {
        config.headers.Authorization = `Bearer ${auth.api_token}`;
      }

      return config;
    },
    (err: any) => Promise.reject(err)
  );

  axios.interceptors.response.use(
    (response: any) => response,
    (error: any) => {
      if (!error.response) {
        const { showErrorToast } = require('../../utils/toast');
        showErrorToast('Connection issue, check your internet');
        return Promise.reject(error);
      }

      const status = error.response.status;
      const message = error.response?.data?.message || '';

      if (status === 401) {
        const { showErrorToast } = require('../../utils/toast');
        showErrorToast('Session expired, please log in again');
        removeAuth();
        window.location.href = '/auth';
        return Promise.reject(error);
      }

      if (status === 403) {
        const { showErrorToast } = require('../../utils/toast');
        showErrorToast(message || 'You don\'t have permission for this action');
        return Promise.reject(error);
      }

      if (status >= 500) {
        const { showErrorToast } = require('../../utils/toast');
        showErrorToast(message || 'Something went wrong, please try again');
        return Promise.reject(error);
      }

      // 400, 409, and other client errors pass through to the component
      return Promise.reject(error);
    }
  );
}
```

Note: Using `require()` instead of top-level import to avoid circular dependency issues — `AuthHelpers.ts` is loaded very early in the app lifecycle.

- [ ] **Step 2: Commit**

```bash
git add react-social/src/app/modules/auth/core/AuthHelpers.ts
git commit -m "feat: add axios response interceptor for global error handling with toast notifications"
```

---

## Task 14: Integrate ErrorBoundary and ToastContainer in App.tsx

**Files:**
- Modify: `react-social/src/app/App.tsx`

- [ ] **Step 1: Update App.tsx**

The current `App.tsx` wraps content with Suspense, I18nProvider, LayoutProvider, and AuthInit. Add ErrorBoundary as the outermost wrapper and ToastContainer inside.

The file should become:

```tsx
import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { I18nProvider } from "../_metronic/i18n/i18nProvider";
import { MasterInit } from "../_metronic/layout/MasterInit";
import { LayoutProvider, LayoutSplashScreen } from "../_metronic/layout/core";
import { AuthInit } from "./modules/auth";
import ErrorBoundary from "./modules/errors/ErrorBoundary";

const App = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LayoutSplashScreen />}>
        <I18nProvider>
          <LayoutProvider>
            <AuthInit>
              <Outlet />
              <MasterInit />
              <ToastContainer />
            </AuthInit>
          </LayoutProvider>
        </I18nProvider>
      </Suspense>
    </ErrorBoundary>
  );
};

export { App };
```

- [ ] **Step 2: Commit**

```bash
git add react-social/src/app/App.tsx
git commit -m "feat: integrate ErrorBoundary and ToastContainer in App.tsx"
```

---

## Task 15: Replace alert() Calls in Frontend Components — Counselling Pages

**Files:**
- Modify: `react-social/src/app/pages/Counselling/student/SlotBookingPage.tsx`
- Modify: `react-social/src/app/pages/Counselling/student/StudentCounsellingPage.tsx`
- Modify: `react-social/src/app/pages/Counselling/counsellor/AvailabilityManagerPage.tsx`
- Modify: `react-social/src/app/pages/Counselling/counsellor/CounsellorDashboardPage.tsx`
- Modify: `react-social/src/app/pages/Counselling/admin/CounsellorManagementPage.tsx`
- Modify: `react-social/src/app/pages/CounsellorDashboard/components/MessagesPanel.tsx`

- [ ] **Step 1: Read each file and identify all alert() calls**

Read all 6 files listed above.

- [ ] **Step 2: Replace alert() calls with toast**

For each file:
1. Add import: `import { showErrorToast, showSuccessToast } from '../../../utils/toast';` (adjust relative path per file)
2. Replace `alert("Error: ...")` → `showErrorToast("...")`
3. Replace `alert("Success: ...")` or `alert("...successfully...")` → `showSuccessToast("...")`
4. Replace `alert("Failed to ...")` → `showErrorToast("Failed to ...")`

- [ ] **Step 3: Commit**

```bash
git add react-social/src/app/pages/Counselling/ react-social/src/app/pages/CounsellorDashboard/components/MessagesPanel.tsx
git commit -m "refactor: replace alert() with toast notifications in counselling pages"
```

---

## Task 16: Replace alert() Calls in Frontend Components — Assessment & Question Pages

**Files:**
- Modify: `react-social/src/app/pages/CreateAssessment/components/assessment/AssessmentTable.tsx`
- Modify: `react-social/src/app/pages/CreateAssessment/components/assessment/AssessmentEditPage.tsx`
- Modify: `react-social/src/app/pages/CreateAssessment/components/assessment/AssessmentEditandCreatePage.tsx`
- Modify: `react-social/src/app/pages/CreateAssessment/components/assessment/AssessmentCreateModal.tsx`
- Modify: `react-social/src/app/pages/CreateAssessment/components/assessment/AssessmentDemographicConfig.tsx`
- Modify: `react-social/src/app/pages/CreateAssessment/components/questionaire/QuestionareCreateSinglePage.tsx`
- Modify: `react-social/src/app/pages/CreateAssessment/components/questionaire/QuestionareEditSinglePage.tsx`
- Modify: `react-social/src/app/pages/CreateAssessment/components/AssessmentQuestion.tsx`
- Modify: `react-social/src/app/pages/CreateAssessment/utils/generateQuestionnairePDF.ts`
- Modify: `react-social/src/app/pages/CreateAssessment/utils/generateOMRSheet.ts`
- Modify: `react-social/src/app/pages/AssesmentQuestions/components/QuestionCreatePage.tsx`
- Modify: `react-social/src/app/pages/AssesmentQuestions/components/QuestionEditPage.tsx`
- Modify: `react-social/src/app/pages/AssesmentQuestions/components/QuestionLanguageModal.tsx`
- Modify: `react-social/src/app/pages/AssesmentQuestions/components/QuestionCreateModal.tsx`
- Modify: `react-social/src/app/pages/AssesmentQuestions/components/QuestionTable.tsx`
- Modify: `react-social/src/app/pages/AssesmentQuestions/components/QuestionBulkUploadModal.tsx`
- Modify: `react-social/src/app/pages/AssesmentQuestions/components/QuestionDuplicatesPage.tsx`
- Modify: `react-social/src/app/pages/AssesmentQuestions/components/QuestionRecycleBinModal.tsx`
- Modify: `react-social/src/app/pages/QuestionSections/components/QuestionSectionRecycleBinModal.tsx`

- [ ] **Step 1: Read each file and identify all alert() calls**

- [ ] **Step 2: Replace alert() calls with toast**

For each file: add toast import, replace `alert()` with `showErrorToast()` or `showSuccessToast()`.

- [ ] **Step 3: Commit**

```bash
git add react-social/src/app/pages/CreateAssessment/ react-social/src/app/pages/AssesmentQuestions/ react-social/src/app/pages/QuestionSections/
git commit -m "refactor: replace alert() with toast in assessment and question pages"
```

---

## Task 17: Replace alert() Calls in Frontend Components — Reports Pages

**Files:**
- Modify: `react-social/src/app/pages/Reports/ReportsPage.tsx`
- Modify: `react-social/src/app/pages/ReportGeneration/ReportGenerationPage.tsx`
- Modify: `react-social/src/app/pages/ReportGeneration/components/ReportGenerationPage.tsx`

- [ ] **Step 1: Read each file and identify all alert() calls**

`ReportsPage.tsx` has 15 alert() calls. `ReportGenerationPage.tsx` files have 20+ combined.

- [ ] **Step 2: Replace alert() calls with toast**

For each file: add toast import, replace `alert()` with `showErrorToast()` or `showSuccessToast()`.

- [ ] **Step 3: Commit**

```bash
git add react-social/src/app/pages/Reports/ react-social/src/app/pages/ReportGeneration/
git commit -m "refactor: replace alert() with toast in report pages"
```

---

## Task 18: Replace alert() Calls in Frontend Components — Student & Registration Pages

**Files:**
- Modify: `react-social/src/app/pages/StudentRegistration/StudentRegistrationForm.tsx`
- Modify: `react-social/src/app/pages/StudentRegistration/StudentRegistrationExisting.tsx`
- Modify: `react-social/src/app/pages/StudentRegistration/ReFillFormPage.tsx`
- Modify: `react-social/src/app/pages/StudentInformation/StudentsList.tsx`
- Modify: `react-social/src/app/pages/StudentInformation/ResetAssessmentModal.tsx`
- Modify: `react-social/src/app/pages/StudentInformation/StudentAnswerExcelModal.tsx`
- Modify: `react-social/src/app/pages/StudentInformation/CreateStudentModal.tsx`
- Modify: `react-social/src/app/pages/StudentLogin/StudentLoginPage.tsx`
- Modify: `react-social/src/app/pages/StudentLogin/DemographicDetailsPage.tsx`
- Modify: `react-social/src/app/pages/StudentLogin/DynamicDemographicForm.tsx`
- Modify: `react-social/src/app/pages/StudentDashboard/student-portal/components/YourReports.tsx`
- Modify: `react-social/src/app/pages/AssessmentRegister/AssessmentRegisterPage.tsx`

- [ ] **Step 1: Read each file and identify all alert() calls**

- [ ] **Step 2: Replace alert() calls with toast**

For each file: add toast import, replace `alert()` with `showErrorToast()` or `showSuccessToast()`.

- [ ] **Step 3: Commit**

```bash
git add react-social/src/app/pages/StudentRegistration/ react-social/src/app/pages/StudentInformation/ \
       react-social/src/app/pages/StudentLogin/ react-social/src/app/pages/StudentDashboard/ \
       react-social/src/app/pages/AssessmentRegister/
git commit -m "refactor: replace alert() with toast in student and registration pages"
```

---

## Task 19: Replace alert() Calls in Frontend Components — Admin & Entity Pages

**Files:**
- Modify: `react-social/src/app/pages/Career/components/CareerTable.tsx`
- Modify: `react-social/src/app/pages/Career/components/CareerCreatePage.tsx`
- Modify: `react-social/src/app/pages/Career/components/CareerEditPage.tsx`
- Modify: `react-social/src/app/pages/MeasuredQualityTypes/components/MeasuredQualityTypesTable.tsx`
- Modify: `react-social/src/app/pages/MeasuredQualityTypes/components/MeasuredQualityTypesEditPage.tsx`
- Modify: `react-social/src/app/pages/MeasuredQualities/components/MeasuredQualitiesTable.tsx`
- Modify: `react-social/src/app/pages/MeasuredQualities/components/MeasuredQualitiesEditPage.tsx`
- Modify: `react-social/src/app/pages/Tool/components/ToolTable.tsx`
- Modify: `react-social/src/app/pages/Tool/components/ToolEditPage.tsx`
- Modify: `react-social/src/app/pages/DemographicFields/components/DemographicFieldTable.tsx`
- Modify: `react-social/src/app/pages/DemographicFields/components/DemographicFieldEditPage.tsx`
- Modify: `react-social/src/app/pages/DemographicFields/components/DemographicFieldCreatePage.tsx`
- Modify: `react-social/src/app/pages/List/components/ListEditPage.tsx`
- Modify: `react-social/src/app/pages/List/components/ListTable.tsx`
- Modify: `react-social/src/app/pages/Leads/LeadsPage.tsx`
- Modify: `react-social/src/app/pages/ScoreDebug/ScoreDebugPage.tsx`
- Modify: `react-social/src/app/pages/LiveTracking/LiveTrackingPage.tsx`

- [ ] **Step 1: Read each file and identify all alert() calls**

- [ ] **Step 2: Replace alert() calls with toast**

For each file: add toast import, replace `alert()` with `showErrorToast()` or `showSuccessToast()`.

- [ ] **Step 3: Commit**

```bash
git add react-social/src/app/pages/Career/ react-social/src/app/pages/MeasuredQualityTypes/ \
       react-social/src/app/pages/MeasuredQualities/ react-social/src/app/pages/Tool/ \
       react-social/src/app/pages/DemographicFields/ react-social/src/app/pages/List/ \
       react-social/src/app/pages/Leads/ react-social/src/app/pages/ScoreDebug/ \
       react-social/src/app/pages/LiveTracking/
git commit -m "refactor: replace alert() with toast in admin and entity management pages"
```

---

## Task 20: Replace alert() Calls in Frontend Components — Remaining Pages

**Files:**
- Modify: `react-social/src/app/modules/accounts/components/settings/cards/DeactivateAccount.tsx`
- Modify: `react-social/src/app/pages/dashboard/InstituteDashboard.tsx`
- Modify: `react-social/src/app/pages/ContactPerson/components/ContactPersonTable.tsx`
- Modify: `react-social/src/app/pages/ContactPerson/components/ContactPersonEditModal.tsx`
- Modify: `react-social/src/app/pages/Users/components/UserCollegeMappingModal.tsx`
- Modify: `react-social/src/app/pages/College/components/CollegeTable.tsx`
- Modify: `react-social/src/app/pages/College/components/CollegeSectionSessionGradeModal.tsx`
- Modify: `react-social/src/app/pages/College/components/AssessmentMappingModal.tsx`
- Modify: `react-social/src/app/pages/College/components/InstituteRecycleBinModal.tsx`
- Modify: `react-social/src/app/pages/OfflineAssessmentUpload/OMRDataUploadPage.tsx`
- Modify: `react-social/src/app/pages/OfflineAssessmentUpload/OfflineAssessmentUploadPage.tsx`
- Modify: `react-social/src/app/pages/GroupStudent/GroupStudentPage.tsx`
- Modify: `react-social/src/app/pages/GroupStudent/GroupStudentAdminPage.tsx`
- Modify: `react-social/src/app/pages/GroupStudent/GroupStudentSchoolPage.tsx`
- Modify: `react-social/src/app/pages/Login/components/LoginCheckEmail.tsx`
- Modify: `react-social/src/app/pages/Login/components/LoginEnterEmail.tsx`
- Modify: `react-social/src/app/pages/Login/components/LoginChangePassword.tsx`
- Modify: `react-social/src/app/pages/Forgot-Password/ForgotPassword.tsx`

- [ ] **Step 1: Read each file and identify all alert() calls**

- [ ] **Step 2: Replace alert() calls with toast**

For each file: add toast import, replace `alert()` with `showErrorToast()` or `showSuccessToast()`.

- [ ] **Step 3: Commit**

```bash
git add react-social/src/app/modules/accounts/ react-social/src/app/pages/dashboard/ \
       react-social/src/app/pages/ContactPerson/ react-social/src/app/pages/Users/ \
       react-social/src/app/pages/College/ react-social/src/app/pages/OfflineAssessmentUpload/ \
       react-social/src/app/pages/GroupStudent/ react-social/src/app/pages/Login/ \
       react-social/src/app/pages/Forgot-Password/
git commit -m "refactor: replace alert() with toast in remaining pages"
```

---

## Task 21: Final Verification

- [ ] **Step 1: Verify backend compiles**

Run: `cd spring-social && mvn compile -pl . -q 2>&1 | tail -10`
Expected: BUILD SUCCESS

- [ ] **Step 2: Verify no remaining alert() calls in frontend**

Run: `cd react-social && grep -r "alert(" src/app --include="*.tsx" --include="*.ts" -l | grep -v node_modules | grep -v assessmentApi.ts`
Expected: No files (or only files where alert() is part of variable names, not function calls)

- [ ] **Step 3: Verify no remaining RuntimeException throws in backend controllers/services**

Run: `grep -r "throw new RuntimeException" spring-social/src/main/java/com/kccitm/api/controller/ spring-social/src/main/java/com/kccitm/api/service/ --include="*.java" -l`
Expected: No files

- [ ] **Step 4: Verify no remaining ResponseEntity.status(500) in controllers**

Run: `grep -r "ResponseEntity.status(500)" spring-social/src/main/java/com/kccitm/api/controller/ --include="*.java" -l`
Expected: No files

- [ ] **Step 5: Commit any remaining fixes**

If any issues were found in steps 2-4, fix them and commit.
