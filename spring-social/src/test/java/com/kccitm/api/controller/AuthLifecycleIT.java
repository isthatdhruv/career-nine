package com.kccitm.api.controller;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.InvocationOnMock;

import com.kccitm.api.config.AppProperties;
import com.kccitm.api.model.RefreshToken;
import com.kccitm.api.repository.RefreshTokenRepository;
import com.kccitm.api.security.RefreshTokenService;
import com.kccitm.api.security.RefreshTokenService.RefreshTokenReuseException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Phase 18 Plan 02 — Auth lifecycle integration coverage.
 *
 * <p>Originally scoped (per plan) as a {@code @SpringBootTest} + {@code @AutoConfigureMockMvc}
 * exercise of {@code /auth/login} → {@code /auth/refresh} → {@code /auth/logout} →
 * {@code /auth/me}. The plan's fallback clause explicitly permits a service-layer test
 * when the full IT plumbing (test profile, seeded user, H2-vs-MySQL bootstrap) is not in
 * place — which is the case for this codebase (Plan 18-01 ran with no test resources;
 * see {@code JtiDenyListServiceTest} for the matching precedent in 18-03).
 *
 * <p>We therefore exercise the contract at the {@link RefreshTokenService} layer using a
 * Mockito-backed in-memory {@link RefreshTokenRepository} stub. The repository's
 * {@code revokeIfLive} method is implemented atomically (per-jti lock) to replicate
 * MySQL's per-row UPDATE atomicity contract — the SOLE invariant on which the rotation
 * race depends. The critical {@link #concurrentRefreshFromTwoTabsOnlyOneSucceeds} test
 * mirrors the plan's must-have: two concurrent rotations on the same jti yield exactly
 * one success and one {@link RefreshTokenReuseException}.
 *
 * <p>Endpoint-level coverage (the AuthController wiring of these service calls) is
 * exercised by manual curl smoke tests on the dev profile; promoting to a full
 * {@code MockMvc} IT requires a test bootstrap that does not yet exist in this codebase
 * (out of plan scope per the explicit fallback).
 */
class AuthLifecycleIT {

    /** Backing store + per-jti locks, shared between mock stubs to simulate one repository. */
    private ConcurrentHashMap<String, RefreshToken> rows;
    private ConcurrentHashMap<String, Object> rowLocks;

    private RefreshTokenRepository repo;
    private RefreshTokenService service;

    @BeforeEach
    void setUp() throws Exception {
        rows = new ConcurrentHashMap<>();
        rowLocks = new ConcurrentHashMap<>();

        repo = mock(RefreshTokenRepository.class);
        wireMockRepo(repo, rows, rowLocks);

        AppProperties props = new AppProperties();
        // 7-day refresh TTL (matches dev/staging/sandbox/prod application.yml from Plan 18-01).
        props.getAuth().setRefreshTokenExpirationMsec(604_800_000L);

        service = new RefreshTokenService();
        setPrivate(service, "repo", repo);
        setPrivate(service, "appProperties", props);
    }

    @Test
    @DisplayName("issue() persists a live row that validate() returns")
    void issueThenValidate_returnsLiveRow() {
        String jti = service.issue(42L, "junit-agent", "127.0.0.1");
        Optional<RefreshToken> validated = service.validate(jti);
        assertThat(validated).as("freshly-issued jti must validate").isPresent();
        assertThat(validated.get().getUserId()).isEqualTo(42L);
        assertThat(validated.get().getRevokedAt()).isNull();
    }

    @Test
    @DisplayName("revoke() makes validate() return empty (logout contract)")
    void revoke_makesValidateReturnEmpty() {
        String jti = service.issue(7L, "ua", "::1");
        assertThat(service.validate(jti)).isPresent();

        service.revoke(jti);
        assertThat(service.validate(jti))
                .as("post-revoke validate must be empty so /auth/refresh returns 401")
                .isNotPresent();
    }

    @Test
    @DisplayName("post-rotation replay of the OLD jti throws RefreshTokenReuseException")
    void replayOfOldJtiReturnsReuseException() {
        String oldJti = service.issue(13L, "ua", "1.2.3.4");
        String newJti = service.rotate(oldJti, "ua", "1.2.3.4");
        assertThat(newJti).isNotEqualTo(oldJti);

        // Replay the old token — already revoked by the rotate above.
        assertThatThrownBy(() -> service.rotate(oldJti, "ua", "1.2.3.4"))
                .isInstanceOf(RefreshTokenReuseException.class);
    }

    @Test
    @DisplayName("getUserIdForJti() returns the owning user-id (used by /auth/refresh)")
    void getUserIdForJti_returnsOwner() {
        String jti = service.issue(99L, "ua", "ip");
        assertThat(service.getUserIdForJti(jti)).isEqualTo(99L);
        assertThat(service.getUserIdForJti("nonexistent-jti")).isNull();
        assertThat(service.getUserIdForJti(null)).isNull();
    }

    /**
     * THE CRITICAL TEST — mirrors ROADMAP Phase 18 success criterion #7 and the
     * quality-gate requirement: "concurrent refresh from two tabs only succeeds once."
     *
     * <p>Two threads call {@code rotate(oldJti, ...)} on the same refresh token at the
     * same instant. The mock repository's {@code revokeIfLive} implementation faithfully
     * replicates the per-row atomicity contract MySQL 5.7 guarantees — exactly one
     * caller's UPDATE flips {@code revoked_at} from null and sees {@code rowCount==1};
     * the other sees 0 and throws. The {@code @Transactional} rollback semantics for the
     * losing path are out of scope for this in-memory test (the new-row insert is left
     * orphaned in the map; in production MySQL it would roll back) — what matters is the
     * externally-visible service contract: exactly one success, exactly one reuse
     * exception.
     */
    @Test
    @DisplayName("concurrentRefreshFromTwoTabsOnlyOneSucceeds — rotation race tie-breaker")
    void concurrentRefreshFromTwoTabsOnlyOneSucceeds() throws Exception {
        String sharedJti = service.issue(1234L, "tab-test", "0.0.0.0");

        AtomicInteger successes = new AtomicInteger(0);
        AtomicInteger reuseExceptions = new AtomicInteger(0);
        AtomicInteger otherFailures = new AtomicInteger(0);

        // Two-thread barrier so both rotation calls hit revokeIfLive at the same instant.
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch finishGate = new CountDownLatch(2);

        ExecutorService pool = Executors.newFixedThreadPool(2);
        Runnable rotator = () -> {
            try {
                startGate.await();
                service.rotate(sharedJti, "tab", "0.0.0.0");
                successes.incrementAndGet();
            } catch (RefreshTokenReuseException ex) {
                reuseExceptions.incrementAndGet();
            } catch (Throwable t) {
                otherFailures.incrementAndGet();
            } finally {
                finishGate.countDown();
            }
        };
        pool.submit(rotator);
        pool.submit(rotator);
        startGate.countDown();
        boolean finished = finishGate.await(5, TimeUnit.SECONDS);
        pool.shutdownNow();

        assertThat(finished).as("both threads completed within timeout").isTrue();
        assertThat(otherFailures.get()).as("no unexpected exceptions").isEqualTo(0);
        assertThat(successes.get())
                .as("exactly ONE tab succeeds (rotation race tie-broken atomically)")
                .isEqualTo(1);
        assertThat(reuseExceptions.get())
                .as("exactly ONE tab fails with RefreshTokenReuseException")
                .isEqualTo(1);
    }

    // ───────────────────────────────────────────────────────────────────────
    // Helpers
    // ───────────────────────────────────────────────────────────────────────

    /**
     * Reflective field setter — avoids requiring a Spring context just to inject the
     * two collaborators. Same trick as {@code JtiDenyListServiceTest} uses to keep the
     * unit-test fast and dependency-free.
     */
    private static void setPrivate(Object target, String fieldName, Object value) throws Exception {
        Field f = target.getClass().getDeclaredField(fieldName);
        f.setAccessible(true);
        f.set(target, value);
    }

    /**
     * Wires Mockito stubs for the four {@link RefreshTokenRepository} methods that
     * {@link RefreshTokenService} actually calls: {@code save}, {@code findByJti},
     * {@code revokeIfLive}, {@code revokeAllForUser}. The backing maps are shared so
     * the stubs collectively behave like a single in-memory repository.
     *
     * <p>{@code revokeIfLive} is the race-deciding call — implemented atomically per-jti
     * to faithfully replicate MySQL 5.7's per-row UPDATE atomicity.
     */
    private static void wireMockRepo(RefreshTokenRepository repo,
                                     ConcurrentHashMap<String, RefreshToken> rows,
                                     ConcurrentHashMap<String, Object> rowLocks) {
        when(repo.save(any(RefreshToken.class))).thenAnswer((InvocationOnMock inv) -> {
            RefreshToken r = inv.getArgument(0);
            rows.put(r.getJti(), r);
            return r;
        });

        when(repo.findByJti(anyString())).thenAnswer((InvocationOnMock inv) ->
                Optional.ofNullable(rows.get(inv.<String>getArgument(0))));

        when(repo.revokeIfLive(anyString(), any(LocalDateTime.class), any()))
                .thenAnswer((InvocationOnMock inv) -> {
                    String jti = inv.getArgument(0);
                    LocalDateTime now = inv.getArgument(1);
                    String replacedBy = inv.getArgument(2);
                    Object lock = rowLocks.computeIfAbsent(jti, k -> new Object());
                    synchronized (lock) {
                        RefreshToken r = rows.get(jti);
                        if (r == null || r.getRevokedAt() != null) {
                            return 0;
                        }
                        r.setRevokedAt(now);
                        r.setReplacedBy(replacedBy);
                        return 1;
                    }
                });

        when(repo.revokeAllForUser(anyLong(), any(LocalDateTime.class)))
                .thenAnswer((InvocationOnMock inv) -> {
                    Long userId = inv.getArgument(0);
                    LocalDateTime now = inv.getArgument(1);
                    int count = 0;
                    for (RefreshToken r : rows.values()) {
                        if (userId.equals(r.getUserId()) && r.getRevokedAt() == null) {
                            r.setRevokedAt(now);
                            count++;
                        }
                    }
                    return count;
                });
    }
}
