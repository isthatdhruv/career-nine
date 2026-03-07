package com.kccitm.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Configuration;

import com.kccitm.api.controller.career9.AssessmentQuestionController;
import com.kccitm.api.controller.career9.MeasuredQualityTypesController;

/**
 * Warms critical Redis caches on application startup.
 *
 * Listens for {@link ApplicationReadyEvent} (fires after all beans are ready and
 * the server is listening) then calls the @Cacheable controller methods through
 * the Spring AOP proxy so that results are stored in Redis automatically.
 *
 * Cache warming is best-effort: if Redis is down or the DB query fails, the
 * application still starts normally — caches will be populated on first request.
 */
@Configuration
public class CacheWarmingConfig implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger logger = LoggerFactory.getLogger(CacheWarmingConfig.class);

    @Autowired
    private AssessmentQuestionController assessmentQuestionController;

    @Autowired
    private MeasuredQualityTypesController measuredQualityTypesController;

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        try {
            logger.info("Starting cache warming...");

            // Warm assessmentQuestions cache — calls @Cacheable("assessmentQuestions")
            assessmentQuestionController.getAllAssessmentQuestions();
            logger.info("Warmed assessmentQuestions cache");

            // Warm measuredQualityTypes cache — calls @Cacheable("measuredQualityTypes")
            measuredQualityTypesController.getAllMeasuredQualityTypes();
            logger.info("Warmed measuredQualityTypes cache");

            logger.info("Cache warming completed successfully");
        } catch (Exception e) {
            logger.warn("Cache warming failed — application will continue, caches will populate on first request", e);
        }
    }
}
