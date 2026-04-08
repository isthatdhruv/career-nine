package com.kccitm.api.controller.career9.counselling;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.service.counselling.CounsellorService;

@RestController
@RequestMapping("/api/counsellor")
public class CounsellorController {

    private static final Logger logger = LoggerFactory.getLogger(CounsellorController.class);

    @Autowired
    private CounsellorService counsellorService;

    @PostMapping("/create")
    public ResponseEntity<Counsellor> create(@RequestBody Counsellor counsellor) {
        logger.info("Creating new counsellor: {}", counsellor.getName());
        return ResponseEntity.ok(counsellorService.create(counsellor));
    }

    @GetMapping("/getAll")
    public ResponseEntity<List<Counsellor>> getAll() {
        return ResponseEntity.ok(counsellorService.getAll());
    }

    @GetMapping("/getActive")
    public ResponseEntity<List<Counsellor>> getActive() {
        return ResponseEntity.ok(counsellorService.getAllActive());
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<Counsellor> getById(@PathVariable Long id) {
        return counsellorService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/get/by-user/{userId}")
    public ResponseEntity<Counsellor> getByUserId(@PathVariable Long userId) {
        return counsellorService.getByUserId(userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<Counsellor> update(@PathVariable Long id, @RequestBody Counsellor counsellor) {
        logger.info("Updating counsellor with id: {}", id);
        return ResponseEntity.ok(counsellorService.update(id, counsellor));
    }

    @PutMapping("/toggle-active/{id}")
    public ResponseEntity<Counsellor> toggleActive(@PathVariable Long id) {
        logger.info("Toggling active status for counsellor with id: {}", id);
        return ResponseEntity.ok(counsellorService.toggleActive(id));
    }
}
