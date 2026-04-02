package com.kccitm.api.service.counselling;

import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;

@Service
public class CounsellorService {

    private static final Logger logger = LoggerFactory.getLogger(CounsellorService.class);

    @Autowired
    private CounsellorRepository counsellorRepository;

    public Counsellor create(Counsellor counsellor) {
        return counsellorRepository.save(counsellor);
    }

    public List<Counsellor> getAllActive() {
        return counsellorRepository.findByIsActiveTrueAndOnboardingStatus("ACTIVE");
    }

    public List<Counsellor> getAll() {
        return counsellorRepository.findAll();
    }

    public Optional<Counsellor> getById(Long id) {
        return counsellorRepository.findById(id);
    }

    public Optional<Counsellor> getByUserId(Long userId) {
        return counsellorRepository.findByUserId(userId);
    }

    public Counsellor update(Long id, Counsellor updated) {
        Counsellor existing = counsellorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Counsellor not found with id: " + id));

        if (updated.getName() != null) {
            existing.setName(updated.getName());
        }
        if (updated.getEmail() != null) {
            existing.setEmail(updated.getEmail());
        }
        if (updated.getPhone() != null) {
            existing.setPhone(updated.getPhone());
        }
        if (updated.getSpecializations() != null) {
            existing.setSpecializations(updated.getSpecializations());
        }
        if (updated.getBio() != null) {
            existing.setBio(updated.getBio());
        }
        if (updated.getProfileImageUrl() != null) {
            existing.setProfileImageUrl(updated.getProfileImageUrl());
        }

        logger.debug("Updating counsellor with id: {}", id);
        return counsellorRepository.save(existing);
    }

    public Counsellor toggleActive(Long id) {
        Counsellor counsellor = counsellorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Counsellor not found with id: " + id));

        counsellor.setIsActive(!counsellor.getIsActive());
        logger.debug("Toggled active status for counsellor id: {} to {}", id, counsellor.getIsActive());
        return counsellorRepository.save(counsellor);
    }
}
