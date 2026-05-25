# Payment Integration Documentation

> **Last updated:** 2026-04-10
> **Integration:** Razorpay Payment Links (backend-driven, no client-side SDK)

---

## Complete User Flow

### Flow 1: Admin Creates a Paid Assessment Mapping

```
Admin opens College page
  -> Opens AssessmentMappingModal for an institute
  -> Selects assessment, session, class/section, mapping level
  -> Enters Amount (INR) -- stored as paise (x100)
  -> Submits -> POST /assessment-mapping/create
  -> Backend generates unique UUID token
  -> Admin gets a shareable registration URL with that token
  -> Admin can copy URL or generate QR code
```

**Key files:**
- Frontend: `react-social/src/app/pages/College/components/AssessmentMappingModal.tsx`
- Backend: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentInstituteMappingController.java`

---

### Flow 2: Student Registers via Public Link (Paid Path)

```
Student opens /assessment-register/:token
  -> Frontend calls GET /assessment-mapping/public/info/{token}
  -> Shows registration form (name, email, DOB, phone, gender, class/section)
  -> Optional: student applies promo code (validated server-side)
  -> Submits -> POST /assessment-mapping/public/register/{token}

Backend decision tree:
  |-- Amount > 0 (payment required)?
  |   |-- Promo code applied?
  |   |   |-- 100% discount -> free path (zero-amount txn recorded, student created immediately)
  |   |   +-- Partial discount -> reduced payment required
  |   |-- Existing student by email/DOB?
  |   |   +-- handleExistingStudentWithPayment() -> creates PaymentTransaction -> returns paymentUrl
  |   +-- New student -> createPaymentAndRedirect()
  |       -> Creates Razorpay payment link via RazorpayService
  |       -> Creates PaymentTransaction (status: "created")
  |       -> Returns { status: "payment_required", paymentUrl }
  |
  +-- Amount = 0 or null (free)?
      -> Creates User -> StudentInfo -> UserStudent -> StudentAssessmentMapping
      -> Returns { status: "success", credentials }
```

**Key files:**
- Frontend: `react-social/src/app/pages/AssessmentRegister/AssessmentRegisterPage.tsx`
- Backend: `AssessmentInstituteMappingController.java` (registration endpoint, lines 237-430)

---

### Flow 3: Student Completes Payment on Razorpay

```
Student redirected to Razorpay payment link (shortUrl)
  -> Completes payment on Razorpay hosted page
  -> Razorpay redirects back to /payment-status?razorpay_payment_link_id=XXX&razorpay_payment_link_status=paid

Simultaneously:
  -> Razorpay sends webhook POST /payment/webhook/razorpay
  -> Backend verifies HMAC-SHA256 signature (X-Razorpay-Signature header)
  -> Event: payment_link.paid
      -> Finds PaymentTransaction by razorpayLinkId
      -> Idempotency check (skips if already "paid")
      -> Updates status to "paid", stores razorpayPaymentId
      -> Calls createStudentAndAllotAssessment():
          |-- New student:
          |   -> Create User (random ID, DOB as password)
          |   -> Generate roll number via CareerNineRollNumberService
          |   -> Create StudentInfo
          |   -> Create UserStudent
          |   -> Create StudentAssessmentMapping (status: "notstarted")
          |   -> Send welcome email (async) with credentials
          |
          +-- Existing student:
              -> Find/create UserStudent
              -> Create StudentAssessmentMapping if not exists
              -> Send welcome email

Frontend polling:
  -> PaymentStatusPage polls GET /payment/webhook/status/{razorpayLinkId} every 2s (max 15 attempts)
  -> Displays status: paid | created (verifying) | failed | expired | cancelled
```

**Key files:**
- Frontend: `react-social/src/app/pages/PaymentTracking/PaymentStatusPage.tsx`
- Backend: `spring-social/src/main/java/com/kccitm/api/controller/career9/PaymentWebhookController.java`
- Backend: `spring-social/src/main/java/com/kccitm/api/service/RazorpayService.java`

---

### Flow 4: Payment Failure/Expiry/Cancellation

```
Razorpay webhook events:
  |-- payment.failed -> status="failed", stores failure_reason -> sends failure email
  |-- payment_link.expired -> status="expired" -> sends expiry email
  +-- payment_link.cancelled -> status="cancelled" -> sends cancellation email

All failure emails include retry link (payment shortUrl).
StudentAssessmentMapping is NOT created on failure.
```

---

### Flow 5: Admin Payment Tracking & Actions

```
Admin navigates to /payment-tracking
  -> PaymentTrackingPage calls GET /payment/transactions
  -> Displays PaymentTable with all transactions
  -> Filter by status or institute

