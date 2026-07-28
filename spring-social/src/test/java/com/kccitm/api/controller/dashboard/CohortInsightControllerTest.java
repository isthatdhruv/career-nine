package com.kccitm.api.controller.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import com.kccitm.api.service.dashboard.cohort.CohortInsightGenerationService;
import com.kccitm.api.service.dashboard.cohort.CohortInsightView;

class CohortInsightControllerTest {

    private CohortInsightGenerationService service;
    private CohortInsightController controller;

    @BeforeEach
    void setUp() {
        service = mock(CohortInsightGenerationService.class);
        controller = new CohortInsightController(service);
    }

    @Test
    void generateEnqueuesAndDispatchesAsyncWhenNewlyPending() {
        when(service.markPending(1L, 5L, null)).thenReturn(true);

        ResponseEntity<?> resp = controller.generate(1, 5L);

        assertThat(resp.getStatusCodeValue()).isEqualTo(202);
        verify(service).runGenerationAsync(1L, 5L);
    }

    @Test
    void generateDoesNotDispatchAsyncWhenAlreadyRunning() {
        when(service.markPending(1L, 5L, null)).thenReturn(false);

        ResponseEntity<?> resp = controller.generate(1, 5L);

        assertThat(resp.getStatusCodeValue()).isEqualTo(202);
        verify(service, never()).runGenerationAsync(eq(1L), eq(5L));
    }

    @Test
    void getReturnsViewFromService() {
        CohortInsightView view = new CohortInsightView();
        view.status = CohortInsightGenerationService.STATUS_GENERATED;
        when(service.getView(1L, 5L)).thenReturn(view);

        ResponseEntity<CohortInsightView> resp = controller.get(1, 5L);

        assertThat(resp.getStatusCodeValue()).isEqualTo(200);
        assertThat(resp.getBody().status).isEqualTo(CohortInsightGenerationService.STATUS_GENERATED);
    }
}
