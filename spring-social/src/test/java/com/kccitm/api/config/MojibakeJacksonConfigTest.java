package com.kccitm.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Proves that the OUTGOING serializer wired by {@link MojibakeJacksonConfig}
 * cleans mojibake out of every string shape the assessment actually returns:
 * a bean field, a List element, a Map value, and the nested Map tree the
 * locked-snapshot endpoint serves. This is the guarantee that no corrupted DB /
 * cache / snapshot value can ever render on screen.
 */
class MojibakeJacksonConfigTest {

    private static final Charset CP1252 = Charset.forName("windows-1252");
    private ObjectMapper mapper;

    private static String corrupt(String clean) {
        return new String(clean.getBytes(StandardCharsets.UTF_8), CP1252);
    }

    @BeforeEach
    void setUp() {
        // Build the mapper through the exact production wiring.
        Jackson2ObjectMapperBuilder builder = new Jackson2ObjectMapperBuilder();
        new MojibakeJacksonConfig().mojibakeSanitizingCustomizer().customize(builder);
        mapper = builder.build();
    }

    private String serializedTextAt(Object payload, String... path) throws Exception {
        JsonNode node = mapper.readTree(mapper.writeValueAsString(payload));
        for (String p : path) {
            node = p.matches("\\d+") ? node.get(Integer.parseInt(p)) : node.get(p);
        }
        return node.asText();
    }

    static class OptionDto {
        public String optionText;
        OptionDto(String t) { this.optionText = t; }
    }

    @Test
    void cleansBeanStringField() throws Exception {
        String clean = "Rarely figure out the mystery before it’s revealed.";
        assertThat(serializedTextAt(new OptionDto(corrupt(clean)), "optionText")).isEqualTo(clean);
    }

    @Test
    void cleansListElement() throws Exception {
        String clean = "ends with a dash — ok";
        List<String> list = new ArrayList<>();
        list.add(corrupt(clean));
        assertThat(serializedTextAt(list, "0")).isEqualTo(clean);
    }

    @Test
    void cleansNestedMapTreeLikeLockedSnapshot() throws Exception {
        // Mirrors readLockedSnapshot(): Map<String,Object> { questionnaire: [ { optionText, questionText } ] }
        String cleanOpt = "before it’s revealed";
        String cleanQ = "If I read a mystery story — I can";
        Map<String, Object> option = new LinkedHashMap<>();
        option.put("optionText", corrupt(cleanOpt));
        option.put("questionText", corrupt(cleanQ));
        List<Object> options = new ArrayList<>();
        options.add(option);
        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.put("questionnaire", options);

        assertThat(serializedTextAt(bundle, "questionnaire", "0", "optionText")).isEqualTo(cleanOpt);
        assertThat(serializedTextAt(bundle, "questionnaire", "0", "questionText")).isEqualTo(cleanQ);
    }

    @Test
    void preservesGenuineHindi() throws Exception {
        String hindi = "सामाजिक रुचि";
        assertThat(serializedTextAt(new OptionDto(hindi), "optionText")).isEqualTo(hindi);
    }
}
