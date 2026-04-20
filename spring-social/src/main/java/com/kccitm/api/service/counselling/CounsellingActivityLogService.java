package com.kccitm.api.service.counselling;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellingActivityLog;
import com.kccitm.api.repository.Career9.counselling.CounsellingActivityLogRepository;

@Service
public class CounsellingActivityLogService {

    @Autowired
    private CounsellingActivityLogRepository logRepository;

    public void log(String type, String title, String description, Counsellor counsellor, String actorName) {
        CounsellingActivityLog entry = new CounsellingActivityLog();
        entry.setActivityType(type);
        entry.setTitle(title);
        entry.setDescription(description);
        entry.setCounsellor(counsellor);
        entry.setActorName(actorName);
        logRepository.save(entry);
    }

    public void log(String type, String title, String description, Counsellor counsellor) {
        log(type, title, description, counsellor, counsellor != null ? counsellor.getName() : null);
    }
}
