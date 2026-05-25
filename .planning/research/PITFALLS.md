# Pitfalls Research: Adding Redis to Spring Boot Assessment System

**Domain:** Redis caching migration for existing Spring Boot 2.5.5 + MySQL + Caffeine assessment platform
**Researched:** 2026-03-07
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: JPA Entity Serialization Explosion with Bidirectional Relationships

**What goes wrong:**
When caching JPA entities with `@JsonManagedReference` and `@JsonBackReference` relationships in Redis, serialization fails with circular reference errors or produces massive 100MB+ payloads for a single question. The `AssessmentQuestions` entity with `@JsonManagedReference` to `options`, which have `@JsonBackReference` to `question`, creates deep object graphs. With EAGER loading on relationships, Hibernate loads the entire entity tree, and Redis serialization attempts to serialize all related entities, including LONGBLOB `optionImage` fields (base64 encoded to ~1.3x original size).

**Why it happens:**
- Caffeine uses Java serialization within the same JVM heap, so object references work fine
- Redis requires full serialization (JSON/Binary) that can't handle circular references or lazy proxies
- Jackson's `@JsonManagedReference/@JsonBackReference` works for HTTP responses but fails for Redis serialization when entities aren't detached
- Developers cache `findAll()` results directly without realizing Hibernate has loaded 6 levels deep of relationships
- The `optionImageBase64` getter always executes during serialization, converting LOB fields even when not needed

**How to avoid:**
1. **Use DTOs for caching, not JPA entities:**
   ```java
   @Cacheable("assessmentQuestions")
   public List<AssessmentQuestionDTO> getAllAssessmentQuestions() {
       List<AssessmentQuestions> entities = repository.findAll();
       return entities.stream()
           .map(this::toDTO)  // Explicit DTO conversion
           .collect(Collectors.toList());
   }
   ```

2. **Create projection classes with only cacheable fields:**
   ```java
   public class AssessmentQuestionCacheProjection {
       private Long questionId;
       private String questionText;
       private String questionType;
       // NO optionImage, NO full option list with scores
   }
   ```

3. **Add `@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})` to all cached entities**

4. **Configure Jackson ObjectMapper for Redis with:**
   ```java
   objectMapper.configure(SerializationFeature.FAIL_ON_EMPTY_BEANS, false);
   objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
   objectMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
   ```

**Warning signs:**
- `RedisTemplate.opsForValue().get()` takes >500ms for a single cache hit
- Redis memory usage grows by 50MB+ when caching 200 questions
- `StackOverflowError` or `OutOfMemoryError` during cache writes
- Jackson throws `JsonMappingException: Direct self-reference leading to cycle`
- Redis shows entries >1MB in size (`MEMORY USAGE key` command)

**Phase to address:**
Phase 1: Redis Setup & Configuration. Create DTO layer and projection queries BEFORE enabling Redis. Test serialization size with actual data.

---

### Pitfall 2: Cache Invalidation Race Conditions with Delete-Then-Save Pattern

**What goes wrong:**
The `AssessmentAnswerController.submitAssessmentAnswers()` method uses `@Transactional` with this pattern:
1. Delete old answers: `assessmentAnswerRepository.deleteByUserStudent_UserStudentIdAndAssessment_Id(...)`
2. Save new answers: `assessmentAnswerRepository.saveAll(answersToSave)`
3. Delete old scores: `assessmentRawScoreRepository.deleteByStudentAssessmentMappingStudentAssessmentId(...)`
4. Save new scores: `assessmentRawScoreRepository.saveAll(rawScoresToSave)`

With Redis caching added, cache invalidation (`@CacheEvict`) happens BEFORE the transaction commits. Other requests reading from cache during the transaction window get stale data or `null`. With 200 concurrent students submitting assessments, this creates a thundering herd of cache misses that overload MySQL.

