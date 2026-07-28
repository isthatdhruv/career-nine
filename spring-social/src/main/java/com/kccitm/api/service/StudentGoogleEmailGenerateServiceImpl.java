package com.kccitm.api.service;

import org.springframework.stereotype.Service;

import com.kccitm.api.model.userDefinedModel.EmailMessage;

/**
 * Legacy KCCITM Google-account reset mail. Retired together with the third-party provider —
 * kept as a no-op so the interface contract and any callers still compile.
 */
@Service
public class StudentGoogleEmailGenerateServiceImpl implements StudentGoogleEmailGenerateService {

    @Override
    public void resetPasswordMail(EmailMessage emailMessage) {
        // Legacy KCCITM provider email path retired — no-op.
    }
}
