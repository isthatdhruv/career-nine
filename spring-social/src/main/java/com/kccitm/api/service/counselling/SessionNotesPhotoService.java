package com.kccitm.api.service.counselling;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.SessionNotesPhoto;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.repository.Career9.counselling.SessionNotesPhotoRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;

/**
 * Photos of handwritten session notes.
 *
 * <p>Files go to the same DigitalOcean Spaces bucket that holds the rendered
 * student reports ({@code report-renders/...}), in a sibling folder:
 * {@code report-renders/session-notes/appointment-<id>/<uuid>.<ext>}. The
 * object is uploaded public-read with an unguessable name, exactly like the
 * report HTML/PDF, and the row in {@code session_notes_photo} is what the
 * portal lists from.
 *
 * <p>Photos are counsellor/admin material only. They are never returned on the
 * student-facing notes endpoint (typed notes already split public remarks from
 * private notes; a photo of the notebook page cannot be split, so it is treated
 * as private).
 */
@Service
public class SessionNotesPhotoService {

    private static final Logger logger = LoggerFactory.getLogger(SessionNotesPhotoService.class);

    /** Sibling of the report render folders so everything for a session sits in one place. */
    static final String FOLDER_PREFIX = "report-renders/session-notes/appointment-";

    static final long MAX_FILE_BYTES = 10L * 1024 * 1024;
    static final int MAX_FILES_PER_REQUEST = 10;
    static final int MAX_PHOTOS_PER_APPOINTMENT = 30;

    @Autowired private SessionNotesPhotoRepository photoRepository;
    @Autowired private CounsellingAppointmentRepository appointmentRepository;
    @Autowired private CounsellorRepository counsellorRepository;
    @Autowired private DigitalOceanSpacesService spacesService;
    @Autowired private AuditLogService auditLogService;

    @Transactional
    public List<SessionNotesPhoto> upload(Long appointmentId, List<MultipartFile> files, Long uploaderUserId) {
        if (files == null || files.isEmpty()) {
            throw new BadRequestException("Choose at least one photo to upload.");
        }
        if (files.size() > MAX_FILES_PER_REQUEST) {
            throw new BadRequestException("Upload at most " + MAX_FILES_PER_REQUEST + " photos at a time.");
        }
        CounsellingAppointment appointment = requireOwnedAppointment(appointmentId, uploaderUserId);

        long existing = photoRepository.countByAppointmentId(appointmentId);
        if (existing + files.size() > MAX_PHOTOS_PER_APPOINTMENT) {
            throw new BadRequestException("A session can hold at most " + MAX_PHOTOS_PER_APPOINTMENT + " photos.");
        }

        // Validate everything before touching Spaces so a bad second file
        // does not leave the first one orphaned in the bucket.
        for (MultipartFile f : files) validate(f);

        String folder = FOLDER_PREFIX + appointmentId;
        List<SessionNotesPhoto> saved = new ArrayList<>();
        for (MultipartFile f : files) {
            String contentType = normalisedContentType(f);
            String fileName = UUID.randomUUID() + extensionFor(contentType, f.getOriginalFilename());
            String url;
            try {
                url = spacesService.uploadBytes(f.getBytes(), contentType, folder, fileName);
            } catch (IOException e) {
                throw new BadRequestException("Could not read the uploaded file " + trimName(f.getOriginalFilename()));
            }

            SessionNotesPhoto photo = new SessionNotesPhoto();
            photo.setAppointmentId(appointmentId);
            photo.setFileUrl(url);
            photo.setObjectKey(folder + "/" + fileName);
            photo.setContentType(contentType);
            photo.setFileSize(f.getSize());
            photo.setOriginalFileName(trimName(f.getOriginalFilename()));
            photo.setUploadedByUserId(uploaderUserId);
            saved.add(photoRepository.save(photo));
        }

        logger.info("Uploaded {} session-notes photo(s) for appointment {} by user {}",
                saved.size(), appointmentId, uploaderUserId);
        try {
            Map<String, Object> newValues = new LinkedHashMap<>();
            newValues.put("photoCount", saved.size());
            newValues.put("totalPhotos", existing + saved.size());
            auditLogService.log(appointment, "SESSION_NOTES_PHOTO_UPLOADED", userRef(uploaderUserId),
                    "Session notes photo uploaded", null, newValues);
        } catch (Exception e) {
            logger.warn("Audit log for session-notes photo upload failed (continuing): {}", e.getMessage());
        }
        return saved;
    }

    public List<SessionNotesPhoto> list(Long appointmentId) {
        return photoRepository.findByAppointmentIdOrderByCreatedAtAscIdAsc(appointmentId);
    }

