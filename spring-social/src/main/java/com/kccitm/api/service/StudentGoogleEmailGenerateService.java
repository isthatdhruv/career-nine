package com.kccitm.api.service;

import com.kccitm.api.model.userDefinedModel.EmailMessage;

public interface StudentGoogleEmailGenerateService {
    public void resetPasswordMail(EmailMessage emailMessage);

}
