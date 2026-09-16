-- The school group is spelled "Dalimss" (see its email domain dalimss.com and the
-- names captured from the website/Firebase). Several institute and assessment
-- names were typed as "Dalimms"/"Dalims", which shows up in the admin institute
-- list, assessment dropdowns, emails, Excel exports and report data.
--
-- Fix every stored occurrence, preserving case. Word boundaries keep the single-s
-- "Dalims" rule from touching an already-correct "Dalimss". Idempotent: re-running
-- finds nothing to change.

-- assessment_table
UPDATE assessment_table
SET assessment_name = REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        REPLACE(REPLACE(REPLACE(assessment_name, 'Dalimms', 'Dalimss'), 'DALIMMS', 'DALIMSS'), 'dalimms', 'dalimss'),
        '\bDalims\b', 'Dalimss', 1, 0, 'c'),
        '\bDALIMS\b', 'DALIMSS', 1, 0, 'c'),
        '\bdalims\b', 'dalimss', 1, 0, 'c')
WHERE assessment_name LIKE '%dalim%';

-- institute_detail_new
UPDATE institute_detail_new
SET institute_name = REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        REPLACE(REPLACE(REPLACE(institute_name, 'Dalimms', 'Dalimss'), 'DALIMMS', 'DALIMSS'), 'dalimms', 'dalimss'),
        '\bDalims\b', 'Dalimss', 1, 0, 'c'),
        '\bDALIMS\b', 'DALIMSS', 1, 0, 'c'),
        '\bdalims\b', 'dalimss', 1, 0, 'c')
WHERE institute_name LIKE '%dalim%';

-- institute_details (legacy)
UPDATE institute_details
SET institute_name = REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        REPLACE(REPLACE(REPLACE(institute_name, 'Dalimms', 'Dalimss'), 'DALIMMS', 'DALIMSS'), 'dalimms', 'dalimss'),
        '\bDalims\b', 'Dalimss', 1, 0, 'c'),
        '\bDALIMS\b', 'DALIMSS', 1, 0, 'c'),
        '\bdalims\b', 'dalimss', 1, 0, 'c')
WHERE institute_name LIKE '%dalim%';

-- navigator_report_data (school name printed on Navigator reports)
UPDATE navigator_report_data
SET student_school = REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        REPLACE(REPLACE(REPLACE(student_school, 'Dalimms', 'Dalimss'), 'DALIMMS', 'DALIMSS'), 'dalimms', 'dalimss'),
        '\bDalims\b', 'Dalimss', 1, 0, 'c'),
        '\bDALIMS\b', 'DALIMSS', 1, 0, 'c'),
        '\bdalims\b', 'dalimss', 1, 0, 'c')
WHERE student_school LIKE '%dalim%';

-- firebase_data_mapping (target institute name used by the Firebase import)
UPDATE firebase_data_mapping
SET new_entity_name = REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        REPLACE(REPLACE(REPLACE(new_entity_name, 'Dalimms', 'Dalimss'), 'DALIMMS', 'DALIMSS'), 'dalimms', 'dalimss'),
        '\bDalims\b', 'Dalimss', 1, 0, 'c'),
        '\bDALIMS\b', 'DALIMSS', 1, 0, 'c'),
        '\bdalims\b', 'dalimss', 1, 0, 'c')
WHERE new_entity_name LIKE '%dalim%';

-- student_info.school_name (free-text school entered by students)
UPDATE student_info
SET school_name = REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        REPLACE(REPLACE(REPLACE(school_name, 'Dalimms', 'Dalimss'), 'DALIMMS', 'DALIMSS'), 'dalimms', 'dalimss'),
        '\bDalims\b', 'Dalimss', 1, 0, 'c'),
        '\bDALIMS\b', 'DALIMSS', 1, 0, 'c'),
        '\bdalims\b', 'dalimss', 1, 0, 'c')
WHERE school_name LIKE '%dalim%';

-- leads.school_name (website lead capture)
UPDATE leads
SET school_name = REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        REPLACE(REPLACE(REPLACE(school_name, 'Dalimms', 'Dalimss'), 'DALIMMS', 'DALIMSS'), 'dalimms', 'dalimss'),
        '\bDalims\b', 'Dalimss', 1, 0, 'c'),
        '\bDALIMS\b', 'DALIMSS', 1, 0, 'c'),
        '\bdalims\b', 'dalimss', 1, 0, 'c')
WHERE school_name LIKE '%dalim%';

-- student_demographic_response (free-text answers mentioning the school)
UPDATE student_demographic_response
SET response_value = REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        REPLACE(REPLACE(REPLACE(response_value, 'Dalimms', 'Dalimss'), 'DALIMMS', 'DALIMSS'), 'dalimms', 'dalimss'),
        '\bDalims\b', 'Dalimss', 1, 0, 'c'),
        '\bDALIMS\b', 'DALIMSS', 1, 0, 'c'),
        '\bdalims\b', 'dalimss', 1, 0, 'c')
WHERE response_value LIKE '%dalim%';

-- email_send_log.subject (historical log, shown in admin email views)
UPDATE email_send_log
SET subject = REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
        REPLACE(REPLACE(REPLACE(subject, 'Dalimms', 'Dalimss'), 'DALIMMS', 'DALIMSS'), 'dalimms', 'dalimss'),
        '\bDalims\b', 'Dalimss', 1, 0, 'c'),
        '\bDALIMS\b', 'DALIMSS', 1, 0, 'c'),
        '\bdalims\b', 'dalimss', 1, 0, 'c')
WHERE subject LIKE '%dalim%';

-- dashboard_snapshot: a 24h cache of the admin dashboard built from the tables
-- above (DashboardSnapshotService). The payloads are 35-95 MB each, so instead
-- of rewriting them, push computed_at past the TTL (the column is NOT NULL);
-- the next dashboard request recomputes from the corrected names.
UPDATE dashboard_snapshot
SET computed_at = '2000-01-01 00:00:00'
WHERE payload_json LIKE '%dalimms%' OR payload_json LIKE '%dalims %';
