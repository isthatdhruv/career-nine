package com.kccitm.api.service.mail;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class MailAudienceRegistry {

    @Autowired(required = false)
    private List<MailAudience> audiences;

    public List<MailAudience> all() {
        return audiences == null ? Collections.emptyList() : audiences;
    }

    public MailAudience byKey(String key) {
        if (key == null) return null;
        for (MailAudience a : all()) {
            if (key.equals(a.key())) return a;
        }
        return null;
    }

    public List<Map<String, Object>> describe() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (MailAudience a : all()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", a.key());
            m.put("label", a.label());
            m.put("description", a.description());
            out.add(m);
        }
        return out;
    }
}