    /** One round-trip for a whole page of appointments: id to its photos (empty list when none). */
    public Map<Long, List<SessionNotesPhoto>> listByAppointments(Collection<Long> appointmentIds) {
        Map<Long, List<SessionNotesPhoto>> out = new LinkedHashMap<>();
        if (appointmentIds == null || appointmentIds.isEmpty()) return out;
        for (Long id : appointmentIds) out.put(id, new ArrayList<>());
        for (SessionNotesPhoto p : photoRepository.findByAppointmentIdInOrderByCreatedAtAscIdAsc(appointmentIds)) {
            out.computeIfAbsent(p.getAppointmentId(), k -> new ArrayList<>()).add(p);
        }
        return out;
    }

    @Transactional
    public void delete(Long photoId, Long requesterUserId) {
        SessionNotesPhoto photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new ResourceNotFoundException("SessionNotesPhoto", "id", photoId));
        CounsellingAppointment appointment = requireOwnedAppointment(photo.getAppointmentId(), requesterUserId);

        photoRepository.delete(photo);
        // Best-effort: a stale object in the bucket is harmless, a dangling DB
        // row that 404s in the UI is not, so the row goes first and Spaces
        // failures only log.
        try {
            spacesService.deleteFileByUrl(photo.getFileUrl());
        } catch (Exception e) {
            logger.warn("Could not delete session-notes photo object {} from Spaces: {}",
                    photo.getObjectKey(), e.getMessage());
        }
        logger.info("Deleted session-notes photo {} (appointment {}) by user {}",
                photoId, appointment.getId(), requesterUserId);
        try {
            Map<String, Object> oldValues = new LinkedHashMap<>();
            oldValues.put("photoId", photoId);
            oldValues.put("fileUrl", photo.getFileUrl());
            auditLogService.log(appointment, "SESSION_NOTES_PHOTO_DELETED", userRef(requesterUserId),
                    "Session notes photo removed", oldValues, null);
        } catch (Exception e) {
            logger.warn("Audit log for session-notes photo delete failed (continuing): {}", e.getMessage());
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /**
     * The appointment must exist and, when the caller is a counsellor, be theirs.
     * Callers without a counsellor profile (admin/staff) are already gated by the
     * session-notes permission on the endpoint and may act on any appointment.
     */
    private CounsellingAppointment requireOwnedAppointment(Long appointmentId, Long userId) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("CounsellingAppointment", "id", appointmentId));
        if (userId != null) {
            Counsellor me = counsellorRepository.findByUserId(userId).orElse(null);
            if (me != null) {
                Long owner = appointment.getCounsellor() != null ? appointment.getCounsellor().getId() : null;
                if (owner == null || !owner.equals(me.getId())) {
                    throw new AccessDeniedException("This session belongs to another counsellor.");
                }
            }
        }
        return appointment;
    }

    private static void validate(MultipartFile f) {
        if (f == null || f.isEmpty()) {
            throw new BadRequestException("One of the selected files is empty.");
        }
        if (f.getSize() > MAX_FILE_BYTES) {
            throw new BadRequestException("Each photo must be under 10 MB (" + trimName(f.getOriginalFilename()) + ").");
        }
        String ct = normalisedContentType(f);
        if (!ct.startsWith("image/")) {
            throw new BadRequestException("Only image files can be uploaded as session notes ("
                    + trimName(f.getOriginalFilename()) + ").");
        }
    }

    private static String normalisedContentType(MultipartFile f) {
        String ct = f.getContentType();
        if (ct == null || ct.isBlank() || "application/octet-stream".equalsIgnoreCase(ct)) {
            // Some phones send octet-stream for camera captures; fall back to the extension.
            String name = f.getOriginalFilename() == null ? "" : f.getOriginalFilename().toLowerCase(Locale.ROOT);
            if (name.endsWith(".png")) return "image/png";
            if (name.endsWith(".webp")) return "image/webp";
            if (name.endsWith(".gif")) return "image/gif";
            if (name.endsWith(".heic") || name.endsWith(".heif")) return "image/heic";
            if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
            return ct == null ? "" : ct.toLowerCase(Locale.ROOT);
        }
        return ct.toLowerCase(Locale.ROOT);
    }

    private static String extensionFor(String contentType, String originalName) {
        switch (contentType) {
            case "image/jpeg": return ".jpg";
            case "image/png":  return ".png";
            case "image/webp": return ".webp";
            case "image/gif":  return ".gif";
            case "image/heic": return ".heic";
            case "image/heif": return ".heif";
            default:
                if (originalName != null) {
                    int dot = originalName.lastIndexOf('.');
                    if (dot > 0 && dot < originalName.length() - 1 && originalName.length() - dot <= 6) {
                        return originalName.substring(dot).toLowerCase(Locale.ROOT);
                    }
                }
                return "";
        }
    }

    private static String trimName(String name) {
        if (name == null) return null;
        // Strip any client path and cap to the column width.
        String base = name.replace('\\', '/');
        base = base.substring(base.lastIndexOf('/') + 1);
        return base.length() > 255 ? base.substring(base.length() - 255) : base;
    }

    private static User userRef(Long userId) {
        if (userId == null) return null;
        User u = new User();
        u.setId(userId);
        return u;
    }
}
