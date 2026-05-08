package com.kccitm.api.service.b2c;

import java.util.Date;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.UserStudentInstituteHistory;
import com.kccitm.api.model.career9.b2c.Campaign;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.Career9.UserStudentInstituteHistoryRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.InstituteDetailRepository;

/**
 * Owns the relationship between a UserStudent and one or more InstituteDetail
 * rows. The user_student.institute_id column holds the PRIMARY institute; the
 * user_student_institute_history table holds every (student, institute) pair
 * the system has ever seen, with per-row drop flags.
 *
 * Rules:
 *  - When a student registers via a campaign, the campaign's institute becomes
 *    the new primary (overwriting any previous primary), and a membership row
 *    is upserted. The old primary is preserved as a (now non-primary)
 *    membership row.
 *  - Drops are soft and cannot be applied to the current primary; admins must
 *    promote another membership to primary first.
 */
@Service
public class StudentInstituteMembershipService {

    private static final Logger logger = LoggerFactory.getLogger(StudentInstituteMembershipService.class);

    @Autowired private UserStudentInstituteHistoryRepository historyRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private InstituteDetailRepository instituteDetailRepository;

    /**
     * Called from every campaign-driven registration path. Sets the student's
     * primary institute to the campaign's institute (overwriting), and records
     * both the new institute and the previous primary as membership rows.
     *
     * No-op when the campaign has no institute mapped (legacy campaigns
     * pre-backfill).
     */
    @Transactional
    public void assignFromCampaign(UserStudent userStudent, Campaign campaign, String source) {
        if (userStudent == null || campaign == null) return;
        Integer newCode = campaign.getInstituteCode();
        if (newCode == null) return; // legacy campaign, nothing to do

        InstituteDetail newInstitute = instituteDetailRepository.findById(newCode.intValue());
        if (newInstitute == null) {
            logger.warn("Campaign {} references missing institute_code {}", campaign.getCampaignId(), newCode);
            return;
        }

        InstituteDetail current = userStudent.getInstitute();
        Integer currentCode = current != null ? current.getInstituteCode() : null;

        // 1. Backfill the existing primary as a membership row if it isn't
        //    represented yet. This applies to legacy students whose institute
        //    predates the membership table.
        if (currentCode != null && !currentCode.equals(newCode)) {
            ensureMembership(userStudent.getUserStudentId(), currentCode, null, "initial");
        }

        // 2. Upsert a membership row for the campaign's institute (un-drops
        //    the row if it had been dropped previously).
        upsertMembership(userStudent.getUserStudentId(), newCode, campaign.getCampaignId(), source);

        // 3. Set/overwrite primary on user_student if it differs.
        if (currentCode == null || !currentCode.equals(newCode)) {
            userStudent.setInstitute(newInstitute);
            userStudentRepository.save(userStudent);
        }
    }

    /** Ensures a non-dropped membership row exists; creates one if missing. */
    @Transactional
    public UserStudentInstituteHistory ensureMembership(Long userStudentId, Integer instituteCode,
                                                        Long campaignId, String source) {
        Optional<UserStudentInstituteHistory> existing =
                historyRepository.findByUserStudentIdAndInstituteCode(userStudentId, instituteCode);
        if (existing.isPresent()) return existing.get();
        UserStudentInstituteHistory row = new UserStudentInstituteHistory(
                userStudentId, instituteCode, campaignId, source);
        return historyRepository.save(row);
    }

    /**
     * Inserts a fresh row, OR if one already exists for (student,institute):
     * un-drops it and refreshes added_at + source + campaign_id. We deliberately
     * keep one row per pair (UNIQUE constraint) rather than appending duplicates.
     */
    @Transactional
    public UserStudentInstituteHistory upsertMembership(Long userStudentId, Integer instituteCode,
                                                        Long campaignId, String source) {
        Optional<UserStudentInstituteHistory> existing =
                historyRepository.findByUserStudentIdAndInstituteCode(userStudentId, instituteCode);
        UserStudentInstituteHistory row = existing.orElseGet(() ->
                new UserStudentInstituteHistory(userStudentId, instituteCode, campaignId, source));
        row.setIsDropped(false);
        row.setDroppedAt(null);
        row.setDroppedReason(null);
        row.setSource(source);
        row.setCampaignId(campaignId);
        if (row.getId() == null) {
            row.setAddedAt(new Date());
        }
        return historyRepository.save(row);
    }

    /**
     * Soft-drop: rejects when the institute is the student's current primary.
     * The caller surfaces the IllegalStateException as an HTTP 400.
     */
    @Transactional
    public UserStudentInstituteHistory dropMembership(Long userStudentId, Integer instituteCode, String reason) {
        UserStudent us = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found"));
        Integer currentPrimary = us.getInstitute() != null ? us.getInstitute().getInstituteCode() : null;
        if (instituteCode.equals(currentPrimary)) {
            throw new IllegalStateException(
                    "Cannot drop the student's primary institute. Promote another institute to primary first.");
        }
        UserStudentInstituteHistory row = historyRepository
                .findByUserStudentIdAndInstituteCode(userStudentId, instituteCode)
                .orElseThrow(() -> new IllegalArgumentException("Membership not found"));
        if (Boolean.TRUE.equals(row.getIsDropped())) return row;
        row.setIsDropped(true);
        row.setDroppedAt(new Date());
        row.setDroppedReason(reason);
        return historyRepository.save(row);
    }

    @Transactional
    public UserStudentInstituteHistory undropMembership(Long userStudentId, Integer instituteCode) {
        UserStudentInstituteHistory row = historyRepository
                .findByUserStudentIdAndInstituteCode(userStudentId, instituteCode)
                .orElseThrow(() -> new IllegalArgumentException("Membership not found"));
        if (!Boolean.TRUE.equals(row.getIsDropped())) return row;
        row.setIsDropped(false);
        row.setDroppedAt(null);
        row.setDroppedReason(null);
        return historyRepository.save(row);
    }

    /**
     * Promotes a non-dropped membership to primary. Updates user_student.institute_id.
     * The previous primary is left alone (it stays as a non-primary membership).
     */
    @Transactional
    public void setPrimary(Long userStudentId, Integer instituteCode) {
        UserStudent us = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found"));
        UserStudentInstituteHistory row = historyRepository
                .findByUserStudentIdAndInstituteCode(userStudentId, instituteCode)
                .orElseThrow(() -> new IllegalArgumentException("Membership not found"));
        if (Boolean.TRUE.equals(row.getIsDropped())) {
            throw new IllegalStateException("Cannot promote a dropped institute to primary. Un-drop it first.");
        }
        InstituteDetail inst = instituteDetailRepository.findById(instituteCode.intValue());
        if (inst == null) throw new IllegalArgumentException("Institute not found");
        us.setInstitute(inst);
        userStudentRepository.save(us);
    }
}
