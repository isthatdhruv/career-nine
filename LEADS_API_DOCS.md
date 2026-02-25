# Leads Capture API Documentation

Base URL: `https://<your-domain>`

---

## 1. Capture Lead

Captures a lead from external landing pages and syncs to Odoo CRM.

**Endpoint:** `POST /leads/capture`

**Authentication:** None (public endpoint)

**Content-Type:** `application/json`

**Required Fields:**

| Field      | Type   | Description                                      |
|------------|--------|--------------------------------------------------|
| `fullName` | String | Full name of the lead                            |
| `email`    | String | Email address                                    |
| `leadType` | String | One of: `SCHOOL`, `PARENT`, `STUDENT`            |

**Optional Fields:**

| Field              | Type   | Description                                 |
|--------------------|--------|---------------------------------------------|
| `phone`            | String | Phone / WhatsApp number                     |
| `source`           | String | Where the lead came from (e.g. page URL)    |
| `designation`      | String | Role (e.g. Principal, Director)             |
| `schoolName`       | String | School / institution name                   |
| `city`             | String | City                                        |
| `cbseAffiliationNo`| String | CBSE Affiliation number                     |
| `totalStudents`    | String | Student count range (e.g. "500-1,000")      |
| `classesOffered`   | String | Classes offered (e.g. "Up to Class 12")     |

Any additional fields beyond those listed above are stored as JSON in the `extras` column.

**Example Request:**

```json
{
  "fullName": "Rajesh Kumar",
  "email": "rajesh@school.edu.in",
  "phone": "9876543210",
  "leadType": "SCHOOL",
  "source": "career-9.net/schools",
  "designation": "Principal",
  "schoolName": "DPS Noida",
  "city": "Noida",
  "cbseAffiliationNo": "2130045",
  "totalStudents": "1200",
  "classesOffered": "6-12"
}
```

**Success Response (201):**

```json
{
  "status": "success",
  "leadId": 42,
  "message": "Lead captured successfully"
}
```

**Error Responses:**

| Status | Body                                                                  |
|--------|-----------------------------------------------------------------------|
| 400    | `{ "error": "fullName is required" }`                                 |
| 400    | `{ "error": "email is required" }`                                    |
| 400    | `{ "error": "leadType is required (SCHOOL, PARENT, or STUDENT)" }`   |
| 400    | `{ "error": "Invalid leadType. Must be one of: SCHOOL, PARENT, STUDENT" }` |
| 500    | `{ "error": "Error processing lead submission" }`                     |

**Odoo Sync:** Leads are automatically synced to Odoo CRM asynchronously after capture. The sync status is tracked per lead (`PENDING` → `SYNCED` or `FAILED`).

---

## 2. Get All Leads

Returns all captured leads.

**Endpoint:** `GET /leads/getAll`

**Authentication:** Required (JWT Bearer token)

**Response (200):**

```json
[
  {
    "id": 42,
    "fullName": "Rajesh Kumar",
    "email": "rajesh@school.edu.in",
    "phone": "9876543210",
    "leadType": "SCHOOL",
    "source": "career-9.net/schools",
    "designation": "Principal",
    "schoolName": "DPS Noida",
    "city": "Noida",
    "cbseAffiliationNo": "2130045",
    "totalStudents": "1,000-2,000",
    "classesOffered": "Up to Class 12",
    "extras": null,
    "odooSyncStatus": "SYNCED",
    "odooLeadId": 158,
    "odooSyncError": null,
    "createdAt": "2026-02-25T10:30:00",
    "updatedAt": "2026-02-25T10:30:05"
  }
]
```

---

## 3. Email Leads Export

Sends an Excel file as an email attachment via Gmail API.

**Endpoint:** `POST /leads/email-export`

**Authentication:** Required (JWT Bearer token)

**Content-Type:** `multipart/form-data`

**Parameters:**

| Field     | Type          | Description                          |
|-----------|---------------|--------------------------------------|
| `to`      | String        | Comma-separated email addresses      |
| `subject` | String        | Email subject line                   |
| `body`    | String        | Email body text                      |
| `file`    | MultipartFile | Excel file (.xlsx) to attach         |

**Example (cURL):**

```bash
curl -X POST "https://<your-domain>/leads/email-export" \
  -H "Authorization: Bearer <token>" \
  -F "to=manager@company.com" \
  -F "subject=Leads Export - Feb 2026" \
  -F "body=Please find the leads export attached." \
  -F "file=@Leads_Export.xlsx"
```

**Success Response (200):**

```json
{
  "status": "success",
  "message": "Email sent successfully"
}
```

**Error Response (500):**

```json
{
  "error": "Failed to send email: <error details>"
}
```

---

## Lead Data Model

| Field              | Type     | Description                                |
|--------------------|----------|--------------------------------------------|
| `id`               | Long     | Auto-generated ID                          |
| `fullName`         | String   | Lead's full name                           |
| `email`            | String   | Email address                              |
| `phone`            | String   | Phone / WhatsApp number (nullable)         |
| `leadType`         | Enum     | `SCHOOL`, `PARENT`, or `STUDENT`           |
| `source`           | String   | Lead source/origin (nullable)              |
| `designation`      | String   | Role / designation (nullable)              |
| `schoolName`       | String   | School / institution name (nullable)       |
| `city`             | String   | City (nullable)                            |
| `cbseAffiliationNo`| String   | CBSE Affiliation number (nullable)         |
| `totalStudents`    | String   | Student count range (nullable)             |
| `classesOffered`   | String   | Classes offered (nullable)                 |
| `extras`           | String   | JSON string of additional fields (nullable)|
| `odooSyncStatus`   | Enum     | `PENDING`, `SYNCED`, or `FAILED`           |
| `odooLeadId`       | Long     | Odoo CRM lead ID after sync (nullable)     |
| `odooSyncError`    | String   | Error message if sync failed (nullable)    |
| `createdAt`        | DateTime | Auto-set on creation                       |
| `updatedAt`        | DateTime | Auto-set on update                         |

---

## Integration Notes

- The `/leads/capture` endpoint is **public** (no auth required) so it can be called from any external landing page.
- Add `source` field to track which landing page the lead came from.
- Any extra form fields beyond the core fields are stored in the `extras` JSON column, so the API works with different form layouts without backend changes.
- CORS is handled by the backend; no special headers needed from the frontend.
