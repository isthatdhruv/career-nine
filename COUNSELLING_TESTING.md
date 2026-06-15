# Counselling Phases 1–3a — Testing Guide

How to verify the auth fix (Phase 1), the lifecycle engine (Phase 2), and the soft-hold +
no-show credit-back (Phase 3a) on a local/dev DB. Backend runs on **:8080**, profile `dev`,
MySQL **localhost:3307** db `career-9-staging`, Redis **:6379**.

> Use `curl.exe` (not bare `curl`, which PowerShell aliases to Invoke-WebRequest).

---

## 0. Start the stack

1. Make sure **MySQL** (3307, db `career-9-staging`) and **Redis** (6379) are running — the
   same ones the app normally uses (via your `docker-compose.yml` or local installs).
2. Ensure `.env.staging` exists at the repo root (the `dev` profile imports it). Copy the
   example if needed:
   ```powershell
   Copy-Item .env.staging.example .env.staging
   ```
   It must define `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_SECRET`, `GITHUB_CLIENT_SECRET`
   (placeholders are fine for local) — the dev profile won't boot without them.
3. Start the backend:
   ```powershell
   cd spring-social
   mvn spring-boot:run
   ```
   Watch the log for a clean boot (`Started ... in N seconds`).

---

## 1. Verify the migrations applied (fastest sanity check)

On boot, Flyway runs `V20260610001` (counsellor role group) and `V20260610002`
(entitlement_id + held_until). In a MySQL client against `career-9-staging`:

```sql
-- Both should show success = 1
SELECT version, description, success
FROM flyway_schema_history
WHERE version IN ('20260610001','20260610002');

-- New columns exist
SHOW COLUMNS FROM counselling_appointment LIKE 'entitlement_id';
SHOW COLUMNS FROM counselling_slot LIKE 'held_until';

-- Counsellor role group + permissions seeded
SELECT * FROM role_group WHERE name = 'counsellor';
SELECT COUNT(*) AS counsellor_perms
FROM role_permission rp
JOIN role r ON r.id = rp.role_id
WHERE r.name = 'COUNSELLOR';   -- expect ~30+ (read bundle + 24 portal perms)
```

If the app failed to boot on a Flyway error, that's the migration to fix — tell me the error.

---

## 2. Phase 1 — counsellor auth linkage

### Easiest: through the UI
1. Run the admin/counsellor app:
   ```powershell
   cd react-social
   npm install   # first time only
   npm start
   ```
2. Go to **`/counsellor/register`**, register a test counsellor (note the email + password).
3. Log in as admin and **approve** the counsellor (Manage Counsellors → activate), OR approve
   via API in the curl flow below.
4. Go to **`/counsellor/login`**, sign in with the test counsellor.
5. ✅ **Pass:** the dashboard/profile loads. ❌ **Fail (old bug):** "Counsellor profile not found".

### Or via curl (no UI)
```powershell
# a) Register a counsellor
curl.exe -X POST http://localhost:8080/api/counsellor/self-register `
  -H "Content-Type: application/json" `
  -d "{\"name\":\"Test Counsellor\",\"email\":\"tc1@example.com\",\"phone\":\"9000000001\",\"password\":\"Passw0rd!\"}"

# b) Log in as the bootstrap super admin to get an auth cookie
curl.exe -c admin.txt -X POST http://localhost:8080/auth/login `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"admin@career-9.local\",\"password\":\"ChangeMeOnFirstLogin!2026\"}"

# c) Approve the counsellor (use the counsellorId returned in step a)
curl.exe -b admin.txt -X PUT http://localhost:8080/api/counsellor/toggle-active/<counsellorId>

# d) Log in as the counsellor (own cookie jar)
curl.exe -c counsellor.txt -X POST http://localhost:8080/auth/login `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"tc1@example.com\",\"password\":\"Passw0rd!\"}"

# e) Who am I — note the "id" field (the User id)
curl.exe -b counsellor.txt http://localhost:8080/auth/me

# f) THE FIX: resolve the counsellor from the user id (this used to 404 / "not found")
curl.exe -b counsellor.txt http://localhost:8080/api/counsellor/get/by-user/<userIdFromStepE>
```
✅ **Pass:** step (f) returns the counsellor JSON.

**DB confirmation of the linkage + provisioning:**
```sql
-- user_id is now populated (was always NULL before)
SELECT id, email, user_id, is_active, onboarding_status FROM counsellors WHERE email = 'tc1@example.com';

