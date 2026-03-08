# External Integrations

**Analysis Date:** 2026-03-06

## Authentication & OAuth2

### OAuth2 Providers

**Google OAuth2:**
- Dev/Staging Client ID: `101961828065-ak601ssij07ugrffovuns8v2adrqvtqd.apps.googleusercontent.com`
- Production Client ID: `701038408648-gnmlifdksik4mqu2as5vpgpe64l8m55b.apps.googleusercontent.com`
- Scopes: email, profile, admin.directory.user, admin.directory.group, admin.directory.orgunit

**Facebook OAuth2:**
- Client ID: `121189305185277`
- Scopes: email, public_profile
- API Version: v3.0

**GitHub OAuth2:**
- Client ID: `d3e47fc2ddd966fa4352`
- Scopes: user:email, read:user

### JWT Token Management
- Expiration: 864,000,000 ms (10 days)
- Header: `Authorization: Bearer <token>`

### Authorized Redirect URIs (all profiles)
- `https://student.kccitm.in/oauth2/redirect`
- `https://staging.student.kccitm.in/oauth2/redirect`
- `http://localhost:3000/oauth2/redirect`
- `myandroidapp://oauth2/redirect` (mobile)
- `myiosapp://oauth2/redirect` (mobile)

## Google Cloud Platform

### Google Cloud Storage
- **Service:** `GoogleCloudAPI` interface
- **Credentials:** `classpath:google.json` (service account)
- **Capabilities:**
  - File upload (direct + byte array)
  - File retrieval and deletion
  - Public URL generation
- **Usage:** Student ID card PDFs, faculty documents, Excel exports

### Google Admin Directory API
- **Service:** `GoogleDirectoryService`
- **Version:** directory_v1-rev20211221-1.32.1
- **Capabilities:** User management, group management, org unit operations in Google Workspace

### Google Gmail API
- **Service:** `GmailApiEmailServiceImpl`
- **Version:** v1-rev20220404-2.0.0
- **Sender:** notifications@career-9.net
- **Capabilities:** Send emails via service account, template-based sending

## Firebase

- **Project ID:** career-9-assessment
- **Backend SDK:** Firebase Admin 9.2.0
- **Frontend SDK:** Firebase 12.8.0
- **Service Account:** `classpath:firebase-service-account.json`
- **Backend Service:** `FirebaseService`
  - Firestore CRUD operations
  - Query operations (==, >, >=, <, <=, !=)
  - Batch document operations
  - Enabled via `app.firebase.enabled` (default: true)
- **Frontend Usage:** Real-time assessment data synchronization (Firestore)

## Email Services

### Mandrill (Transactional Email)
- **Libraries:** mandrillClient 1.1, Lutung 0.0.8
- **Service:** `EmailService`
- **Capabilities:**
  - HTML email with templates
  - Merge variables support
  - Attachment handling
  - Click & open tracking
  - Multiple recipients (To, CC)

### Gmail SMTP
- **Host:** smtp.gmail.com
- **Port:** 587 (STARTTLS)
- **Username:** `${SMTP_USERNAME:notifications@career-9.net}`
- **Services:** `SmtpEmailService`, `SmtpEmailServiceImpl`
- **Capabilities:** Simple text, HTML, and attachment emails
- **Timeouts:** 5s (dev), 10s (staging/production)

## CRM - Odoo Integration

- **URL:** career-91.odoo.com
- **Database:** career-91
- **Service:** `OdooLeadService`
- **Capabilities:**
  - Lead synchronization from Career-Nine to Odoo
  - Lead status tracking (OdooSyncStatus: PENDING, SYNCED, FAILED)
- **Integration Point:** `LeadController`
- **Staging:** Uses environment variables (`${ODOO_URL}`, `${ODOO_DATABASE}`, etc.)

## Translation Service

- **Type:** Node.js microservice (Express.js)
- **Port:** 5000
- **AI Model:** OpenAI GPT-3.5-turbo
- **Endpoints:**
  - `POST /translate/question` - Translate assessment questions
  - `POST /translate/option` - Translate answer options
- **Language Focus:** Hindi translations (formal language)
- **Frontend URL:** `TRANSLATE_APP_API_URL=http://localhost:5000/translate`

## Code Compiler

- **Dev:** http://35.196.122.199
- **Staging:** https://judge0.api.kccitm.in
- **Purpose:** Online code execution for coding assessments
- **Frontend Variable:** `REACT_APP_COMPLIER`

## PDF & Document Generation

### HTML-to-PDF
- **Service:** `PdfServiceImpl`
- **Libraries:** iTextPDF 5.5.13, OpenHTMLToPDF 1.0.10, Flying Saucer 9.1.20
- **Capabilities:** HTML-to-PDF conversion, student/faculty ID card generation
- **Output:** Uploaded to Google Cloud Storage

### QR Code Generation
- **Library:** Google ZXing 3.3.0
- **Format:** BarcodeFormat.QR_CODE
- **Usage:** Embedded in student/faculty ID card PDFs

### Excel Processing
- **Library:** Apache POI 5.2.3
- **Capabilities:** Assessment question export/import, bulk upload templates
- **Format:** .xlsx

## Assessment Proctoring

### MediaPipe (Computer Vision)
- **Library:** @mediapipe/tasks-vision 0.10.22
- **Capability:** Face mesh detection for student authentication/proctoring
- **Public Path:** `/mediapipe/face_mesh/`

### WebGazer (Eye Tracking)
- **Library:** webgazer 3.4.0
- **Capability:** Eye gaze tracking during assessments

## CORS Configuration

### Dev Profile
- `http://localhost:5173` (Vite assessment app)
- `http://localhost:3000` (React admin app)
- `http://localhost:3001`
- Various internal IPs (192.168.x.x)
- `https://staging.student.kccitm.in/`
- `https://student.kccitm.in/`
- `https://erp.aktu.ac.in/`
- `https://leetcode.com`

### Staging Profile
- `https://dashboard.career-9.com`
- `https://assessment.career-9.com`
- `https://*.career-9.com`

### Production Profile
- `http://localhost:3000`, `http://localhost:8080`
- `https://staging.student.kccitm.in/`
- `https://student.kccitm.in/`

## Database

- **Engine:** MySQL 5.7+ (Docker: latest)
- **Dev:** `jdbc:mysql://localhost:3307/career-9` (root/Career-qCsfeuECc3MW)
- **Staging:** `jdbc:mysql://mysql_db_api:3306/career-9` (same credentials)
- **Production:** `jdbc:mysql://easylearning.guru:3310/kcc_student` (root/qCsfeuECc3MW)
- **ORM:** Hibernate with DDL auto-update
- **Connection Pool:** HikariCP (30-50 max connections)

## PWA Configuration (Assessment App)

- **Plugin:** vite-plugin-pwa
- **Service Worker:** Auto-update with Workbox
- **Caching:**
  - Max cache size: 15MB
  - Video runtime caching: 7-day TTL, max 10 entries
  - Cached patterns: *.js, *.css, *.html, *.webp, *.png