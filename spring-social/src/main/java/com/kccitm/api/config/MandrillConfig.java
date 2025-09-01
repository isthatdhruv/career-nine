package com.kccitm.api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.microtripit.mandrillapp.lutung.MandrillApi;

@Configuration
public class MandrillConfig {


    String mandrillApiKey="WXX3fC00pJTZgonjnVvkgQ";

    @Bean
    public MandrillApi createMandrillApi() {
        return new MandrillApi(mandrillApiKey);
    }
}