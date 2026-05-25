# Coding Conventions

**Analysis Date:** 2026-03-06

## Code Style & Formatting

### Backend (Java)
- **Indentation:** 4 spaces (standard Java)
- **Line length:** No explicit limit, observed up to 120+ characters
- **File organization:** One class per file, Maven standard layout
- **No linter configured** — relies on IDE defaults

### Frontend (TypeScript/React)
- **Indentation:** 2 spaces
- **Formatter:** Prettier 2.6.2 (`npm run format` / `npm run lint`)
- **Linter:** ESLint via `react-app` and `react-app/jest` presets
- **TypeScript:** Strict mode enabled but `noImplicitAny: false`
- **No path aliases** — all relative imports

## Naming Conventions

### Backend (Java)

| Type | Convention | Example |
|------|-----------|---------|
| Packages | lowercase (mostly) | `controller.career9`, `repository.Career9` |
| Classes | PascalCase | `AssessmentTableController`, `CareerRepository` |
| Controllers | `{Entity}Controller` | `CareerController.java` |
| Services | `{Entity}Service` / `{Entity}ServiceImpl` | `PdfService.java` / `PdfServiceImpl.java` |
| Repositories | `{Entity}Repository` | `CareerRepository.java` |
| Methods | camelCase verb+noun | `getAllAssessments()`, `createCareer()` |
| Fields | camelCase | `assessmentId`, `userStudentId` |
| DB columns | snake_case (via `@Column`) | `assessment_id`, `is_active` |
| Logger | static final | `LoggerFactory.getLogger(ClassName.class)` |

**Known inconsistencies:**
- Package casing: `controller/career9/` vs `repository/Career9/`
- Misspelling: `Questionaire/` (missing 'n')
- Entity typo: `OptionScoreBasedOnMEasuredQualityTypes`
- Some service files use lowercase: `courseData.java`, `branchData.java`

### Frontend (TypeScript/React)

| Type | Convention | Example |
|------|-----------|---------|
| Directories | PascalCase | `Career/`, `CreateAssessment/` |
| Pages | PascalCase + suffix | `CareerPage.tsx`, `BranchPage.tsx` |
| Components | PascalCase | `CareerTable.tsx`, `BranchCreateModal.tsx` |
| API files | `{Feature}_APIs.ts` | `Career_APIs.ts`, `Branch_APIs.ts` |
| API functions | PascalCase or camelCase (inconsistent) | `ReadCareersData()`, `readBranchData()` |
| Interfaces | PascalCase `.interface.ts` | `AssessmentQuestion.interface.ts` |
| State vars | camelCase with `set` prefix | `[loading, setLoading]` |
| Props | Inline typed objects | `(props: { data: any; setLoading: any; })` |
| Barrel exports | `index.ts` | `export { default as QuestionEditPage }` |

**Heavy use of `any` type** throughout — weak typing is common.

## Import Organization

### Backend (Java)
```java
// 1. java.* standard library
// 2. javax.* Java EE
// 3. org.springframework.* Spring framework
// 4. Third-party (Jackson, Apache, etc.)
// 5. com.kccitm.api.* project imports
```
No wildcard imports observed. No enforced ordering tool.

### Frontend (TypeScript)
```typescript
// 1. React/library imports (react, react-bootstrap, axios)
// 2. UI library imports (react-icons, formik, yup)
// 3. Router imports
// 4. Local/relative imports (./API/, ../components/)
```
No import sorting enforced. All relative paths.

## Error Handling

### Backend Patterns

**Custom exceptions** in `com.kccitm.api.exception/`:
- `ResourceNotFoundException` — `@ResponseStatus(HttpStatus.NOT_FOUND)`
- `BadRequestException` — `@ResponseStatus(HttpStatus.BAD_REQUEST)`
- `OAuth2AuthenticationProcessingException`
- `EmailSendException`

