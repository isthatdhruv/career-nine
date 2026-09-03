package com.kccitm.api.model.mail;

/** IMMEDIATE sends inline when the event is published (OTP-class mail); QUEUED goes through the Redis queue. */
public enum MailAutomationDelivery {
    IMMEDIATE,
    QUEUED
}
