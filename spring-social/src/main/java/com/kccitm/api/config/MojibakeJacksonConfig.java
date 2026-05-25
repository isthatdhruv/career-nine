package com.kccitm.api.config;

import java.io.IOException;

import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.Version;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.kccitm.api.util.MojibakeFixer;

@Configuration
public class MojibakeJacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer mojibakeSanitizingCustomizer() {
        SimpleModule module = new SimpleModule("MojibakeSanitizingModule",
                new Version(1, 0, 0, null, null, null));
        module.addDeserializer(String.class, new SanitizingStringDeserializer());
        return builder -> builder.modulesToInstall(module);
    }

    private static final class SanitizingStringDeserializer extends JsonDeserializer<String> {
        @Override
        public String deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
            String value = p.getValueAsString();
            return MojibakeFixer.fix(value);
        }
    }
}
