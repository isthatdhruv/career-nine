package com.kccitm.api.controller.career9.counselling;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    // no scope arg: self-lookup by userId from query param
    @PreAuthorize("@auth.allows('counselling.notification.read')")
    @GetMapping("/my")
    public ResponseEntity<List<Notification>> getMyNotifications(@RequestParam Long userId) {
        return ResponseEntity.ok(notificationService.getNotificationsForUser(userId));
    }

    // no scope arg: self-lookup unread count
    @PreAuthorize("@auth.allows('counselling.notification.read')")
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@RequestParam Long userId) {
        return ResponseEntity.ok(Map.of("count", notificationService.getUnreadCount(userId)));
    }

    // no scope arg: mark-read by id
    @PreAuthorize("@auth.allows('counselling.notification.update')")
    @PutMapping("/mark-read/{id}")
    public ResponseEntity<Void> markRead(@PathVariable Long id) {
        logger.info("Marking notification {} as read", id);
        notificationService.markAsRead(id);
        return ResponseEntity.ok().build();
    }

    // no scope arg: self-mark-all-read
    @PreAuthorize("@auth.allows('counselling.notification.update')")
    @PutMapping("/mark-all-read")
    public ResponseEntity<Void> markAllRead(@RequestParam Long userId) {
        logger.info("Marking all notifications as read for userId: {}", userId);
        notificationService.markAllRead(userId);
        return ResponseEntity.ok().build();
    }
}