**Why it happens:**
- Spring's `@CacheEvict` executes at method entry (before transaction starts) or method exit (after transaction commits), but not synchronized with transaction boundaries
- Default `@Transactional` isolation level is `READ_COMMITTED`, so uncommitted deletes are invisible to other transactions
- Redis cache has no transaction awareness—it doesn't participate in Spring's transaction management
- The delete-then-save pattern creates a window where the database is in an inconsistent state but the cache is already invalidated
- Under high concurrency (200 students), cache stampede occurs: all requests miss cache and hit database simultaneously

**How to avoid:**
1. **Use `@CacheEvict` AFTER transaction commits:**
   ```java
   @Transactional
   @CacheEvict(value = "assessmentAnswers", allEntries = true,
               beforeInvocation = false)  // Execute AFTER method completes
   public ResponseEntity<?> submitAssessmentAnswers(...) {
       // delete and save logic
   }
   ```

2. **Use `@Transactional(propagation = Propagation.REQUIRES_NEW)` for cache updates:**
   ```java
   @Service
   public class CacheInvalidationService {
       @Transactional(propagation = Propagation.REQUIRES_NEW)
       @CacheEvict(value = "assessmentAnswers", allEntries = true)
       public void invalidateAfterCommit() {
           // Executes in separate transaction after parent commits
       }
   }
   ```

3. **Implement cache-aside pattern with manual control:**
   ```java
   @Autowired
   private RedisTemplate<String, Object> redisTemplate;

   @Transactional
   public ResponseEntity<?> submitAssessmentAnswers(...) {
       // delete and save logic
       return ResponseEntity.ok(...);
   }

   // Call this AFTER transaction commits (use TransactionSynchronization)
   private void invalidateCache(Long assessmentId) {
       redisTemplate.delete("assessmentAnswers::" + assessmentId);
   }
   ```

4. **Use versioned cache keys to avoid invalidation:**
   ```java
   @Cacheable(value = "assessmentAnswers",
              key = "#assessmentId + ':' + #version")
   ```

**Warning signs:**
- Users see "ghost" answers (old data) for 1-2 seconds after submission
- Database CPU spikes to 100% when 50+ students submit assessments simultaneously
- Redis shows high eviction rate during assessment periods
- Logs show `PSQLException: deadlock detected` or `MySQLTransactionRollbackException`
- Cache hit rate drops from 90% to 10% during peak submission times

**Phase to address:**
Phase 2: Cache Integration Testing. Write integration tests that simulate concurrent submissions and verify cache consistency. Test with JMeter/Gatling at 200 concurrent users.

---

### Pitfall 3: Redis Out-of-Memory Eviction Breaks Assessment Submissions

**What goes wrong:**
Redis is configured with a 1.5GB memory limit. Assessment data includes base64-encoded images in `optionImageBase64` (average 500KB per option, up to 6 options per question). With 500 questions cached, Redis uses ~1.5GB. When the system tries to cache new assessment submissions during peak periods (200 students), Redis hits `maxmemory` and starts evicting keys using the default `noeviction` policy. This causes cache writes to fail silently, breaking the assumption that `@Cacheable` always works. Submission endpoints fail with `RedisCommandExecutionException: OOM command not allowed when used memory > 'maxmemory'`.

**Why it happens:**
- Developers estimate cache size based on database row count, ignoring serialization overhead
- Base64 encoding increases BLOB size by 33% (from LONGBLOB to String)
- Jackson JSON adds metadata fields (`"@class": "..."`) that inflate size by 10-20%
- Current Caffeine config uses `maximumSize=500` (entry count limit), but Redis needs byte-based limits
- No cache entry size limits—a single question with 6 images can be 3MB
- Assessment submissions append to cached lists, growing indefinitely
- No TTL monitoring or eviction alerts

**How to avoid:**
1. **Never cache BLOB/LOB fields in Redis:**
   ```java
   public class AssessmentQuestionCacheDTO {
       private Long questionId;
       private String questionText;
       // NO optionImage, NO optionImageBase64
       // Store image URLs instead, serve from cloud storage
   }
   ```

2. **Configure Redis with appropriate maxmemory-policy:**
   ```yaml
   spring:
     redis:
       maxmemory: 1536mb  # 1.5GB
       maxmemory-policy: allkeys-lru  # Evict least recently used
   ```

