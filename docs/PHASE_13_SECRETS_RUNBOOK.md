# Phase 13 — Secret Rotation Runbook

This runbook accompanies the secret externalization shipped in Plan 13-01.
Every environment (dev, staging, sandbox, production) must hold DISTINCT
values for the secrets below.

## 1. Generate secrets

### JWT signing secret (`APP_AUTH_TOKEN_SECRET`)

HS512 requires ≥ 64 bytes of entropy. Generate once per environment:

```bash
openssl rand -hex 64
# Output: 128 hex chars (= 64 bytes = 512 bits)
```

Run four times. Store each output in the respective environment's
deployment secrets:

| Env        | Storage location                                          |
|------------|-----------------------------------------------------------|
| dev        | local `.env` (gitignored)                                 |
| sandbox    | sandbox deploy secret store (DigitalOcean app spec / docker-compose `.env`) |
| staging    | staging deploy secret store                               |
| production | production deploy secret store                            |

### Database password (`SPRING_DATASOURCE_PASSWORD`)

1. Generate: `openssl rand -base64 32 | tr -d '/+=' | head -c 32`
2. Apply on the DB server:
   ```sql
   ALTER USER 'root'@'%' IDENTIFIED BY '<new-password>';
   FLUSH PRIVILEGES;
   ```
3. Update the env var in the deployment secret store.
4. Redeploy the API container — Hikari will drain in ~15–30s and reconnect.

### Razorpay webhook secret (`RAZORPAY_WEBHOOK_SECRET`)

1. In Razorpay Dashboard → Settings → Webhooks → Edit the relevant webhook
   → "Rotate Secret" → copy the new value.
2. Update the env var.
3. Redeploy. Razorpay will sign new webhooks with the rotated secret;
   in-flight retries during the swap may 401 once before Razorpay
   re-signs with the new key.

### Razorpay API keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`)

Rotate from Razorpay Dashboard → Account → API Keys → Regenerate.
Update env vars and redeploy.

### OpenAI API key (`OPENAI_API_KEY`)

**The current key `sk-proj-v4_HscC...` is leaked in git history and MUST
be revoked.**

1. https://platform.openai.com/api-keys → revoke the leaked key.
2. Create a new restricted key (limit scopes if possible).
3. Update env var and redeploy.

### OAuth client secrets (`GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_SECRET`, `GITHUB_CLIENT_SECRET`)

These are CONFIG-only externalized in Phase 13 — no Java code change. Rotate from:

- Google: https://console.cloud.google.com/apis/credentials → click the OAuth 2.0 Client ID → "Reset secret".
- Facebook: https://developers.facebook.com/apps/ → select app → Settings → Basic → "Show" / "Reset" App Secret.
- GitHub: https://github.com/settings/developers → OAuth Apps → select app → "Generate a new client secret".

After rotation, update the env var in the deployment secret store and redeploy.

In **dev**, the application.yml falls back to `placeholder-dev-only` if the env var is unset — useful for engineers who don't use OAuth locally. In **production / staging / sandbox**, the app fails to start if the env var is unset.

### Other secrets

`APP_MANDRILL`, `DO_SPACES_ACCESS_KEY`, `DO_SPACES_SECRET_KEY`, `ODOO_*` —
rotate from each vendor's dashboard. Same pattern: update env var → redeploy.

## 2. Deploy order

Roll out 13-01 in this sequence:

1. **Pre-deploy**: in every target environment (production / staging / sandbox), set ALL of:
   - `APP_AUTH_TOKEN_SECRET` (unique per env)
   - `SPRING_DATASOURCE_PASSWORD`
   - `RAZORPAY_WEBHOOK_SECRET` (required in sandbox/staging/production after Plan 13-03)
   - `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_SECRET`, `GITHUB_CLIENT_SECRET` (OAuth)
2. **Deploy 13-01**: ship the updated `application.yml`. On startup, Spring
   reads the env vars. If any of the three "no-default" vars are missing,
   the app fails to start with `BeanCreationException: Could not resolve
   placeholder '<NAME>'` — fix env vars and retry.
3. **Expected user impact**: Because `APP_AUTH_TOKEN_SECRET` changes value,
   every existing JWT in user `localStorage` becomes invalid. On their next
   API call they get 401 → frontend interceptor (`AuthHelpers.ts:76-81`)
   calls `removeAuth()` and redirects to `/auth`. User re-logs in, gets a
   token signed by the new secret. No data is lost.
4. **Schedule production deploy** during low-traffic window (recommended
   04:00–06:00 IST per project ops standard).

## 3. Verification after rollout

```bash
# 1. Server is up and serving non-auth endpoints (smoke test):
curl -i https://api.career-9.com/actuator/health
# expect 200 (or 401 once Plan 13-02 ships and /actuator/* moves to authenticated)

# 2. Login works (issues a fresh JWT signed with new secret):
curl -i -X POST https://api.career-9.com/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@career-9.net","password":"<pwd>"}'
# expect 200 with body containing accessToken

# 3. Stale token from before rotation is rejected:
OLD_TOKEN="<paste a localStorage token from before deploy>"
curl -i https://api.career-9.com/user/me -H "Authorization: Bearer $OLD_TOKEN"
# expect 401
```

## 4. Rollback

If the rollout breaks production:

1. Re-apply the previous `application.yml` from git (`git revert <commit>` of 13-01).
2. The old JWTs in `localStorage` will validate again because the old
   `tokenSecret` literal is restored.
3. Re-deploy.

This rollback only works if the leaked secrets have NOT yet been revoked
from external vendors. If they have been revoked (OpenAI, Razorpay), the
rollback restores a non-working secret — in that case, push forward and
fix the env-var resolution instead of reverting.

## 5. Q&A

**Q: What if a user logs in during the deploy window?**
A: Their token is signed by whichever container served the login. As
containers roll over, that token may become invalid mid-session. The
frontend handles 401 transparently by redirecting to `/auth`. Worst-case
impact is one extra re-login.

**Q: Do scheduled (`@Scheduled`) jobs break?**
A: No. None of the six `@Scheduled` services call the public HTTP API —
they go straight to repositories. Verified in Phase 13 research.

**Q: Does the AssessmentLoadTest break?**
A: No. It does `POST /auth/login` first, then uses the fresh token. After
rotation, just re-run it — it picks up the new secret automatically.
