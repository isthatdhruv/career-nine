package com.kccitm.api.service.career9;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.InstituteAssessment;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.Career9.InstituteAssessmentRepository;
import com.kccitm.api.repository.InstituteDetailRepository;

/**
 * Owns the Institute&lt;-&gt;Assessment catalog (B2B redesign, Layer 1).
 *
 * Two entry points:
 *   {@link #ensure} — idempotent upsert wired into createMapping; never blocks on
 *                     the cap (a registration link must not be refused by a catalog
 *                     limit — the cap is a UI affordance enforced at {@link #enable}).
 *   {@link #enable} — cap-enforced catalog editing from the wizard / mapping page.
 */
@Service
public class InstituteAssessmentService {

    @Autowired private InstituteAssessmentRepository repository;
    @Autowired private InstituteDetailRepository instituteDetailRepository;

    /**
     * Ensure (institute, assessment) is in the catalog and active. Reactivates a
     * soft-disabled row. Idempotent — safe to call on every mapping create.
     */
    @Transactional
    public InstituteAssessment ensure(Integer instituteCode, Long assessmentId) {
        if (instituteCode == null || assessmentId == null) return null;
        Optional<InstituteAssessment> existing =
                repository.findByInstituteCodeAndAssessmentId(instituteCode, assessmentId);
        if (existing.isPresent()) {
            InstituteAssessment ia = existing.get();
            if (!Boolean.TRUE.equals(ia.getIsActive())) {
                ia.setIsActive(true);
                return repository.save(ia);
            }
            return ia;
        }
        return repository.save(new InstituteAssessment(instituteCode, assessmentId));
    }

    /**
     * Enable a set of assessments for an institute, honoring InstituteDetail.maxAssessments
     * (null/0 = unlimited). Throws IllegalStateException if the cap would be exceeded.
     * Returns the institute's full catalog after the change.
     */
    @Transactional
    public List<InstituteAssessment> enable(Integer instituteCode, List<Long> assessmentIds) {
        Integer cap = instituteDetailRepository.findById(instituteCode)
                .map(InstituteDetail::getMaxAssessments).orElse(null);
        long activeCount = repository.countByInstituteCodeAndIsActive(instituteCode, true);

        if (assessmentIds != null) {
            for (Long assessmentId : assessmentIds) {
                if (assessmentId == null) continue;
                Optional<InstituteAssessment> existing =
                        repository.findByInstituteCodeAndAssessmentId(instituteCode, assessmentId);
                if (existing.isPresent()) {
                    InstituteAssessment ia = existing.get();
                    if (!Boolean.TRUE.equals(ia.getIsActive())) {
                        enforceCap(cap, activeCount);
                        ia.setIsActive(true);
                        repository.save(ia);
                        activeCount++;
                    }
                } else {
                    enforceCap(cap, activeCount);
                    repository.save(new InstituteAssessment(instituteCode, assessmentId));
                    activeCount++;
                }
            }
        }
        return repository.findByInstituteCode(instituteCode);
    }

    private void enforceCap(Integer cap, long activeCount) {
        if (cap != null && cap > 0 && activeCount >= cap) {
            throw new IllegalStateException("Assessment limit reached for this institute (max " + cap + ")");
        }
    }

    @Transactional
    public InstituteAssessment setActive(Long id, boolean active) {
        Optional<InstituteAssessment> opt = repository.findById(id);
        if (!opt.isPresent()) return null;
        InstituteAssessment ia = opt.get();
        ia.setIsActive(active);
        return repository.save(ia);
    }

    /** Flip is_active. Returns null when the row doesn't exist. */
    @Transactional
    public InstituteAssessment toggle(Long id) {
        Optional<InstituteAssessment> opt = repository.findById(id);
        if (!opt.isPresent()) return null;
        InstituteAssessment ia = opt.get();
        ia.setIsActive(!Boolean.TRUE.equals(ia.getIsActive()));
        return repository.save(ia);
    }

    @Transactional
    public boolean delete(Long id) {
        if (!repository.existsById(id)) return false;
        repository.deleteById(id);
        return true;
    }

    public List<InstituteAssessment> listByInstitute(Integer instituteCode) {
        return repository.findByInstituteCode(instituteCode);
    }
}
