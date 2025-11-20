package com.kccitm.api.controller.career9;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.List;
import com.kccitm.api.repository.career9.CounsellorRepository;
import com.kccitm.api.model.career9.Counsellor;


@RestController
@RequestMapping("/counsellor")
public class CounsellorController {
    @Autowired
    private CounsellorRepository counsellorRepository;
    
    @GetMapping("/all")
    public List<Counsellor> getAllCounsellors() {
        return counsellorRepository.findAll();
    }

    @PostMapping("/add")
    public Counsellor addCounsellor(@RequestBody Counsellor counsellor) {
        return counsellorRepository.save(counsellor);
    }
}