Admin actions per transaction:
  |-- Send Nudge -> POST /payment/{id}/send-nudge -> reminder email to student
  |-- Resend Welcome -> POST /payment/{id}/resend-welcome -> re-sends credentials (paid only)
  |-- Send Email -> POST /payment/{id}/send-email -> sends payment link email
  |-- Send WhatsApp -> POST /payment/{id}/send-whatsapp -> generates WhatsApp deeplink
  +-- View Notifications -> GET /payment/{id}/notifications -> audit trail
```

**Key files:**
- Frontend: `react-social/src/app/pages/PaymentTracking/PaymentTrackingPage.tsx`
- Frontend: `react-social/src/app/pages/PaymentTracking/components/PaymentTable.tsx`
- Backend: `spring-social/src/main/java/com/kccitm/api/controller/career9/PaymentController.java`

---

## Technical Architecture

### Backend Components

| Layer | File | Purpose |
|-------|------|---------|
| **Model** | `PaymentTransaction.java` | Transaction entity (razorpay IDs, amount in paise, status, student info, promo) |
| **Model** | `PaymentNotificationLog.java` | Audit trail for emails/whatsapp sent |
| **Model** | `AssessmentInstituteMapping.java` | Links assessment to institute with amount + token |
| **Model** | `StudentAssessmentMapping.java` | Links student to assessment (created post-payment) |
| **Repo** | `PaymentTransactionRepository.java` | Queries by linkId, paymentId, orderId, email+assessment, mapping, institute |
| **Repo** | `PaymentNotificationLogRepository.java` | Queries by transaction, channel, recipient |
| **Controller** | `PaymentController.java` | Admin APIs: generate link, list txns, send notifications |
| **Controller** | `PaymentWebhookController.java` | Public APIs: webhook handler, status polling, student registration |
| **Controller** | `AssessmentInstituteMappingController.java` | Registration endpoint with payment decision logic |
| **Service** | `RazorpayService.java` | Razorpay API: create payment link, verify webhook signature |
| **Service** | `PaymentEmailService.java` | Async HTML emails: welcome, failure, nudge, payment link |

### Frontend Components

| Route | Component | Auth | Purpose |
|-------|-----------|------|---------|
| `/assessment-register/:token` | AssessmentRegisterPage | Public | Student registration + payment trigger |
| `/payment-register/:transactionId` | PaymentRegisterPage | Public | Pre-payment detail capture |
| `/payment-status` | PaymentStatusPage | Public | Post-payment status with polling |
| `/payment-tracking` | PaymentTrackingPage | Private | Admin transaction dashboard |
| `/promo-codes` | PromoCodePage | Private | Admin promo code management |

### API Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/payment/generate-link` | Yes | Create Razorpay payment link |
| GET | `/payment/transactions` | Yes | List all transactions (filterable by status, instituteCode) |
| GET | `/payment/transactions/by-mapping/{id}` | Yes | Transactions for a mapping |
| POST | `/payment/{id}/send-email` | Yes | Email payment link to student |
| POST | `/payment/{id}/send-whatsapp` | Yes | Generate WhatsApp deeplink with payment link |
| POST | `/payment/{id}/send-nudge` | Yes | Send reminder email |
| POST | `/payment/{id}/resend-welcome` | Yes | Re-send credentials (paid txns only) |
| GET | `/payment/{id}/notifications` | Yes | Get notification audit log |
| POST | `/payment/webhook/razorpay` | No | Razorpay webhook receiver |
| GET | `/payment/webhook/status/{linkId}` | No | Poll payment status (frontend polling) |
| GET | `/payment/webhook/info/{txnId}` | No | Transaction info for registration forms |
| POST | `/payment/webhook/register/{txnId}` | No | Student pre-payment detail registration |

---

## Payment Status Lifecycle

```
CREATED -> PAID -> (student provisioned, welcome email sent)
                   +-- or PAID_PROVISIONING_FAILED (student creation error)
CREATED -> FAILED -> (failure email sent, retry possible)
CREATED -> EXPIRED -> (expiry email sent)
CREATED -> CANCELLED -> (cancellation email sent)
```

---

## Razorpay Integration Details

