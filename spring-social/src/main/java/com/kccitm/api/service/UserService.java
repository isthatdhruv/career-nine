package com.kccitm.api.service;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;

import com.kccitm.api.model.User;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.security.audit.SensitiveOp;



@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;

    /**
     * Mutates a {@link User} entity. Annotated {@code @SensitiveOp("user.write")}
     * per Plan 20-02 — every invocation writes one {@code auth_audit} row via
     * {@link com.kccitm.api.security.audit.SensitiveOpAspect} (ALLOW on success,
     * DENY on exception). This is currently the only public mutation method on
     * {@code UserService}; if more user-write paths are added later (create,
     * delete, password-reset, role assign, etc.) each MUST carry the same
     * {@code @SensitiveOp("user.write")} annotation.
     */
    @SensitiveOp("user.write")
    public List<User> updateUser(@RequestBody Map<String,User> currentUser) {
        User r = currentUser.get("values");
		userRepository.save(r);
        return userRepository.findByName(r.getName());
    }
}