-- a login User exists (provider = local), and is active after approval
SELECT id, email, provider, isActive FROM student_user WHERE email = 'tc1@example.com';

-- the counsellor User is mapped to the 'counsellor' role group (provisioned on approval / first portal load)
SELECT * FROM user_role_group_mapping WHERE user_id = <userId>;   -- (column may be `user`/`user_ref` in your schema)
```

---

## 3. Phase 2 — lifecycle (auto COMPLETED / MISSED at slot end)

You don't have to wait for the 5-min cron — there's a manual trigger.

The simplest way to get a test appointment is to make an existing `CONFIRMED` one look
"ended in the past", then trigger the sweep.

```sql
-- 1) Find a confirmed appointment and its slot
SELECT a.id AS appt_id, a.status, a.checkin_verified_at, a.entitlement_id,
       s.id AS slot_id, s.date, s.end_time
FROM counselling_appointment a
JOIN counselling_slot s ON s.id = a.slot_id
WHERE a.status = 'CONFIRMED'
LIMIT 5;

-- 2) Make its slot end 5 minutes ago
UPDATE counselling_slot
SET date = CURDATE(), end_time = TIME(DATE_SUB(NOW(), INTERVAL 5 MINUTE))
WHERE id = <slot_id>;
```

**Test the MISSED branch** (leave `checkin_verified_at` NULL), then trigger:
```powershell
curl.exe -b admin.txt -X POST http://localhost:8080/api/counselling-lifecycle/run-session-sweep
```
```sql
-- appointment is now MISSED; if it had an entitlement_id, the session is credited back
SELECT id, status, attended, entitlement_id FROM counselling_appointment WHERE id = <appt_id>;
SELECT counselling_sessions_total, counselling_sessions_used
FROM student_entitlement WHERE entitlement_id = <entitlement_id>;  -- used should have dropped by 1
```
A no-show email/in-app notice is also sent (check the app log + `notification` table).

**Test the COMPLETED branch:** set the check-in, re-age the slot, trigger again:
```sql
UPDATE counselling_appointment SET status='CONFIRMED', checkin_verified_at = NOW() WHERE id = <appt_id>;
UPDATE counselling_slot SET end_time = TIME(DATE_SUB(NOW(), INTERVAL 5 MINUTE)) WHERE id = <slot_id>;
```
```powershell
curl.exe -b admin.txt -X POST http://localhost:8080/api/counselling-lifecycle/run-session-sweep
```
✅ **Pass:** appointment becomes `COMPLETED`, `attended = 1`.

---

## 4. Phase 3a — soft-hold auto-release

Simulate an abandoned hold (slot reserved during payment, never confirmed), then trigger the
hold sweep (normally every 1 min).

```sql
-- pick any AVAILABLE future slot
SELECT id, status, date, held_until FROM counselling_slot WHERE status = 'AVAILABLE' LIMIT 5;

-- simulate a hold whose 5-min TTL already expired, with NO appointment attached
UPDATE counselling_slot
SET status = 'REQUESTED', held_until = DATE_SUB(NOW(), INTERVAL 1 MINUTE)
WHERE id = <slot_id>;
```
```powershell
curl.exe -b admin.txt -X POST http://localhost:8080/api/counselling-lifecycle/run-hold-sweep
```
```sql
SELECT id, status, held_until FROM counselling_slot WHERE id = <slot_id>;
```
✅ **Pass:** status is back to `AVAILABLE`, `held_until` is NULL.

**Guard check (important):** a held slot that *did* become a real booking must NOT be released.
Take a slot that has a confirmed appointment, set `status='REQUESTED'`, `held_until` in the past,
run the hold sweep → it should **stay REQUESTED** (because an appointment exists for it).

---

## Notes
- The two `/api/counselling-lifecycle/*` triggers are guarded by `counsellor.update`; the
  bootstrap super admin (`admin@career-9.local`) passes via the super-admin bypass.
- After testing, you can leave the triggers in (handy for ops) or I can remove them.
- Log lines to watch: `Counselling lifecycle sweep: X completed, Y missed` and
  `Counselling hold sweep: released N expired slot hold(s)`.
