-- ---------------------------------------------------------------------------
-- V20260609002__assessment_mapping_payment_timing.sql
--
-- Post-assessment monetization timing for assessment-mapping links.
--
-- Brings the campaign "purchase path" concept to the B2B assessment-mapping
-- flow. After a student finishes the assessment, they may need to pick a tier
-- (to unlock counselling). WHEN they pay is governed per-link by this column:
--
--   PAY_FIRST  -> student selects a tier, pays immediately (Razorpay), the
--                 entitlement is activated, and only then can they book a
--                 counselling session.
--   PAY_LATER  -> student selects a tier and may proceed to pick a counselling
--                 slot, but payment is required (and confirmed via webhook)
--                 BEFORE the appointment is finalised. The slot is held until
--                 payment completes.
--
-- Default PAY_FIRST preserves the existing behaviour (pay before you proceed)
-- for every already-created mapping.
-- ---------------------------------------------------------------------------

ALTER TABLE assessment_institute_mapping
  ADD COLUMN payment_timing VARCHAR(20) NOT NULL DEFAULT 'PAY_FIRST';
