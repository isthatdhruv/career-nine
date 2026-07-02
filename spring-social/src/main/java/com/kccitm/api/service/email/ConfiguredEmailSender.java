package com.kccitm.api.service.email;

import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;

/**
 * A ready-to-use sender bound to one {@link com.kccitm.api.model.email.EmailAccount}.
 * Built by {@link SenderFactory}. {@link #send} is <b>synchronous and throws</b> on
 * failure — the dispatcher decides whether the call runs on the caller's thread (SYNC)
 * or the async executor (ASYNC).
 */
public interface ConfiguredEmailSender {

    void send(SmtpEmailRequest request) throws Exception;
}