3. **Set entry size limits with custom serializer:**
   ```java
   @Bean
   public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
       RedisTemplate<String, Object> template = new RedisTemplate<>();
       template.setConnectionFactory(factory);
       template.setValueSerializer(new SizeLimitedJsonRedisSerializer(1_000_000)); // 1MB max
       return template;
   }
   ```

4. **Monitor cache entry sizes before deployment:**
   ```bash
   # Test serialization size in integration test
   ObjectMapper mapper = new ObjectMapper();
   byte[] serialized = mapper.writeValueAsBytes(assessmentQuestion);
   assertEquals(serialized.length < 100_000, "Entry exceeds 100KB");
   ```

5. **Implement tiered caching:**
   - Redis: Metadata only (IDs, names, counts) - hot data
   - Caffeine: Full DTOs without images - warm data
   - Database: Full entities with BLOBs - cold data

**Warning signs:**
- Redis memory usage consistently above 90% (`INFO memory`)
- `used_memory_rss` grows unbounded over days
- Cache writes fail with `JedisDataException: OOM`
- Application logs show `RedisConnectionFailureException`
- Students report "Submission failed" errors during peak times
- Redis shows high `evicted_keys` counter

**Phase to address:**
Phase 1: Redis Setup & Configuration. Calculate expected cache size with production data samples. Set up Redis monitoring (Prometheus + Grafana) BEFORE going live.

---

### Pitfall 4: Spring Boot 2.5.5 vs Redis Starter Version Incompatibility

**What goes wrong:**
Adding the latest `spring-boot-starter-data-redis` (3.x) to Spring Boot 2.5.5 causes dependency conflicts. Lettuce client version mismatches break connection pooling. `RedisTemplate` auto-configuration fails with `NoSuchMethodError` because Spring Data Redis 3.x requires Spring Framework 6+, but Spring Boot 2.5.5 uses Spring Framework 5.3.x. The application fails to start with:
```
java.lang.NoSuchMethodError: org.springframework.data.redis.connection.RedisConnection.setConfig(Ljava/lang/String;Ljava/lang/String;)V
```

**Why it happens:**
- Spring Boot 2.5.5 (Sept 2021) is NOT compatible with Spring Data Redis 3.x (Nov 2022+)
- Developers copy-paste latest Redis dependencies from recent tutorials written for Spring Boot 3.x
- Maven/Gradle don't enforce Spring Boot BOM version constraints strictly
- Lettuce 6.x (required by Spring Data Redis 2.7+) has breaking API changes from Lettuce 5.x
- Spring Boot 2.5.x reached end of commercial support in August 2023—documentation is outdated

**How to avoid:**
1. **Use compatible Spring Data Redis version for Spring Boot 2.5.5:**
   ```xml
   <!-- pom.xml -->
   <dependency>
       <groupId>org.springframework.boot</groupId>
       <artifactId>spring-boot-starter-data-redis</artifactId>
       <version>2.5.15</version>  <!-- Match Spring Boot version -->
   </dependency>
   ```

2. **Explicitly specify Lettuce version:**
   ```xml
   <dependency>
       <groupId>io.lettuce</groupId>
       <artifactId>lettuce-core</artifactId>
       <version>6.1.10.RELEASE</version>  <!-- Last 6.1.x compatible with Spring Boot 2.5 -->
   </dependency>
   ```

3. **Verify dependency tree before adding Redis:**
   ```bash
   mvn dependency:tree | grep -i redis
   mvn dependency:tree | grep -i lettuce
   # Check for version conflicts
   ```

4. **Test with integration test before production:**
   ```java
   @SpringBootTest
   @AutoConfigureDataRedis
   public class RedisConnectionTest {
       @Autowired
       private RedisTemplate<String, Object> redisTemplate;

       @Test
       public void testRedisConnection() {
           redisTemplate.opsForValue().set("test", "value");
           assertEquals("value", redisTemplate.opsForValue().get("test"));
       }
   }
   ```

