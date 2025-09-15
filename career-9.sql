-- MySQL dump 10.13  Distrib 8.0.43, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: career-9
-- ------------------------------------------------------
-- Server version	9.4.0

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
-- Table structure for table `assessment_question_measured_quality_type_mapping`
--

DROP TABLE IF EXISTS `assessment_question_measured_quality_type_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_question_measured_quality_type_mapping` (
  `question_id` bigint NOT NULL,
  `measured_quality_type_id` bigint NOT NULL,
  PRIMARY KEY (`question_id`,`measured_quality_type_id`),
  KEY `FK25xlh92n2t0upmwk1v2vv1bj` (`measured_quality_type_id`),
  CONSTRAINT `FK25xlh92n2t0upmwk1v2vv1bj` FOREIGN KEY (`measured_quality_type_id`) REFERENCES `measured_quality_types` (`measured_quality_type_id`),
  CONSTRAINT `FK298hf6x2iae3pctbs0lj2mwsq` FOREIGN KEY (`question_id`) REFERENCES `assessment_questions` (`question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_question_measured_quality_type_mapping`
--

LOCK TABLES `assessment_question_measured_quality_type_mapping` WRITE;
/*!40000 ALTER TABLE `assessment_question_measured_quality_type_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `assessment_question_measured_quality_type_mapping` ENABLE KEYS */;
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
  `option_text` varchar(255) DEFAULT NULL,
  `fk_assessment_questions` bigint NOT NULL,
  PRIMARY KEY (`option_id`),
  KEY `FKp8o3611escbo6rxqdeimj9s3f` (`fk_assessment_questions`),
  CONSTRAINT `FKp8o3611escbo6rxqdeimj9s3f` FOREIGN KEY (`fk_assessment_questions`) REFERENCES `assessment_questions` (`question_id`)
) ENGINE=InnoDB AUTO_INCREMENT=237 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_question_options`
--

LOCK TABLES `assessment_question_options` WRITE;
/*!40000 ALTER TABLE `assessment_question_options` DISABLE KEYS */;
INSERT INTO `assessment_question_options` VALUES (205,_binary '\0','I finish early and check answers.',60),(206,_binary '\0','I finish just on time.',60),(207,_binary '\0','I leave a few questions.',60),(208,_binary '\0','I need more time.',60),(209,_binary '\0','I can catch it almost every time.',61),(210,_binary '\0','I can catch it most of the time, but sometimes miss.',61),(211,_binary '\0','I miss more often than I catch.',61),(212,_binary '\0','I rarely catch it successfully.',61),(213,_binary '\0','Instantly know how much is left',62),(214,_binary '\0','Try to guess the amount roughly',62),(215,_binary '\0','Need to write and subtract',62),(216,_binary '\0','I need help of a calculator',62),(217,_binary '\0','Predict the ending based on clues',63),(218,_binary '\0','Sometimes guess correctly, but not always.',63),(219,_binary '\0','Rarely figure out the mystery before it’s revealed.',63),(220,_binary '\0','I enjoy reading it till end rahter than predicting.',63),(221,_binary '\0','I create new  plots and characters',64),(222,_binary '\0','I take help from stories I\'ve read',64),(223,_binary '\0','I write basic but clear stories',64),(224,_binary '\0','I struggle to think of stories',64),(225,_binary '\0','I can easily imagine the shape of the box.',65),(226,_binary '\0','I can imagine it, but it takes some effort.',65),(227,_binary '\0','I find it difficult to imagine the shape of the box.',65),(228,_binary '\0','I can\'t imagine the shape of the box.',65),(229,_binary '\0','I know  most of the words',66),(230,_binary '\0','I know some of them',66),(231,_binary '\0','I  guess most answers',66),(232,_binary '\0','I struggle with it',66),(233,_binary '\0','I can do it easily on the first try.',67),(234,_binary '\0','I can do it after a few attempts.',67),(235,_binary '\0','I can do it after a few attempts.',67),(236,_binary '\0','I can’t do it at all.',67);
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
  `question_text` varchar(255) DEFAULT NULL,
  `question_type` varchar(255) DEFAULT NULL,
  `section_id` bigint DEFAULT NULL,
  `fk_question_section` bigint DEFAULT NULL,
  `max_options_allowed` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`question_id`),
  KEY `FKm74r414caiap3oe4rrsihspqv` (`section_id`),
  KEY `FKqotkr9tctqibstdabhskh4s2q` (`fk_question_section`),
  CONSTRAINT `FKm74r414caiap3oe4rrsihspqv` FOREIGN KEY (`section_id`) REFERENCES `question_sections` (`section_id`),
  CONSTRAINT `FKqotkr9tctqibstdabhskh4s2q` FOREIGN KEY (`fk_question_section`) REFERENCES `question_sections` (`section_id`)
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_questions`
--

LOCK TABLES `assessment_questions` WRITE;
/*!40000 ALTER TABLE `assessment_questions` DISABLE KEYS */;
INSERT INTO `assessment_questions` VALUES (60,'In a timed class test or quiz…','multiple-choice',42,NULL,1),(61,'If I have to catch a thrown object..','multiple-choice',42,NULL,1),(62,'When shopping, if i get 250 and spend 185, I...','multiple-choice',42,NULL,1),(63,'If I read a mystery story, I can…','multiple-choice',42,NULL,1),(64,'In a storytelling or creative writing task...','multiple-choice',42,NULL,1),(65,'To imagine what a flat piece of cardboard would look like if it were folded to make a box…\n','multiple-choice',42,NULL,1),(66,'In a vocabulary quiz or crossword','multiple-choice',42,NULL,1),(67,'If I have to thread a needle…\n','multiple-choice',42,NULL,1);
/*!40000 ALTER TABLE `assessment_questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `batch`
--

DROP TABLE IF EXISTS `batch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `batch` (
  `id` int NOT NULL,
  `batch` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `batch`
--

LOCK TABLES `batch` WRITE;
/*!40000 ALTER TABLE `batch` DISABLE KEYS */;
/*!40000 ALTER TABLE `batch` ENABLE KEYS */;
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
  `name` varchar(255) DEFAULT NULL,
  `permanent` bit(1) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branch`
--

LOCK TABLES `branch` WRITE;
/*!40000 ALTER TABLE `branch` DISABLE KEYS */;
/*!40000 ALTER TABLE `branch` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `careers`
--

DROP TABLE IF EXISTS `careers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `careers` (
  `career_id` bigint NOT NULL AUTO_INCREMENT,
  `description` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`career_id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `careers`
--

LOCK TABLES `careers` WRITE;
/*!40000 ALTER TABLE `careers` DISABLE KEYS */;
INSERT INTO `careers` VALUES (7,'SDE','SDE'),(8,'A','A');
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
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `code` varchar(255) DEFAULT NULL,
  `coding_question_id` int DEFAULT NULL,
  `language_id` int DEFAULT NULL,
  `language_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `coding_problem` text,
  `problem_heading` varchar(255) DEFAULT NULL,
  `problem_url` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`problem_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `difficulty_level` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `acceptance_rate` varchar(255) DEFAULT NULL,
  `accepted` varchar(255) DEFAULT NULL,
  `coding_question` text,
  `likes` varchar(255) DEFAULT NULL,
  `platform` varchar(255) DEFAULT NULL,
  `question_heading` varchar(255) DEFAULT NULL,
  `question_url` varchar(255) DEFAULT NULL,
  `submissions` varchar(255) DEFAULT NULL,
  `difficulty` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_bbeat6rac52wo906cjn6oonus` (`question_url`),
  KEY `FKoi2nuwq53d5msve9bc7fxpdvw` (`difficulty`),
  CONSTRAINT `FKoi2nuwq53d5msve9bc7fxpdvw` FOREIGN KEY (`difficulty`) REFERENCES `difficulty` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coding_questions`
--

LOCK TABLES `coding_questions` WRITE;
/*!40000 ALTER TABLE `coding_questions` DISABLE KEYS */;
/*!40000 ALTER TABLE `coding_questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `compiler_question_logs`
--

DROP TABLE IF EXISTS `compiler_question_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compiler_question_logs` (
  `id` int NOT NULL,
  `expected_output` varchar(255) DEFAULT NULL,
  `language_id` int DEFAULT NULL,
  `question_id` int DEFAULT NULL,
  `response` varchar(255) DEFAULT NULL,
  `source_code` longtext,
  `stdin` varchar(255) DEFAULT NULL,
  `stdout` varchar(255) DEFAULT NULL,
  `user_id` decimal(19,2) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `compiler_question_logs`
--

LOCK TABLES `compiler_question_logs` WRITE;
/*!40000 ALTER TABLE `compiler_question_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `compiler_question_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `create_question`
--

DROP TABLE IF EXISTS `create_question`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `create_question` (
  `id` int NOT NULL AUTO_INCREMENT,
  `question` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `create_question`
--

LOCK TABLES `create_question` WRITE;
/*!40000 ALTER TABLE `create_question` DISABLE KEYS */;
/*!40000 ALTER TABLE `create_question` ENABLE KEYS */;
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
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `aadhar_card_no` varchar(255) DEFAULT NULL,
  `bank_account_no` varchar(255) DEFAULT NULL,
  `bank_name_with_address` longtext,
  `category` int NOT NULL,
  `current_address` longtext,
  `department` varchar(255) DEFAULT NULL,
  `designation` varchar(255) DEFAULT NULL,
  `display` tinyint NOT NULL,
  `dob` longtext,
  `educational_qualifications` varchar(255) DEFAULT NULL,
  `father_husband_name` varchar(255) DEFAULT NULL,
  `first_name` varchar(255) DEFAULT NULL,
  `gender` int DEFAULT NULL,
  `generate` varchar(255) DEFAULT NULL,
  `ifsc_code` varchar(255) DEFAULT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `middle_name` varchar(255) DEFAULT NULL,
  `official_email_address` longtext,
  `pan_card_no` varchar(255) DEFAULT NULL,
  `permanent_address` longtext,
  `personal_email_address` longtext,
  `phone_number` varchar(255) DEFAULT NULL,
  `teaching_experience` varchar(255) DEFAULT NULL,
  `webcam_photo` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`college_identification_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `name` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `files_metadata`
--

LOCK TABLES `files_metadata` WRITE;
/*!40000 ALTER TABLE `files_metadata` DISABLE KEYS */;
/*!40000 ALTER TABLE `files_metadata` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gender`
--

DROP TABLE IF EXISTS `gender`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gender` (
  `id` int NOT NULL,
  `type` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gender`
--

LOCK TABLES `gender` WRITE;
/*!40000 ALTER TABLE `gender` DISABLE KEYS */;
/*!40000 ALTER TABLE `gender` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `group_data`
--

DROP TABLE IF EXISTS `group_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `group_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_description` varchar(255) DEFAULT NULL,
  `group_title` varchar(255) DEFAULT NULL,
  `user_owner_id` tinyblob,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `academic_name` varchar(255) DEFAULT NULL,
  `academic_type` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`academic_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `batch_duration_type` varchar(255) DEFAULT NULL,
  `batch_end` varchar(255) DEFAULT NULL,
  `batch_start` varchar(255) DEFAULT NULL,
  `display` bit(1) DEFAULT NULL,
  PRIMARY KEY (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `email` varchar(255) DEFAULT NULL,
  `unique_id` varchar(255) DEFAULT NULL,
  `display` tinyint DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_batch_google_group`
--

LOCK TABLES `institute_batch_google_group` WRITE;
/*!40000 ALTER TABLE `institute_batch_google_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_batch_google_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_branch`
--

DROP TABLE IF EXISTS `institute_branch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_branch` (
  `branch_id` int NOT NULL AUTO_INCREMENT,
  `abbreviation` varchar(255) DEFAULT NULL,
  `branch_name` varchar(255) DEFAULT NULL,
  `course_id` int DEFAULT NULL,
  `display` bit(1) DEFAULT NULL,
  `shift` varchar(255) DEFAULT NULL,
  `total_intake` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `abbreviation` varchar(255) DEFAULT NULL,
  `course_name` varchar(255) DEFAULT NULL,
  `display` bit(1) DEFAULT NULL,
  `institute_id` int DEFAULT NULL,
  PRIMARY KEY (`course_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_courses`
--

LOCK TABLES `institute_courses` WRITE;
/*!40000 ALTER TABLE `institute_courses` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_details`
--

DROP TABLE IF EXISTS `institute_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_details` (
  `institute_code` int NOT NULL,
  `display` bit(1) DEFAULT NULL,
  `institute_address` varchar(255) DEFAULT NULL,
  `institute_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`institute_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_details`
--

LOCK TABLES `institute_details` WRITE;
/*!40000 ALTER TABLE `institute_details` DISABLE KEYS */;
INSERT INTO `institute_details` VALUES (123,_binary '','123','KCC');
/*!40000 ALTER TABLE `institute_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institute_google_group`
--

DROP TABLE IF EXISTS `institute_google_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institute_google_group` (
  `id` int NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `session_duration_type` varchar(255) DEFAULT NULL,
  `session_end_date` varchar(255) DEFAULT NULL,
  `session_start_date` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institute_session_google_group`
--

LOCK TABLES `institute_session_google_group` WRITE;
/*!40000 ALTER TABLE `institute_session_google_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `institute_session_google_group` ENABLE KEYS */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `measured_quality_description` varchar(255) DEFAULT NULL,
  `measured_quality_name` varchar(255) DEFAULT NULL,
  `quality_display_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`measured_quality_id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `measured_qualities`
--

LOCK TABLES `measured_qualities` WRITE;
/*!40000 ALTER TABLE `measured_qualities` DISABLE KEYS */;
INSERT INTO `measured_qualities` VALUES (21,'Personality','Personality','Personality'),(22,'Intelligence_Top','Intelligence_Top','Intelligence_Top'),(23,'Ability_Top','Ability_Top','Ability_Top');
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `measured_quality_type_career_mapping`
--

LOCK TABLES `measured_quality_type_career_mapping` WRITE;
/*!40000 ALTER TABLE `measured_quality_type_career_mapping` DISABLE KEYS */;
INSERT INTO `measured_quality_type_career_mapping` VALUES (31,7),(33,7),(34,8);
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
  `fk_measured_qualities` bigint DEFAULT NULL,
  `measured_quality_type_description` varchar(255) DEFAULT NULL,
  `measured_quality_type_display_name` varchar(255) DEFAULT NULL,
  `measured_quality_type_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`measured_quality_type_id`),
  KEY `FK41x7h4949wosayebo0qyo92bm` (`fk_measured_qualities`),
  CONSTRAINT `FK41x7h4949wosayebo0qyo92bm` FOREIGN KEY (`fk_measured_qualities`) REFERENCES `measured_qualities` (`measured_quality_id`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `measured_quality_types`
--

LOCK TABLES `measured_quality_types` WRITE;
/*!40000 ALTER TABLE `measured_quality_types` DISABLE KEYS */;
INSERT INTO `measured_quality_types` VALUES (31,21,'conventional','conventional','Conventional'),(32,21,'Investigative','Investigative','Investigative'),(33,NULL,'Enterprising','Enterprising','Enterprising'),(34,NULL,'Social','Social','Social'),(35,NULL,'Interpersonal','Interpersonal','Interpersonal'),(36,NULL,'Visual-Spatial','Visual-Spatial','Visual-Spatial'),(37,NULL,'Musical','Musical','Musical'),(38,NULL,'Naturalistic','Naturalistic','Naturalistic'),(39,NULL,'Logical','Logical','Logical'),(40,NULL,'Linguistic','Linguistic','Linguistic'),(41,NULL,'Bodily-Kinesthetic','Bodily-Kinesthetic','Bodily-Kinesthetic'),(42,NULL,'Communication','Communication','Communication'),(43,NULL,'Decision making & problem solving','Decision making & problem solving','Decision making & problem solving'),(44,NULL,'Computational','Computational','Computational'),(45,NULL,'Form perception','Form perception','Form perception'),(46,NULL,'Speed and accuracy','Speed and accuracy','Speed and accuracy'),(47,NULL,'Logical reasoning','Logical reasoning','Logical reasoning'),(48,NULL,'Technical','Technical','Technical'),(49,NULL,'Creativity','Creativity','Creativity'),(50,NULL,'Motor movement','Motor movement','Motor movement'),(51,NULL,'Finger dexterity','Finger dexterity','Finger dexterity'),(53,NULL,'analytical thinking','analytical thinking','Analytical thinking');
/*!40000 ALTER TABLE `measured_quality_types` ENABLE KEYS */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `section_description` varchar(255) DEFAULT NULL,
  `section_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`section_id`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `question_sections`
--

LOCK TABLES `question_sections` WRITE;
/*!40000 ALTER TABLE `question_sections` DISABLE KEYS */;
INSERT INTO `question_sections` VALUES (40,'section a','section A'),(41,'section b','Section B'),(42,'section c','Section C');
/*!40000 ALTER TABLE `question_sections` ENABLE KEYS */;
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
  `name` varchar(255) DEFAULT NULL,
  `url` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role`
--

LOCK TABLES `role` WRITE;
/*!40000 ALTER TABLE `role` DISABLE KEYS */;
/*!40000 ALTER TABLE `role` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_group`
--

DROP TABLE IF EXISTS `role_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_group` (
  `id` int NOT NULL AUTO_INCREMENT,
  `display` bit(1) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_group`
--

LOCK TABLES `role_group` WRITE;
/*!40000 ALTER TABLE `role_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `role_group` ENABLE KEYS */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_role_group_mapping`
--

LOCK TABLES `role_role_group_mapping` WRITE;
/*!40000 ALTER TABLE `role_role_group_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `role_role_group_mapping` ENABLE KEYS */;
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
  `fk_measured_quality_type_id` bigint DEFAULT NULL,
  `fk_option_id` bigint DEFAULT NULL,
  `fk_quality_type` bigint NOT NULL,
  `fk_assessment_questions_option` bigint NOT NULL,
  PRIMARY KEY (`score_id`),
  UNIQUE KEY `uk_option_quality_type` (`fk_option_id`,`fk_measured_quality_type_id`),
  KEY `FKawc8d1cp0fxtrg9x21j1sstns` (`fk_measured_quality_type_id`),
  KEY `FKnbgocbj2oti3pp9tqfm4j4nfa` (`fk_quality_type`),
  KEY `FKkmukl305s2pm2jqb1qjuprm25` (`fk_assessment_questions_option`),
  CONSTRAINT `FKawc8d1cp0fxtrg9x21j1sstns` FOREIGN KEY (`fk_measured_quality_type_id`) REFERENCES `measured_quality_types` (`measured_quality_type_id`),
  CONSTRAINT `FKk0pc9sd7lp3sbxass21lpvbtf` FOREIGN KEY (`fk_option_id`) REFERENCES `assessment_question_options` (`option_id`),
  CONSTRAINT `FKkmukl305s2pm2jqb1qjuprm25` FOREIGN KEY (`fk_assessment_questions_option`) REFERENCES `assessment_question_options` (`option_id`),
  CONSTRAINT `FKnbgocbj2oti3pp9tqfm4j4nfa` FOREIGN KEY (`fk_quality_type`) REFERENCES `measured_quality_types` (`measured_quality_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `score_based_on_measured_quality_types`
--

LOCK TABLES `score_based_on_measured_quality_types` WRITE;
/*!40000 ALTER TABLE `score_based_on_measured_quality_types` DISABLE KEYS */;
INSERT INTO `score_based_on_measured_quality_types` VALUES (57,4,NULL,NULL,46,205),(58,3,NULL,NULL,46,206),(59,2,NULL,NULL,46,207),(60,1,NULL,NULL,46,208),(61,4,NULL,NULL,50,209),(62,3,NULL,NULL,50,210),(63,2,NULL,NULL,50,211),(64,1,NULL,NULL,50,212),(65,4,NULL,NULL,44,213),(66,3,NULL,NULL,44,214),(67,2,NULL,NULL,44,215),(68,1,NULL,NULL,44,216),(69,4,NULL,NULL,53,217),(70,3,NULL,NULL,53,218),(71,2,NULL,NULL,53,219),(72,1,NULL,NULL,53,220),(73,4,NULL,NULL,49,221),(74,3,NULL,NULL,49,222),(75,2,NULL,NULL,49,223),(76,1,NULL,NULL,49,224),(77,4,NULL,NULL,45,225),(78,3,NULL,NULL,45,226),(79,2,NULL,NULL,45,227),(80,1,NULL,NULL,45,228),(81,4,NULL,NULL,42,229),(82,3,NULL,NULL,42,230),(83,2,NULL,NULL,42,231),(84,1,NULL,NULL,42,232),(85,4,NULL,NULL,51,233),(86,3,NULL,NULL,51,234),(87,2,NULL,NULL,51,235),(88,1,NULL,NULL,51,236);
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
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `name` varchar(255) DEFAULT NULL,
  `section_id` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `section_google_group`
--

LOCK TABLES `section_google_group` WRITE;
/*!40000 ALTER TABLE `section_google_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `section_google_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_logs`
--

DROP TABLE IF EXISTS `student_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fname` longtext,
  `lname` varchar(255) DEFAULT NULL,
  `mname` varchar(255) DEFAULT NULL,
  `10th_marks` varchar(255) DEFAULT NULL,
  `10th_roll_no` varchar(255) DEFAULT NULL,
  `10thboard` varchar(255) DEFAULT NULL,
  `12th_marks_chemistry` varchar(255) DEFAULT NULL,
  `12th_marks_maths` varchar(255) DEFAULT NULL,
  `12th_marks_physics` varchar(255) DEFAULT NULL,
  `12th_roll_noss` varchar(255) DEFAULT NULL,
  `12thboardss` varchar(255) DEFAULT NULL,
  `aadhar_card_no` varchar(255) DEFAULT NULL,
  `batch` longtext,
  `branch` longtext,
  `category` varchar(255) DEFAULT NULL,
  `course` longtext,
  `current_address` longtext,
  `dob` longtext,
  `email_address` longtext,
  `father_name` longtext,
  `father_phone_number` varchar(255) DEFAULT NULL,
  `gender` varchar(255) DEFAULT NULL,
  `generate` varchar(255) DEFAULT NULL,
  `hindi_name` varchar(255) DEFAULT NULL,
  `image` longblob,
  `mother_name` longtext,
  `pdf` longblob,
  `permanent_address` longtext,
  `phone_number` varchar(255) DEFAULT NULL,
  `roll no_` decimal(19,2) DEFAULT NULL,
  `studentscol` varchar(255) DEFAULT NULL,
  `timestamp` varchar(255) DEFAULT NULL,
  `updatedby` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `display` bit(1) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `email_verified` bit(1) NOT NULL,
  `google_auth_string` varchar(255) DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `provider` varchar(255) NOT NULL,
  `provider_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_user`
--

LOCK TABLES `student_user` WRITE;
/*!40000 ALTER TABLE `student_user` DISABLE KEYS */;
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
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `input` text,
  `locked` bit(1) DEFAULT NULL,
  `output` text,
  `coding_question_id_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKsg00meo58fsf959f6jlmqixkq` (`coding_question_id_id`),
  CONSTRAINT `FKsg00meo58fsf959f6jlmqixkq` FOREIGN KEY (`coding_question_id_id`) REFERENCES `coding_questions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `10th_marks` varchar(255) DEFAULT NULL,
  `10th_roll_no` varchar(255) DEFAULT NULL,
  `10thboard` int DEFAULT NULL,
  `12th_marks_chemistry` varchar(255) DEFAULT NULL,
  `12th_marks_maths` varchar(255) DEFAULT NULL,
  `12th_marks_physics` varchar(255) DEFAULT NULL,
  `12th_roll_noss` varchar(255) DEFAULT NULL,
  `12thboardss` int DEFAULT NULL,
  `aadhar_card` varchar(255) DEFAULT NULL,
  `aadhar_card_no` varchar(255) DEFAULT NULL,
  `aadhar_card_physical` tinyint DEFAULT NULL,
  `adhaar_card_parents` varchar(255) DEFAULT NULL,
  `adhaar_card_parents_physical` tinyint DEFAULT NULL,
  `affidavit_for_gap` varchar(255) DEFAULT NULL,
  `affidavit_for_gap_physical` tinyint DEFAULT NULL,
  `allotment_letter` varchar(255) DEFAULT NULL,
  `allotment_letter_physical` tinyint DEFAULT NULL,
  `anti_ragging_affidavit` varchar(255) DEFAULT NULL,
  `anti_ragging_affidavit_physical` tinyint DEFAULT NULL,
  `batch_id` int DEFAULT NULL,
  `birthday_mail` varchar(255) DEFAULT NULL,
  `branch_id` int DEFAULT NULL,
  `caste_certificate` varchar(255) DEFAULT NULL,
  `caste_certificate_physical` tinyint DEFAULT NULL,
  `category` int NOT NULL,
  `character_certificate` varchar(255) DEFAULT NULL,
  `character_certificate_physical` tinyint DEFAULT NULL,
  `counselling` bit(1) DEFAULT NULL,
  `course` int DEFAULT NULL,
  `crypto_wallet_address` varchar(255) DEFAULT NULL,
  `current_address` longtext,
  `display` tinyint NOT NULL,
  `dob` longtext,
  `domicile_certificate_up` varchar(255) DEFAULT NULL,
  `domicile_certificate_up_physical` tinyint DEFAULT NULL,
  `ews` bit(1) DEFAULT NULL,
  `father_name` longtext,
  `father_phone_number` varchar(255) DEFAULT NULL,
  `father_photograph` varchar(255) DEFAULT NULL,
  `father_photograph_physical` tinyint DEFAULT NULL,
  `first_name` varchar(255) DEFAULT NULL,
  `gender` int DEFAULT NULL,
  `generate` varchar(255) DEFAULT NULL,
  `google` bit(1) DEFAULT NULL,
  `google_group` varchar(255) DEFAULT NULL,
  `high_school_certificate` varchar(255) DEFAULT NULL,
  `high_school_certificate_physical` tinyint DEFAULT NULL,
  `high_school_marksheet` varchar(255) DEFAULT NULL,
  `high_school_marksheet_physical` tinyint DEFAULT NULL,
  `hindi_name` varchar(255) DEFAULT NULL,
  `home_board_12th` bit(1) DEFAULT NULL,
  `image` longblob,
  `income_certificate` varchar(255) DEFAULT NULL,
  `income_certificate_physical` tinyint DEFAULT NULL,
  `intermediate_certificate` varchar(255) DEFAULT NULL,
  `intermediate_certificate_physical` tinyint DEFAULT NULL,
  `intermediate_marksheet` varchar(255) DEFAULT NULL,
  `intermediate_marksheet_physical` tinyint DEFAULT NULL,
  `ipfs_pdf_url` varchar(255) DEFAULT NULL,
  `ipfs_url` varchar(255) DEFAULT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `medical_certificate` varchar(255) DEFAULT NULL,
  `medical_certificate_physical` tinyint DEFAULT NULL,
  `middle_name` varchar(255) DEFAULT NULL,
  `migration_certificate` varchar(255) DEFAULT NULL,
  `migration_certificate_physical` tinyint DEFAULT NULL,
  `mother_name` longtext,
  `mother_photograph` varchar(255) DEFAULT NULL,
  `mother_photograph_physical` tinyint DEFAULT NULL,
  `nft_hash_code` varchar(255) DEFAULT NULL,
  `official_email_address` longtext,
  `pan_card_parents` varchar(255) DEFAULT NULL,
  `pan_card_parents_physical` tinyint DEFAULT NULL,
  `pdf` longblob,
  `permanent_address` longtext,
  `personal_email_address` longtext,
  `phone_number` varchar(255) DEFAULT NULL,
  `qualified_rank_letter` varchar(255) DEFAULT NULL,
  `qualified_rank_letter_physical` tinyint DEFAULT NULL,
  `roll_no` int DEFAULT NULL,
  `student_photograph` varchar(255) DEFAULT NULL,
  `student_photograph_physical` tinyint DEFAULT NULL,
  `student_signature` varchar(255) DEFAULT NULL,
  `student_signature_physical` tinyint DEFAULT NULL,
  `student_thumb_impression` varchar(255) DEFAULT NULL,
  `student_thumb_impression_physical` tinyint DEFAULT NULL,
  `studentscol` varchar(255) DEFAULT NULL,
  `sub_category` varchar(255) DEFAULT NULL,
  `transfer_certificate` varchar(255) DEFAULT NULL,
  `transfer_certificate_physical` tinyint DEFAULT NULL,
  `type_of_student` varchar(255) DEFAULT NULL,
  `webcam_photo` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`college_enrollment_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tool_measured_quality_mapping`
--

LOCK TABLES `tool_measured_quality_mapping` WRITE;
/*!40000 ALTER TABLE `tool_measured_quality_mapping` DISABLE KEYS */;
INSERT INTO `tool_measured_quality_mapping` VALUES (21,50),(21,51);
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
  `name` varchar(255) DEFAULT NULL,
  `price` double DEFAULT NULL,
  PRIMARY KEY (`tool_id`)
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tools`
--

LOCK TABLES `tools` WRITE;
/*!40000 ALTER TABLE `tools` DISABLE KEYS */;
INSERT INTO `tools` VALUES (50,_binary '','Navigator Pro',0),(51,_binary '\0','Navigator 360',299);
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
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `jsontext` longtext,
  `timestamp` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`roll_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `university_marks`
--

LOCK TABLES `university_marks` WRITE;
/*!40000 ALTER TABLE `university_marks` DISABLE KEYS */;
/*!40000 ALTER TABLE `university_marks` ENABLE KEYS */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `role_group_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKp7x9kle7h9425fw74vdc9oiem` (`role_group_id`),
  CONSTRAINT `FKp7x9kle7h9425fw74vdc9oiem` FOREIGN KEY (`role_group_id`) REFERENCES `role_group` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_role_group_mapping`
--

LOCK TABLES `user_role_group_mapping` WRITE;
/*!40000 ALTER TABLE `user_role_group_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_role_group_mapping` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-09-15 12:14:17
