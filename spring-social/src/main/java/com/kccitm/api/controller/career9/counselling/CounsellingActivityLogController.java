package com.kccitm.api.controller.career9.counselling;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.counselling.CounsellingActivityLog;
import com.kccitm.api.repository.Career9.counselling.CounsellingActivityLogRepository;

@RestController
@RequestMapping("/api/counselling-activity")
public class CounsellingActivityLogController {

    @Autowired
    private CounsellingActivityLogRepository logRepository;

    @GetMapping("/recent")
    public ResponseEntity<List<CounsellingActivityLog>> getRecent(
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(logRepository.findAllRecent(PageRequest.of(0, limit)));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount() {
        return ResponseEntity.ok(Map.of("count", logRepository.countByIsReadFalse()));
    }

    @PutMapping("/mark-all-read")
    public ResponseEntity<?> markAllRead() {
        logRepository.markAllAsRead();
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