**Warning signs:**
- Maven build succeeds but application fails to start
- `ClassNotFoundException: org.springframework.data.redis.connection.RedisConnectionFactory`
- `NoSuchMethodError` in Redis-related classes during startup
- `UnsatisfiedDependencyException` for `RedisTemplate` bean
- Different Redis behavior between local development and Docker container

**Phase to address:**
Phase 1: Redis Setup & Configuration. Verify dependency compatibility BEFORE writing any Redis code. Pin exact versions in `pom.xml`.

---

### Pitfall 5: Docker Networking Misconfiguration Breaks Redis Connectivity

**What goes wrong:**
The existing Docker Compose setup uses `career_shared_net` external network. Adding a Redis container without joining this network causes connection failures: the Spring Boot `api` container cannot resolve the Redis hostname. Application starts successfully (passes health checks) but fails at runtime when first cache operation executes:
```
io.lettuce.core.RedisConnectionException: Unable to connect to redis:6379
Caused by: java.net.UnknownHostException: redis
```
Developers test locally (`localhost:6379`) where Redis is accessible, but Docker deployment fails silently because connection errors only surface when cache is actually used.

**Why it happens:**
- Docker Compose networks are isolated—containers can't communicate across networks by default
- `spring-boot-starter-data-redis` defaults to `localhost:6379`, which doesn't exist inside the `api` container
- DNS resolution inside Docker uses container names as hostnames (`redis`), not IP addresses
- The `api` container's `application.yml` has profile-specific DB config but no Redis config yet
- Spring Boot's connection pool eagerly creates connections, but with lazy initialization (`spring.data.redis.client.type: lettuce`), errors are deferred

**How to avoid:**
1. **Add Redis container to `docker-compose.yml` on the same network:**
   ```yaml
   services:
     redis:
       image: redis:7.2-alpine  # Smaller, secure, compatible
       restart: always
       ports:
         - '6379:6379'
       command: redis-server --maxmemory 1536mb --maxmemory-policy allkeys-lru
       deploy:
         resources:
           limits:
             memory: 1.5g  # Match Redis maxmemory + overhead
       networks:
         - career_shared_net
       volumes:
         - redis_data:/data

     api:
       # existing config
       depends_on:
         - mysql_db_api
         - redis  # Add dependency

   volumes:
     mysql_data:
     redis_data:  # Add volume
   ```

2. **Configure profile-specific Redis settings in `application.yml`:**
   ```yaml
   ---
   spring:
     profiles: dev
     redis:
       host: localhost
       port: 6379
   ---
   spring:
     profiles: staging
     redis:
       host: redis  # Docker service name
       port: 6379
       lettuce:
         pool:
           max-active: 50
           max-idle: 20
           min-idle: 10
           max-wait: 30000
   ```

3. **Test Docker networking BEFORE adding cache annotations:**
   ```bash
   # Start containers
   docker-compose up -d redis

   # Verify Redis is accessible from api container
   docker exec -it <api_container_id> sh -c "nc -zv redis 6379"
   # Should output: redis (172.x.x.x:6379) open

   # Test Redis connection from Spring Boot
   docker logs -f <api_container_id> | grep -i redis
   ```

4. **Add health check to Redis container:**
   ```yaml
   redis:
     healthcheck:
       test: ["CMD", "redis-cli", "ping"]
       interval: 10s
       timeout: 3s
       retries: 3
   ```

**Warning signs:**
- Application starts successfully but cache operations fail at runtime
- `UnknownHostException: redis` in logs
- `RedisConnectionFailureException: Unable to connect` during first cache write
- Local development works but Docker deployment fails
- Redis container shows 0 connections (`redis-cli CLIENT LIST`)
- Network packet analysis shows DNS resolution failure for `redis` hostname

**Phase to address:**
Phase 1: Redis Setup & Configuration. Add Redis to Docker Compose and verify connectivity BEFORE any Spring code changes. Test with `redis-cli` from inside `api` container.

---

### Pitfall 6: Caffeine to Redis Migration Without Backward Compatibility

