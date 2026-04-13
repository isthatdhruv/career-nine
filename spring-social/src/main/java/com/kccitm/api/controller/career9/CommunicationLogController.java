package com.kccitm.api.controller.career9;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.CommunicationLog;
import com.kccitm.api.repository.Career9.CommunicationLogRepository;

/**
 * Read-only endpoints for the "Logs of Email and WhatsApp" page.
 * Writes happen inside CommunicationLogService, called from the send endpoints.
 */
@RestController
@RequestMapping("/communication-logs")
public class CommunicationLogController {

    @Autowired
    private CommunicationLogRepository repository;

    @GetMapping
    public ResponseEntity<Page<CommunicationLog>> list(
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String messageType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        String normalizedChannel = isBlank(channel) ? null : channel.trim().toUpperCase();
        String normalizedType = isBlank(messageType) ? null : messageType.trim().toUpperCase();
        String normalizedStatus = isBlank(status) ? null : status.trim().toUpperCase();
        String normalizedSearch = isBlank(search) ? null : search.trim();

        LocalDateTime from = parseDate(fromDate, false);
        LocalDateTime to = parseDate(toDate, true);

        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 500)));
        Page<CommunicationLog> result = repository.search(
                normalizedChannel, normalizedType, normalizedStatus,
                normalizedSearch, from, to, pageable);
        return ResponseEntity.ok(result);
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    /** Accept "yyyy-MM-dd" or ISO datetime. `endOfDay` pads a date to 23:59:59. */
    private LocalDateTime parseDate(String value, boolean endOfDay) {
        if (isBlank(value)) return null;
        try {
            if (value.length() == 10) {
                LocalDateTime ldt = LocalDateTime.parse(value + "T00:00:00");
                return endOfDay ? ldt.withHour(23).withMinute(59).withSecond(59) : ldt;
            }
            return LocalDateTime.parse(value, DateTimeFormatter.ISO_DATE_TIME);
        } catch (Exception e) {
            return null;
        }
    }
}
