package com.kccitm.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;

import com.kccitm.api.config.AppProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
@EnableAsync
@EnableCaching
public class SpringSocialApplication {
	
	public static void main(String[] args) {
		SpringApplication.run(SpringSocialApplication.class, args);
	}
}