**What goes wrong:**
Switching from `CaffeineCacheManager` to `RedisCacheManager` in one deployment causes all caches to be empty during the cutover. The existing code assumes cache is always populated after the first load. Cached values return `null`, triggering database queries for all 200 concurrent users simultaneously. This creates a thundering herd that overloads MySQL (connection pool exhausted), causing 30-second response times. Users see "Assessment unavailable" errors during the migration window.

**Why it happens:**
- Caffeine cache is in-memory, wiped on application restart
- Redis cache persists across restarts, but starts empty on first deployment
- Existing `@Cacheable` code doesn't handle `null` returns gracefully
- No cache warming strategy—application expects cache to be pre-populated
- Blue-green deployment switches all traffic instantly from old (Caffeine) to new (Redis) instances
- Cache key format differences between Caffeine and Redis cause cache misses even when data exists

**How to avoid:**
1. **Run Caffeine and Redis simultaneously during migration:**
   ```java
   @Configuration
   public class CacheConfig {

       @Bean
       @Primary
       public CacheManager compositeCacheManager(
           CacheManager caffeineCacheManager,
           CacheManager redisCacheManager) {

           CompositeCacheManager manager = new CompositeCacheManager(
               redisCacheManager,     // Check Redis first
               caffeineCacheManager   // Fallback to Caffeine
           );
           manager.setFallbackToNoOpCache(false);
           return manager;
       }
   }
   ```

2. **Implement cache warming on application startup:**
   ```java
   @Component
   public class CacheWarmer implements ApplicationRunner {

       @Autowired
       private AssessmentQuestionRepository repository;

       @Autowired
       private CacheManager cacheManager;

       @Override
       public void run(ApplicationArguments args) {
           Cache cache = cacheManager.getCache("assessmentQuestions");
           List<AssessmentQuestions> questions = repository.findAll();
           cache.put("allQuestions", questions);
           logger.info("Warmed cache with {} questions", questions.size());
       }
   }
   ```

3. **Add fallback logic for cache misses:**
   ```java
   @Cacheable(value = "assessmentQuestions", unless = "#result == null")
   public List<AssessmentQuestions> getAllAssessmentQuestions() {
       logger.warn("Cache miss - loading from database");
       return repository.findAll();
   }
   ```

4. **Use feature flag for gradual rollout:**
   ```java
   @Configuration
   public class CacheConfig {

       @Value("${cache.redis.enabled:false}")
       private boolean redisEnabled;

       @Bean
       public CacheManager cacheManager() {
           if (redisEnabled) {
               return redisCacheManager();
           }
           return caffeineCacheManager();
       }
   }
   ```

**Warning signs:**
- Sudden spike in database connections after Redis deployment
- Response times increase from 50ms to 5000ms
- MySQL shows `Too many connections` error
- Cache hit rate drops to 0% after deployment
- Users report "Server error" during migration
- Redis shows 0 keys immediately after deployment (`DBSIZE`)

**Phase to address:**
Phase 3: Migration & Cutover. Plan phased rollout with composite cache manager. Test cache warming with production data volumes.

---

### Pitfall 7: No Graceful Degradation When Redis is Down

**What goes wrong:**
Redis container crashes (OOM, disk full, network partition). Spring Boot's `RedisCacheManager` throws `RedisConnectionException` on every cache operation. All requests fail with 500 errors because cache operations are not fault-tolerant. The application cannot serve assessment data even though MySQL is healthy and contains all data. A single Redis failure creates a complete outage.

**Why it happens:**
- Default `RedisTemplate` propagates all exceptions to calling code
- `@Cacheable` annotation doesn't have built-in fallback mechanism
- No circuit breaker pattern implemented for Redis
- Connection pool keeps retrying failed connections, blocking threads
- Developers assume "cache is infrastructure" and don't plan for its failure
- No monitoring/alerting configured for Redis health

