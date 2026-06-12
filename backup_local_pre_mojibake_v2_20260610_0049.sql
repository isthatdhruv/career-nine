-- MySQL dump 10.13  Distrib 8.4.8, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: career-9
-- ------------------------------------------------------
-- Server version	8.4.8

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `appointment_audit_log`
--

DROP TABLE IF EXISTS `appointment_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointment_audit_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `new_values` text COLLATE utf8mb4_unicode_ci,
  `old_values` text COLLATE utf8mb4_unicode_ci,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `timestamp` datetime NOT NULL,
  `appointment_id` bigint NOT NULL,
  `performed_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKrck6sqlog2mf4gilei5hq49t5` (`appointment_id`),
  KEY `FKre79tqrykpeujae5bbwo0tfic` (`performed_by`),
  CONSTRAINT `FKrck6sqlog2mf4gilei5hq49t5` FOREIGN KEY (`appointment_id`) REFERENCES `counselling_appointment` (`id`),
  CONSTRAINT `FKre79tqrykpeujae5bbwo0tfic` FOREIGN KEY (`performed_by`) REFERENCES `student_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointment_audit_log`
--

LOCK TABLES `appointment_audit_log` WRITE;
/*!40000 ALTER TABLE `appointment_audit_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `appointment_audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assessment_admin_action`
--

