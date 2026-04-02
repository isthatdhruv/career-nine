package com.kccitm.api.controller.career9.counselling;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.counselling.Notification;
import com.kccitm.api.service.counselling.CounsellingNotificationService;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private static final Logger logger = LoggerFactory.getLogger(NotificationController.class);

    @Autowired
    private CounsellingNotificationService notificationService;

    @GetMapping("/my")
    public ResponseEntity<List<Notification>> getMyNotifications(@RequestParam Long userId) {
        return ResponseEntity.ok(notificationService.getNotificationsForUser(userId));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@RequestParam Long userId) {
        return ResponseEntity.ok(Map.of("count", notificationService.getUnreadCount(userId)));
    }

    @PutMapping("/mark-read/{id}")
    public ResponseEntity<Void> markRead(@PathVariable Long id) {
        logger.info("Marking notification {} as read", id);
        notificationService.markAsRead(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/mark-all-read")
    public ResponseEntity<Void> markAllRead(@RequestParam Long userId) {
        logger.info("Marking all notifications as read for userId: {}", userId);
        notificationService.markAllRead(userId);
        return ResponseEntity.ok().build();
    }
}