**How to avoid:**
1. **Implement cache fallback with try-catch:**
   ```java
   @Service
   public class AssessmentService {

       @Autowired
       private AssessmentQuestionRepository repository;

       @Autowired
       private RedisTemplate<String, Object> redisTemplate;

       public List<AssessmentQuestions> getAllQuestions() {
           try {
               List<AssessmentQuestions> cached =
                   (List<AssessmentQuestions>) redisTemplate
                       .opsForValue()
                       .get("assessmentQuestions");
               if (cached != null) {
                   return cached;
               }
           } catch (Exception e) {
               logger.error("Redis failure, falling back to DB", e);
               metrics.incrementCounter("cache.redis.fallback");
           }

           return repository.findAll();
       }
   }
   ```

2. **Use Spring Cache abstraction with error handler:**
   ```java
   @Configuration
   public class CacheConfig implements CachingConfigurer {

       @Override
       public CacheErrorHandler errorHandler() {
           return new CacheErrorHandler() {
               @Override
               public void handleCacheGetError(RuntimeException exception,
                                                Cache cache, Object key) {
                   logger.error("Cache GET failed for {}: {}",
                               key, exception.getMessage());
                   // Don't throw - return null to trigger DB query
               }

               @Override
               public void handleCachePutError(RuntimeException exception,
                                                Cache cache, Object key, Object value) {
                   logger.error("Cache PUT failed for {}: {}",
                               key, exception.getMessage());
                   // Don't throw - continue without caching
               }

               // Implement other methods similarly
           };
       }
   }
   ```

3. **Add Resilience4j circuit breaker:**
   ```java
   @CircuitBreaker(name = "redis", fallbackMethod = "fallbackGetQuestions")
   @Cacheable("assessmentQuestions")
   public List<AssessmentQuestions> getAllQuestions() {
       return repository.findAll();
   }

   public List<AssessmentQuestions> fallbackGetQuestions(Exception e) {
       logger.warn("Redis circuit open, using DB directly");
       return repository.findAll();
   }
   ```

4. **Configure Lettuce connection timeout:**
   ```yaml
   spring:
     redis:
       lettuce:
         shutdown-timeout: 100ms  # Fail fast, don't wait
       timeout: 2000  # 2 second timeout for operations
   ```

**Warning signs:**
- All API endpoints return 500 when Redis is down
- Application logs filled with `RedisConnectionException`
- Thread pool exhausted (all threads blocked on Redis connection attempts)
- Response times >30 seconds (waiting for Redis timeout)
- Users cannot access assessments even though MySQL is healthy
- No database queries logged (all requests failing at cache layer)

**Phase to address:**
Phase 2: Cache Integration Testing. Implement circuit breaker and error handling BEFORE production deployment. Test by killing Redis container during load test.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Cache JPA entities directly (no DTOs) | Faster implementation, less code | Serialization issues, cache size explosion, tight coupling to database schema | Never - always use DTOs for Redis |
| Use default Redis serialization (JDK) | No configuration needed | 10x larger payload size, not human-readable, version incompatibility | Never - always use JSON serialization |
| Skip cache size calculations | Deploy faster | OOM crashes, eviction storms, unpredictable performance | Never for production - acceptable for dev/POC only |
| Use `allEntries=true` for all evictions | Simple invalidation logic | Cache stampede, database overload during writes | Acceptable for low-traffic MVP, must fix before scale |
| No Redis monitoring/alerting | Simpler initial setup | Cannot detect issues before outage | Never - monitoring is mandatory for production cache |
| Cache entire entity graphs with relationships | Easier to work with rich objects | Memory explosion, circular reference errors | Never - flatten to value objects |
| Rely on Redis default config | Quick to deploy | Wrong eviction policy, no memory limits, poor performance | Acceptable for local dev only |

## Integration Gotchas

Common mistakes when connecting Redis to the existing Spring Boot + MySQL system.