- **Mode:** Payment Links (NOT client-side SDK) -- backend creates links, student is redirected to Razorpay hosted page
- **Signature verification:** HMAC-SHA256 on webhook payload using `X-Razorpay-Signature` header
- **Environments:** Test keys for dev (`rzp_test_*`), live keys for staging/production (`rzp_live_*`)
- **Custom notifications:** Razorpay SMS/email disabled -- all notifications sent via `PaymentEmailService`
- **Callback URL:** Configurable per environment (`localhost:3000` dev, `dashboard.career-9.com` staging/prod)
- **Timeouts:** 10s connection, 30s read timeout for Razorpay API calls

---

## Promo Code System

- Validated server-side during registration (`POST /assessment-mapping/public/register/{token}`)
- Supports: percentage-based discount, expiration date, max usage limit
- 100% discount = free registration (zero-amount transaction recorded with status "paid")
- Promo code details stored on PaymentTransaction for audit (`promoCode`, `promoDiscountPercent`, `originalAmount`)
- Usage counter incremented on successful validation

---

## Security

- Webhook endpoint (`/payment/webhook/**`) is `permitAll` in `SecurityConfig`
- Webhook requests verified via HMAC-SHA256 signature -- rejects unsigned/invalid with 401
- All admin payment endpoints require JWT authentication via `@AuthenticationPrincipal`
- HTML emails use `escapeHtml()` for XSS prevention
- Idempotency: webhook handler skips already-processed "paid" transactions
- `@Transactional` on webhook endpoint ensures data consistency

---

## Database Tables

### payment_transaction
| Column | Type | Description |
|--------|------|-------------|
| transaction_id | BIGINT PK | Auto-generated |
| razorpay_link_id | VARCHAR(50) UNIQUE | Razorpay payment link ID |
| razorpay_payment_id | VARCHAR(50) | Razorpay payment ID (set on payment) |
| razorpay_order_id | VARCHAR(50) | Razorpay order ID |
| mapping_id | BIGINT | FK to assessment_institute_mapping |
| amount | BIGINT | Amount in paise |
| currency | VARCHAR(10) | Default: INR |
| status | VARCHAR(20) | created/paid/failed/expired/cancelled/paid_provisioning_failed |
| payment_link_url | VARCHAR(500) | Full Razorpay payment link URL |
| short_url | VARCHAR(500) | Short Razorpay URL |
| student_name | VARCHAR(200) | Student name |
| student_email | VARCHAR(200) | Student email |
| student_phone | VARCHAR(20) | Student phone |
| student_dob | DATE | Student date of birth |
| user_student_id | BIGINT | FK to user_student (set after provisioning) |
| assessment_id | BIGINT | FK to assessment_table |
| institute_code | INT | FK to institute_detail |
| promo_code | VARCHAR(50) | Applied promo code |
| promo_discount_percent | INT | Discount percentage |
| original_amount | BIGINT | Pre-discount amount in paise |
| failure_reason | VARCHAR(500) | Error description on failure |
| welcome_email_sent | BOOLEAN | Default: false |
| nudge_email_sent | BOOLEAN | Default: false |
| created_at | TIMESTAMP | Auto-set on creation |
| updated_at | TIMESTAMP | Auto-set on update |

### payment_notification_log
| Column | Type | Description |
|--------|------|-------------|
| log_id | BIGINT PK | Auto-generated |
| transaction_id | BIGINT | FK to payment_transaction |
| channel | VARCHAR(20) | email or whatsapp |
| recipient | VARCHAR(200) | Email address or phone number |
| status | VARCHAR(20) | sent or failed |
| payment_link_url | VARCHAR(500) | Link included in notification |
| amount | BIGINT | Amount shown in notification |
| error_message | VARCHAR(500) | Error details if failed |
| sent_by | VARCHAR(100) | Who triggered the notification |
| created_at | TIMESTAMP | Auto-set on creation |

---

## Known Issues / Notes

- **Dead code:** `PaymentLinkModal.tsx` in `react-social/src/app/pages/College/components/` exists but is never imported or used anywhere in the codebase.
- **Amount unit:** All amounts are stored in paise (1 INR = 100 paise). Frontend converts INR input to paise before sending to backend.
- **Student credentials:** On successful payment, student gets username (auto-generated) and password (DOB in dd-MM-yyyy format). Sent via welcome email.
- **Polling vs webhooks on frontend:** The frontend uses client-side polling (2s interval, 15 max attempts) rather than WebSockets or SSE to check payment status.
- **RazorpayService key mapping:** The service returns keys `linkId`, `shortUrl`, `paymentLinkUrl`, `status`. Controllers must use these exact keys (not Razorpay's raw API field names like `id` or `short_url`). A prior bug where the controller used raw field names caused payment URLs to be null.
