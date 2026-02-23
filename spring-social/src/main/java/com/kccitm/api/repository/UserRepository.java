package com.kccitm.api.repository;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.AuthProvider;
import com.kccitm.api.model.User;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    List<User> findByProviderNot(AuthProvider provider);

    User findByEmail(String email);

    // Optional<User> findByT(String email);
    Boolean existsByEmail(String email);

    Boolean existsByPhone(String phone);

    public List<User> findByDisplay(Boolean display);

    public List<User> findByName(String Name);

    public User getOne(Long id);

    public Optional<User> findById(Long id);

    @Query("SELECT u FROM User u WHERE u.username = :username AND DATE(u.dobDate) = DATE(:dobDate)")
    Optional<User> findByUsernameAndDobDate(@Param("username") String username, @Param("dobDate") Date dobDate);
}