| Integration Point | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `@Transactional` + `@CacheEvict` | Cache invalidated before transaction commits, causing dirty reads | Use `beforeInvocation=false` or `TransactionSynchronization` to invalidate after commit |
| Docker networking | Redis on different network, API container can't connect | Add Redis to `career_shared_net`, use service name as hostname |
| Lettuce version | Using latest Lettuce 6.4.x with Spring Boot 2.5.5 | Pin Lettuce to 6.1.10.RELEASE for compatibility |
| Cache key format | Caffeine uses simple keys, Redis uses prefixed keys (`cache::key`) | Explicitly set key format with `@Cacheable(key = "...")` for consistency |
| LOB field serialization | Caching entities with `optionImage` LONGBLOB | Exclude LOB fields from cache DTOs, use URLs instead |
| Connection pool sizing | Default pool (8 connections) insufficient for 200 concurrent users | Set `lettuce.pool.max-active=50` based on expected concurrency |
| Profile-specific config | Redis host hardcoded to `localhost` in all profiles | Use profile-specific `spring.redis.host` (localhost for dev, redis for staging) |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Caching full entity graphs with EAGER loading | Cache hit takes 500ms, 10MB Redis entries | Use DTOs with lazy loading disabled, fetch only needed fields | 500+ questions with 6 options each |
| No TTL on assessment submissions | Redis memory grows unbounded | Set TTL on transient data: `@Cacheable(expire = 3600)` | After 1000+ student submissions |
| Synchronous cache writes on submission | Submission takes 2 seconds (waiting for Redis) | Use async cache updates: `@CacheEvict(asyncInvalidate = true)` | 50+ concurrent submissions |
| Single Redis instance (no clustering) | All cache requests bottleneck on one instance | Use Redis Cluster or Sentinel for HA | 200+ concurrent users during assessments |
| Cache stampede on delete-then-save | Database CPU 100% when multiple users submit | Implement probabilistic early recomputation or request coalescing | 100+ concurrent writes |
| Uncompressed JSON serialization | Redis network bandwidth saturated | Enable compression for large values with GenericJackson2JsonRedisSerializer | Cache values >100KB |
| N+1 cache queries for related entities | 100 Redis calls for one assessment | Use batch operations: `redisTemplate.opsForValue().multiGet()` | Assessment with 50+ questions |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| No Redis authentication | Anyone on Docker network can read/write cache, exposing student assessment data | Set `requirepass` in redis.conf, configure `spring.redis.password` |
| Caching PII without encryption | Student names, DOB, phone numbers visible in Redis | Encrypt sensitive fields before caching or exclude from cache |
| Redis accessible from public internet | Port 6379 exposed, vulnerable to ransomware attacks | Bind Redis to internal network only, use Docker network isolation |
| No SSL/TLS for Redis connection | Data transmitted in plaintext inside Docker network | Enable Redis SSL with `spring.redis.ssl.enabled: true` for production |
| Caching authentication tokens | JWT tokens in cache could be stolen if Redis is compromised | Never cache tokens, use stateless authentication |
| No Redis backup | Cache data lost on container failure, no audit trail for assessment submissions | Configure Redis persistence (RDB snapshots), backup to volume |
| Student data visible in cache keys | `assessmentAnswers::studentId:12345` exposes student IDs | Use opaque cache keys with hash-based identifiers |

## UX Pitfalls

