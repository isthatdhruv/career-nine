package com.kccitm.api.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.school.SchoolSections;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.Career9.School.SchoolSectionsRepository;

@Service
public class CareerNineRollNumberService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SchoolSectionsRepository schoolSectionsRepository;

    /**
     * Generate the next careerNineRollNumber for a given institute + section.
     * Format: {SectionName}{3-digit-number}, e.g., "A001", "B002".
     * Scoped per institute + section (independent numbering per institute).
     */
    public synchronized String generateNextRollNumber(Integer instituteId, Integer sectionId) {
        if (instituteId == null || sectionId == null) {
            return null;
        }

        SchoolSections section = schoolSectionsRepository.findById(sectionId).orElse(null);
        if (section == null) {
            return null;
        }

        String sectionName = section.getSectionName();
        if (sectionName == null || sectionName.isEmpty()) {
            return null;
        }

        List<String> existingRollNumbers = userRepository.findRollNumbersByInstituteAndSection(
                instituteId, sectionId);

        int maxNumber = 0;
        for (String rollNumber : existingRollNumbers) {
            if (rollNumber != null && rollNumber.startsWith(sectionName)) {
                try {
                    int num = Integer.parseInt(rollNumber.substring(sectionName.length()));
                    if (num > maxNumber) {
                        maxNumber = num;
                    }
                } catch (NumberFormatException e) {
                    // Skip malformed roll numbers
                }
            }
        }

        int nextNumber = maxNumber + 1;
        if (nextNumber <= 999) {
            return String.format("%s%03d", sectionName, nextNumber);
        } else {
            return String.format("%s%d", sectionName, nextNumber);
        }
    }
}
