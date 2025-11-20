package com.kccitm.api.controller.career9;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Autowired;
import com.kccitm.api.repository.Career9.AdminRepository;
import com.kccitm.api.model.career9.Admin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.List;

@RestController
@RequestMapping("/admin")
public class AdminController {

    @Autowired
    private AdminRepository adminRepository;

    @GetMapping("/all")
    public List<Admin> getAllAdmins() {
        return adminRepository.findAll();
    }
    
    @PostMapping("/add")
    public Admin addAdmin(@RequestBody Admin admin) {
        return adminRepository.save(admin);
    }

    
}
