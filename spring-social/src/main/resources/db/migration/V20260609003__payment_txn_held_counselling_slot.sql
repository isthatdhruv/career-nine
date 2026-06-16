-- ---------------------------------------------------------------------------
-- V20260609003__payment_txn_held_counselling_slot.sql
--
-- PAY_LATER counselling support for the assessment-mapping flow.
--
-- When a link is configured PAY_LATER, the student picks a counselling slot
-- BEFORE paying. We hold that slot and stash the student's chosen slot + contact
-- details on the PaymentTransaction so the Razorpay webhook can, on successful
-- payment, finalise the counselling appointment in one place (alongside the
-- existing B2B entitlement activation).
--
-- All columns are nullable — they are only populated for PAY_LATER counselling
-- transactions; every other payment leaves them null.
-- ---------------------------------------------------------------------------

ALTER TABLE payment_transaction
  ADD COLUMN counselling_slot_id        BIGINT       NULL,
  ADD COLUMN counselling_contact_name   VARCHAR(200) NULL,
  ADD COLUMN counselling_contact_phone  VARCHAR(20)  NULL,
  ADD COLUMN counselling_contact_email  VARCHAR(200) NULL,
  ADD COLUMN counselling_contact_method VARCHAR(20)  NULL;
