package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.User;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    User findByEmail(String email);

    // Optional<User> findByT(String email);
    Boolean existsByEmail(String email);

    public List<User> findByDisplay(Boolean display);

    public List<User> findByName(String Name);

    public User getOne(Long id);

    public Optional<User> findById(Long id);

}
