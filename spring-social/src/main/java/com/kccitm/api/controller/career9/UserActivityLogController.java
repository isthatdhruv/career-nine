package com.kccitm.api.controller.career9;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.UserActivityLog;
import com.kccitm.api.model.career9.UserUrlAccessLog;
import com.kccitm.api.repository.Career9.UserActivityLogRepository;
import com.kccitm.api.repository.Career9.UserUrlAccessLogRepository;

@RestController
@RequestMapping("/activity-log")
public class UserActivityLogController {

    @Autowired
    private UserActivityLogRepository activityLogRepository;

    @Autowired
    private UserUrlAccessLogRepository urlAccessLogRepository;

    @GetMapping("/logins")
    public ResponseEntity<List<UserActivityLog>> getLogins(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.atTime(LocalTime.MAX);

        List<UserActivityLog> logs = activityLogRepository
                .findByLoginTimeBetweenOrderByLoginTimeDesc(start, end);

        return ResponseEntity.ok(logs);
    }

    @GetMapping("/urls/{userId}")
    public ResponseEntity<List<UserUrlAccessLog>> getUrlAccess(
            @PathVariable Long userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.atTime(LocalTime.MAX);

        List<UserUrlAccessLog> logs = urlAccessLogRepository
                .findByUserIdAndAccessTimeBetweenOrderByAccessTimeDesc(userId, start, end);

        return ResponseEntity.ok(logs);
    }
}