Common user experience mistakes when adding Redis caching.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Stale assessment data after admin edits | Students see old questions after teacher updates assessment | Invalidate cache immediately on admin edits with WebSocket notification |
| Infinite "Loading..." during Redis outage | Users stuck on loading screen when cache fails | Show "degraded performance" banner, fall back to DB with loading indicator |
| Inconsistent assessment state across restarts | Student sees different questions after server restart (cache cleared) | Persist assessment state in database, use cache only for performance |
| Submission appears to fail but actually succeeded | User re-submits, creates duplicate answers | Return cached submission result for 60 seconds to handle retries |
| Score recalculation shows outdated results | Text-to-option mappings cached, score recalculation uses old mappings | Invalidate both answer cache and mapping cache atomically |
| Admin sees cached counts, not real-time data | Dashboard shows "150 submissions" but database has 200 | Don't cache admin metrics, or use 5-second TTL |
| Question images fail to load after migration | Image URLs broken because cache still has old data | Version cache keys when data schema changes |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Redis container added to Docker Compose:** Often missing `depends_on`, health check, memory limits, persistence volume
- [ ] **Cache DTO layer created:** Often missing `@JsonIgnore` on LOB fields, still has circular references
- [ ] **Profile-specific Redis config:** Often hardcoded `localhost`, breaks in Docker
- [ ] **Cache eviction timing:** Often uses default `beforeInvocation=true`, causes dirty reads
- [ ] **Error handling for Redis failures:** Often no try-catch, circuit breaker, or fallback to database
- [ ] **Cache size monitoring:** Often no alerts for Redis memory usage, eviction rate
- [ ] **Integration tests for cache coherence:** Often only unit tests, no concurrent submission testing
- [ ] **Cache key versioning:** Often no strategy for schema changes, old cache causes errors
- [ ] **Lettuce connection pool tuning:** Often uses default 8 connections, insufficient for 200 users
- [ ] **Cache warming on startup:** Often assumes cache will populate organically, causes thundering herd
- [ ] **Redis persistence configuration:** Often runs in-memory only, loses data on restart
- [ ] **Documentation for cache invalidation logic:** Often undocumented which endpoints invalidate which caches

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Redis OOM crash during assessment period | HIGH | 1. Immediately increase `maxmemory` limit 2. Flush non-critical caches (`FLUSHDB 1`) 3. Restart Redis 4. Enable monitoring alerts |
| Serialization error breaks all cache writes | MEDIUM | 1. Disable Redis caching with feature flag 2. Fix DTO serialization 3. Test with integration test 4. Re-enable gradually |
| Cache stampede overloads MySQL | HIGH | 1. Enable query cache on MySQL 2. Add rate limiting to submission endpoint 3. Implement request coalescing 4. Scale database vertically |
| Wrong Lettuce version causes startup failure | LOW | 1. Revert to Caffeine-only config 2. Fix dependency version 3. Rebuild JAR 4. Redeploy |
| Redis network unreachable in Docker | MEDIUM | 1. Verify network config with `docker network inspect` 2. Recreate network if needed 3. Restart containers in order (Redis, API) |
| Stale data served after admin edits | LOW | 1. Manual cache invalidation: `redis-cli FLUSHALL` 2. Implement cache versioning 3. Add TTL to prevent long-lived stale data |
| Cache key mismatch after migration | MEDIUM | 1. Flush all caches 2. Warm cache with correct key format 3. Deploy fix to normalize keys |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| JPA entity serialization explosion | Phase 1: Redis Setup | Serialize sample entities, measure size <100KB |
| Cache invalidation race conditions | Phase 2: Integration Testing | Run concurrent submission test, verify no dirty reads |
| Redis OOM eviction | Phase 1: Redis Setup | Load test with 500 questions, monitor Redis memory |
| Spring Boot version incompatibility | Phase 1: Redis Setup | Maven build succeeds, integration test passes |
| Docker networking misconfiguration | Phase 1: Redis Setup | `docker exec` into API container, ping Redis |
| Caffeine to Redis migration | Phase 3: Migration & Cutover | Cache hit rate >80% after migration, no DB spike |
| No graceful degradation | Phase 2: Integration Testing | Kill Redis container, verify API still serves data |

## Sources

- Spring Boot 2.5.5 official documentation: https://docs.spring.io/spring-boot/docs/2.5.5/reference/html/
- Spring Data Redis reference: https://docs.spring.io/spring-data/redis/docs/2.5.x/reference/html/
- Lettuce Redis client compatibility matrix
- Career-Nine codebase analysis: `AssessmentQuestionController.java`, `AssessmentAnswerController.java`, `CacheConfig.java`
- Docker Compose configuration: `docker-compose.yml`
- Redis memory optimization best practices
- Jackson JSON serialization with JPA entities (circular reference handling)
- Spring `@Transactional` and cache interaction patterns
- Redis persistence and eviction policies documentation

---
*Pitfalls research for: Adding Redis to Spring Boot 2.5.5 + MySQL + Caffeine assessment system*
*Researched: 2026-03-07*
*Confidence: HIGH - Based on codebase analysis and Spring Boot 2.5.x + Redis integration patterns*
