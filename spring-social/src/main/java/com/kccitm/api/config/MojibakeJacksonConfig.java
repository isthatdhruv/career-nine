package com.kccitm.api.config;

import java.io.IOException;

import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.Version;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.kccitm.api.util.MojibakeFixer;

/**
 * Sanitizes mojibake out of every String that crosses the JSON boundary:
 *  - on the way IN  (deserialize): cleans request bodies before they are persisted.
 *  - on the way OUT (serialize):   cleans every response string at the display
 *    boundary, so any already-corrupted DB row (question text, option text,
 *    section instructions, careers, demographics, ...) renders clean without
 *    having to touch every entity or controller.
 *
 * Combined with the corrected {@link MojibakeFixer}, this guarantees the
 * assessment never shows mojibake, regardless of which table the text lives in.
 */
@Configuration
public class MojibakeJacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer mojibakeSanitizingCustomizer() {
        SimpleModule module = new SimpleModule("MojibakeSanitizingModule",
                new Version(1, 0, 0, null, null, null));
        module.addDeserializer(String.class, new SanitizingStringDeserializer());
        module.addSerializer(String.class, new SanitizingStringSerializer());
        return builder -> builder.modulesToInstall(module);
    }

    private static final class SanitizingStringDeserializer extends JsonDeserializer<String> {
        @Override
        public String deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
            return MojibakeFixer.fix(p.getValueAsString());
        }
    }

    private static final class SanitizingStringSerializer extends JsonSerializer<String> {
        @Override
        public void serialize(String value, JsonGenerator gen, SerializerProvider provider) throws IOException {
            gen.writeString(MojibakeFixer.fix(value));
        }
    }
}