**Controller response patterns:**
```java
ResponseEntity.ok(data)                              // Success
ResponseEntity.notFound().build()                    // 404
ResponseEntity.badRequest().body(error)              // 400
ResponseEntity.internalServerError().body(message)   // 500
ResponseEntity.noContent().build()                   // 204 (delete)
```

**Common anti-patterns:**
- Many controllers return `null` for not-found instead of 404
- `catch (Exception e)` bare catches (29+ instances)
- `throw new RuntimeException("message")` instead of custom exceptions
- **No global `@ControllerAdvice`** for centralized error handling

### Frontend Patterns
```typescript
try {
    await apiCall();
} catch (error) {
    console.error(error);
    // Sometimes: window.location.replace("/error");
}
```
- No centralized error boundary components
- No toast/notification system for errors
- API errors caught and logged, rarely shown to user

## Logging

### Backend
- **Framework:** SLF4J with Logback
- **Pattern:** `private static final Logger logger = LoggerFactory.getLogger(ClassName.class);`
- **Levels used:** `logger.info()`, `logger.error()`, `logger.debug()`
- **Format:** Descriptive messages with `{}` placeholders + entity IDs
- **Anti-pattern:** 82+ instances of `System.out.println` / `printStackTrace` instead of logger

### Frontend
- **Framework:** `console.log` / `console.error` (no structured logging)
- 374 instances of console logging across pages

## REST API Conventions

### URL Patterns
```
/[entity-name]/getAll              → List all
/[entity-name]/get/{id}            → Get by ID
/[entity-name]/create              → Create
/[entity-name]/update/{id}         → Update
/[entity-name]/delete/{id}         → Delete
/{entityId}/related-entities/{id}  → Relationships
```

**HTTP Methods:**
- `GET` for reads, `POST` for creates, `PUT` for updates, `DELETE` for deletes
- `POST` for custom actions: `/startAssessment`, `/submit`
- `PUT` for state changes: `/{id}/lock`, `/{id}/unlock`

**Inconsistencies noted:**
- Mix of `/getAll`, `/get`, `/getAllList`, `/get/list`
- Both `getbyid` (lowercase) and `getById` (camelCase)
- Some frontend deletes use `axios.get()` instead of `axios.delete()`

### Response Format
- Direct entity objects or `ResponseEntity<T>`
- Lists returned as JSON arrays (no wrapper)
- No pagination on many `findAll()` endpoints
- No consistent error response structure

## Dependency Injection

### Backend
**Field injection via `@Autowired` exclusively** (no constructor injection):
```java
@Autowired
private CareerRepository careerRepository;
```

### Frontend
- **React Context** for shared state (AuthContext, DataContext, AssessmentContext)
- **Props drilling** for component communication
- **No Redux/Zustand** — hooks and context only

## State Management (Frontend)

- **Component state:** `useState` hooks
- **Server state:** React Query (react-query 3.38.0)
- **Form state:** Formik + Yup validation
- **Auth state:** React Context (AuthContext + useAuth hook)
- **Data fetching:** `useEffect` with async functions

## Comments

### Backend
- Javadoc on complex public methods with `@param`/`@return`
- Inline step comments: `// Step 1: Find existing question`
- ASCII section dividers: `// ─── Locked assessment JSON snapshot helpers ───`
- Significant commented-out code left in place

### Frontend
- Minimal commenting — largely self-documenting
- Some emoji-prefixed comments: `// ✅ State for modals`
- Commented-out code blocks (legacy behavior)

## Module Design

### Backend Packages
- Base: `com.kccitm.api`
- Layers: `controller/`, `service/`, `repository/`, `model/`, `security/`, `config/`, `exception/`
- Many controllers directly access repositories (no service layer)
- Services have interface + implementation pattern when they exist

### Frontend
- Feature-based directory structure under `pages/`
- Barrel files (`index.ts`) in component directories (not all)
- API files export named functions
- No shared component library (beyond Metronic)