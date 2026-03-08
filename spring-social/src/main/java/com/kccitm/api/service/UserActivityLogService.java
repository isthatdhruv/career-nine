package com.kccitm.api.service;

import java.time.LocalDateTime;

import javax.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.UserActivityLog;
import com.kccitm.api.model.career9.UserUrlAccessLog;
import com.kccitm.api.repository.Career9.UserActivityLogRepository;
import com.kccitm.api.repository.Career9.UserUrlAccessLogRepository;

@Service
public class UserActivityLogService {

    private static final Logger logger = LoggerFactory.getLogger(UserActivityLogService.class);

    @Autowired
    private UserActivityLogRepository activityLogRepository;

    @Autowired
    private UserUrlAccessLogRepository urlAccessLogRepository;

    @Async
    public void logLogin(Long userId, String userName, String email,
            String organisation, String ipAddress, String userAgent) {
        try {
            UserActivityLog log = new UserActivityLog();
            log.setUserId(userId);
            log.setUserName(userName);
            log.setEmail(email);
            log.setOrganisation(organisation);
            log.setIpAddress(ipAddress);
            log.setUserAgent(userAgent);
            log.setDeviceInfo(parseDeviceInfo(userAgent));
            log.setLoginTime(LocalDateTime.now());

            activityLogRepository.save(log);
            logger.info("Login logged for user: {} (ID: {})", email, userId);
        } catch (Exception e) {
            logger.error("Failed to log login activity for user ID: {}. Error: {}", userId, e.getMessage());
        }
    }

    @Async
    public void logUrlAccess(Long userId, String url, String httpMethod) {
        try {
            UserUrlAccessLog log = new UserUrlAccessLog();
            log.setUserId(userId);
            log.setUrl(url);
            log.setHttpMethod(httpMethod);
            log.setAccessTime(LocalDateTime.now());

            urlAccessLogRepository.save(log);
        } catch (Exception e) {
            logger.error("Failed to log URL access for user ID: {}. Error: {}", userId, e.getMessage());
        }
    }

    /**
     * Extracts client IP from request, handling proxies via X-Forwarded-For header.
     */
    public static String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            // X-Forwarded-For can contain multiple IPs; the first is the original client
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }

    /**
     * Parses User-Agent string into a human-readable OS + Browser summary.
     */
    public static String parseDeviceInfo(String userAgent) {
        if (userAgent == null || userAgent.isEmpty()) {
            return "Unknown";
        }

        String os = "Unknown OS";
        String browser = "Unknown Browser";

        // Detect OS
        String uaLower = userAgent.toLowerCase();
        if (uaLower.contains("windows nt 10")) {
            os = "Windows 10/11";
        } else if (uaLower.contains("windows nt 6.3")) {
            os = "Windows 8.1";
        } else if (uaLower.contains("windows nt 6.1")) {
            os = "Windows 7";
        } else if (uaLower.contains("windows")) {
            os = "Windows";
        } else if (uaLower.contains("mac os x")) {
            os = "macOS";
        } else if (uaLower.contains("android")) {
            os = "Android";
        } else if (uaLower.contains("iphone") || uaLower.contains("ipad")) {
            os = "iOS";
        } else if (uaLower.contains("linux")) {
            os = "Linux";
        } else if (uaLower.contains("chromeos") || uaLower.contains("cros")) {
            os = "Chrome OS";
        }

        // Detect Browser
        if (uaLower.contains("edg/") || uaLower.contains("edge/")) {
            browser = "Edge";
        } else if (uaLower.contains("opr/") || uaLower.contains("opera")) {
            browser = "Opera";
        } else if (uaLower.contains("chrome") && !uaLower.contains("chromium")) {
            browser = "Chrome";
        } else if (uaLower.contains("firefox")) {
            browser = "Firefox";
        } else if (uaLower.contains("safari") && !uaLower.contains("chrome")) {
            browser = "Safari";
        } else if (uaLower.contains("msie") || uaLower.contains("trident")) {
            browser = "Internet Explorer";
        }

        return os + " / " + browser;
    }
}
