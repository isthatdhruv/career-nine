package com.kccitm.api.controller.career9;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutionException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.school.FirebaseDataMapping;
import com.kccitm.api.repository.Career9.School.FirebaseDataMappingRepository;
import com.kccitm.api.service.FirebaseService;

@RestController
@RequestMapping("/firebase-mapping")
public class FirebaseDataMappingController {

    @Autowired
    private FirebaseDataMappingRepository firebaseDataMappingRepository;

    @Autowired
    private FirebaseService firebaseService;

    @GetMapping("/getAll")
    public List<FirebaseDataMapping> getAll() {
        return firebaseDataMappingRepository.findAll();
    }

    @GetMapping("/getByType/{type}")
    public List<FirebaseDataMapping> getByType(@PathVariable("type") String type) {
        return firebaseDataMappingRepository.findByFirebaseType(type.toUpperCase());
    }

    @GetMapping("/getByParent/{parentId}")
    public List<FirebaseDataMapping> getByParent(@PathVariable("parentId") Long parentId) {
        return firebaseDataMappingRepository.findByParentMappingId(parentId);
    }

    @PostMapping("/save")
    public ResponseEntity<FirebaseDataMapping> save(@RequestBody FirebaseDataMapping mapping) {
        // Normalize firebaseType to uppercase
        if (mapping.getFirebaseType() != null) {
            mapping.setFirebaseType(mapping.getFirebaseType().toUpperCase());
        }
        FirebaseDataMapping saved = firebaseDataMappingRepository.save(mapping);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/save-batch")
    public ResponseEntity<List<FirebaseDataMapping>> saveBatch(@RequestBody List<FirebaseDataMapping> mappings) {
        for (FirebaseDataMapping m : mappings) {
            if (m.getFirebaseType() != null) {
                m.setFirebaseType(m.getFirebaseType().toUpperCase());
            }
        }
        List<FirebaseDataMapping> saved = firebaseDataMappingRepository.saveAll(mappings);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/check/{firebaseId}/{type}")
    public ResponseEntity<FirebaseDataMapping> checkMapping(
            @PathVariable("firebaseId") String firebaseId,
            @PathVariable("type") String type) {
        Optional<FirebaseDataMapping> existing =
            firebaseDataMappingRepository.findByFirebaseIdAndFirebaseType(firebaseId, type.toUpperCase());
        return existing.map(ResponseEntity::ok)
                       .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Fetches all student documents from Firestore "Users" collection,
     * extracts unique school/session/grade/section values, and returns
     * a grouped hierarchy ready for the mapping wizard.
     *
     * Each student document has an "educational" map with fields:
     *   school (String), studentClass (String), session (String, optional), section (String, optional)
     *
     * Returns structure:
     * [
     *   {
     *     "id": "Harvest public school",   // used as firebaseId
     *     "name": "Harvest public school",
     *     "sessions": [
     *       {
     *         "id": "2024-25",
     *         "year": "2024-25",
     *         "grades": [
     *           {
     *             "id": "Harvest public school__2024-25__10",
     *             "name": "10",
     *             "sections": [
     *               { "id": "Harvest public school__2024-25__10__A", "name": "A" }
     *             ]
     *           }
     *         ]
     *       }
     *     ]
     *   }
     * ]
     */
    @GetMapping("/fetch-school-data")
    public ResponseEntity<?> fetchSchoolData() {
        try {
            // Collection is "users" (lowercase) — confirmed from Firebase console
            List<Map<String, Object>> users = firebaseService.getAllDocuments("users");
            if (users.isEmpty()) {
                // Fallback: try capitalized
                users = firebaseService.getAllDocuments("Users");
            }

            // school -> session -> grade -> sections
            // Using LinkedHashMap to preserve insertion order
            Map<String, Map<String, Map<String, Set<String>>>> grouped = new LinkedHashMap<>();

            for (Map<String, Object> user : users) {
                Object eduObj = user.get("educational");
                if (!(eduObj instanceof Map)) continue;

                @SuppressWarnings("unchecked")
                Map<String, Object> edu = (Map<String, Object>) eduObj;

                String school = getString(edu, "school");
                if (school == null || school.trim().isEmpty()) continue;
                school = school.trim();

                // Derive academic session from createdAt timestamp
                // Indian academic year: Apr-Dec → "year-(year+1)", Jan-Mar → "(year-1)-year"
                String session = deriveAcademicSession(user.get("createdAt"));

                String grade = getString(edu, "studentClass");
                if (grade == null || grade.trim().isEmpty()) grade = "Unknown Class";
                else grade = grade.trim();

                String section = getString(edu, "section");
                if (section == null || section.trim().isEmpty()) section = "Unknown Section";
                else section = section.trim();

                grouped
                    .computeIfAbsent(school, k -> new LinkedHashMap<>())
                    .computeIfAbsent(session, k -> new LinkedHashMap<>())
                    .computeIfAbsent(grade, k -> new LinkedHashSet<>())
                    .add(section);
            }

            // Convert to list structure expected by frontend wizard
            List<Map<String, Object>> result = new ArrayList<>();
            for (Map.Entry<String, Map<String, Map<String, Set<String>>>> schoolEntry : grouped.entrySet()) {
                String schoolName = schoolEntry.getKey();
                List<Map<String, Object>> sessionList = new ArrayList<>();

                for (Map.Entry<String, Map<String, Set<String>>> sessionEntry : schoolEntry.getValue().entrySet()) {
                    String sessionYear = sessionEntry.getKey();
                    List<Map<String, Object>> gradeList = new ArrayList<>();

                    for (Map.Entry<String, Set<String>> gradeEntry : sessionEntry.getValue().entrySet()) {
                        String gradeName = gradeEntry.getKey();
                        List<Map<String, Object>> sectionList = new ArrayList<>();

                        for (String sectionName : gradeEntry.getValue()) {
                            Map<String, Object> sectionMap = new LinkedHashMap<>();
                            sectionMap.put("id", schoolName + "__" + sessionYear + "__" + gradeName + "__" + sectionName);
                            sectionMap.put("name", sectionName);
                            sectionList.add(sectionMap);
                        }

                        Map<String, Object> gradeMap = new LinkedHashMap<>();
                        gradeMap.put("id", schoolName + "__" + sessionYear + "__" + gradeName);
                        gradeMap.put("name", gradeName);
                        gradeMap.put("sections", sectionList);
                        gradeList.add(gradeMap);
                    }

                    Map<String, Object> sessionMap = new LinkedHashMap<>();
                    sessionMap.put("id", schoolName + "__" + sessionYear);
                    sessionMap.put("year", sessionYear);
                    sessionMap.put("grades", gradeList);
                    sessionList.add(sessionMap);
                }

                Map<String, Object> schoolMap = new LinkedHashMap<>();
                schoolMap.put("id", schoolName);
                schoolMap.put("name", schoolName);
                schoolMap.put("sessions", sessionList);
                result.add(schoolMap);
            }

            // Wrap with metadata for debugging
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("rawUserCount", users.size());
            response.put("schools", result);
            return ResponseEntity.ok(response);

        } catch (ExecutionException | InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to fetch data from Firebase: " + e.getMessage());
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("Firebase is not initialized. Please check server configuration.");
        }
    }

    /**
     * Derives Indian academic session year from a Firestore Timestamp or Date object.
     * Indian academic year: April–December → "year-(year+1)", January–March → "(year-1)-year"
     * e.g. Feb 2026 → "2025-26", Aug 2025 → "2025-26"
     */
    private String deriveAcademicSession(Object createdAt) {
        try {
            ZonedDateTime dt = null;
            if (createdAt instanceof com.google.cloud.Timestamp) {
                com.google.cloud.Timestamp ts = (com.google.cloud.Timestamp) createdAt;
                dt = Instant.ofEpochSecond(ts.getSeconds(), ts.getNanos())
                        .atZone(ZoneId.of("Asia/Kolkata"));
            } else if (createdAt instanceof java.util.Date) {
                dt = ((java.util.Date) createdAt).toInstant().atZone(ZoneId.of("Asia/Kolkata"));
            }
            if (dt != null) {
                int month = dt.getMonthValue(); // 1=Jan … 12=Dec
                int year = dt.getYear();
                if (month <= 3) {
                    // Jan–Mar: academic year started previous year
                    return (year - 1) + "-" + String.valueOf(year).substring(2);
                } else {
                    // Apr–Dec: academic year started this year
                    return year + "-" + String.valueOf(year + 1).substring(2);
                }
            }
        } catch (Exception ignored) {}
        return "Unknown Session";
    }

    private String getString(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }
}
