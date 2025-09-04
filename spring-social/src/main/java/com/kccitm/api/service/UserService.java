package com.kccitm.api.service;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;

import com.kccitm.api.model.User;
import com.kccitm.api.repository.UserRepository;



@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;
    
    public List<User> updateUser(@RequestBody Map<String,User> currentUser) {
        User r = currentUser.get("values");
		userRepository.save(r);
        return userRepository.findByName(r.getName());
    }
}
