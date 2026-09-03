package com.kccitm.api.controller.career9;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.AssessmentInstituteMapping;
import com.kccitm.api.repository.Career9.AssessmentInstituteMappingRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Regression cover for the partial-update contract of
 * {@code PUT /assessment-mapping/update/{id}}.
 *
 * <p>The endpoint used to bind its body straight to {@link AssessmentInstituteMapping}
 * and guard each copy with {@code != null}. That is unsound for any field carrying a
 * Java initializer: Jackson constructs through the no-arg constructor (running
 * {@code isActive = true} and {@code audience18Plus = false}) and then overwrites only
 * the properties actually present in the JSON. An omitted field therefore arrives as
 * its initializer value, never null, so the guard passed and clobbered stored state:
 * an isActive-only PUT reset a mapping's 18+ flag to minor, and an audience18Plus-only
 * PUT reactivated a mapping the admin had switched off.
 *
 * <p>{@link #entityBindingCannotDistinguishOmittedFromSent()} pins that mechanism so the
 * endpoint is never converted back to entity binding; the remaining tests pin the
 * containsKey-guarded Map contract that replaced it.
 *
 * <p>Follows the service/controller-level unit precedent set by
 * {@code AuthLifecycleIT} — this codebase has no MockMvc/SpringBootTest bootstrap.
 */
class AssessmentInstituteMappingUpdateTest {

    private AssessmentInstituteMappingRepository repository;
    private AssessmentInstituteMappingController controller;

    /** Whatever the controller handed to save() — i.e. the row as it would be persisted. */
    private AssessmentInstituteMapping saved;

    @BeforeEach
    void setUp() throws Exception {
        repository = mock(AssessmentInstituteMappingRepository.class);
        controller = new AssessmentInstituteMappingController();

        Field f = AssessmentInstituteMappingController.class.getDeclaredField("mappingRepository");
        f.setAccessible(true);
        f.set(controller, repository);

        when(repository.save(any(AssessmentInstituteMapping.class))).thenAnswer(inv -> {
            saved = inv.getArgument(0);
            return saved;
        });
    }

    /** Seed a stored row and make the repository return it for any id. */
    private void givenStoredRow(boolean isActive, Long amount, boolean audience18Plus) {
        AssessmentInstituteMapping existing = new AssessmentInstituteMapping();
        existing.setMappingId(7L);
        existing.setIsActive(isActive);
        existing.setAmount(amount);
        existing.setAudience18Plus(audience18Plus);
        when(repository.findById(anyLong())).thenReturn(Optional.of(existing));
    }

    private static Map<String, Object> body(String key, Object value) {
        Map<String, Object> m = new HashMap<>();
        m.put(key, value);
        return m;
    }

    @Test
    @DisplayName("entity binding reports initializer values for omitted fields, so != null guards are unsound")
    void entityBindingCannotDistinguishOmittedFromSent() throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        // The AssessmentMappingPanel "Active" toggle sends exactly this body.
        AssessmentInstituteMapping fromIsActiveOnly =
                mapper.readValue("{\"isActive\":true}", AssessmentInstituteMapping.class);
        assertThat(fromIsActiveOnly.getAudience18Plus())
                .as("omitted audience18Plus arrives as the field initializer, NOT null")
                .isNotNull()
                .isFalse();

        // The new 18+ switch sends exactly this body.
        AssessmentInstituteMapping fromAudienceOnly =
                mapper.readValue("{\"audience18Plus\":false}", AssessmentInstituteMapping.class);
        assertThat(fromAudienceOnly.getIsActive())
                .as("omitted isActive arrives as the field initializer, NOT null")
                .isNotNull()
                .isTrue();
    }

    @Test
    @DisplayName("isActive-only PUT preserves a stored 18+ flag (Critical 1)")
    void isActiveOnlyUpdateKeepsAudienceFlag() {
        givenStoredRow(true, 500L, true);

        controller.updateMapping(7L, body("isActive", true));

        assertThat(saved.getAudience18Plus()).isTrue();
        assertThat(saved.getIsActive()).isTrue();
        assertThat(saved.getAmount()).isEqualTo(500L);
    }

    @Test
    @DisplayName("audience18Plus-only PUT does not reactivate a deactivated mapping (Critical 2)")
    void audienceOnlyUpdateKeepsDeactivatedState() {
        givenStoredRow(false, 500L, false);

        controller.updateMapping(7L, body("audience18Plus", true));

        assertThat(saved.getIsActive()).isFalse();
        assertThat(saved.getAudience18Plus()).isTrue();
        assertThat(saved.getAmount()).isEqualTo(500L);
    }

    @Test
    @DisplayName("amount-only PUT leaves isActive and audience18Plus untouched")
    void amountOnlyUpdateLeavesOthersUntouched() {
        givenStoredRow(false, 500L, true);

        controller.updateMapping(7L, body("amount", 750));

        assertThat(saved.getAmount()).isEqualTo(750L);
        assertThat(saved.getIsActive()).isFalse();
        assertThat(saved.getAudience18Plus()).isTrue();
    }

    @Test
    @DisplayName("an explicit false still turns the flag off — containsKey, not truthiness")
    void explicitFalseStillClearsTheFlag() {
        givenStoredRow(true, null, true);

        controller.updateMapping(7L, body("audience18Plus", false));

        assertThat(saved.getAudience18Plus()).isFalse();
    }

    @Test
    @DisplayName("string and floating-point JSON values coerce instead of 500ing")
    void tolerantCoercionOfStringAndDoubleValues() {
        givenStoredRow(false, null, false);
        controller.updateMapping(7L, body("audience18Plus", "true"));
        assertThat(saved.getAudience18Plus()).isTrue();

        givenStoredRow(false, null, false);
        controller.updateMapping(7L, body("amount", "750"));
        assertThat(saved.getAmount()).isEqualTo(750L);

        givenStoredRow(false, null, false);
        controller.updateMapping(7L, body("amount", 750.0));
        assertThat(saved.getAmount()).isEqualTo(750L);
    }
}
