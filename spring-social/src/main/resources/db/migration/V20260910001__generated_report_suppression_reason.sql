-- Navigator Pro gates (R1 attention, R3 weak peak, R4 no signal, R5 incomplete)
-- decline to generate a report. The row keeps report_status = 'suppressed' and
-- this column carries "<rule>: <reason>" so the Reports Hub can show why, and
-- the suppressed list doubles as the counselling queue until that is automated.
ALTER TABLE generated_report
  ADD COLUMN suppression_reason VARCHAR(500) NULL AFTER pdf_status;