DROP TABLE IF EXISTS `assessment_admin_action`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_admin_action` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `action_at` datetime NOT NULL,
  `action_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `admin_user_id` bigint DEFAULT NULL,
  `after_state_json` longtext COLLATE utf8mb4_unicode_ci,
  `assessment_id` bigint NOT NULL,
  `before_state_json` longtext COLLATE utf8mb4_unicode_ci,
  `reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_student_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_aaa_mapping` (`user_student_id`,`assessment_id`),
  KEY `idx_aaa_action_at` (`action_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_admin_action`
--

LOCK TABLES `assessment_admin_action` WRITE;
/*!40000 ALTER TABLE `assessment_admin_action` DISABLE KEYS */;
/*!40000 ALTER TABLE `assessment_admin_action` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assessment_answer`
--

DROP TABLE IF EXISTS `assessment_answer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_answer` (
  `assessment_answer_id` bigint NOT NULL AUTO_INCREMENT,
  `rank_order` int DEFAULT NULL,
  `text_response` text COLLATE utf8mb4_unicode_ci,
  `assessment_id` bigint DEFAULT NULL,
  `mapped_option_id` bigint DEFAULT NULL,
  `option_id` bigint DEFAULT NULL,
  `questionnaire_question_id` bigint DEFAULT NULL,
  `user_student_id` bigint DEFAULT NULL,
  PRIMARY KEY (`assessment_answer_id`),
  KEY `idx_answer_student_assessment` (`user_student_id`,`assessment_id`),
  KEY `idx_answer_question` (`questionnaire_question_id`),
  KEY `FKf3tincra2l6hr1erfo30vcoul` (`assessment_id`),
  KEY `FKb92kn983djmqxcf52tgsghn5s` (`mapped_option_id`),
  KEY `FKl0bux7ik876h0advxlbke8ykb` (`option_id`),
  CONSTRAINT `FK9ok1rlormlq0elcoixrdxgvdj` FOREIGN KEY (`user_student_id`) REFERENCES `user_student` (`user_student_id`),
  CONSTRAINT `FKb92kn983djmqxcf52tgsghn5s` FOREIGN KEY (`mapped_option_id`) REFERENCES `assessment_question_options` (`option_id`),
  CONSTRAINT `FKf3tincra2l6hr1erfo30vcoul` FOREIGN KEY (`assessment_id`) REFERENCES `assessment_table` (`assessment_id`),
  CONSTRAINT `FKl0bux7ik876h0advxlbke8ykb` FOREIGN KEY (`option_id`) REFERENCES `assessment_question_options` (`option_id`),
  CONSTRAINT `FKp4akyesj80ok2j5akm6wep5lr` FOREIGN KEY (`questionnaire_question_id`) REFERENCES `questionnaire_question` (`questionnaire_question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_answer`
--

LOCK TABLES `assessment_answer` WRITE;
/*!40000 ALTER TABLE `assessment_answer` DISABLE KEYS */;
/*!40000 ALTER TABLE `assessment_answer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assessment_demographic_mapping`
--

DROP TABLE IF EXISTS `assessment_demographic_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_demographic_mapping` (
  `mapping_id` bigint NOT NULL AUTO_INCREMENT,
  `assessment_id` bigint NOT NULL,
  `custom_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display_order` int DEFAULT '0',
  `is_mandatory` tinyint(1) DEFAULT '1',
  `field_id` bigint NOT NULL,
  PRIMARY KEY (`mapping_id`),
  UNIQUE KEY `UKi60dfwyledw1su9u5qgsruusr` (`assessment_id`,`field_id`),
  KEY `FKbdvyruc6k9vhh9uq7n7bf7mcs` (`field_id`),
  CONSTRAINT `FKbdvyruc6k9vhh9uq7n7bf7mcs` FOREIGN KEY (`field_id`) REFERENCES `demographic_field_definition` (`field_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_demographic_mapping`
--

LOCK TABLES `assessment_demographic_mapping` WRITE;
/*!40000 ALTER TABLE `assessment_demographic_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `assessment_demographic_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assessment_institute_mapping`
--

DROP TABLE IF EXISTS `assessment_institute_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_institute_mapping` (
  `mapping_id` bigint NOT NULL AUTO_INCREMENT,
  `assessment_id` bigint NOT NULL,
  `class_id` int DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `institute_code` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `mapping_level` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `section_id` int DEFAULT NULL,
  `session_id` int DEFAULT NULL,
  `token` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` bigint DEFAULT NULL,
  PRIMARY KEY (`mapping_id`),
  UNIQUE KEY `UK_i74wyte2gncawfgex0pjvbtbi` (`token`),
  UNIQUE KEY `UKpjjdl2dtsmk9r31a8qe6ddy4y` (`assessment_id`,`institute_code`,`session_id`,`class_id`,`section_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_institute_mapping`
--

LOCK TABLES `assessment_institute_mapping` WRITE;
/*!40000 ALTER TABLE `assessment_institute_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `assessment_institute_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assessment_mapping_tier`
--

DROP TABLE IF EXISTS `assessment_mapping_tier`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_mapping_tier` (
  `tier_id` bigint NOT NULL AUTO_INCREMENT,
  `amount` bigint DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `current_count` int NOT NULL DEFAULT '0',
  `description` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `mapping_id` bigint NOT NULL,
  `max_registrations` int DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`tier_id`),
  UNIQUE KEY `uk_mapping_tier_sort` (`mapping_id`,`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_mapping_tier`
--

LOCK TABLES `assessment_mapping_tier` WRITE;
/*!40000 ALTER TABLE `assessment_mapping_tier` DISABLE KEYS */;
/*!40000 ALTER TABLE `assessment_mapping_tier` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assessment_proctoring_question_log`
--

DROP TABLE IF EXISTS `assessment_proctoring_question_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_proctoring_question_log` (
  `proctoring_log_id` bigint NOT NULL AUTO_INCREMENT,
  `avg_faces_detected` double DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `eye_gaze_points_json` longtext COLLATE utf8mb4_unicode_ci,
  `gaze_points_json` longtext COLLATE utf8mb4_unicode_ci,
  `head_away_count` int DEFAULT NULL,
  `max_faces_detected` int DEFAULT NULL,
  `mouse_click_count` int DEFAULT NULL,
  `mouse_clicks_json` text COLLATE utf8mb4_unicode_ci,
  `options_rect_json` text COLLATE utf8mb4_unicode_ci,
  `question_end_time` bigint DEFAULT NULL,
  `question_rect_json` text COLLATE utf8mb4_unicode_ci,
  `question_start_time` bigint DEFAULT NULL,
  `screen_height` int DEFAULT NULL,
  `screen_width` int DEFAULT NULL,
  `tab_switch_count` int DEFAULT NULL,
  `time_spent_ms` bigint DEFAULT NULL,
  `assessment_id` bigint NOT NULL,
  `questionnaire_question_id` bigint NOT NULL,
  `user_student_id` bigint NOT NULL,
  PRIMARY KEY (`proctoring_log_id`),
  KEY `FKbmrja0347mtq6pnxcmkcsn2po` (`assessment_id`),
  KEY `FK6tjw67rmfvpa5kf6ck9wuc1a0` (`questionnaire_question_id`),
  KEY `FKixbxm1oxmsy30h1421c2vtd32` (`user_student_id`),
  CONSTRAINT `FK6tjw67rmfvpa5kf6ck9wuc1a0` FOREIGN KEY (`questionnaire_question_id`) REFERENCES `questionnaire_question` (`questionnaire_question_id`),
  CONSTRAINT `FKbmrja0347mtq6pnxcmkcsn2po` FOREIGN KEY (`assessment_id`) REFERENCES `assessment_table` (`assessment_id`),
  CONSTRAINT `FKixbxm1oxmsy30h1421c2vtd32` FOREIGN KEY (`user_student_id`) REFERENCES `user_student` (`user_student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_proctoring_question_log`
--

LOCK TABLES `assessment_proctoring_question_log` WRITE;
/*!40000 ALTER TABLE `assessment_proctoring_question_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `assessment_proctoring_question_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assessment_question_options`
--

DROP TABLE IF EXISTS `assessment_question_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_question_options` (
  `option_id` bigint NOT NULL AUTO_INCREMENT,
  `is_correct` bit(1) NOT NULL,
  `is_game` bit(1) NOT NULL,
  `option_description` longtext COLLATE utf8mb4_unicode_ci,
  `option_image` longblob,
  `option_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fk_game_table` bigint DEFAULT NULL,
  `fk_assessment_questions` bigint DEFAULT NULL,
  `option_image_url` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`option_id`),
  KEY `FKe1us4vrvyphvyytir040x6fu3` (`fk_game_table`),
  KEY `FKp8o3611escbo6rxqdeimj9s3f` (`fk_assessment_questions`),
  CONSTRAINT `FKe1us4vrvyphvyytir040x6fu3` FOREIGN KEY (`fk_game_table`) REFERENCES `game_table` (`game_id`),
  CONSTRAINT `FKp8o3611escbo6rxqdeimj9s3f` FOREIGN KEY (`fk_assessment_questions`) REFERENCES `assessment_questions` (`question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_question_options`
--

LOCK TABLES `assessment_question_options` WRITE;
/*!40000 ALTER TABLE `assessment_question_options` DISABLE KEYS */;
/*!40000 ALTER TABLE `assessment_question_options` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assessment_questions`
--

DROP TABLE IF EXISTS `assessment_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_questions` (
  `question_id` bigint NOT NULL AUTO_INCREMENT,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `is_mqt` tinyint(1) NOT NULL DEFAULT '0',
  `ismqttyped` tinyint(1) NOT NULL DEFAULT '0',
  `max_options_allowed` int DEFAULT NULL,
  `question_image_url` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `question_media_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `question_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `question_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `question_video_url` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section_id` bigint DEFAULT NULL,
  `options_count` int DEFAULT NULL,
  `options_rule` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`question_id`),
  KEY `idx_question_deleted` (`is_deleted`),
  KEY `idx_question_section` (`section_id`),
  CONSTRAINT `FKm74r414caiap3oe4rrsihspqv` FOREIGN KEY (`section_id`) REFERENCES `question_sections` (`section_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_questions`
--

LOCK TABLES `assessment_questions` WRITE;
/*!40000 ALTER TABLE `assessment_questions` DISABLE KEYS */;
/*!40000 ALTER TABLE `assessment_questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assessment_raw_score`
--

DROP TABLE IF EXISTS `assessment_raw_score`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_raw_score` (
  `assessment_raw_score_id` bigint NOT NULL AUTO_INCREMENT,
  `raw_score` int NOT NULL,
  `measured_quality_id` bigint DEFAULT NULL,
  `measured_quality_type_id` bigint DEFAULT NULL,
  `student_assessment_id` bigint DEFAULT NULL,
  PRIMARY KEY (`assessment_raw_score_id`),
  KEY `idx_raw_score_mapping` (`student_assessment_id`),
  KEY `idx_raw_score_mqt` (`measured_quality_type_id`),
  KEY `FKf0oux4wr8x6pwibm0k3ji12n6` (`measured_quality_id`),
  CONSTRAINT `FKf0oux4wr8x6pwibm0k3ji12n6` FOREIGN KEY (`measured_quality_id`) REFERENCES `measured_qualities` (`measured_quality_id`),
  CONSTRAINT `FKjcv60khypvwhtehvafwl9a7ar` FOREIGN KEY (`student_assessment_id`) REFERENCES `student_assessment_mapping` (`student_assessment_id`),
  CONSTRAINT `FKnidhy14nnr7hf3h9biqfxmatc` FOREIGN KEY (`measured_quality_type_id`) REFERENCES `measured_quality_types` (`measured_quality_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_raw_score`
--

LOCK TABLES `assessment_raw_score` WRITE;
/*!40000 ALTER TABLE `assessment_raw_score` DISABLE KEYS */;
/*!40000 ALTER TABLE `assessment_raw_score` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assessment_submission_failure`
--

DROP TABLE IF EXISTS `assessment_submission_failure`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_submission_failure` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `assessment_id` bigint NOT NULL,
  `attempt_count` int NOT NULL,
  `consecutive_non_transient_count` int NOT NULL,
  `first_failed_at` datetime NOT NULL,
  `last_attempt_at` datetime NOT NULL,
  `last_error_class` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_error_kind` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_error_message` longtext COLLATE utf8mb4_unicode_ci,
  `next_retry_at` datetime DEFAULT NULL,
  `resolved` bit(1) NOT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `user_student_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKn54emq0crh5b10goybuk7v1lj` (`user_student_id`,`assessment_id`),
  KEY `idx_asf_last_attempt` (`last_attempt_at`),
  KEY `idx_asf_first_failed` (`first_failed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_submission_failure`
--

LOCK TABLES `assessment_submission_failure` WRITE;
/*!40000 ALTER TABLE `assessment_submission_failure` DISABLE KEYS */;
/*!40000 ALTER TABLE `assessment_submission_failure` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assessment_table`
--

DROP TABLE IF EXISTS `assessment_table`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_table` (
  `assessment_id` bigint NOT NULL AUTO_INCREMENT,
  `assessment_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `end_date` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` bit(1) DEFAULT NULL,
  `is_deleted` tinyint(1) DEFAULT '0',
  `is_locked` tinyint(1) DEFAULT '0',
  `modeof_assessment` bit(1) DEFAULT NULL,
  `save_later` tinyint(1) DEFAULT '1',
  `show_timer` tinyint(1) DEFAULT '1',
  `star_date` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `questionnaire_id` bigint DEFAULT NULL,
  `collect_email_and_phone` tinyint(1) DEFAULT '1',
  `default_counselling_model` char(1) COLLATE utf8mb4_unicode_ci DEFAULT '1',
  `default_purchase_path` char(1) COLLATE utf8mb4_unicode_ci DEFAULT 'B',
  `max_resets_per_student` int DEFAULT NULL,
  `report_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`assessment_id`),
  KEY `FKyff8eqg1j28yf2cotq74u1gq` (`questionnaire_id`),
  CONSTRAINT `FKyff8eqg1j28yf2cotq74u1gq` FOREIGN KEY (`questionnaire_id`) REFERENCES `questionire` (`questionnaire_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_table`
--

LOCK TABLES `assessment_table` WRITE;
/*!40000 ALTER TABLE `assessment_table` DISABLE KEYS */;
/*!40000 ALTER TABLE `assessment_table` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_audit`
--

DROP TABLE IF EXISTS `auth_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_audit` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ts` datetime(3) NOT NULL,
  `user_id` bigint DEFAULT NULL,
  `permission` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scope` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resource_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `decision` enum('ALLOW','DENY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `request_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_aa_user_ts` (`user_id`,`ts`),
  KEY `idx_aa_deny` (`decision`,`ts`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_audit`
--

LOCK TABLES `auth_audit` WRITE;
/*!40000 ALTER TABLE `auth_audit` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_audit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `availability_template`
--

DROP TABLE IF EXISTS `availability_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `availability_template` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime DEFAULT NULL,
  `day_of_week` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `default_slot_duration` int NOT NULL,
  `end_time` time NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `start_time` time NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `counsellor_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK61agc3e8ekid5d3af6fusr25h` (`counsellor_id`),
  CONSTRAINT `FK61agc3e8ekid5d3af6fusr25h` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `availability_template`
--

LOCK TABLES `availability_template` WRITE;
/*!40000 ALTER TABLE `availability_template` DISABLE KEYS */;
/*!40000 ALTER TABLE `availability_template` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `batch`
--

DROP TABLE IF EXISTS `batch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `batch` (
  `id` int NOT NULL,
  `batch` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `batch`
--

LOCK TABLES `batch` WRITE;
/*!40000 ALTER TABLE `batch` DISABLE KEYS */;
/*!40000 ALTER TABLE `batch` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bet_report_data`
--

DROP TABLE IF EXISTS `bet_report_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bet_report_data` (
  `bet_report_data_id` bigint NOT NULL AUTO_INCREMENT,
  `assessment_id` bigint NOT NULL,
  `cog1` text COLLATE utf8mb4_unicode_ci,
  `cog2` text COLLATE utf8mb4_unicode_ci,
  `cog3` text COLLATE utf8mb4_unicode_ci,
  `cog3_description` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT NULL,
  `environment` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `report_status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `report_url` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `self_management_1` text COLLATE utf8mb4_unicode_ci,
  `self_management_2` text COLLATE utf8mb4_unicode_ci,
  `self_management_3` text COLLATE utf8mb4_unicode_ci,
  `social_insight` text COLLATE utf8mb4_unicode_ci,
  `student_grade` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value3` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value_overview` text COLLATE utf8mb4_unicode_ci,
  `user_student_id` bigint NOT NULL,
  PRIMARY KEY (`bet_report_data_id`),
  KEY `FKe5pg840a93x6ahaxyb36gcx46` (`user_student_id`),
  CONSTRAINT `FKe5pg840a93x6ahaxyb36gcx46` FOREIGN KEY (`user_student_id`) REFERENCES `user_student` (`user_student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bet_report_data`
--

LOCK TABLES `bet_report_data` WRITE;
/*!40000 ALTER TABLE `bet_report_data` DISABLE KEYS */;
/*!40000 ALTER TABLE `bet_report_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `block_date_request`
--

DROP TABLE IF EXISTS `block_date_request`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `block_date_request` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `admin_response` text COLLATE utf8mb4_unicode_ci,
  `block_date` date NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `updated_at` datetime DEFAULT NULL,
  `counsellor_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK3xi5h85ebcehbe0q5krt7993q` (`counsellor_id`),
  CONSTRAINT `FK3xi5h85ebcehbe0q5krt7993q` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `block_date_request`
--

LOCK TABLES `block_date_request` WRITE;
/*!40000 ALTER TABLE `block_date_request` DISABLE KEYS */;
/*!40000 ALTER TABLE `block_date_request` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `board_name`
--

DROP TABLE IF EXISTS `board_name`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `board_name` (
  `id` int NOT NULL AUTO_INCREMENT,
  `display` bit(1) DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `permanent` bit(1) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `board_name`
--

LOCK TABLES `board_name` WRITE;
/*!40000 ALTER TABLE `board_name` DISABLE KEYS */;
/*!40000 ALTER TABLE `board_name` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `branch`
--

DROP TABLE IF EXISTS `branch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `branch` (
  `id` int NOT NULL AUTO_INCREMENT,
  `display` bit(1) DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branch`
--

LOCK TABLES `branch` WRITE;
/*!40000 ALTER TABLE `branch` DISABLE KEYS */;
/*!40000 ALTER TABLE `branch` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `calculated_report_data`
--

DROP TABLE IF EXISTS `calculated_report_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `calculated_report_data` (
  `calculated_report_data_id` bigint NOT NULL AUTO_INCREMENT,
  `user_student_id` bigint NOT NULL,
  `assessment_id` bigint NOT NULL,
  `report_type_id` bigint NOT NULL,
  `report_subtype_id` bigint NOT NULL,
  `calculated_json` json NOT NULL,
  `engine_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `calculated_at` datetime NOT NULL,
  PRIMARY KEY (`calculated_report_data_id`),
  UNIQUE KEY `uk_calc_student_assessment_type_subtype` (`user_student_id`,`assessment_id`,`report_type_id`,`report_subtype_id`),
  KEY `fk_calc_report_type` (`report_type_id`),
  KEY `fk_calc_report_subtype` (`report_subtype_id`),
  KEY `idx_calc_assessment` (`assessment_id`),
  KEY `idx_calc_student` (`user_student_id`),
  CONSTRAINT `fk_calc_report_subtype` FOREIGN KEY (`report_subtype_id`) REFERENCES `report_subtype` (`report_subtype_id`),
  CONSTRAINT `fk_calc_report_type` FOREIGN KEY (`report_type_id`) REFERENCES `report_type` (`report_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `calculated_report_data`
--

LOCK TABLES `calculated_report_data` WRITE;
/*!40000 ALTER TABLE `calculated_report_data` DISABLE KEYS */;
/*!40000 ALTER TABLE `calculated_report_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `campaign_assessment_mapping`
--

DROP TABLE IF EXISTS `campaign_assessment_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaign_assessment_mapping` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `assessment_id` bigint NOT NULL,
  `campaign_id` bigint NOT NULL,
  `counselling_model` varchar(1) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) DEFAULT '0',
  `purchase_path` varchar(1) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKi8w107dfbsiy1wvr5sfg66v6j` (`campaign_id`,`assessment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campaign_assessment_mapping`
--

LOCK TABLES `campaign_assessment_mapping` WRITE;
/*!40000 ALTER TABLE `campaign_assessment_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `campaign_assessment_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `campaign_assessment_tiers`
--

DROP TABLE IF EXISTS `campaign_assessment_tiers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaign_assessment_tiers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `campaign_assessment_mapping_id` bigint NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `is_default` tinyint(1) DEFAULT '0',
  `price_override_inr` bigint DEFAULT NULL,
  `pricing_tier_id` bigint NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campaign_assessment_tiers`
--

LOCK TABLES `campaign_assessment_tiers` WRITE;
/*!40000 ALTER TABLE `campaign_assessment_tiers` DISABLE KEYS */;
/*!40000 ALTER TABLE `campaign_assessment_tiers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `campaigns`
--

DROP TABLE IF EXISTS `campaigns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaigns` (
  `campaign_id` bigint NOT NULL AUTO_INCREMENT,
  `brand_logo_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `default_counselling_model` char(1) COLLATE utf8mb4_unicode_ci DEFAULT '1',
  `default_purchase_path` char(1) COLLATE utf8mb4_unicode_ci DEFAULT 'B',
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) DEFAULT '0',
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_audience` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `valid_from` date DEFAULT NULL,
  `valid_to` date DEFAULT NULL,
  `institute_code` int DEFAULT NULL,
  PRIMARY KEY (`campaign_id`),
  UNIQUE KEY `UK_g6ksjym2qdcby6fhnogyttus8` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campaigns`
--

LOCK TABLES `campaigns` WRITE;
/*!40000 ALTER TABLE `campaigns` DISABLE KEYS */;
/*!40000 ALTER TABLE `campaigns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `careers`
--

DROP TABLE IF EXISTS `careers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `careers` (
  `career_id` bigint NOT NULL AUTO_INCREMENT,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `personality_code1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `personality_code2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `personality_code3` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`career_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `careers`
--

LOCK TABLES `careers` WRITE;
/*!40000 ALTER TABLE `careers` DISABLE KEYS */;
/*!40000 ALTER TABLE `careers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `category`
--

DROP TABLE IF EXISTS `category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category` (
  `id` int NOT NULL AUTO_INCREMENT,
  `display` bit(1) DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `category`
--

LOCK TABLES `category` WRITE;
/*!40000 ALTER TABLE `category` DISABLE KEYS */;
/*!40000 ALTER TABLE `category` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coding_attempts`
--

DROP TABLE IF EXISTS `coding_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coding_attempts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `question_id` int DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKikssny4vsit1uj1ynaml64iur` (`question_id`),
  KEY `FKbxl86ov6ml1p25cnslpopmgf0` (`user_id`),
  CONSTRAINT `FKbxl86ov6ml1p25cnslpopmgf0` FOREIGN KEY (`user_id`) REFERENCES `student_user` (`id`),
  CONSTRAINT `FKikssny4vsit1uj1ynaml64iur` FOREIGN KEY (`question_id`) REFERENCES `coding_questions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coding_attempts`
--

LOCK TABLES `coding_attempts` WRITE;
/*!40000 ALTER TABLE `coding_attempts` DISABLE KEYS */;
/*!40000 ALTER TABLE `coding_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coding_language`
--

DROP TABLE IF EXISTS `coding_language`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coding_language` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `coding_question_id` int DEFAULT NULL,
  `language_id` int DEFAULT NULL,
  `language_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coding_language`
--

LOCK TABLES `coding_language` WRITE;
/*!40000 ALTER TABLE `coding_language` DISABLE KEYS */;
/*!40000 ALTER TABLE `coding_language` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coding_platform_problem`
--

DROP TABLE IF EXISTS `coding_platform_problem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coding_platform_problem` (
  `problem_id` int NOT NULL AUTO_INCREMENT,
  `coding_problem` text COLLATE utf8mb4_unicode_ci,
  `problem_heading` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `problem_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`problem_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coding_platform_problem`
--

LOCK TABLES `coding_platform_problem` WRITE;
/*!40000 ALTER TABLE `coding_platform_problem` DISABLE KEYS */;
/*!40000 ALTER TABLE `coding_platform_problem` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coding_problem_diffculty_coding_problem_mapping`
--

DROP TABLE IF EXISTS `coding_problem_diffculty_coding_problem_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coding_problem_diffculty_coding_problem_mapping` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coding_plateform_problem_problem_id` int DEFAULT NULL,
  `difficulty_level_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK9tw0vlfg3qc9ltwc9xnyjgxdc` (`coding_plateform_problem_problem_id`),
  KEY `FKpketgtu0nkkqf2ha7h9smm3vm` (`difficulty_level_id`),
  CONSTRAINT `FK9tw0vlfg3qc9ltwc9xnyjgxdc` FOREIGN KEY (`coding_plateform_problem_problem_id`) REFERENCES `coding_platform_problem` (`problem_id`),
  CONSTRAINT `FKpketgtu0nkkqf2ha7h9smm3vm` FOREIGN KEY (`difficulty_level_id`) REFERENCES `coding_problem_difficulty` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coding_problem_diffculty_coding_problem_mapping`
--

LOCK TABLES `coding_problem_diffculty_coding_problem_mapping` WRITE;
/*!40000 ALTER TABLE `coding_problem_diffculty_coding_problem_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `coding_problem_diffculty_coding_problem_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coding_problem_difficulty`
--

DROP TABLE IF EXISTS `coding_problem_difficulty`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coding_problem_difficulty` (
  `id` int NOT NULL AUTO_INCREMENT,
  `difficulty_level` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coding_problem_difficulty`
--

LOCK TABLES `coding_problem_difficulty` WRITE;
/*!40000 ALTER TABLE `coding_problem_difficulty` DISABLE KEYS */;
/*!40000 ALTER TABLE `coding_problem_difficulty` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coding_questions`
--

DROP TABLE IF EXISTS `coding_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coding_questions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `acceptance_rate` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `accepted` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `coding_question` text COLLATE utf8mb4_unicode_ci,
  `likes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `question_heading` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `question_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `submissions` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `difficulty` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_bbeat6rac52wo906cjn6oonus` (`question_url`),
  KEY `FKoi2nuwq53d5msve9bc7fxpdvw` (`difficulty`),
  CONSTRAINT `FKoi2nuwq53d5msve9bc7fxpdvw` FOREIGN KEY (`difficulty`) REFERENCES `difficulty` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coding_questions`
--

LOCK TABLES `coding_questions` WRITE;
/*!40000 ALTER TABLE `coding_questions` DISABLE KEYS */;
/*!40000 ALTER TABLE `coding_questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `communication_log`
--

DROP TABLE IF EXISTS `communication_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `communication_log` (
  `log_id` bigint NOT NULL AUTO_INCREMENT,
  `channel` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `message_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient_phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sent_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `communication_log`
--

LOCK TABLES `communication_log` WRITE;
/*!40000 ALTER TABLE `communication_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `communication_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `compiler_question_logs`
--

DROP TABLE IF EXISTS `compiler_question_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compiler_question_logs` (
  `id` int NOT NULL,
  `expected_output` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `language_id` int DEFAULT NULL,
  `question_id` int DEFAULT NULL,
  `response` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_code` longtext COLLATE utf8mb4_unicode_ci,
  `stdin` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stdout` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` decimal(19,2) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `compiler_question_logs`
--

LOCK TABLES `compiler_question_logs` WRITE;
/*!40000 ALTER TABLE `compiler_question_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `compiler_question_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contact_person`
--

DROP TABLE IF EXISTS `contact_person`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_person` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `designation` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gender` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  `institute_code` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKdr8q2ue916bj0yd2yb7rh49f9` (`institute_code`),
  CONSTRAINT `FKdr8q2ue916bj0yd2yb7rh49f9` FOREIGN KEY (`institute_code`) REFERENCES `institute_detail_new` (`institute_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contact_person`
--

LOCK TABLES `contact_person` WRITE;
/*!40000 ALTER TABLE `contact_person` DISABLE KEYS */;
/*!40000 ALTER TABLE `contact_person` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contact_person_access_level`
--

DROP TABLE IF EXISTS `contact_person_access_level`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_person_access_level` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `class_id` int DEFAULT NULL,
  `contact_person_id` bigint NOT NULL,
  `section_id` int DEFAULT NULL,
  `session_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK532gfqheyqos9kba3kcn0gvm8` (`contact_person_id`,`session_id`,`class_id`,`section_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contact_person_access_level`
--

LOCK TABLES `contact_person_access_level` WRITE;
/*!40000 ALTER TABLE `contact_person_access_level` DISABLE KEYS */;
/*!40000 ALTER TABLE `contact_person_access_level` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `counselling_activity_log`
--

DROP TABLE IF EXISTS `counselling_activity_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `counselling_activity_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `activity_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_read` tinyint(1) DEFAULT '0',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `counsellor_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKcq78jobdff43g8v57lw6r9hhv` (`counsellor_id`),
  CONSTRAINT `FKcq78jobdff43g8v57lw6r9hhv` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `counselling_activity_log`
--

LOCK TABLES `counselling_activity_log` WRITE;
/*!40000 ALTER TABLE `counselling_activity_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `counselling_activity_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `counselling_appointment`
--

DROP TABLE IF EXISTS `counselling_appointment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `counselling_appointment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime DEFAULT NULL,
  `meeting_link` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meeting_link_source` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'AUTO',
  `reminder_1h_sent` bit(1) DEFAULT NULL,
  `reminder_24h_sent` bit(1) DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `student_reason` text COLLATE utf8mb4_unicode_ci,
  `updated_at` datetime DEFAULT NULL,
  `assigned_by` bigint DEFAULT NULL,
  `counsellor_id` bigint DEFAULT NULL,
  `slot_id` bigint NOT NULL,
  `student_id` bigint NOT NULL,
  `rescheduled_from_appointment_id` bigint DEFAULT NULL,
  `student_reschedule_count` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `FKisx1ikqk01wun63csm9utwcll` (`assigned_by`),
  KEY `FKbl2qbsa8sg1y825p96baqfrpy` (`counsellor_id`),
  KEY `FK8g5lkeeq3wrbhosx1vww9wccb` (`slot_id`),
  KEY `FKfv7grbwge0ul0vt6t1ie5rb96` (`student_id`),
  CONSTRAINT `FK8g5lkeeq3wrbhosx1vww9wccb` FOREIGN KEY (`slot_id`) REFERENCES `counselling_slot` (`id`),
  CONSTRAINT `FKbl2qbsa8sg1y825p96baqfrpy` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors` (`id`),
  CONSTRAINT `FKfv7grbwge0ul0vt6t1ie5rb96` FOREIGN KEY (`student_id`) REFERENCES `user_student` (`user_student_id`),
  CONSTRAINT `FKisx1ikqk01wun63csm9utwcll` FOREIGN KEY (`assigned_by`) REFERENCES `student_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `counselling_appointment`
--

LOCK TABLES `counselling_appointment` WRITE;
/*!40000 ALTER TABLE `counselling_appointment` DISABLE KEYS */;
/*!40000 ALTER TABLE `counselling_appointment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `counselling_notification`
--

DROP TABLE IF EXISTS `counselling_notification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `counselling_notification` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `message` text COLLATE utf8mb4_unicode_ci,
  `reference_id` bigint DEFAULT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK7suycciwocutfkdihj4cs98q2` (`user_id`),
  CONSTRAINT `FK7suycciwocutfkdihj4cs98q2` FOREIGN KEY (`user_id`) REFERENCES `student_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `counselling_notification`
--

LOCK TABLES `counselling_notification` WRITE;
/*!40000 ALTER TABLE `counselling_notification` DISABLE KEYS */;
/*!40000 ALTER TABLE `counselling_notification` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `counselling_payment`
--

DROP TABLE IF EXISTS `counselling_payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `counselling_payment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `amount` bigint NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'INR',
  `failure_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `payment_link_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `razorpay_link_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `razorpay_order_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `razorpay_payment_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `refund_status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sessions_purchased` int DEFAULT '1',
  `sessions_used` int DEFAULT '0',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CREATED',
  `updated_at` datetime DEFAULT NULL,
  `student_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKjcehs07twfv0msme9w6jk3cd8` (`student_id`),
  CONSTRAINT `FKjcehs07twfv0msme9w6jk3cd8` FOREIGN KEY (`student_id`) REFERENCES `user_student` (`user_student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `counselling_payment`
--

LOCK TABLES `counselling_payment` WRITE;
/*!40000 ALTER TABLE `counselling_payment` DISABLE KEYS */;
/*!40000 ALTER TABLE `counselling_payment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `counselling_plan`
--

DROP TABLE IF EXISTS `counselling_plan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `counselling_plan` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `amount_paid` bigint DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `end_date` date NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `plan_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sessions_used` int DEFAULT '0',
  `start_date` date NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `total_sessions` int NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `institute_code` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK7jwgiu6hjoi3x36qovx5npbvr` (`institute_code`),
  CONSTRAINT `FK7jwgiu6hjoi3x36qovx5npbvr` FOREIGN KEY (`institute_code`) REFERENCES `institute_detail_new` (`institute_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `counselling_plan`
--

LOCK TABLES `counselling_plan` WRITE;
/*!40000 ALTER TABLE `counselling_plan` DISABLE KEYS */;
/*!40000 ALTER TABLE `counselling_plan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `counselling_rating`
--

DROP TABLE IF EXISTS `counselling_rating`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `counselling_rating` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime DEFAULT NULL,
  `rating` int NOT NULL,
  `review` text COLLATE utf8mb4_unicode_ci,
  `appointment_id` bigint NOT NULL,
  `counsellor_id` bigint NOT NULL,
  `student_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_3bd8vd5ud5c8ndc79rvb7lety` (`appointment_id`),
  KEY `FKks7drrtb4vdv9m4kiv1yjccxt` (`counsellor_id`),
  KEY `FKsfvb30ulvivj7b1ky4pne9d1c` (`student_id`),
  CONSTRAINT `FK1viv6je4f54qnpger7esgucxk` FOREIGN KEY (`appointment_id`) REFERENCES `counselling_appointment` (`id`),
  CONSTRAINT `FKks7drrtb4vdv9m4kiv1yjccxt` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors` (`id`),
  CONSTRAINT `FKsfvb30ulvivj7b1ky4pne9d1c` FOREIGN KEY (`student_id`) REFERENCES `user_student` (`user_student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `counselling_rating`
--

LOCK TABLES `counselling_rating` WRITE;
/*!40000 ALTER TABLE `counselling_rating` DISABLE KEYS */;
/*!40000 ALTER TABLE `counselling_rating` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `counselling_slot`
--

DROP TABLE IF EXISTS `counselling_slot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `counselling_slot` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `block_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `date` date NOT NULL,
  `duration_minutes` int NOT NULL,
  `end_time` time NOT NULL,
  `is_blocked` tinyint(1) DEFAULT '0',
  `is_manually_created` tinyint(1) DEFAULT '0',
  `start_time` time NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'AVAILABLE',
  `version` int DEFAULT NULL,
  `counsellor_id` bigint NOT NULL,
  `template_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK6ovacoamfklh3iopasrvrgmj8` (`counsellor_id`),
  KEY `FKrdnwl55i306rm58wof0rqdxew` (`template_id`),
  CONSTRAINT `FK6ovacoamfklh3iopasrvrgmj8` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors` (`id`),
  CONSTRAINT `FKrdnwl55i306rm58wof0rqdxew` FOREIGN KEY (`template_id`) REFERENCES `availability_template` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `counselling_slot`
--

LOCK TABLES `counselling_slot` WRITE;
/*!40000 ALTER TABLE `counselling_slot` DISABLE KEYS */;
/*!40000 ALTER TABLE `counselling_slot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `counsellor_institute_mapping`
--

DROP TABLE IF EXISTS `counsellor_institute_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `counsellor_institute_mapping` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `assigned_by` bigint DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `updated_at` datetime DEFAULT NULL,
  `counsellor_id` bigint NOT NULL,
  `institute_code` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKp834qoog9wte5fxw1ubgeuxnp` (`counsellor_id`,`institute_code`),
  KEY `FKbnkkd7ggwsuam65jq4x9p5rc2` (`institute_code`),
  CONSTRAINT `FKbnkkd7ggwsuam65jq4x9p5rc2` FOREIGN KEY (`institute_code`) REFERENCES `institute_detail_new` (`institute_code`),
  CONSTRAINT `FKj8hk3req8d6pwnffovfxkd9hw` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `counsellor_institute_mapping`
--

LOCK TABLES `counsellor_institute_mapping` WRITE;
/*!40000 ALTER TABLE `counsellor_institute_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `counsellor_institute_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `counsellors`
--

DROP TABLE IF EXISTS `counsellors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `counsellors` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `bio` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `is_external` tinyint(1) DEFAULT '0',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `onboarding_status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profile_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `specializations` text COLLATE utf8mb4_unicode_ci,
  `updated_at` datetime DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  `bank_account` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_branch` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_ifsc` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `certifications_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `counsellor_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'CAREER',
  `govt_id_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `govt_id_last4` varchar(4) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hourly_rate_preference` int DEFAULT NULL,
  `languages_spoken` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `linkedin_profile` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_sessions_per_day` int DEFAULT NULL,
  `mode_capability` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'BOTH',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qualifications` text COLLATE utf8mb4_unicode_ci,
  `signed_agreement_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `work_time` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'FULL_TIME',
  `years_of_experience` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKgdj3va5njefd621mhemyog6vc` (`user_id`),
  CONSTRAINT `FKgdj3va5njefd621mhemyog6vc` FOREIGN KEY (`user_id`) REFERENCES `student_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `counsellors`
--

LOCK TABLES `counsellors` WRITE;
/*!40000 ALTER TABLE `counsellors` DISABLE KEYS */;
/*!40000 ALTER TABLE `counsellors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `create_question`
--

DROP TABLE IF EXISTS `create_question`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `create_question` (
  `id` int NOT NULL AUTO_INCREMENT,
  `question` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `create_question`
--

LOCK TABLES `create_question` WRITE;
/*!40000 ALTER TABLE `create_question` DISABLE KEYS */;
/*!40000 ALTER TABLE `create_question` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dashboard_snapshot`
--

DROP TABLE IF EXISTS `dashboard_snapshot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dashboard_snapshot` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `computed_at` datetime NOT NULL,
  `payload_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `snapshot_key` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKac9j5825rytp34rwv6luf0frq` (`snapshot_key`),
  KEY `idx_dashboard_snapshot_key` (`snapshot_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dashboard_snapshot`
--

LOCK TABLES `dashboard_snapshot` WRITE;
/*!40000 ALTER TABLE `dashboard_snapshot` DISABLE KEYS */;
/*!40000 ALTER TABLE `dashboard_snapshot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `demographic_field_definition`
--

DROP TABLE IF EXISTS `demographic_field_definition`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `demographic_field_definition` (
  `field_id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime DEFAULT NULL,
  `data_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `default_value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display_label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `field_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `field_source` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `max_value` int DEFAULT NULL,
  `min_value` int DEFAULT NULL,
  `placeholder` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `system_field_key` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `validation_message` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `validation_regex` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`field_id`),
  UNIQUE KEY `UK_g66iat28aqkb4l9x0093qwh6f` (`field_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `demographic_field_definition`
--

LOCK TABLES `demographic_field_definition` WRITE;
/*!40000 ALTER TABLE `demographic_field_definition` DISABLE KEYS */;
/*!40000 ALTER TABLE `demographic_field_definition` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `demographic_field_option`
--

DROP TABLE IF EXISTS `demographic_field_option`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `demographic_field_option` (
  `option_id` bigint NOT NULL AUTO_INCREMENT,
  `display_order` int DEFAULT '0',
  `option_label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `option_value` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `field_id` bigint NOT NULL,
  PRIMARY KEY (`option_id`),
  KEY `FK8uj1elxqucxhfn5y5rtdxyxey` (`field_id`),
  CONSTRAINT `FK8uj1elxqucxhfn5y5rtdxyxey` FOREIGN KEY (`field_id`) REFERENCES `demographic_field_definition` (`field_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `demographic_field_option`
--

LOCK TABLES `demographic_field_option` WRITE;
/*!40000 ALTER TABLE `demographic_field_option` DISABLE KEYS */;
/*!40000 ALTER TABLE `demographic_field_option` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `difficulty`
--

DROP TABLE IF EXISTS `difficulty`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `difficulty` (
  `id` int NOT NULL AUTO_INCREMENT,
  `checked` tinyint(1) DEFAULT '0',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `difficulty`
--

LOCK TABLES `difficulty` WRITE;
/*!40000 ALTER TABLE `difficulty` DISABLE KEYS */;
/*!40000 ALTER TABLE `difficulty` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `faculty_metadata`
--

DROP TABLE IF EXISTS `faculty_metadata`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `faculty_metadata` (
  `college_identification_number` int NOT NULL AUTO_INCREMENT,
  `aadhar_card_no` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_no` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name_with_address` longtext COLLATE utf8mb4_unicode_ci,
  `category` int NOT NULL,
  `current_address` longtext COLLATE utf8mb4_unicode_ci,
  `department` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `designation` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display` tinyint NOT NULL,
  `dob` longtext COLLATE utf8mb4_unicode_ci,
  `educational_qualifications` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `father_husband_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gender` int DEFAULT NULL,
  `generate` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ifsc_code` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `middle_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `official_email_address` longtext COLLATE utf8mb4_unicode_ci,
  `pan_card_no` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `permanent_address` longtext COLLATE utf8mb4_unicode_ci,
  `personal_email_address` longtext COLLATE utf8mb4_unicode_ci,
  `phone_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `teaching_experience` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `webcam_photo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`college_identification_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `faculty_metadata`
--

LOCK TABLES `faculty_metadata` WRITE;
/*!40000 ALTER TABLE `faculty_metadata` DISABLE KEYS */;
/*!40000 ALTER TABLE `faculty_metadata` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `files_metadata`
--

DROP TABLE IF EXISTS `files_metadata`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `files_metadata` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `files_metadata`
--

LOCK TABLES `files_metadata` WRITE;
/*!40000 ALTER TABLE `files_metadata` DISABLE KEYS */;
/*!40000 ALTER TABLE `files_metadata` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `firebase_data_mapping`
--

DROP TABLE IF EXISTS `firebase_data_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `firebase_data_mapping` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `firebase_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `firebase_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `firebase_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mapped_at` datetime DEFAULT NULL,
  `new_entity_id` bigint DEFAULT NULL,
  `new_entity_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parent_mapping_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `firebase_data_mapping`
--

LOCK TABLES `firebase_data_mapping` WRITE;
/*!40000 ALTER TABLE `firebase_data_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `firebase_data_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `firebase_question_mapping`
--

DROP TABLE IF EXISTS `firebase_question_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `firebase_question_mapping` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `assessment_id` bigint NOT NULL,
  `category` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `firebase_answer` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `firebase_question` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `mapped_at` datetime DEFAULT NULL,
  `system_option_id` bigint DEFAULT NULL,
  `system_question_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `firebase_question_mapping`
--

LOCK TABLES `firebase_question_mapping` WRITE;
/*!40000 ALTER TABLE `firebase_question_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `firebase_question_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `firebase_student_extra_data`
--

DROP TABLE IF EXISTS `firebase_student_extra_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `firebase_student_extra_data` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `data_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `data_value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `firebase_doc_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_student_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `firebase_student_extra_data`
--

LOCK TABLES `firebase_student_extra_data` WRITE;
/*!40000 ALTER TABLE `firebase_student_extra_data` DISABLE KEYS */;
/*!40000 ALTER TABLE `firebase_student_extra_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `flyway_schema_history`
--

DROP TABLE IF EXISTS `flyway_schema_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `flyway_schema_history` (
  `installed_rank` int NOT NULL,
  `version` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `script` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` int DEFAULT NULL,
  `installed_by` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `installed_on` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `execution_time` int NOT NULL,
  `success` tinyint(1) NOT NULL,
  PRIMARY KEY (`installed_rank`),
  KEY `flyway_schema_history_s_idx` (`success`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `flyway_schema_history`
--

LOCK TABLES `flyway_schema_history` WRITE;
/*!40000 ALTER TABLE `flyway_schema_history` DISABLE KEYS */;
INSERT INTO `flyway_schema_history` VALUES (1,'0','<< Flyway Baseline >>','BASELINE','<< Flyway Baseline >>',NULL,'root','2026-06-01 07:28:20',0,1),(2,'20260511001','create auth tables','SQL','V20260511001__create_auth_tables.sql',665731313,'root','2026-06-01 07:28:20',499,1),(3,'20260511002','seed permissions','SQL','V20260511002__seed_permissions.sql',-2029979425,'root','2026-06-01 07:28:21',27,1),(4,'20260511003','seed role permissions','SQL','V20260511003__seed_role_permissions.sql',1909821615,'root','2026-06-01 07:28:21',62,1),(5,'20260511004','student info abac columns','SQL','V20260511004__student_info_abac_columns.sql',-585937154,'root','2026-06-01 07:28:21',284,1),(6,'20260511005','student info backfill','SQL','V20260511005__student_info_backfill.sql',730161025,'root','2026-06-01 07:28:21',97,1),(7,'20260511006','supersede user scope undo seeds','SQL','V20260511006__supersede_user_scope_undo_seeds.sql',-444454232,'root','2026-06-01 07:28:21',152,1),(8,'20260511007','create user role scope','SQL','V20260511007__create_user_role_scope.sql',189364976,'root','2026-06-01 07:28:22',106,1),(9,'20260512001','seed phase15 permissions','SQL','V20260512001__seed_phase15_permissions.sql',-27622597,'root','2026-06-01 07:28:22',43,1),(10,'20260521001','seed phase0 permission catalog gaps','SQL','V20260521001__seed_phase0_permission_catalog_gaps.sql',1823162812,'root','2026-06-01 07:28:22',18,1),(11,'20260522001','seed student role group','SQL','V20260522001__seed_student_role_group.sql',-723788119,'root','2026-06-01 07:44:43',27,1),(12,'20260525001','reminder tables','SQL','V20260525001__reminder_tables.sql',1717913556,'root','2026-06-01 07:44:43',85,1),(13,'20260525002','reminder permissions','SQL','V20260525002__reminder_permissions.sql',-1187619488,'root','2026-06-01 07:44:43',12,1),(14,'20260526001','create report type subtype','SQL','V20260526001__create_report_type_subtype.sql',1807079830,'root','2026-06-01 07:44:43',52,1),(15,'20260526002','create intermediary scores','SQL','V20260526002__create_intermediary_scores.sql',1965503702,'root','2026-06-01 07:44:43',28,1),(16,'20260526003','create calculated report data','SQL','V20260526003__create_calculated_report_data.sql',629599607,'root','2026-06-01 07:44:44',31,1),(17,'20260526004','questionnaire report fks','SQL','V20260526004__questionnaire_report_fks.sql',-446591780,'root','2026-06-01 07:44:44',97,1),(18,'20260526005','generated report subtype','SQL','V20260526005__generated_report_subtype.sql',-1487461396,'root','2026-06-01 07:44:44',151,1),(19,'20260526006','seed report types and subtypes','SQL','V20260526006__seed_report_types_and_subtypes.sql',-138103192,'root','2026-06-01 07:44:44',8,1),(20,'20260526007','backfill generated report subtype','SQL','V20260526007__backfill_generated_report_subtype.sql',973165090,'root','2026-06-01 07:44:44',3,1),(21,'20260526008','seed report pipeline permissions','SQL','V20260526008__seed_report_pipeline_permissions.sql',420191467,'root','2026-06-01 07:44:44',9,1),(22,'20260526009','seed report type crud permissions','SQL','V20260526009__seed_report_type_crud_permissions.sql',1071381391,'root','2026-06-01 07:44:44',6,1),(23,'20260527001','create jwt token audit','SQL','V20260527001__create_jwt_token_audit.sql',1362404679,'root','2026-06-01 07:44:44',35,1),(24,'20260528001','password reset token table','SQL','V20260528001__password_reset_token_table.sql',-1256509356,'root','2026-06-01 07:44:44',33,1);
/*!40000 ALTER TABLE `flyway_schema_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `game_table`
--

DROP TABLE IF EXISTS `game_table`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `game_table` (
  `game_id` bigint NOT NULL AUTO_INCREMENT,
  `game_code` int NOT NULL,
  `game_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `game_table`
--

LOCK TABLES `game_table` WRITE;
/*!40000 ALTER TABLE `game_table` DISABLE KEYS */;
/*!40000 ALTER TABLE `game_table` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gender`
--

DROP TABLE IF EXISTS `gender`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gender` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gender`
--

LOCK TABLES `gender` WRITE;
/*!40000 ALTER TABLE `gender` DISABLE KEYS */;
/*!40000 ALTER TABLE `gender` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `general_assessment_result`
--

DROP TABLE IF EXISTS `general_assessment_result`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `general_assessment_result` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ability_scores` text COLLATE utf8mb4_unicode_ci,
  `ability_top1` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ability_top2` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ability_top3` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ability_top4` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ability_top5` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ai_summary` text COLLATE utf8mb4_unicode_ci,
  `assessment_id` bigint NOT NULL,
  `career_aspirations` text COLLATE utf8mb4_unicode_ci,
  `career_match_result` text COLLATE utf8mb4_unicode_ci,
  `class_group` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `eligibility_issues` text COLLATE utf8mb4_unicode_ci,
  `eligibility_status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `future_suggestions` text COLLATE utf8mb4_unicode_ci,
  `intelligence_profiles` text COLLATE utf8mb4_unicode_ci,
  `intelligence_scores` text COLLATE utf8mb4_unicode_ci,
  `intelligence_top1` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `intelligence_top2` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `intelligence_top3` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `learning_styles` text COLLATE utf8mb4_unicode_ci,
  `learning_style_summary` text COLLATE utf8mb4_unicode_ci,
  `personality_profiles` text COLLATE utf8mb4_unicode_ci,
  `personality_scores` text COLLATE utf8mb4_unicode_ci,
  `personality_top1` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `personality_top2` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `personality_top3` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `processed_at` datetime DEFAULT NULL,
  `student_class` int DEFAULT NULL,
  `student_values` text COLLATE utf8mb4_unicode_ci,
  `subjects_of_interest` text COLLATE utf8mb4_unicode_ci,
  `suitability_pathways` text COLLATE utf8mb4_unicode_ci,
  `user_student_id` bigint NOT NULL,
  `weak_ability` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `weak_ability_recommendations` text COLLATE utf8mb4_unicode_ci,
  `student_assessment_mapping_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKlyye6s4s4vbe8ngcmqol75wbw` (`student_assessment_mapping_id`),
  CONSTRAINT `FKlyye6s4s4vbe8ngcmqol75wbw` FOREIGN KEY (`student_assessment_mapping_id`) REFERENCES `student_assessment_mapping` (`student_assessment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `general_assessment_result`
--

LOCK TABLES `general_assessment_result` WRITE;
/*!40000 ALTER TABLE `general_assessment_result` DISABLE KEYS */;
/*!40000 ALTER TABLE `general_assessment_result` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `generated_report`
--

DROP TABLE IF EXISTS `generated_report`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `generated_report` (
  `generated_report_id` bigint NOT NULL AUTO_INCREMENT,
  `assessment_id` bigint NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `report_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `report_url` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type_of_report` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `visible_to_student` tinyint(1) NOT NULL DEFAULT '0',
  `user_student_id` bigint NOT NULL,
  `report_subtype_id` bigint DEFAULT NULL,
  PRIMARY KEY (`generated_report_id`),
  UNIQUE KEY `uk_student_assessment_type_subtype` (`user_student_id`,`assessment_id`,`type_of_report`,`report_subtype_id`),
  KEY `idx_gr_assessment` (`assessment_id`),
  KEY `idx_gr_student` (`user_student_id`),
  KEY `idx_gr_type` (`type_of_report`),
  KEY `fk_genrep_subtype` (`report_subtype_id`),
  CONSTRAINT `FK66ji83bcmkggqn19agpsv1i9i` FOREIGN KEY (`user_student_id`) REFERENCES `user_student` (`user_student_id`),
  CONSTRAINT `fk_genrep_subtype` FOREIGN KEY (`report_subtype_id`) REFERENCES `report_subtype` (`report_subtype_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `generated_report`
--

LOCK TABLES `generated_report` WRITE;
/*!40000 ALTER TABLE `generated_report` DISABLE KEYS */;
/*!40000 ALTER TABLE `generated_report` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `group_data`
--

DROP TABLE IF EXISTS `group_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `group_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `group_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_owner_id` tinyblob,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `group_data`
--

LOCK TABLES `group_data` WRITE;
/*!40000 ALTER TABLE `group_data` DISABLE KEYS */;
/*!40000 ALTER TABLE `group_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institue_academic`
--

DROP TABLE IF EXISTS `institue_academic`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institue_academic` (
  `academic_id` int NOT NULL,
  `academic_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `academic_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`academic_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institue_academic`
--

LOCK TABLES `institue_academic` WRITE;
/*!40000 ALTER TABLE `institue_academic` DISABLE KEYS */;
/*!40000 ALTER TABLE `institue_academic` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_batch`
--

DROP TABLE IF EXISTS `institute_batch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_batch` (
  `batch_id` int NOT NULL AUTO_INCREMENT,
  `batch_duration` int DEFAULT NULL,
  `batch_duration_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_end` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_start` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display` bit(1) DEFAULT NULL,
  PRIMARY KEY (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_batch`
--

LOCK TABLES `institute_batch` WRITE;
/*!40000 ALTER TABLE `institute_batch` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_batch` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_batch_google`
--

DROP TABLE IF EXISTS `institute_batch_google`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_batch_google` (
  `id` int NOT NULL,
  `batch_id` int DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unique_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display` tinyint DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_batch_google`
--

LOCK TABLES `institute_batch_google` WRITE;
/*!40000 ALTER TABLE `institute_batch_google` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_batch_google` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_batch_google_group`
--

DROP TABLE IF EXISTS `institute_batch_google_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_batch_google_group` (
  `id` int NOT NULL,
  `institute_batch_id` int DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_batch_google_group`
--

LOCK TABLES `institute_batch_google_group` WRITE;
/*!40000 ALTER TABLE `institute_batch_google_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_batch_google_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_board_mapping`
--

DROP TABLE IF EXISTS `institute_board_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_board_mapping` (
  `institute_code` int NOT NULL,
  `board_id` int NOT NULL,
  PRIMARY KEY (`institute_code`,`board_id`),
  KEY `FK95525cbl2nll1o0yyaduc8pf7` (`board_id`),
  CONSTRAINT `FK95525cbl2nll1o0yyaduc8pf7` FOREIGN KEY (`board_id`) REFERENCES `board_name` (`id`),
  CONSTRAINT `FKaliy9u6kucq6kulpun0opst3t` FOREIGN KEY (`institute_code`) REFERENCES `institute_detail_new` (`institute_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_board_mapping`
--

LOCK TABLES `institute_board_mapping` WRITE;
/*!40000 ALTER TABLE `institute_board_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_board_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_branch`
--

DROP TABLE IF EXISTS `institute_branch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_branch` (
  `branch_id` int NOT NULL AUTO_INCREMENT,
  `abbreviation` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `branch_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `course_id` int DEFAULT NULL,
  `display` bit(1) DEFAULT NULL,
  `shift` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_intake` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_branch`
--

LOCK TABLES `institute_branch` WRITE;
/*!40000 ALTER TABLE `institute_branch` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_branch` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_branch_batch_map`
--

DROP TABLE IF EXISTS `institute_branch_batch_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_branch_batch_map` (
  `map_id` int NOT NULL AUTO_INCREMENT,
  `batch_id` int NOT NULL,
  `branch_id` int NOT NULL,
  `display` bit(1) DEFAULT NULL,
  PRIMARY KEY (`map_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_branch_batch_map`
--

LOCK TABLES `institute_branch_batch_map` WRITE;
/*!40000 ALTER TABLE `institute_branch_batch_map` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_branch_batch_map` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_branch_google_group`
--

DROP TABLE IF EXISTS `institute_branch_google_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_branch_google_group` (
  `id` int NOT NULL,
  `institute_branch_id` int DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_branch_google_group`
--

LOCK TABLES `institute_branch_google_group` WRITE;
/*!40000 ALTER TABLE `institute_branch_google_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_branch_google_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_course_google_group`
--

DROP TABLE IF EXISTS `institute_course_google_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_course_google_group` (
  `id` int NOT NULL,
  `institute_course_id` int DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_course_google_group`
--

LOCK TABLES `institute_course_google_group` WRITE;
/*!40000 ALTER TABLE `institute_course_google_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_course_google_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_courses`
--

DROP TABLE IF EXISTS `institute_courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_courses` (
  `course_code` int NOT NULL AUTO_INCREMENT,
  `abbreviation` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `course_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display` bit(1) DEFAULT NULL,
  `institute_id` int DEFAULT NULL,
  PRIMARY KEY (`course_code`),
  KEY `FKl8ocprbqtvdj13y16ol5yw5t3` (`institute_id`),
  CONSTRAINT `FKl8ocprbqtvdj13y16ol5yw5t3` FOREIGN KEY (`institute_id`) REFERENCES `institute_detail_new` (`institute_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_courses`
--

LOCK TABLES `institute_courses` WRITE;
/*!40000 ALTER TABLE `institute_courses` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_detail_new`
--

DROP TABLE IF EXISTS `institute_detail_new`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_detail_new` (
  `institute_code` int NOT NULL AUTO_INCREMENT,
  `city` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display` bit(1) DEFAULT NULL,
  `institute_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `institute_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_school` bit(1) DEFAULT NULL,
  `max_class` int DEFAULT NULL,
  `max_contact_persons` int DEFAULT NULL,
  `max_students` int DEFAULT NULL,
  `phone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `school_logo` longblob,
  `state` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_assessments` int DEFAULT NULL,
  `assessment_cookie_auth_enabled` bit(1) DEFAULT NULL,
  PRIMARY KEY (`institute_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_detail_new`
--

LOCK TABLES `institute_detail_new` WRITE;
/*!40000 ALTER TABLE `institute_detail_new` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_detail_new` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_google_group`
--

DROP TABLE IF EXISTS `institute_google_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_google_group` (
  `id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_google_group`
--

LOCK TABLES `institute_google_group` WRITE;
/*!40000 ALTER TABLE `institute_google_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_google_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_session`
--

DROP TABLE IF EXISTS `institute_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_session` (
  `session_id` int NOT NULL AUTO_INCREMENT,
  `batch_id` int DEFAULT NULL,
  `display` bit(1) DEFAULT NULL,
  `session_duration` int DEFAULT NULL,
  `session_duration_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `session_end_date` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `session_start_date` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_session`
--

LOCK TABLES `institute_session` WRITE;
/*!40000 ALTER TABLE `institute_session` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_session` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_session_google_group`
--

DROP TABLE IF EXISTS `institute_session_google_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_session_google_group` (
  `id` int NOT NULL,
  `institute_session_id` int DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_session_google_group`
--

LOCK TABLES `institute_session_google_group` WRITE;
/*!40000 ALTER TABLE `institute_session_google_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_session_google_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `intermediary_scores`
--

DROP TABLE IF EXISTS `intermediary_scores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `intermediary_scores` (
  `intermediary_scores_id` bigint NOT NULL AUTO_INCREMENT,
  `user_student_id` bigint NOT NULL,
  `assessment_id` bigint NOT NULL,
  `scores_json` json NOT NULL,
  `engine_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `calculated_at` datetime NOT NULL,
  PRIMARY KEY (`intermediary_scores_id`),
  UNIQUE KEY `uk_intermediary_student_assessment` (`user_student_id`,`assessment_id`),
  KEY `idx_intermediary_assessment` (`assessment_id`),
  KEY `idx_intermediary_student` (`user_student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `intermediary_scores`
--

LOCK TABLES `intermediary_scores` WRITE;
/*!40000 ALTER TABLE `intermediary_scores` DISABLE KEYS */;
/*!40000 ALTER TABLE `intermediary_scores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jwt_token_audit`
--

DROP TABLE IF EXISTS `jwt_token_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jwt_token_audit` (
  `jti` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint NOT NULL,
  `user_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token_type` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issued_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `not_before` datetime DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `revoked_by` bigint DEFAULT NULL,
  `revocation_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `roles_snapshot` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `super_admin` tinyint(1) NOT NULL DEFAULT '0',
  `issuer` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`jti`),
  KEY `idx_jta_user` (`user_id`),
  KEY `idx_jta_issued` (`issued_at`),
  KEY `idx_jta_expires` (`expires_at`),
  KEY `idx_jta_revoked` (`revoked_at`),
  KEY `idx_jta_token_type` (`token_type`),
  CONSTRAINT `fk_jta_user` FOREIGN KEY (`user_id`) REFERENCES `student_user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jwt_token_audit`
--

LOCK TABLES `jwt_token_audit` WRITE;
/*!40000 ALTER TABLE `jwt_token_audit` DISABLE KEYS */;
/*!40000 ALTER TABLE `jwt_token_audit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `language_option`
--

DROP TABLE IF EXISTS `language_option`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `language_option` (
  `language_option_id` bigint NOT NULL AUTO_INCREMENT,
  `languageoption_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assessment_option_id` bigint NOT NULL,
  `language_id` bigint NOT NULL,
  `language_question_id` bigint NOT NULL,
  `fk_language_option` bigint DEFAULT NULL,
  PRIMARY KEY (`language_option_id`),
  KEY `FKp6n3ih4hiypix6p4o3qltypcj` (`assessment_option_id`),
  KEY `FK2m8b2q90otju96kc28e38rjwy` (`language_id`),
  KEY `FKkt28ksq7y74alj3g9sbsah7kk` (`language_question_id`),
  KEY `FK9u6stptpxvkpf2hi222j0c2fk` (`fk_language_option`),
  CONSTRAINT `FK2m8b2q90otju96kc28e38rjwy` FOREIGN KEY (`language_id`) REFERENCES `language_table` (`language_id`),
  CONSTRAINT `FK9u6stptpxvkpf2hi222j0c2fk` FOREIGN KEY (`fk_language_option`) REFERENCES `language_table` (`language_id`),
  CONSTRAINT `FKkt28ksq7y74alj3g9sbsah7kk` FOREIGN KEY (`language_question_id`) REFERENCES `language_question` (`language_question_id`),
  CONSTRAINT `FKp6n3ih4hiypix6p4o3qltypcj` FOREIGN KEY (`assessment_option_id`) REFERENCES `assessment_question_options` (`option_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `language_option`
--

LOCK TABLES `language_option` WRITE;
/*!40000 ALTER TABLE `language_option` DISABLE KEYS */;
/*!40000 ALTER TABLE `language_option` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `language_question`
--

DROP TABLE IF EXISTS `language_question`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `language_question` (
  `language_question_id` bigint NOT NULL AUTO_INCREMENT,
  `question_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `original_question_id` bigint NOT NULL,
  `language_id` bigint NOT NULL,
  `fk_language_question` bigint DEFAULT NULL,
  PRIMARY KEY (`language_question_id`),
  KEY `FKapdim0sra49eqof9utjtdcs18` (`original_question_id`),
  KEY `FK4xyqlyovcomlcq44w08arhmme` (`language_id`),
  KEY `FKf0imxv3no22bwgxbyne1m5pgj` (`fk_language_question`),
  CONSTRAINT `FK4xyqlyovcomlcq44w08arhmme` FOREIGN KEY (`language_id`) REFERENCES `language_table` (`language_id`),
  CONSTRAINT `FKapdim0sra49eqof9utjtdcs18` FOREIGN KEY (`original_question_id`) REFERENCES `assessment_questions` (`question_id`),
  CONSTRAINT `FKf0imxv3no22bwgxbyne1m5pgj` FOREIGN KEY (`fk_language_question`) REFERENCES `language_table` (`language_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `language_question`
--

LOCK TABLES `language_question` WRITE;
/*!40000 ALTER TABLE `language_question` DISABLE KEYS */;
/*!40000 ALTER TABLE `language_question` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `language_table`
--

DROP TABLE IF EXISTS `language_table`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `language_table` (
  `language_id` bigint NOT NULL AUTO_INCREMENT,
  `language_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`language_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `language_table`
--

LOCK TABLES `language_table` WRITE;
/*!40000 ALTER TABLE `language_table` DISABLE KEYS */;
/*!40000 ALTER TABLE `language_table` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leads`
--

DROP TABLE IF EXISTS `leads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `cbse_affiliation_no` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `classes_offered` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `designation` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `extras` text COLLATE utf8mb4_unicode_ci,
  `full_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lead_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `odoo_lead_id` bigint DEFAULT NULL,
  `odoo_sync_error` text COLLATE utf8mb4_unicode_ci,
  `odoo_sync_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `school_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_students` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leads`
--

LOCK TABLES `leads` WRITE;
/*!40000 ALTER TABLE `leads` DISABLE KEYS */;
/*!40000 ALTER TABLE `leads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `list`
--

DROP TABLE IF EXISTS `list`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `list` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grade` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guardian_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `roll_no` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `list`
--

LOCK TABLES `list` WRITE;
/*!40000 ALTER TABLE `list` DISABLE KEYS */;
/*!40000 ALTER TABLE `list` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `major_sub_mapping`
--

DROP TABLE IF EXISTS `major_sub_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `major_sub_mapping` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `sub_topic_id` bigint DEFAULT NULL,
  `topic_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKpxp5hmb54mqvpr1rydwt4e0s` (`sub_topic_id`),
  KEY `FK6r225pixxhemsrhrx4k8mhoxv` (`topic_id`),
  CONSTRAINT `FK6r225pixxhemsrhrx4k8mhoxv` FOREIGN KEY (`topic_id`) REFERENCES `topic` (`id`),
  CONSTRAINT `FKpxp5hmb54mqvpr1rydwt4e0s` FOREIGN KEY (`sub_topic_id`) REFERENCES `sub_topics` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `major_sub_mapping`
--

LOCK TABLES `major_sub_mapping` WRITE;
/*!40000 ALTER TABLE `major_sub_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `major_sub_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `measured_qualities`
--

DROP TABLE IF EXISTS `measured_qualities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `measured_qualities` (
  `measured_quality_id` bigint NOT NULL AUTO_INCREMENT,
  `is_deleted` bit(1) DEFAULT NULL,
  `measured_quality_description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `measured_quality_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quality_display_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`measured_quality_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `measured_qualities`
--

LOCK TABLES `measured_qualities` WRITE;
/*!40000 ALTER TABLE `measured_qualities` DISABLE KEYS */;
/*!40000 ALTER TABLE `measured_qualities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `measured_quality_type_career_mapping`
--

DROP TABLE IF EXISTS `measured_quality_type_career_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `measured_quality_type_career_mapping` (
  `measured_quality_type_id` bigint NOT NULL,
  `career_id` bigint NOT NULL,
  PRIMARY KEY (`measured_quality_type_id`,`career_id`),
  KEY `FKrgmk1pputxg95hea72wj5eue1` (`career_id`),
  CONSTRAINT `FKkhyufs5g5eyk9em4ovtuc0wjd` FOREIGN KEY (`measured_quality_type_id`) REFERENCES `measured_quality_types` (`measured_quality_type_id`),
  CONSTRAINT `FKrgmk1pputxg95hea72wj5eue1` FOREIGN KEY (`career_id`) REFERENCES `careers` (`career_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `measured_quality_type_career_mapping`
--

LOCK TABLES `measured_quality_type_career_mapping` WRITE;
/*!40000 ALTER TABLE `measured_quality_type_career_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `measured_quality_type_career_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `measured_quality_types`
--

DROP TABLE IF EXISTS `measured_quality_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `measured_quality_types` (
  `measured_quality_type_id` bigint NOT NULL AUTO_INCREMENT,
  `is_deleted` bit(1) DEFAULT NULL,
  `measured_quality_type_description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `measured_quality_type_display_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `measured_quality_type_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fk_measured_qualities` bigint DEFAULT NULL,
  PRIMARY KEY (`measured_quality_type_id`),
  KEY `FK41x7h4949wosayebo0qyo92bm` (`fk_measured_qualities`),
  CONSTRAINT `FK41x7h4949wosayebo0qyo92bm` FOREIGN KEY (`fk_measured_qualities`) REFERENCES `measured_qualities` (`measured_quality_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `measured_quality_types`
--

LOCK TABLES `measured_quality_types` WRITE;
/*!40000 ALTER TABLE `measured_quality_types` DISABLE KEYS */;
/*!40000 ALTER TABLE `measured_quality_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `navigator_report_data`
--

DROP TABLE IF EXISTS `navigator_report_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `navigator_report_data` (
  `navigator_report_data_id` bigint NOT NULL AUTO_INCREMENT,
  `ability_1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ability_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ability_3` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ability_4` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assessment_id` bigint NOT NULL,
  `can_at_home` text COLLATE utf8mb4_unicode_ci,
  `can_at_school` text COLLATE utf8mb4_unicode_ci,
  `career_asp_1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `career_asp_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `career_asp_3` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `career_asp_4` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `career_match_result` text COLLATE utf8mb4_unicode_ci,
  `cp1_ability_has` text COLLATE utf8mb4_unicode_ci,
  `cp1_ability_lacks` text COLLATE utf8mb4_unicode_ci,
  `cp1_courses` text COLLATE utf8mb4_unicode_ci,
  `cp1_exams` text COLLATE utf8mb4_unicode_ci,
  `cp1_intelligence_has` text COLLATE utf8mb4_unicode_ci,
  `cp1_intelligence_lacks` text COLLATE utf8mb4_unicode_ci,
  `cp1_personality_has` text COLLATE utf8mb4_unicode_ci,
  `cp1_personality_lacks` text COLLATE utf8mb4_unicode_ci,
  `cp1_skills` text COLLATE utf8mb4_unicode_ci,
  `cp1_soi_has` text COLLATE utf8mb4_unicode_ci,
  `cp1_soi_lacks` text COLLATE utf8mb4_unicode_ci,
  `cp1_subjects` text COLLATE utf8mb4_unicode_ci,
  `cp1_values_has` text COLLATE utf8mb4_unicode_ci,
  `cp1_values_lacks` text COLLATE utf8mb4_unicode_ci,
  `cp2_ability_has` text COLLATE utf8mb4_unicode_ci,
  `cp2_ability_lacks` text COLLATE utf8mb4_unicode_ci,
  `cp2_courses` text COLLATE utf8mb4_unicode_ci,
  `cp2_exams` text COLLATE utf8mb4_unicode_ci,
  `cp2_intelligence_has` text COLLATE utf8mb4_unicode_ci,
  `cp2_intelligence_lacks` text COLLATE utf8mb4_unicode_ci,
  `cp2_personality_has` text COLLATE utf8mb4_unicode_ci,
  `cp2_personality_lacks` text COLLATE utf8mb4_unicode_ci,
  `cp2_skills` text COLLATE utf8mb4_unicode_ci,
  `cp2_soi_has` text COLLATE utf8mb4_unicode_ci,
  `cp2_soi_lacks` text COLLATE utf8mb4_unicode_ci,
  `cp2_subjects` text COLLATE utf8mb4_unicode_ci,
  `cp2_values_has` text COLLATE utf8mb4_unicode_ci,
  `cp2_values_lacks` text COLLATE utf8mb4_unicode_ci,
  `cp3_ability_has` text COLLATE utf8mb4_unicode_ci,
  `cp3_ability_lacks` text COLLATE utf8mb4_unicode_ci,
  `cp3_courses` text COLLATE utf8mb4_unicode_ci,
  `cp3_exams` text COLLATE utf8mb4_unicode_ci,
  `cp3_intelligence_has` text COLLATE utf8mb4_unicode_ci,
  `cp3_intelligence_lacks` text COLLATE utf8mb4_unicode_ci,
  `cp3_personality_has` text COLLATE utf8mb4_unicode_ci,
  `cp3_personality_lacks` text COLLATE utf8mb4_unicode_ci,
  `cp3_skills` text COLLATE utf8mb4_unicode_ci,
  `cp3_soi_has` text COLLATE utf8mb4_unicode_ci,
  `cp3_soi_lacks` text COLLATE utf8mb4_unicode_ci,
  `cp3_subjects` text COLLATE utf8mb4_unicode_ci,
  `cp3_values_has` text COLLATE utf8mb4_unicode_ci,
  `cp3_values_lacks` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT NULL,
  `data_significance` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `eligibility_issues` text COLLATE utf8mb4_unicode_ci,
  `eligible` bit(1) NOT NULL,
  `enjoys_with_1` text COLLATE utf8mb4_unicode_ci,
  `enjoys_with_2` text COLLATE utf8mb4_unicode_ci,
  `enjoys_with_3` text COLLATE utf8mb4_unicode_ci,
  `intelligence_1_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `intelligence_1_text` text COLLATE utf8mb4_unicode_ci,
  `intelligence_2_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `intelligence_2_text` text COLLATE utf8mb4_unicode_ci,
  `intelligence_3_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `intelligence_3_text` text COLLATE utf8mb4_unicode_ci,
  `intelligence_graph` text COLLATE utf8mb4_unicode_ci,
  `learning_style` text COLLATE utf8mb4_unicode_ci,
  `learning_style_1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `learning_style_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `learning_style_3` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `learning_style_summary` text COLLATE utf8mb4_unicode_ci,
  `pathway_1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pathway_1_text` text COLLATE utf8mb4_unicode_ci,
  `pathway_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pathway_2_text` text COLLATE utf8mb4_unicode_ci,
  `pathway_3` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pathway_3_text` text COLLATE utf8mb4_unicode_ci,
  `pathway_4` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pathway_5` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pathway_6` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pathway_7` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pathway_8` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pathway_9` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `personality_1_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `personality_1_text` text COLLATE utf8mb4_unicode_ci,
  `personality_2_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `personality_2_text` text COLLATE utf8mb4_unicode_ci,
  `personality_3_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `personality_3_text` text COLLATE utf8mb4_unicode_ci,
  `personality_graph` text COLLATE utf8mb4_unicode_ci,
  `recommendations` text COLLATE utf8mb4_unicode_ci,
  `report_status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `report_url` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `soi_1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `soi_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `soi_3` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `soi_4` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `soi_5` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `struggles_with_1` text COLLATE utf8mb4_unicode_ci,
  `struggles_with_2` text COLLATE utf8mb4_unicode_ci,
  `struggles_with_3` text COLLATE utf8mb4_unicode_ci,
  `student_class` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_first_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_name_caps` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_school` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `summary` text COLLATE utf8mb4_unicode_ci,
  `values_1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `values_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `values_3` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `values_4` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `weak_ability` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_student_id` bigint NOT NULL,
  PRIMARY KEY (`navigator_report_data_id`),
  KEY `FK1yy63s2n4jiyc3ueo1jke4hw4` (`user_student_id`),
  CONSTRAINT `FK1yy63s2n4jiyc3ueo1jke4hw4` FOREIGN KEY (`user_student_id`) REFERENCES `user_student` (`user_student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `navigator_report_data`
--

LOCK TABLES `navigator_report_data` WRITE;
/*!40000 ALTER TABLE `navigator_report_data` DISABLE KEYS */;
/*!40000 ALTER TABLE `navigator_report_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `omr_column_mapping`
--

DROP TABLE IF EXISTS `omr_column_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `omr_column_mapping` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `assessment_id` bigint NOT NULL,
  `created_at` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `institute_id` bigint NOT NULL,
  `mapping_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `mapping_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `questionnaire_id` bigint DEFAULT NULL,
  `updated_at` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK9thgw1jhfd1isamq31bkbfoem` (`assessment_id`,`institute_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `omr_column_mapping`
--

LOCK TABLES `omr_column_mapping` WRITE;
/*!40000 ALTER TABLE `omr_column_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `omr_column_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_token`
--

DROP TABLE IF EXISTS `password_reset_token`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_token` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `used_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_prt_token` (`token`),
  KEY `idx_prt_user` (`user_id`),
  KEY `idx_prt_expires` (`expires_at`),
  CONSTRAINT `fk_prt_user` FOREIGN KEY (`user_id`) REFERENCES `student_user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_token`
--

LOCK TABLES `password_reset_token` WRITE;
/*!40000 ALTER TABLE `password_reset_token` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_token` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_notification_log`
--

DROP TABLE IF EXISTS `payment_notification_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_notification_log` (
  `log_id` bigint NOT NULL AUTO_INCREMENT,
  `amount` bigint DEFAULT NULL,
  `channel` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `error_message` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_link_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sent_by` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'sent',
  `transaction_id` bigint NOT NULL,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_notification_log`
--

LOCK TABLES `payment_notification_log` WRITE;
/*!40000 ALTER TABLE `payment_notification_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_notification_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_transaction`
--

DROP TABLE IF EXISTS `payment_transaction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_transaction` (
  `transaction_id` bigint NOT NULL AUTO_INCREMENT,
  `amount` bigint NOT NULL,
  `assessment_id` bigint DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'INR',
  `failure_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `institute_code` int DEFAULT NULL,
  `mapping_id` bigint NOT NULL,
  `nudge_email_sent` tinyint(1) DEFAULT '0',
  `payment_link_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `razorpay_link_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `razorpay_order_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `razorpay_payment_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `short_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'created',
  `student_dob` date DEFAULT NULL,
  `student_email` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `user_student_id` bigint DEFAULT NULL,
  `welcome_email_sent` tinyint(1) DEFAULT '0',
  `campaign_assessment_tier_id` bigint DEFAULT NULL,
  `campaign_id` bigint DEFAULT NULL,
  `original_amount` bigint DEFAULT NULL,
  `promo_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `promo_discount_percent` int DEFAULT NULL,
  `purchase_path` varchar(1) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `school_config_id` bigint DEFAULT NULL,
  `mapping_tier_id` bigint DEFAULT NULL,
  PRIMARY KEY (`transaction_id`),
  UNIQUE KEY `UK_fjwke2bevnqvnhxpsvbsqpbce` (`razorpay_link_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_transaction`
--

LOCK TABLES `payment_transaction` WRITE;
/*!40000 ALTER TABLE `payment_transaction` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_transaction` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permission`
--

DROP TABLE IF EXISTS `permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permission` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_permission_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=529 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permission`
--

LOCK TABLES `permission` WRITE;
/*!40000 ALTER TABLE `permission` DISABLE KEYS */;
INSERT INTO `permission` VALUES (1,'institute.read','View institute details'),(2,'institute.write','Create or update institutes'),(3,'institute.delete','Delete institutes'),(4,'session.read','View academic sessions'),(5,'session.write','Create or update sessions'),(6,'class.read','View classes / courses'),(7,'class.write','Create or update classes / courses'),(8,'section.read','View sections'),(9,'section.write','Create or update sections'),(10,'student.read','View students'),(11,'student.write','Create or update students'),(12,'student.import_bulk','Bulk-import students from CSV/Excel'),(13,'assessment.read','View assessments'),(14,'assessment.create','Create assessments'),(15,'assessment.publish','Publish assessments to students'),(16,'assessment.delete','Delete assessments'),(17,'campaign.read','View marketing/payment campaigns'),(18,'campaign.write','Create or update campaigns'),(19,'campaign.publish','Publish/activate campaigns'),(20,'report.read','View generated reports'),(21,'report.export','Export reports (PDF/Excel)'),(22,'user.read','View user accounts'),(23,'user.write','Create or update user accounts'),(24,'user.toggle_active','Activate or deactivate users'),(25,'payment.refund','Issue payment refunds'),(26,'payment.webhook.handle','Handle Razorpay webhook (system role)'),(27,'role.assign','Assign roles to users'),(28,'permission.grant','Grant/revoke individual permissions'),(29,'assessment.read.all','View assessments across all scopes'),(30,'assessment.update','Update assessment definitions'),(31,'assessment.start','Start an assessment session'),(32,'assessment.submit','Submit an assessment session'),(33,'assessment.prefetch','Prefetch assessment payload for student app'),(34,'student.create','Create individual students'),(35,'student.update','Update individual students'),(36,'student.delete','Delete individual students'),(37,'student.read.all','View students across all scopes'),(38,'student.import','Import students (single-row CSV/Excel)'),(39,'student.export','Export student lists (CSV/Excel/PDF)'),(40,'user.me','View own user profile'),(41,'user.read.all','View user accounts across all scopes'),(42,'user.create','Create user accounts'),(43,'user.update','Update user accounts'),(44,'user.delete','Delete user accounts'),(45,'role.read','View roles'),(46,'role.read.all','View all roles across scopes'),(47,'role.create','Create roles'),(48,'role.update','Update roles'),(49,'role.delete','Delete roles'),(50,'role_group.read','View role groups'),(51,'role_group.read.all','View all role groups across scopes'),(52,'role_group.create','Create role groups'),(53,'role_group.update','Update role groups'),(54,'role_group.delete','Delete role groups'),(55,'role_role_group_mapping.read','View role-to-role-group mappings'),(56,'role_role_group_mapping.read.all','View all role-to-role-group mappings across scopes'),(57,'role_role_group_mapping.create','Create role-to-role-group mappings'),(58,'role_role_group_mapping.update','Update role-to-role-group mappings'),(59,'role_role_group_mapping.delete','Delete role-to-role-group mappings'),(60,'user_role_group_mapping.read','View user-to-role-group mappings'),(61,'user_role_group_mapping.read.all','View all user-to-role-group mappings across scopes'),(62,'user_role_group_mapping.create','Create user-to-role-group mappings'),(63,'user_role_group_mapping.update','Update user-to-role-group mappings'),(64,'user_role_group_mapping.delete','Delete user-to-role-group mappings'),(65,'group.read','View groups'),(66,'group.read.all','View all groups across scopes'),(67,'group.create','Create groups'),(68,'group.update','Update groups'),(69,'group.delete','Delete groups'),(70,'google_admin.read','View Google Workspace admin data'),(71,'google_admin.create','Create Google Workspace admin entities'),(72,'google_admin.update','Update Google Workspace admin entities'),(73,'google_admin.delete','Delete Google Workspace admin entities'),(74,'google_groups.read','View Google Workspace groups'),(75,'google_groups.create','Create Google Workspace groups'),(76,'google_groups.update','Update Google Workspace groups'),(77,'google_groups.delete','Delete Google Workspace groups'),(78,'data.read','View bulk data dumps'),(79,'list.read','View list endpoints'),(80,'util.read','View utility endpoint output'),(81,'util.execute','Execute utility operations'),(82,'institute_batch.read','View institute batches'),(83,'institute_batch.read.all','View all institute batches across scopes'),(84,'institute_batch.create','Create institute batches'),(85,'institute_batch.update','Update institute batches'),(86,'institute_batch.delete','Delete institute batches'),(87,'institute_branch.read','View institute branches'),(88,'institute_branch.read.all','View all institute branches across scopes'),(89,'institute_branch.create','Create institute branches'),(90,'institute_branch.update','Update institute branches'),(91,'institute_branch.delete','Delete institute branches'),(92,'institute_branch_batch_mapping.read','View institute branch-batch mappings'),(93,'institute_branch_batch_mapping.read.all','View all institute branch-batch mappings across scopes'),(94,'institute_branch_batch_mapping.create','Create institute branch-batch mappings'),(95,'institute_branch_batch_mapping.update','Update institute branch-batch mappings'),(96,'institute_branch_batch_mapping.delete','Delete institute branch-batch mappings'),(97,'institute_course.read','View institute courses'),(98,'institute_course.read.all','View all institute courses across scopes'),(99,'institute_course.create','Create institute courses'),(100,'institute_course.update','Update institute courses'),(101,'institute_course.delete','Delete institute courses'),(102,'institute_session.read','View institute sessions'),(103,'institute_session.read.all','View all institute sessions across scopes'),(104,'institute_session.create','Create institute sessions'),(105,'institute_session.update','Update institute sessions'),(106,'institute_session.delete','Delete institute sessions'),(107,'institute_detail.read','View institute detail records'),(108,'institute_detail.read.all','View all institute detail records across scopes'),(109,'institute_detail.create','Create institute detail records'),(110,'institute_detail.update','Update institute detail records'),(111,'institute_detail.delete','Delete institute detail records'),(112,'report_generation.read','View report-generation jobs'),(113,'report_generation.read.all','View all report-generation jobs across scopes'),(114,'report_generation.create','Create report-generation jobs'),(115,'report_generation.update','Update report-generation jobs'),(116,'report_generation.delete','Delete report-generation jobs'),(117,'school_session.read','View school sessions'),(118,'school_session.read.all','View all school sessions across scopes'),(119,'school_session.create','Create school sessions'),(120,'school_session.update','Update school sessions'),(121,'school_session.delete','Delete school sessions'),(122,'dashboard.admin','Access admin dashboard'),(123,'dashboard.admin.read','Read admin dashboard data'),(124,'dashboard.principal','Access principal dashboard'),(125,'dashboard.principal.read','Read principal dashboard data'),(126,'dashboard.teacher','Access teacher dashboard'),(127,'dashboard.teacher.read','Read teacher dashboard data'),(128,'payment.create','Create payments'),(129,'payment.verify','Verify payments'),(130,'payment.read','View payments'),(131,'payment.read.all','View all payments across scopes'),(132,'payment_webhook.read','View payment webhook records'),(133,'payment_webhook.list','List payment webhook records'),(134,'promo_code.read','View promo codes'),(135,'promo_code.read.all','View all promo codes across scopes'),(136,'promo_code.create','Create promo codes'),(137,'promo_code.update','Update promo codes'),(138,'promo_code.delete','Delete promo codes'),(139,'campaign.public','Access public-facing campaign endpoints'),(140,'campaign.create','Create campaigns'),(141,'campaign.update','Update campaigns'),(142,'campaign.delete','Delete campaigns'),(143,'campaign.read.all','View all campaigns across scopes'),(144,'entitlement.read','View entitlements'),(145,'entitlement.read.all','View all entitlements across scopes'),(146,'entitlement.create','Create entitlements'),(147,'entitlement.update','Update entitlements'),(148,'entitlement.delete','Delete entitlements'),(149,'pricing_tier.read','View pricing tiers'),(150,'pricing_tier.read.all','View all pricing tiers across scopes'),(151,'pricing_tier.create','Create pricing tiers'),(152,'pricing_tier.update','Update pricing tiers'),(153,'pricing_tier.delete','Delete pricing tiers'),(154,'report_preparation.read','View report-preparation records'),(155,'report_preparation.create','Create report-preparation records'),(156,'report_preparation.update','Update report-preparation records'),(157,'report_preparation.delete','Delete report-preparation records'),(158,'tracker.read','View trackers'),(159,'tracker.read.all','View all trackers across scopes'),(160,'tracker.create','Create trackers'),(161,'tracker.update','Update trackers'),(162,'tracker.delete','Delete trackers'),(163,'assessment_answer.read','View assessment answers'),(164,'assessment_answer.read.all','View all assessment answers across scopes'),(165,'assessment_answer.create','Create assessment answers'),(166,'assessment_answer.update','Update assessment answers'),(167,'assessment_answer.delete','Delete assessment answers'),(168,'assessment_answer.submit','Submit assessment answers'),(169,'assessment_demographic_mapping.read','View assessment-demographic mappings'),(170,'assessment_demographic_mapping.create','Create assessment-demographic mappings'),(171,'assessment_demographic_mapping.update','Update assessment-demographic mappings'),(172,'assessment_demographic_mapping.delete','Delete assessment-demographic mappings'),(173,'assessment_institute_mapping.read','View assessment-institute mappings'),(174,'assessment_institute_mapping.create','Create assessment-institute mappings'),(175,'assessment_institute_mapping.update','Update assessment-institute mappings'),(176,'assessment_institute_mapping.delete','Delete assessment-institute mappings'),(177,'assessment_proctoring.read','View assessment proctoring data'),(178,'assessment_proctoring.create','Create assessment proctoring records'),(179,'assessment_proctoring.update','Update assessment proctoring records'),(180,'assessment_proctoring.delete','Delete assessment proctoring records'),(181,'assessment_question.read','View assessment questions'),(182,'assessment_question.read.all','View all assessment questions across scopes'),(183,'assessment_question.create','Create assessment questions'),(184,'assessment_question.update','Update assessment questions'),(185,'assessment_question.delete','Delete assessment questions'),(186,'assessment_question.import','Import assessment questions from Excel'),(187,'assessment_question.export','Export assessment questions to Excel'),(188,'assessment_question_option.read','View assessment-question options'),(189,'assessment_question_option.create','Create assessment-question options'),(190,'assessment_question_option.update','Update assessment-question options'),(191,'assessment_question_option.delete','Delete assessment-question options'),(192,'bet_report_data.read','View BET report data'),(193,'bet_report_data.read.all','View all BET report data across scopes'),(194,'bet_report_data.create','Create BET report data'),(195,'bet_report_data.update','Update BET report data'),(196,'bet_report_data.delete','Delete BET report data'),(197,'dashboard_snapshot.read','View dashboard snapshots'),(198,'dashboard_snapshot.create','Create dashboard snapshots'),(199,'dashboard_snapshot.update','Update dashboard snapshots'),(200,'four_pager_template.read','View 4-pager report templates'),(201,'four_pager_template.update','Update 4-pager report templates'),(202,'game_results.read','View game results'),(203,'game_results.create','Create game results'),(204,'game_results.update','Update game results'),(205,'game_results.delete','Delete game results'),(206,'game_table.read','View game-table definitions'),(207,'game_table.create','Create game-table definitions'),(208,'game_table.update','Update game-table definitions'),(209,'game_table.delete','Delete game-table definitions'),(210,'general_assessment.read','View general assessments'),(211,'general_assessment.create','Create general assessments'),(212,'general_assessment.update','Update general assessments'),(213,'general_assessment.delete','Delete general assessments'),(214,'generated_report.read','View generated reports'),(215,'generated_report.read.all','View all generated reports across scopes'),(216,'generated_report.create','Create generated reports'),(217,'generated_report.update','Update generated reports'),(218,'generated_report.delete','Delete generated reports'),(219,'navigator_report_data.read','View Navigator report data'),(220,'navigator_report_data.read.all','View all Navigator report data across scopes'),(221,'navigator_report_data.create','Create Navigator report data'),(222,'navigator_report_data.update','Update Navigator report data'),(223,'navigator_report_data.delete','Delete Navigator report data'),(224,'language_option.read','View language options'),(225,'language_option.create','Create language options'),(226,'language_option.update','Update language options'),(227,'language_option.delete','Delete language options'),(228,'language_question.read','View language questions'),(229,'language_question.create','Create language questions'),(230,'language_question.update','Update language questions'),(231,'language_question.delete','Delete language questions'),(232,'language_supported.read','View supported languages'),(233,'language_supported.create','Create supported languages'),(234,'language_supported.update','Update supported languages'),(235,'language_supported.delete','Delete supported languages'),(236,'measured_quality.read','View measured qualities'),(237,'measured_quality.create','Create measured qualities'),(238,'measured_quality.update','Update measured qualities'),(239,'measured_quality.delete','Delete measured qualities'),(240,'measured_quality_type.read','View measured-quality types'),(241,'measured_quality_type.create','Create measured-quality types'),(242,'measured_quality_type.update','Update measured-quality types'),(243,'measured_quality_type.delete','Delete measured-quality types'),(244,'omr_column_mapping.read','View OMR column mappings'),(245,'omr_column_mapping.create','Create OMR column mappings'),(246,'omr_column_mapping.update','Update OMR column mappings'),(247,'omr_column_mapping.delete','Delete OMR column mappings'),(248,'option_score.read','View option scores'),(249,'option_score.create','Create option scores'),(250,'option_score.update','Update option scores'),(251,'option_score.delete','Delete option scores'),(252,'question_media.read','View question media'),(253,'question_media.create','Create question media'),(254,'question_media.delete','Delete question media'),(255,'question_section.read','View question sections'),(256,'question_section.create','Create question sections'),(257,'question_section.update','Update question sections'),(258,'question_section.delete','Delete question sections'),(259,'questionnaire.read','View questionnaires'),(260,'questionnaire.read.all','View all questionnaires across scopes'),(261,'questionnaire.create','Create questionnaires'),(262,'questionnaire.update','Update questionnaires'),(263,'questionnaire.delete','Delete questionnaires'),(264,'questionnaire_language.read','View questionnaire languages'),(265,'questionnaire_language.create','Create questionnaire languages'),(266,'questionnaire_language.update','Update questionnaire languages'),(267,'questionnaire_language.delete','Delete questionnaire languages'),(268,'report_template.read','View report templates'),(269,'report_template.create','Create report templates'),(270,'report_template.update','Update report templates'),(271,'report_template.delete','Delete report templates'),(272,'report_zip.read','View report ZIP bundles'),(273,'report_zip.create','Create report ZIP bundles'),(274,'report_zip.update','Update report ZIP bundles'),(275,'tool.read','View psychometric tools'),(276,'tool.create','Create psychometric tools'),(277,'tool.update','Update psychometric tools'),(278,'tool.delete','Delete psychometric tools'),(279,'student_info.read','View student info records'),(280,'student_info.read.all','View all student info records across scopes'),(281,'student_info.create','Create student info records'),(282,'student_info.update','Update student info records'),(283,'student_info.delete','Delete student info records'),(284,'student_info.import','Import student info records'),(285,'temporary_student.read','View temporary students'),(286,'temporary_student.create','Create temporary students'),(287,'temporary_student.update','Update temporary students'),(288,'temporary_student.delete','Delete temporary students'),(289,'contact_person.read','View contact persons'),(290,'contact_person.create','Create contact persons'),(291,'contact_person.update','Update contact persons'),(292,'contact_person.delete','Delete contact persons'),(293,'faculty.read','View faculty'),(294,'faculty.create','Create faculty'),(295,'faculty.update','Update faculty'),(296,'faculty.delete','Delete faculty'),(297,'topic.read','View topics'),(298,'topic.create','Create topics'),(299,'topic.update','Update topics'),(300,'topic.delete','Delete topics'),(301,'university_mark.read','View university marks'),(302,'university_mark.create','Create university marks'),(303,'university_mark.update','Update university marks'),(304,'university_mark.delete','Delete university marks'),(305,'coding_question.read','View coding questions'),(306,'coding_question.create','Create coding questions'),(307,'coding_question.update','Update coding questions'),(308,'coding_question.delete','Delete coding questions'),(309,'compiler.read','View compiler endpoints'),(310,'compiler.submit','Submit code to compiler'),(311,'compiler_question_log.read','View compiler-question logs'),(312,'compiler_question_log.create','Create compiler-question log entries'),(313,'email.send','Send transactional email'),(314,'email.validate','Validate email addresses (OTP flow)'),(315,'student_institute_membership.read','View student-institute memberships'),(316,'student_institute_membership.create','Create student-institute memberships'),(317,'student_institute_membership.update','Update student-institute memberships'),(318,'student_institute_membership.delete','Delete student-institute memberships'),(319,'student_demographic_response.read','View student demographic responses'),(320,'student_demographic_response.create','Create student demographic responses'),(321,'student_demographic_response.update','Update student demographic responses'),(322,'student_demographic_response.delete','Delete student demographic responses'),(323,'demographic_field.read','View demographic fields'),(324,'demographic_field.create','Create demographic fields'),(325,'demographic_field.update','Update demographic fields'),(326,'demographic_field.delete','Delete demographic fields'),(327,'lead.read','View leads'),(328,'lead.create','Create leads'),(329,'lead.update','Update leads'),(330,'lead.delete','Delete leads'),(331,'live_tracking.read','View live-tracking events'),(332,'live_tracking.create','Create live-tracking events'),(333,'heartbeat.ping','Heartbeat ping (anonymous health probe)'),(334,'school_registration.read','View school registrations'),(335,'school_registration.create','Create school registrations'),(336,'school_registration.update','Update school registrations'),(337,'school_registration.delete','Delete school registrations'),(338,'career.read','View careers'),(339,'career.create','Create careers'),(340,'career.update','Update careers'),(341,'career.delete','Delete careers'),(342,'career_suggestion.read','View career suggestions'),(343,'career_suggestion.create','Create career suggestions'),(344,'career_suggestion.update','Update career suggestions'),(345,'career_suggestion.delete','Delete career suggestions'),(346,'communication_log.read','View communication logs'),(347,'communication_log.create','Create communication-log entries'),(348,'user_activity_log.read','View user activity logs'),(349,'user_activity_log.create','Create user activity log entries'),(350,'firebase_data_mapping.read','View Firebase data mappings'),(351,'firebase_data_mapping.create','Create Firebase data mappings'),(352,'firebase_data_mapping.update','Update Firebase data mappings'),(353,'firebase_data_mapping.delete','Delete Firebase data mappings'),(354,'counselling.availability_template.read','View counselling availability templates'),(355,'counselling.availability_template.create','Create counselling availability templates'),(356,'counselling.availability_template.update','Update counselling availability templates'),(357,'counselling.availability_template.delete','Delete counselling availability templates'),(358,'counselling.block_date.read','View counselling block-date requests'),(359,'counselling.block_date.create','Create counselling block-date requests'),(360,'counselling.block_date.update','Update counselling block-date requests'),(361,'counselling.block_date.delete','Delete counselling block-date requests'),(362,'counselling.activity_log.read','View counselling activity logs'),(363,'counselling.activity_log.create','Create counselling activity log entries'),(364,'counselling.appointment.read','View counselling appointments'),(365,'counselling.appointment.create','Create counselling appointments'),(366,'counselling.appointment.update','Update counselling appointments'),(367,'counselling.appointment.delete','Delete counselling appointments'),(368,'counselling.eligibility.read','View counselling eligibility records'),(369,'counselling.eligibility.create','Create counselling eligibility records'),(370,'counselling.eligibility.update','Update counselling eligibility records'),(371,'counselling.eligibility.delete','Delete counselling eligibility records'),(372,'counselling.rating.read','View counselling ratings'),(373,'counselling.rating.create','Create counselling ratings'),(374,'counselling.rating.update','Update counselling ratings'),(375,'counselling.rating.delete','Delete counselling ratings'),(376,'counselling.slot.read','View counselling slots'),(377,'counselling.slot.create','Create counselling slots'),(378,'counselling.slot.update','Update counselling slots'),(379,'counselling.slot.delete','Delete counselling slots'),(380,'counsellor.read','View counsellors'),(381,'counsellor.create','Create counsellors'),(382,'counsellor.update','Update counsellors'),(383,'counsellor.delete','Delete counsellors'),(384,'counsellor_institute_mapping.read','View counsellor-institute mappings'),(385,'counsellor_institute_mapping.create','Create counsellor-institute mappings'),(386,'counsellor_institute_mapping.update','Update counsellor-institute mappings'),(387,'counsellor_institute_mapping.delete','Delete counsellor-institute mappings'),(388,'counsellor_media.read','View counsellor media'),(389,'counsellor_media.create','Create counsellor media'),(390,'counsellor_media.update','Update counsellor media'),(391,'counsellor_media.delete','Delete counsellor media'),(392,'counselling.notification.read','View counselling notifications'),(393,'counselling.notification.create','Create counselling notifications'),(394,'counselling.notification.update','Update counselling notifications'),(395,'counselling.notification.delete','Delete counselling notifications'),(396,'counselling.session_notes.read','View counselling session notes'),(397,'counselling.session_notes.create','Create counselling session notes'),(398,'counselling.session_notes.update','Update counselling session notes'),(399,'counselling.session_notes.delete','Delete counselling session notes'),(400,'counselling.slot_configuration.read','View counselling slot configurations'),(401,'counselling.slot_configuration.create','Create counselling slot configurations'),(402,'counselling.slot_configuration.update','Update counselling slot configurations'),(403,'counselling.slot_configuration.delete','Delete counselling slot configurations'),(404,'counselling.student_counsellor_mapping.read','View student-counsellor mappings'),(405,'counselling.student_counsellor_mapping.create','Create student-counsellor mappings'),(406,'counselling.student_counsellor_mapping.update','Update student-counsellor mappings'),(407,'counselling.student_counsellor_mapping.delete','Delete student-counsellor mappings'),(408,'counselling.student_management.read','View counselling student management'),(409,'counselling.student_management.create','Create counselling student-management records'),(410,'counselling.student_management.update','Update counselling student-management records'),(411,'counselling.student_management.delete','Delete counselling student-management records'),(440,'dashboard.admin.refresh','Force-recompute the admin dashboard snapshot'),(441,'permission.refresh','Run the permission catalog refresh'),(442,'role.url.update','Manage which React URLs a role grants access to'),(443,'payment.update','Update payment state and send nudge / link-resend communications'),(444,'student_management.read','View Student Management page (no data downloads)'),(445,'student_management.update','Allot / reset / edit students from Student Management'),(510,'reminders.view','Open the Reminder Management page'),(511,'reminders.config.read','Read reminder system configuration'),(512,'reminders.config.edit','Edit enable/disable, cron, lead-time, caps'),(513,'reminders.template.edit','Edit subject + body templates'),(514,'reminders.logs.view','View delivery log and analytics'),(515,'reminders.suppressions.manage','Add / remove per-student opt-outs'),(516,'reminders.send.manual','Trigger a manual reminder send'),(517,'reminders.send.test','Send a test email from the template editor'),(518,'report_type.read','View report types catalog'),(519,'report_subtype.read','View report subtypes catalog'),(520,'report_subtype.create','Create a new report subtype'),(521,'report_subtype.update','Update subtype metadata (display name, render folder)'),(522,'report_subtype.upload_template','Upload / replace the HTML template for a subtype'),(523,'report_subtype.delete','Delete a report subtype'),(524,'calculated_report_data.read','View persisted calculated report payloads (dashboards)'),(525,'intermediary_scores.read','View persisted intermediary score payloads (dashboards)'),(526,'report_type.create','Create a new report type'),(527,'report_type.update','Update report type metadata'),(528,'report_type.delete','Delete a report type');
/*!40000 ALTER TABLE `permission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pricing_tiers`
--

DROP TABLE IF EXISTS `pricing_tiers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pricing_tiers` (
  `tier_id` bigint NOT NULL AUTO_INCREMENT,
  `base_price_inr` bigint NOT NULL,
  `counselling_session_count` int DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'INR',
  `dashboard_validity_days` int DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `includes_counselling` tinyint(1) DEFAULT '0',
  `includes_dashboard` tinyint(1) DEFAULT '0',
  `includes_final_report` tinyint(1) DEFAULT '0',
  `includes_lms` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) DEFAULT '0',
  `lms_validity_days` int DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int DEFAULT '0',
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`tier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pricing_tiers`
--

LOCK TABLES `pricing_tiers` WRITE;
/*!40000 ALTER TABLE `pricing_tiers` DISABLE KEYS */;
/*!40000 ALTER TABLE `pricing_tiers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `promo_code`
--

DROP TABLE IF EXISTS `promo_code`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `promo_code` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `current_uses` int DEFAULT '0',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discount_percent` int NOT NULL,
  `expires_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `max_uses` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_fplc11dewa94eib758xs5mrg9` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `promo_code`
--

LOCK TABLES `promo_code` WRITE;
/*!40000 ALTER TABLE `promo_code` DISABLE KEYS */;
/*!40000 ALTER TABLE `promo_code` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `promo_code_campaigns`
--

DROP TABLE IF EXISTS `promo_code_campaigns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `promo_code_campaigns` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `campaign_id` bigint NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `promo_code_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK10nj46buaied3rqpg3e094wb9` (`promo_code_id`,`campaign_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `promo_code_campaigns`
--

LOCK TABLES `promo_code_campaigns` WRITE;
/*!40000 ALTER TABLE `promo_code_campaigns` DISABLE KEYS */;
/*!40000 ALTER TABLE `promo_code_campaigns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `question_major_mapping`
--

DROP TABLE IF EXISTS `question_major_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `question_major_mapping` (
  `question_id` int NOT NULL,
  `topic_id` bigint NOT NULL,
  KEY `FK8e5hn3pxd8e7505guto5ijda1` (`topic_id`),
  KEY `FK1obp2417jp9bvgjs6du0t8tqc` (`question_id`),
  CONSTRAINT `FK1obp2417jp9bvgjs6du0t8tqc` FOREIGN KEY (`question_id`) REFERENCES `coding_questions` (`id`),
  CONSTRAINT `FK8e5hn3pxd8e7505guto5ijda1` FOREIGN KEY (`topic_id`) REFERENCES `topic` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `question_major_mapping`
--

LOCK TABLES `question_major_mapping` WRITE;
/*!40000 ALTER TABLE `question_major_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `question_major_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `question_sections`
--

DROP TABLE IF EXISTS `question_sections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `question_sections` (
  `section_id` bigint NOT NULL AUTO_INCREMENT,
  `is_deleted` bit(1) DEFAULT NULL,
  `section_description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_be_linked_with` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`section_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `question_sections`
--

LOCK TABLES `question_sections` WRITE;
/*!40000 ALTER TABLE `question_sections` DISABLE KEYS */;
/*!40000 ALTER TABLE `question_sections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `questionire`
--

DROP TABLE IF EXISTS `questionire`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `questionire` (
  `questionnaire_id` bigint NOT NULL AUTO_INCREMENT,
  `display` bit(1) DEFAULT NULL,
  `is_free` bit(1) DEFAULT NULL,
  `mode_id` int DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` decimal(19,2) DEFAULT NULL,
  `type` bit(1) DEFAULT NULL,
  `tool_id` bigint DEFAULT NULL,
  `report_category` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `report_type_id` bigint DEFAULT NULL,
  `report_subtype_id` bigint DEFAULT NULL,
  PRIMARY KEY (`questionnaire_id`),
  KEY `FKd664edii00sgacc8en1w8u53k` (`tool_id`),
  KEY `fk_questionire_report_type` (`report_type_id`),
  KEY `fk_questionire_report_subtype` (`report_subtype_id`),
  CONSTRAINT `fk_questionire_report_subtype` FOREIGN KEY (`report_subtype_id`) REFERENCES `report_subtype` (`report_subtype_id`),
  CONSTRAINT `fk_questionire_report_type` FOREIGN KEY (`report_type_id`) REFERENCES `report_type` (`report_type_id`),
  CONSTRAINT `FKd664edii00sgacc8en1w8u53k` FOREIGN KEY (`tool_id`) REFERENCES `tools` (`tool_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questionire`
--

LOCK TABLES `questionire` WRITE;
/*!40000 ALTER TABLE `questionire` DISABLE KEYS */;
/*!40000 ALTER TABLE `questionire` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `questionnaire_language`
--

DROP TABLE IF EXISTS `questionnaire_language`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `questionnaire_language` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `instructions` longtext COLLATE utf8mb4_unicode_ci,
  `language_id` bigint DEFAULT NULL,
  `questionnaire_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKmqaoen3pl07igcybaysr9n4da` (`language_id`),
  KEY `FKaowsm5pbrvfdean36qvaw75ja` (`questionnaire_id`),
  CONSTRAINT `FKaowsm5pbrvfdean36qvaw75ja` FOREIGN KEY (`questionnaire_id`) REFERENCES `questionire` (`questionnaire_id`),
  CONSTRAINT `FKmqaoen3pl07igcybaysr9n4da` FOREIGN KEY (`language_id`) REFERENCES `language_table` (`language_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questionnaire_language`
--

LOCK TABLES `questionnaire_language` WRITE;
/*!40000 ALTER TABLE `questionnaire_language` DISABLE KEYS */;
/*!40000 ALTER TABLE `questionnaire_language` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `questionnaire_question`
--

DROP TABLE IF EXISTS `questionnaire_question`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `questionnaire_question` (
  `questionnaire_question_id` bigint NOT NULL AUTO_INCREMENT,
  `excel_question_header` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_index` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `question_id` bigint DEFAULT NULL,
  `questionnaire_section_id` bigint DEFAULT NULL,
  PRIMARY KEY (`questionnaire_question_id`),
  KEY `FK8fpgxwan18si7wtn26fu8r8v5` (`question_id`),
  KEY `FKheyirduwk8ghlaxkptmy6cnkg` (`questionnaire_section_id`),
  CONSTRAINT `FK8fpgxwan18si7wtn26fu8r8v5` FOREIGN KEY (`question_id`) REFERENCES `assessment_questions` (`question_id`),
  CONSTRAINT `FKheyirduwk8ghlaxkptmy6cnkg` FOREIGN KEY (`questionnaire_section_id`) REFERENCES `questionnaire_section` (`questionnaire_section_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questionnaire_question`
--

LOCK TABLES `questionnaire_question` WRITE;
/*!40000 ALTER TABLE `questionnaire_question` DISABLE KEYS */;
/*!40000 ALTER TABLE `questionnaire_question` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `questionnaire_section`
--

DROP TABLE IF EXISTS `questionnaire_section`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `questionnaire_section` (
  `questionnaire_section_id` bigint NOT NULL AUTO_INCREMENT,
  `order_index` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `questionnaire_id` bigint DEFAULT NULL,
  `section_id` bigint DEFAULT NULL,
  PRIMARY KEY (`questionnaire_section_id`),
  KEY `FK2ghkuo5nkdjthoejtv15dfrsb` (`questionnaire_id`),
  KEY `FKkaqyxi84y9vpfqp39yj1m5awc` (`section_id`),
  CONSTRAINT `FK2ghkuo5nkdjthoejtv15dfrsb` FOREIGN KEY (`questionnaire_id`) REFERENCES `questionire` (`questionnaire_id`),
  CONSTRAINT `FKkaqyxi84y9vpfqp39yj1m5awc` FOREIGN KEY (`section_id`) REFERENCES `question_sections` (`section_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questionnaire_section`
--

LOCK TABLES `questionnaire_section` WRITE;
/*!40000 ALTER TABLE `questionnaire_section` DISABLE KEYS */;
/*!40000 ALTER TABLE `questionnaire_section` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `questionnaire_section_instruction`
--

DROP TABLE IF EXISTS `questionnaire_section_instruction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `questionnaire_section_instruction` (
  `questionnaire_section_instruction_id` bigint NOT NULL AUTO_INCREMENT,
  `instruction_text` longtext COLLATE utf8mb4_unicode_ci,
  `language_id` bigint DEFAULT NULL,
  `questionnaire_section_id` bigint DEFAULT NULL,
  PRIMARY KEY (`questionnaire_section_instruction_id`),
  KEY `FKt6qsl1omqjc38v8ea3hr1s2g0` (`language_id`),
  KEY `FK6tl75ctf71qpmdj7fcl2b0dme` (`questionnaire_section_id`),
  CONSTRAINT `FK6tl75ctf71qpmdj7fcl2b0dme` FOREIGN KEY (`questionnaire_section_id`) REFERENCES `questionnaire_section` (`questionnaire_section_id`),
  CONSTRAINT `FKt6qsl1omqjc38v8ea3hr1s2g0` FOREIGN KEY (`language_id`) REFERENCES `language_table` (`language_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questionnaire_section_instruction`
--

LOCK TABLES `questionnaire_section_instruction` WRITE;
/*!40000 ALTER TABLE `questionnaire_section_instruction` DISABLE KEYS */;
/*!40000 ALTER TABLE `questionnaire_section_instruction` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refresh_token`
--

DROP TABLE IF EXISTS `refresh_token`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_token` (
  `jti` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint NOT NULL,
  `issued_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `replaced_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`jti`),
  KEY `idx_rt_user` (`user_id`),
  KEY `idx_rt_exp` (`expires_at`),
  CONSTRAINT `fk_rt_user` FOREIGN KEY (`user_id`) REFERENCES `student_user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_token`
--

LOCK TABLES `refresh_token` WRITE;
/*!40000 ALTER TABLE `refresh_token` DISABLE KEYS */;
/*!40000 ALTER TABLE `refresh_token` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reminder_config`
--

DROP TABLE IF EXISTS `reminder_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reminder_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `service_type` varchar(40) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `cron_expression` varchar(64) NOT NULL,
  `lead_time_minutes` int DEFAULT NULL,
  `max_sends_per_recipient` int DEFAULT NULL,
  `subject_template` varchar(500) NOT NULL,
  `body_template` mediumtext NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reminder_config_service_type` (`service_type`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reminder_config`
--

LOCK TABLES `reminder_config` WRITE;
/*!40000 ALTER TABLE `reminder_config` DISABLE KEYS */;
INSERT INTO `reminder_config` VALUES (1,'ASSESSMENT_INVITE_B2C',1,'0 23 * * * *',NULL,2,'Reminder: complete your career assessment','<p>Hi {{studentName}},</p><p>You have not yet started your career assessment <b>{{assessmentName}}</b>. Click the link below to begin:</p><p><a href=\"{{link}}\">{{link}}</a></p>','2026-06-01 13:14:43',NULL),(2,'COUNSELLING_24H',1,'0 0 * * * *',1440,NULL,'Reminder: your counselling session is tomorrow','<p>Hi {{studentName}},</p><p>Your counselling session with <b>{{counsellorName}}</b> is scheduled for <b>{{appointmentTime}}</b>.</p><p>Join here: <a href=\"{{meetingUrl}}\">{{meetingUrl}}</a></p>','2026-06-01 13:14:43',NULL),(3,'COUNSELLING_1H',1,'0 0 * * * *',60,NULL,'Your counselling session starts in an hour','<p>Hi {{studentName}},</p><p>Your counselling session starts at <b>{{appointmentTime}}</b>. Join here: <a href=\"{{meetingUrl}}\">{{meetingUrl}}</a></p>','2026-06-01 13:14:43',NULL),(4,'ASSESSMENT_MAPPING',1,'0 15 * * * *',4320,3,'Reminder: complete your assigned assessment','<p>Hi {{studentName}},</p><p>You have an assigned assessment <b>{{assessmentName}}</b> from {{instituteName}} that you have not yet started. Please complete it at your earliest convenience.</p><p><a href=\"{{link}}\">{{link}}</a></p>','2026-06-01 13:14:43',NULL);
/*!40000 ALTER TABLE `reminder_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reminder_delivery_log`
--

DROP TABLE IF EXISTS `reminder_delivery_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reminder_delivery_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `service_type` varchar(40) NOT NULL,
  `recipient` varchar(200) DEFAULT NULL,
  `user_student_id` bigint DEFAULT NULL,
  `institute_code` int DEFAULT NULL,
  `subject` varchar(300) DEFAULT NULL,
  `body_snapshot` mediumtext,
  `link_url` varchar(1000) DEFAULT NULL,
  `delivery_status` varchar(20) NOT NULL DEFAULT 'sent',
  `failure_reason` varchar(500) DEFAULT NULL,
  `triggered_by` varchar(20) NOT NULL DEFAULT 'SCHEDULED',
  `triggered_by_user_id` bigint DEFAULT NULL,
  `entitlement_id` bigint DEFAULT NULL,
  `appointment_id` bigint DEFAULT NULL,
  `assessment_mapping_id` bigint DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_reminder_log_service_status` (`service_type`,`delivery_status`),
  KEY `ix_reminder_log_recipient` (`recipient`),
  KEY `ix_reminder_log_sent_at` (`sent_at`),
  KEY `ix_reminder_log_institute` (`institute_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reminder_delivery_log`
--

LOCK TABLES `reminder_delivery_log` WRITE;
/*!40000 ALTER TABLE `reminder_delivery_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `reminder_delivery_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reminder_suppression`
--

DROP TABLE IF EXISTS `reminder_suppression`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reminder_suppression` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_student_id` bigint NOT NULL,
  `service_type` varchar(40) NOT NULL,
  `reason` varchar(500) DEFAULT NULL,
  `suppressed_by` bigint DEFAULT NULL,
  `suppressed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reminder_suppression_student_service` (`user_student_id`,`service_type`),
  KEY `ix_reminder_suppression_service` (`service_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reminder_suppression`
--

LOCK TABLES `reminder_suppression` WRITE;
/*!40000 ALTER TABLE `reminder_suppression` DISABLE KEYS */;
/*!40000 ALTER TABLE `reminder_suppression` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `report_generation_log`
--

DROP TABLE IF EXISTS `report_generation_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_generation_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `assessment_id` bigint DEFAULT NULL,
  `attempt_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `campaign_id` bigint DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `entitlement_id` bigint DEFAULT NULL,
  `error_class` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `report_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resolution_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `resolved_by` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stack_trace_excerpt` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_class_at_attempt` int DEFAULT NULL,
  `user_student_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_rgl_entitlement` (`entitlement_id`),
  KEY `idx_rgl_campaign` (`campaign_id`),
  KEY `idx_rgl_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `report_generation_log`
--

LOCK TABLES `report_generation_log` WRITE;
/*!40000 ALTER TABLE `report_generation_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `report_generation_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `report_subtype`
--

DROP TABLE IF EXISTS `report_subtype`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_subtype` (
  `report_subtype_id` bigint NOT NULL AUTO_INCREMENT,
  `report_type_id` bigint NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_spaces_url` varchar(2048) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `template_spaces_key` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `template_uploaded_at` datetime DEFAULT NULL,
  `spaces_render_folder` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`report_subtype_id`),
  UNIQUE KEY `uk_report_subtype_type_code` (`report_type_id`,`code`),
  CONSTRAINT `fk_report_subtype_type` FOREIGN KEY (`report_type_id`) REFERENCES `report_type` (`report_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `report_subtype`
--

LOCK TABLES `report_subtype` WRITE;
/*!40000 ALTER TABLE `report_subtype` DISABLE KEYS */;
INSERT INTO `report_subtype` VALUES (1,1,'insight','Insight Navigator (6-8)',NULL,NULL,NULL,'navigator-reports/insight'),(2,1,'subject','Subject Navigator (9-10)',NULL,NULL,NULL,'navigator-reports/subject'),(3,1,'career','Career Navigator (11-12)',NULL,NULL,NULL,'navigator-reports/career'),(4,2,'insight','Insight 4-Pager (6-8)',NULL,NULL,NULL,'pager-reports/insight'),(5,2,'subject','Subject 4-Pager (9-10)',NULL,NULL,NULL,'pager-reports/subject'),(6,2,'career','Career 4-Pager (11-12)',NULL,NULL,NULL,'pager-reports/career'),(7,3,'default','BET (single template)',NULL,NULL,NULL,'bet-reports/default');
/*!40000 ALTER TABLE `report_subtype` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `report_template`
--

DROP TABLE IF EXISTS `report_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_template` (
  `report_template_id` bigint NOT NULL AUTO_INCREMENT,
  `assessment_id` bigint NOT NULL,
  `created_at` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `field_mappings` text COLLATE utf8mb4_unicode_ci,
  `template_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_url` varchar(1024) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`report_template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `report_template`
--

LOCK TABLES `report_template` WRITE;
/*!40000 ALTER TABLE `report_template` DISABLE KEYS */;
/*!40000 ALTER TABLE `report_template` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `report_type`
--

DROP TABLE IF EXISTS `report_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_type` (
  `report_type_id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`report_type_id`),
  UNIQUE KEY `uk_report_type_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `report_type`
--

LOCK TABLES `report_type` WRITE;
/*!40000 ALTER TABLE `report_type` DISABLE KEYS */;
INSERT INTO `report_type` VALUES (1,'legacy','Navigator 18-Page'),(2,'pager','Navigator 4-Pager'),(3,'bet','BET');
/*!40000 ALTER TABLE `report_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role`
--

DROP TABLE IF EXISTS `role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role` (
  `id` int NOT NULL AUTO_INCREMENT,
  `display` bit(1) DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role`
--

LOCK TABLES `role` WRITE;
/*!40000 ALTER TABLE `role` DISABLE KEYS */;
INSERT INTO `role` VALUES (2,_binary '','STUDENT',NULL),(3,_binary '','B2C_OPS',NULL),(4,_binary '','SCHOOL_PRINCIPAL',NULL),(5,_binary '','SUPERADMIN',NULL);
/*!40000 ALTER TABLE `role` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_group`
--

DROP TABLE IF EXISTS `role_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_group` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `display` bit(1) DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_group`
--

LOCK TABLES `role_group` WRITE;
/*!40000 ALTER TABLE `role_group` DISABLE KEYS */;
INSERT INTO `role_group` VALUES (2,_binary '','student'),(3,_binary '','b2c_ops'),(4,_binary '','school_principal'),(5,_binary '','superadmin');
/*!40000 ALTER TABLE `role_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permission`
--

DROP TABLE IF EXISTS `role_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permission` (
  `role_id` int NOT NULL,
  `permission_id` bigint NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `idx_rp_permission` (`permission_id`),
  CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_id`) REFERENCES `permission` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `role` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permission`
--

LOCK TABLES `role_permission` WRITE;
/*!40000 ALTER TABLE `role_permission` DISABLE KEYS */;
INSERT INTO `role_permission` VALUES (2,13),(2,31),(2,33),(2,40),(2,43),(2,163),(2,166),(2,168),(2,178),(2,214),(2,279),(2,282),(2,319),(2,320),(2,321),(2,333),(3,510),(4,510),(5,510),(3,511),(4,511),(5,511),(3,512),(5,512),(5,513),(3,514),(4,514),(5,514),(5,515),(3,516),(4,516),(5,516),(3,517),(4,517),(5,517),(5,518),(5,519),(5,520),(5,521),(5,522),(5,523),(5,524),(5,525),(5,526),(5,527),(5,528);
/*!40000 ALTER TABLE `role_permission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_role_group_mapping`
--

DROP TABLE IF EXISTS `role_role_group_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_role_group_mapping` (
  `id` int NOT NULL AUTO_INCREMENT,
  `display` bit(1) DEFAULT NULL,
  `role_group_id` bigint DEFAULT NULL,
  `role_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK1mskk8h6e5smpuikoj112ut0i` (`role_id`),
  CONSTRAINT `FK1mskk8h6e5smpuikoj112ut0i` FOREIGN KEY (`role_id`) REFERENCES `role` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_role_group_mapping`
--

LOCK TABLES `role_role_group_mapping` WRITE;
/*!40000 ALTER TABLE `role_role_group_mapping` DISABLE KEYS */;
INSERT INTO `role_role_group_mapping` VALUES (2,_binary '',2,2),(3,_binary '',3,3),(4,_binary '',4,4),(5,_binary '',5,5);
/*!40000 ALTER TABLE `role_role_group_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_url`
--

DROP TABLE IF EXISTS `role_url`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_url` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_url_role_path` (`role_id`,`path`),
  UNIQUE KEY `UKme92jy2vme8jj4jtcrobruyfu` (`role_id`,`path`),
  KEY `idx_role_url_role` (`role_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_url`
--

LOCK TABLES `role_url` WRITE;
/*!40000 ALTER TABLE `role_url` DISABLE KEYS */;
INSERT INTO `role_url` VALUES (1,2,'/student/*');
/*!40000 ALTER TABLE `role_url` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `school_assessment_config`
--

DROP TABLE IF EXISTS `school_assessment_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `school_assessment_config` (
  `config_id` bigint NOT NULL AUTO_INCREMENT,
  `amount` bigint DEFAULT NULL,
  `assessment_id` bigint NOT NULL,
  `class_id` int NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `institute_code` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `session_id` int NOT NULL,
  PRIMARY KEY (`config_id`),
  UNIQUE KEY `UK1d4mcxfxqq36dubq7iqvsyub5` (`institute_code`,`session_id`,`class_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `school_assessment_config`
--

LOCK TABLES `school_assessment_config` WRITE;
/*!40000 ALTER TABLE `school_assessment_config` DISABLE KEYS */;
/*!40000 ALTER TABLE `school_assessment_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `school_assessment_tier`
--

DROP TABLE IF EXISTS `school_assessment_tier`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `school_assessment_tier` (
  `tier_id` bigint NOT NULL AUTO_INCREMENT,
  `amount` bigint DEFAULT NULL,
  `assessment_id` bigint NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `current_count` int NOT NULL DEFAULT '0',
  `description` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `institute_code` bigint NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `max_registrations` int DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_id` bigint NOT NULL,
  `sort_order` int NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`tier_id`),
  UNIQUE KEY `uk_school_assessment_tier_sort` (`institute_code`,`session_id`,`assessment_id`,`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `school_assessment_tier`
--

LOCK TABLES `school_assessment_tier` WRITE;
/*!40000 ALTER TABLE `school_assessment_tier` DISABLE KEYS */;
/*!40000 ALTER TABLE `school_assessment_tier` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `school_classes`
--

DROP TABLE IF EXISTS `school_classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `school_classes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `class_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `school_session_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK6kklrm7lx1ojxk2j87om0fqva` (`school_session_id`),
  CONSTRAINT `FK6kklrm7lx1ojxk2j87om0fqva` FOREIGN KEY (`school_session_id`) REFERENCES `school_session` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `school_classes`
--

LOCK TABLES `school_classes` WRITE;
/*!40000 ALTER TABLE `school_classes` DISABLE KEYS */;
/*!40000 ALTER TABLE `school_classes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `school_registration_link`
--

DROP TABLE IF EXISTS `school_registration_link`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `school_registration_link` (
  `link_id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime DEFAULT NULL,
  `institute_code` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `session_id` int NOT NULL,
  `token` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `current_count` int NOT NULL DEFAULT '0',
  `max_registrations` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `UKs8055ye9rhd2lyq35msyl7ubn` (`institute_code`,`session_id`),
  UNIQUE KEY `UK_gc9yfouq6mbmodlgn2yqr7vxt` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `school_registration_link`
--

LOCK TABLES `school_registration_link` WRITE;
/*!40000 ALTER TABLE `school_registration_link` DISABLE KEYS */;
/*!40000 ALTER TABLE `school_registration_link` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `school_report`
--

DROP TABLE IF EXISTS `school_report`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `school_report` (
  `school_report_id` bigint NOT NULL AUTO_INCREMENT,
  `ai_insights` longtext COLLATE utf8mb4_unicode_ci,
  `assessment_id` bigint NOT NULL,
  `assessment_name` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `institute_code` bigint NOT NULL,
  `institute_name` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `report_data` longtext COLLATE utf8mb4_unicode_ci,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `students_with_scores` int DEFAULT NULL,
  `total_students` int DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`school_report_id`),
  UNIQUE KEY `uk_school_report_inst_assess` (`institute_code`,`assessment_id`),
  KEY `idx_sr_institute` (`institute_code`),
  KEY `idx_sr_assessment` (`assessment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `school_report`
--

LOCK TABLES `school_report` WRITE;
/*!40000 ALTER TABLE `school_report` DISABLE KEYS */;
/*!40000 ALTER TABLE `school_report` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `school_sections`
--

DROP TABLE IF EXISTS `school_sections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `school_sections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `section_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `school_classes_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKb0f5dsmc45wn7yoo77thgj4e9` (`school_classes_id`),
  CONSTRAINT `FKb0f5dsmc45wn7yoo77thgj4e9` FOREIGN KEY (`school_classes_id`) REFERENCES `school_classes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `school_sections`
--

LOCK TABLES `school_sections` WRITE;
/*!40000 ALTER TABLE `school_sections` DISABLE KEYS */;
/*!40000 ALTER TABLE `school_sections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `school_session`
--

DROP TABLE IF EXISTS `school_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `school_session` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_year` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `institute_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKn0lqasvfv7d6ic8jjeckpf5jl` (`institute_id`),
  CONSTRAINT `FKn0lqasvfv7d6ic8jjeckpf5jl` FOREIGN KEY (`institute_id`) REFERENCES `institute_detail_new` (`institute_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `school_session`
--

LOCK TABLES `school_session` WRITE;
/*!40000 ALTER TABLE `school_session` DISABLE KEYS */;
/*!40000 ALTER TABLE `school_session` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `score_based_on_measured_quality_types`
--

DROP TABLE IF EXISTS `score_based_on_measured_quality_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `score_based_on_measured_quality_types` (
  `score_id` bigint NOT NULL AUTO_INCREMENT,
  `score` int DEFAULT NULL,
  `fk_quality_type` bigint DEFAULT NULL,
  `fk_assessment_questions_option` bigint DEFAULT NULL,
  PRIMARY KEY (`score_id`),
  KEY `idx_score_option` (`fk_assessment_questions_option`),
  KEY `idx_score_quality_type` (`fk_quality_type`),
  CONSTRAINT `FKkmukl305s2pm2jqb1qjuprm25` FOREIGN KEY (`fk_assessment_questions_option`) REFERENCES `assessment_question_options` (`option_id`),
  CONSTRAINT `FKnbgocbj2oti3pp9tqfm4j4nfa` FOREIGN KEY (`fk_quality_type`) REFERENCES `measured_quality_types` (`measured_quality_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `score_based_on_measured_quality_types`
--

LOCK TABLES `score_based_on_measured_quality_types` WRITE;
/*!40000 ALTER TABLE `score_based_on_measured_quality_types` DISABLE KEYS */;
/*!40000 ALTER TABLE `score_based_on_measured_quality_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `section`
--

DROP TABLE IF EXISTS `section`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `section` (
  `id` int NOT NULL,
  `display` bit(1) DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `section`
--

LOCK TABLES `section` WRITE;
/*!40000 ALTER TABLE `section` DISABLE KEYS */;
/*!40000 ALTER TABLE `section` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `section_google_group`
--

DROP TABLE IF EXISTS `section_google_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `section_google_group` (
  `id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section_id` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `section_google_group`
--

LOCK TABLES `section_google_group` WRITE;
/*!40000 ALTER TABLE `section_google_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `section_google_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_delivery_log`
--

DROP TABLE IF EXISTS `service_delivery_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_delivery_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `channel` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clicked_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `delivery_status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT 'queued',
  `entitlement_id` bigint DEFAULT NULL,
  `failure_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `link_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `opened_at` datetime DEFAULT NULL,
  `provider_message_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `service_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `template_key` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_student_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_delivery_log`
--

LOCK TABLES `service_delivery_log` WRITE;
/*!40000 ALTER TABLE `service_delivery_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `service_delivery_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_notes`
--

DROP TABLE IF EXISTS `session_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_notes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `action_items` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT NULL,
  `followup_required` tinyint(1) DEFAULT '0',
  `key_discussion_points` text COLLATE utf8mb4_unicode_ci,
  `private_notes` text COLLATE utf8mb4_unicode_ci,
  `public_remarks` text COLLATE utf8mb4_unicode_ci,
  `recommended_next_session` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `appointment_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKpvbo7u92oobtv3xev6hakyw4b` (`appointment_id`),
  CONSTRAINT `FKpvbo7u92oobtv3xev6hakyw4b` FOREIGN KEY (`appointment_id`) REFERENCES `counselling_appointment` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_notes`
--

LOCK TABLES `session_notes` WRITE;
/*!40000 ALTER TABLE `session_notes` DISABLE KEYS */;
/*!40000 ALTER TABLE `session_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `slot_configuration`
--

DROP TABLE IF EXISTS `slot_configuration`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `slot_configuration` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `break_end` time DEFAULT NULL,
  `break_start` time DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `end_date` date NOT NULL,
  `end_time` time NOT NULL,
  `has_break` tinyint(1) DEFAULT '0',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slot_duration` int NOT NULL,
  `start_date` date NOT NULL,
  `start_time` time NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `slot_configuration`
--

LOCK TABLES `slot_configuration` WRITE;
/*!40000 ALTER TABLE `slot_configuration` DISABLE KEYS */;
/*!40000 ALTER TABLE `slot_configuration` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_assessment_mapping`
--

DROP TABLE IF EXISTS `student_assessment_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_assessment_mapping` (
  `student_assessment_id` bigint NOT NULL AUTO_INCREMENT,
  `assessment_id` bigint NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'notstarted',
  `user_student_id` bigint NOT NULL,
  `feedback_rating` int DEFAULT NULL,
  `persistence_state` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reset_count` int DEFAULT '0',
  PRIMARY KEY (`student_assessment_id`),
  UNIQUE KEY `UK47plt03aoy9r1bfml8jw4sgsg` (`user_student_id`,`assessment_id`),
  CONSTRAINT `FKpu4p8dh847iao1c7otheen4hl` FOREIGN KEY (`user_student_id`) REFERENCES `user_student` (`user_student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_assessment_mapping`
--

LOCK TABLES `student_assessment_mapping` WRITE;
/*!40000 ALTER TABLE `student_assessment_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `student_assessment_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_contact_assignment`
--

DROP TABLE IF EXISTS `student_contact_assignment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_contact_assignment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `assigned_at` datetime DEFAULT NULL,
  `contact_person_id` bigint NOT NULL,
  `institute_id` int DEFAULT NULL,
  `user_student_id` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_contact_assignment`
--

LOCK TABLES `student_contact_assignment` WRITE;
/*!40000 ALTER TABLE `student_contact_assignment` DISABLE KEYS */;
/*!40000 ALTER TABLE `student_contact_assignment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_counsellor_mapping`
--

DROP TABLE IF EXISTS `student_counsellor_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_counsellor_mapping` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `assigned_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `assigned_by` bigint DEFAULT NULL,
  `counsellor_id` bigint NOT NULL,
  `student_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKbtatru068dbcl4egmtj8p5t8u` (`assigned_by`),
  KEY `FK6bjaq2j1puanhj5i351byy7g` (`counsellor_id`),
  KEY `FKm6unen337fgh8gne0491o7fub` (`student_id`),
  CONSTRAINT `FK6bjaq2j1puanhj5i351byy7g` FOREIGN KEY (`counsellor_id`) REFERENCES `counsellors` (`id`),
  CONSTRAINT `FKbtatru068dbcl4egmtj8p5t8u` FOREIGN KEY (`assigned_by`) REFERENCES `student_user` (`id`),
  CONSTRAINT `FKm6unen337fgh8gne0491o7fub` FOREIGN KEY (`student_id`) REFERENCES `user_student` (`user_student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_counsellor_mapping`
--

LOCK TABLES `student_counsellor_mapping` WRITE;
/*!40000 ALTER TABLE `student_counsellor_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `student_counsellor_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_demographic_response`
--

DROP TABLE IF EXISTS `student_demographic_response`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_demographic_response` (
  `response_id` bigint NOT NULL AUTO_INCREMENT,
  `assessment_id` bigint NOT NULL,
  `response_value` text COLLATE utf8mb4_unicode_ci,
  `submitted_at` datetime DEFAULT NULL,
  `user_student_id` bigint NOT NULL,
  `field_id` bigint NOT NULL,
  PRIMARY KEY (`response_id`),
  UNIQUE KEY `UK2n4f1cmxujp7yuec3bmgn1yd5` (`user_student_id`,`assessment_id`,`field_id`),
  KEY `FK3vo57obwu9t14p64fealkbkh6` (`field_id`),
  CONSTRAINT `FK3vo57obwu9t14p64fealkbkh6` FOREIGN KEY (`field_id`) REFERENCES `demographic_field_definition` (`field_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_demographic_response`
--

LOCK TABLES `student_demographic_response` WRITE;
/*!40000 ALTER TABLE `student_demographic_response` DISABLE KEYS */;
/*!40000 ALTER TABLE `student_demographic_response` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_entitlements`
--

DROP TABLE IF EXISTS `student_entitlements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_entitlements` (
  `entitlement_id` bigint NOT NULL AUTO_INCREMENT,
  `access_token` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `access_token_expires_at` datetime DEFAULT NULL,
  `assessment_id` bigint NOT NULL,
  `campaign_assessment_tier_id` bigint DEFAULT NULL,
  `campaign_id` bigint DEFAULT NULL,
  `counselling_active` tinyint(1) DEFAULT '0',
  `counselling_model` varchar(1) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `counselling_sessions_total` int DEFAULT '0',
  `counselling_sessions_used` int DEFAULT '0',
  `created_at` datetime DEFAULT NULL,
  `dashboard_active` tinyint(1) DEFAULT '0',
  `dashboard_expires_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `final_report_active` tinyint(1) DEFAULT '0',
  `granted_at` datetime DEFAULT NULL,
  `lms_active` tinyint(1) DEFAULT '0',
  `lms_expires_at` datetime DEFAULT NULL,
  `payment_transaction_id` bigint DEFAULT NULL,
  `pricing_tier_id` bigint DEFAULT NULL,
  `purchase_path` varchar(1) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `updated_at` datetime DEFAULT NULL,
  `user_student_id` bigint DEFAULT NULL,
  `report_prepared_at` datetime DEFAULT NULL,
  PRIMARY KEY (`entitlement_id`),
  UNIQUE KEY `UK_mnlcsk7jg74puhiuepwffmhw7` (`access_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_entitlements`
--

LOCK TABLES `student_entitlements` WRITE;
/*!40000 ALTER TABLE `student_entitlements` DISABLE KEYS */;
/*!40000 ALTER TABLE `student_entitlements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_info`
--

DROP TABLE IF EXISTS `student_info`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_info` (
  `id` int NOT NULL AUTO_INCREMENT,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `control_number` bigint DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `family` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gender` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `institute_id` int DEFAULT NULL,
  `session_id` int DEFAULT NULL,
  `course_code` int DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `school_board` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `school_roll_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `school_section_id` int DEFAULT NULL,
  `sibling` int DEFAULT NULL,
  `student_class` int DEFAULT NULL,
  `student_dob` datetime DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKja19bt0viky23gkbev4rai29g` (`user_id`),
  KEY `idx_student_info_scope` (`institute_id`,`session_id`,`course_code`,`school_section_id`),
  KEY `fk_si_session` (`session_id`),
  KEY `fk_si_course` (`course_code`),
  CONSTRAINT `fk_si_course` FOREIGN KEY (`course_code`) REFERENCES `institute_courses` (`course_code`),
  CONSTRAINT `fk_si_session` FOREIGN KEY (`session_id`) REFERENCES `institute_session` (`session_id`),
  CONSTRAINT `FKja19bt0viky23gkbev4rai29g` FOREIGN KEY (`user_id`) REFERENCES `student_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_info`
--

LOCK TABLES `student_info` WRITE;
/*!40000 ALTER TABLE `student_info` DISABLE KEYS */;
/*!40000 ALTER TABLE `student_info` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_info_backfill_report`
--

DROP TABLE IF EXISTS `student_info_backfill_report`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_info_backfill_report` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `run_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `institute_id` int DEFAULT NULL,
  `student_info_id` int DEFAULT NULL,
  `notes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_report_status` (`status`),
  KEY `idx_report_inst` (`institute_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_info_backfill_report`
--

LOCK TABLES `student_info_backfill_report` WRITE;
/*!40000 ALTER TABLE `student_info_backfill_report` DISABLE KEYS */;
/*!40000 ALTER TABLE `student_info_backfill_report` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_logs`
--

DROP TABLE IF EXISTS `student_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fname` longtext COLLATE utf8mb4_unicode_ci,
  `lname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `10th_marks` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `10th_roll_no` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `10thboard` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `12th_marks_chemistry` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `12th_marks_maths` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `12th_marks_physics` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `12th_roll_noss` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `12thboardss` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `aadhar_card_no` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch` longtext COLLATE utf8mb4_unicode_ci,
  `branch` longtext COLLATE utf8mb4_unicode_ci,
  `category` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `course` longtext COLLATE utf8mb4_unicode_ci,
  `current_address` longtext COLLATE utf8mb4_unicode_ci,
  `dob` longtext COLLATE utf8mb4_unicode_ci,
  `email_address` longtext COLLATE utf8mb4_unicode_ci,
  `father_name` longtext COLLATE utf8mb4_unicode_ci,
  `father_phone_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gender` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `generate` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hindi_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image` longblob,
  `mother_name` longtext COLLATE utf8mb4_unicode_ci,
  `pdf` longblob,
  `permanent_address` longtext COLLATE utf8mb4_unicode_ci,
  `phone_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `roll no_` decimal(19,2) DEFAULT NULL,
  `studentscol` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timestamp` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedby` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_logs`
--

LOCK TABLES `student_logs` WRITE;
/*!40000 ALTER TABLE `student_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `student_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_user`
--

DROP TABLE IF EXISTS `student_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_user` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `accept_terms` bit(1) DEFAULT NULL,
  `career_nine_rollnumber` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `designation` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display` bit(1) DEFAULT NULL,
  `dob_date` datetime DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_verified` bit(1) DEFAULT NULL,
  `google_auth_string` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '0',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `organisation` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_info_id` int DEFAULT NULL,
  `is_super_admin` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `FKn2v7p6lkcu5v13rwqooej89uj` (`student_info_id`),
  CONSTRAINT `FKn2v7p6lkcu5v13rwqooej89uj` FOREIGN KEY (`student_info_id`) REFERENCES `student_info` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_user`
--

LOCK TABLES `student_user` WRITE;
/*!40000 ALTER TABLE `student_user` DISABLE KEYS */;
INSERT INTO `student_user` VALUES (2,_binary '\0',NULL,NULL,_binary '',NULL,'admin@career-9.local',_binary '',NULL,NULL,1,'System Administrator',NULL,'$2a$10$neRNBqkjVvTqX1wbkd1DFOJ0jvY3HLFFqC8.8EN.gvJ1JSGQAjmNK',NULL,'local',NULL,NULL,NULL,1);
/*!40000 ALTER TABLE `student_user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sub_topics`
--

DROP TABLE IF EXISTS `sub_topics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sub_topics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sub_topics`
--

LOCK TABLES `sub_topics` WRITE;
/*!40000 ALTER TABLE `sub_topics` DISABLE KEYS */;
/*!40000 ALTER TABLE `sub_topics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_case`
--

DROP TABLE IF EXISTS `test_case`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_case` (
  `id` int NOT NULL AUTO_INCREMENT,
  `input` text COLLATE utf8mb4_unicode_ci,
  `locked` bit(1) DEFAULT NULL,
  `output` text COLLATE utf8mb4_unicode_ci,
  `coding_question_id_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKsg00meo58fsf959f6jlmqixkq` (`coding_question_id_id`),
  CONSTRAINT `FKsg00meo58fsf959f6jlmqixkq` FOREIGN KEY (`coding_question_id_id`) REFERENCES `coding_questions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `test_case`
--

LOCK TABLES `test_case` WRITE;
/*!40000 ALTER TABLE `test_case` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_case` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_faculty_check`
--

DROP TABLE IF EXISTS `test_faculty_check`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_faculty_check` (
  `faculty_id` int NOT NULL,
  `aadhar_card_no` bit(1) DEFAULT NULL,
  `bank_account_no` bit(1) DEFAULT NULL,
  `bank_name_with_address` bit(1) DEFAULT NULL,
  `category` bit(1) DEFAULT NULL,
  `current_address` bit(1) DEFAULT NULL,
  `department` bit(1) DEFAULT NULL,
  `designation` bit(1) DEFAULT NULL,
  `dob` bit(1) DEFAULT NULL,
  `educational_qualifications` bit(1) DEFAULT NULL,
  `father_husband_name` bit(1) DEFAULT NULL,
  `first_name` bit(1) DEFAULT NULL,
  `gender` bit(1) DEFAULT NULL,
  `ifsc_code` bit(1) DEFAULT NULL,
  `last_name` bit(1) DEFAULT NULL,
  `middle_name` bit(1) DEFAULT NULL,
  `official_email_address` bit(1) DEFAULT NULL,
  `pan_card_no` bit(1) DEFAULT NULL,
  `permanent_address` bit(1) DEFAULT NULL,
  `personal_email_address` bit(1) DEFAULT NULL,
  `phone_number` bit(1) DEFAULT NULL,
  `teaching_experience` bit(1) DEFAULT NULL,
  `webcam_photo` bit(1) DEFAULT NULL,
  PRIMARY KEY (`faculty_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `test_faculty_check`
--

LOCK TABLES `test_faculty_check` WRITE;
/*!40000 ALTER TABLE `test_faculty_check` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_faculty_check` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_updated_check`
--

DROP TABLE IF EXISTS `test_updated_check`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_updated_check` (
  `student_id` int NOT NULL,
  `_0th_board` bit(1) DEFAULT NULL,
  `_0th_marks` bit(1) DEFAULT NULL,
  `_0th_roll_no` bit(1) DEFAULT NULL,
  `_2th_board_ss` bit(1) DEFAULT NULL,
  `_2th_marks_chem` bit(1) DEFAULT NULL,
  `_2th_marks_maths` bit(1) DEFAULT NULL,
  `_2th_marks_physics` bit(1) DEFAULT NULL,
  `_2th_roll_no_ss` bit(1) DEFAULT NULL,
  `aadhar_card` bit(1) DEFAULT NULL,
  `aadhar_card_no` bit(1) DEFAULT NULL,
  `adhaar_card_parents` bit(1) DEFAULT NULL,
  `affidavit_for_gap` bit(1) DEFAULT NULL,
  `allotment_letter` bit(1) DEFAULT NULL,
  `anti_ragging_affidavit` bit(1) DEFAULT NULL,
  `batch` bit(1) DEFAULT NULL,
  `birthday_mail` bit(1) DEFAULT NULL,
  `branch` bit(1) DEFAULT NULL,
  `caste_certificate` bit(1) DEFAULT NULL,
  `category` bit(1) DEFAULT NULL,
  `character_certificate` bit(1) DEFAULT NULL,
  `course` bit(1) DEFAULT NULL,
  `crypto_wallet_address` bit(1) DEFAULT NULL,
  `current_address` bit(1) DEFAULT NULL,
  `display` bit(1) NOT NULL,
  `dob` bit(1) DEFAULT NULL,
  `domicile_certificate_up` bit(1) DEFAULT NULL,
  `email_address` bit(1) DEFAULT NULL,
  `father_photograph` bit(1) DEFAULT NULL,
  `father_name` bit(1) DEFAULT NULL,
  `father_phone_number` bit(1) DEFAULT NULL,
  `first_name` bit(1) DEFAULT NULL,
  `gender` bit(1) DEFAULT NULL,
  `generate` bit(1) DEFAULT NULL,
  `high_school_certificate` bit(1) DEFAULT NULL,
  `high_school_marksheet` bit(1) DEFAULT NULL,
  `hindi_name` bit(1) DEFAULT NULL,
  `image` bit(1) NOT NULL,
  `income_certificate` bit(1) DEFAULT NULL,
  `intermediate_certificate` bit(1) DEFAULT NULL,
  `intermediate_marksheet` bit(1) DEFAULT NULL,
  `ipfs_pdf_url` bit(1) DEFAULT NULL,
  `ipfs_url` bit(1) DEFAULT NULL,
  `last_name` bit(1) DEFAULT NULL,
  `medical_certificate` bit(1) DEFAULT NULL,
  `middle_name` bit(1) DEFAULT NULL,
  `migration_certificate` bit(1) DEFAULT NULL,
  `mother_photograph` bit(1) DEFAULT NULL,
  `mother_name` bit(1) DEFAULT NULL,
  `nft_hash_code` bit(1) DEFAULT NULL,
  `pan_card_parents` bit(1) DEFAULT NULL,
  `pdf` bit(1) NOT NULL,
  `permanent_address` bit(1) DEFAULT NULL,
  `phone_number` bit(1) DEFAULT NULL,
  `qualified_rank_letter` bit(1) DEFAULT NULL,
  `roll_no` bit(1) DEFAULT NULL,
  `student_photograph` bit(1) DEFAULT NULL,
  `student_signature` bit(1) DEFAULT NULL,
  `student_thumb_impression` bit(1) DEFAULT NULL,
  `studentscol` bit(1) NOT NULL,
  `sub_category` bit(1) DEFAULT NULL,
  `transfer_certificate` bit(1) DEFAULT NULL,
  `webcam_photo` bit(1) DEFAULT NULL,
  `college_enrollment_number_id` int NOT NULL,
  `10th_marks` bit(1) DEFAULT NULL,
  `10th_roll_no` bit(1) DEFAULT NULL,
  `10thboard` bit(1) DEFAULT NULL,
  `12th_marks_chemistry` bit(1) DEFAULT NULL,
  `12th_marks_maths` bit(1) DEFAULT NULL,
  `12th_marks_physics` bit(1) DEFAULT NULL,
  `12th_roll_noss` bit(1) DEFAULT NULL,
  `12thboardss` bit(1) DEFAULT NULL,
  PRIMARY KEY (`college_enrollment_number_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `test_updated_check`
--

LOCK TABLES `test_updated_check` WRITE;
/*!40000 ALTER TABLE `test_updated_check` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_updated_check` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `testing_students`
--

DROP TABLE IF EXISTS `testing_students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `testing_students` (
  `college_enrollment_number` int NOT NULL AUTO_INCREMENT,
  `10th_marks` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `10th_roll_no` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `10thboard` int DEFAULT NULL,
  `12th_marks_chemistry` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `12th_marks_maths` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `12th_marks_physics` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `12th_roll_noss` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `12thboardss` int DEFAULT NULL,
  `aadhar_card` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `aadhar_card_no` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `aadhar_card_physical` tinyint DEFAULT NULL,
  `adhaar_card_parents` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adhaar_card_parents_physical` tinyint DEFAULT NULL,
  `affidavit_for_gap` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `affidavit_for_gap_physical` tinyint DEFAULT NULL,
  `allotment_letter` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `allotment_letter_physical` tinyint DEFAULT NULL,
  `anti_ragging_affidavit` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `anti_ragging_affidavit_physical` tinyint DEFAULT NULL,
  `batch_id` int DEFAULT NULL,
  `birthday_mail` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `branch_id` int DEFAULT NULL,
  `caste_certificate` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `caste_certificate_physical` tinyint DEFAULT NULL,
  `category` int NOT NULL,
  `character_certificate` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `character_certificate_physical` tinyint DEFAULT NULL,
  `counselling` bit(1) DEFAULT NULL,
  `course` int DEFAULT NULL,
  `crypto_wallet_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `current_address` longtext COLLATE utf8mb4_unicode_ci,
  `display` tinyint NOT NULL,
  `dob` longtext COLLATE utf8mb4_unicode_ci,
  `domicile_certificate_up` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `domicile_certificate_up_physical` tinyint DEFAULT NULL,
  `ews` bit(1) DEFAULT NULL,
  `father_name` longtext COLLATE utf8mb4_unicode_ci,
  `father_phone_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `father_photograph` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `father_photograph_physical` tinyint DEFAULT NULL,
  `first_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gender` int DEFAULT NULL,
  `generate` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `google` bit(1) DEFAULT NULL,
  `google_group` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `high_school_certificate` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `high_school_certificate_physical` tinyint DEFAULT NULL,
  `high_school_marksheet` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `high_school_marksheet_physical` tinyint DEFAULT NULL,
  `hindi_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_board_12th` bit(1) DEFAULT NULL,
  `image` longblob,
  `income_certificate` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `income_certificate_physical` tinyint DEFAULT NULL,
  `intermediate_certificate` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `intermediate_certificate_physical` tinyint DEFAULT NULL,
  `intermediate_marksheet` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `intermediate_marksheet_physical` tinyint DEFAULT NULL,
  `ipfs_pdf_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ipfs_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `medical_certificate` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `medical_certificate_physical` tinyint DEFAULT NULL,
  `middle_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `migration_certificate` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `migration_certificate_physical` tinyint DEFAULT NULL,
  `mother_name` longtext COLLATE utf8mb4_unicode_ci,
  `mother_photograph` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mother_photograph_physical` tinyint DEFAULT NULL,
  `nft_hash_code` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `official_email_address` longtext COLLATE utf8mb4_unicode_ci,
  `pan_card_parents` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pan_card_parents_physical` tinyint DEFAULT NULL,
  `pdf` longblob,
  `permanent_address` longtext COLLATE utf8mb4_unicode_ci,
  `personal_email_address` longtext COLLATE utf8mb4_unicode_ci,
  `phone_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qualified_rank_letter` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qualified_rank_letter_physical` tinyint DEFAULT NULL,
  `roll_no` int DEFAULT NULL,
  `student_photograph` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_photograph_physical` tinyint DEFAULT NULL,
  `student_signature` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_signature_physical` tinyint DEFAULT NULL,
  `student_thumb_impression` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_thumb_impression_physical` tinyint DEFAULT NULL,
  `studentscol` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sub_category` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transfer_certificate` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transfer_certificate_physical` tinyint DEFAULT NULL,
  `type_of_student` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `webcam_photo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`college_enrollment_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `testing_students`
--

LOCK TABLES `testing_students` WRITE;
/*!40000 ALTER TABLE `testing_students` DISABLE KEYS */;
/*!40000 ALTER TABLE `testing_students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tool_measured_quality_mapping`
--

DROP TABLE IF EXISTS `tool_measured_quality_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tool_measured_quality_mapping` (
  `measured_quality_id` bigint NOT NULL,
  `tool_id` bigint NOT NULL,
  PRIMARY KEY (`measured_quality_id`,`tool_id`),
  KEY `FKwi5y6v7gn1xa1r19ngsebsf2` (`tool_id`),
  CONSTRAINT `FKe2twg4s3qw89afunkwc5xapn1` FOREIGN KEY (`measured_quality_id`) REFERENCES `measured_qualities` (`measured_quality_id`),
  CONSTRAINT `FKwi5y6v7gn1xa1r19ngsebsf2` FOREIGN KEY (`tool_id`) REFERENCES `tools` (`tool_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tool_measured_quality_mapping`
--

LOCK TABLES `tool_measured_quality_mapping` WRITE;
/*!40000 ALTER TABLE `tool_measured_quality_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `tool_measured_quality_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tools`
--

DROP TABLE IF EXISTS `tools`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tools` (
  `tool_id` bigint NOT NULL AUTO_INCREMENT,
  `is_free` bit(1) DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` double DEFAULT NULL,
  PRIMARY KEY (`tool_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tools`
--

LOCK TABLES `tools` WRITE;
/*!40000 ALTER TABLE `tools` DISABLE KEYS */;
/*!40000 ALTER TABLE `tools` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `topic`
--

DROP TABLE IF EXISTS `topic`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `topic` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `topic`
--

LOCK TABLES `topic` WRITE;
/*!40000 ALTER TABLE `topic` DISABLE KEYS */;
/*!40000 ALTER TABLE `topic` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `university_marks`
--

DROP TABLE IF EXISTS `university_marks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `university_marks` (
  `roll_no` bigint NOT NULL,
  `jsontext` longtext COLLATE utf8mb4_unicode_ci,
  `timestamp` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`roll_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `university_marks`
--

LOCK TABLES `university_marks` WRITE;
/*!40000 ALTER TABLE `university_marks` DISABLE KEYS */;
/*!40000 ALTER TABLE `university_marks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_activity_log`
--

DROP TABLE IF EXISTS `user_activity_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_activity_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `device_info` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `login_time` datetime DEFAULT NULL,
  `organisation` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `user_id` bigint DEFAULT NULL,
  `user_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_activity_log`
--

LOCK TABLES `user_activity_log` WRITE;
/*!40000 ALTER TABLE `user_activity_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_activity_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_group_mapping`
--

DROP TABLE IF EXISTS `user_group_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_group_mapping` (
  `user_id` bigint NOT NULL,
  `group_id` int NOT NULL,
  PRIMARY KEY (`user_id`,`group_id`),
  KEY `FK8b7r2boy8wkye7a8g83u7aj2l` (`group_id`),
  CONSTRAINT `FK80iuo4udtcc8clcb3kyjsou9c` FOREIGN KEY (`user_id`) REFERENCES `student_user` (`id`),
  CONSTRAINT `FK8b7r2boy8wkye7a8g83u7aj2l` FOREIGN KEY (`group_id`) REFERENCES `group_data` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_group_mapping`
--

LOCK TABLES `user_group_mapping` WRITE;
/*!40000 ALTER TABLE `user_group_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_group_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_role_group_mapping`
--

DROP TABLE IF EXISTS `user_role_group_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_role_group_mapping` (
  `id` int NOT NULL AUTO_INCREMENT,
  `display` bit(1) DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  `role_group_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKx9sre447nlfs4e1ygo39avx1` (`user_id`),
  KEY `FKp7x9kle7h9425fw74vdc9oiem` (`role_group_id`),
  CONSTRAINT `FKp7x9kle7h9425fw74vdc9oiem` FOREIGN KEY (`role_group_id`) REFERENCES `role_group` (`id`),
  CONSTRAINT `FKx9sre447nlfs4e1ygo39avx1` FOREIGN KEY (`user_id`) REFERENCES `student_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_role_group_mapping`
--

LOCK TABLES `user_role_group_mapping` WRITE;
/*!40000 ALTER TABLE `user_role_group_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_role_group_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_role_scope`
--

DROP TABLE IF EXISTS `user_role_scope`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_role_scope` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_role_group_mapping_id` int NOT NULL,
  `institute_id` int DEFAULT NULL,
  `session_id` int DEFAULT NULL,
  `course_code` int DEFAULT NULL,
  `section_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_urs_assignment` (`user_role_group_mapping_id`),
  KEY `idx_urs_scope` (`institute_id`,`session_id`,`course_code`,`section_id`),
  KEY `fk_urs_session` (`session_id`),
  KEY `fk_urs_course` (`course_code`),
  KEY `fk_urs_section` (`section_id`),
  CONSTRAINT `fk_urs_assignment` FOREIGN KEY (`user_role_group_mapping_id`) REFERENCES `user_role_group_mapping` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_urs_course` FOREIGN KEY (`course_code`) REFERENCES `institute_courses` (`course_code`),
  CONSTRAINT `fk_urs_institute` FOREIGN KEY (`institute_id`) REFERENCES `institute_detail_new` (`institute_code`),
  CONSTRAINT `fk_urs_section` FOREIGN KEY (`section_id`) REFERENCES `section` (`id`),
  CONSTRAINT `fk_urs_session` FOREIGN KEY (`session_id`) REFERENCES `institute_session` (`session_id`),
  CONSTRAINT `chk_urs_containment` CHECK ((((`section_id` is null) or (`course_code` is not null)) and ((`course_code` is null) or (`session_id` is not null) or (`institute_id` is not null)) and ((`session_id` is null) or (`institute_id` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_role_scope`
--

LOCK TABLES `user_role_scope` WRITE;
/*!40000 ALTER TABLE `user_role_scope` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_role_scope` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_student`
--

DROP TABLE IF EXISTS `user_student`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_student` (
  `user_student_id` bigint NOT NULL AUTO_INCREMENT,
  `info_completed` tinyint(1) NOT NULL DEFAULT '0',
  `user_id` bigint NOT NULL,
  `institute_id` int NOT NULL,
  `id` int NOT NULL,
  `counselling_allowed` tinyint(1) DEFAULT '0',
  `reports_visible` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`user_student_id`),
  KEY `FKbldshapeutun8rtleakx06dql` (`institute_id`),
  KEY `FKcjexsmhgak2j5tt9fa52un7qo` (`id`),
  CONSTRAINT `FKbldshapeutun8rtleakx06dql` FOREIGN KEY (`institute_id`) REFERENCES `institute_detail_new` (`institute_code`),
  CONSTRAINT `FKcjexsmhgak2j5tt9fa52un7qo` FOREIGN KEY (`id`) REFERENCES `student_info` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_student`
--

LOCK TABLES `user_student` WRITE;
/*!40000 ALTER TABLE `user_student` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_student` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_student_institute_history`
--

DROP TABLE IF EXISTS `user_student_institute_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_student_institute_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `added_at` datetime NOT NULL,
  `campaign_id` bigint DEFAULT NULL,
  `dropped_at` datetime DEFAULT NULL,
  `dropped_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `institute_code` int NOT NULL,
  `is_dropped` tinyint(1) NOT NULL DEFAULT '0',
  `source` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_student_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK6co2wjy2tpb81e94rv8h9rilu` (`user_student_id`,`institute_code`),
  KEY `idx_ush_user_student` (`user_student_id`),
  KEY `idx_ush_institute` (`institute_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_student_institute_history`
--

LOCK TABLES `user_student_institute_history` WRITE;
/*!40000 ALTER TABLE `user_student_institute_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_student_institute_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_url_access_log`
--

DROP TABLE IF EXISTS `user_url_access_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_url_access_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `access_time` datetime DEFAULT NULL,
  `http_method` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_url_access_log`
--

LOCK TABLES `user_url_access_log` WRITE;
/*!40000 ALTER TABLE `user_url_access_log` DISABLE KEYS */;
INSERT INTO `user_url_access_log` VALUES (1,'2026-05-05 10:59:34','GET','/user/me',1);
/*!40000 ALTER TABLE `user_url_access_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'career-9'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-10  0:49:58
