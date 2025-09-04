package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Role;

@Repository
public interface RoleRepository extends JpaRepository<Role, Integer> {

    public List<Role> findAll();

    public List<Role> findByDisplay(Boolean display);

    public List<Role> findByName(String Name);

    public Role getOne(int id);

    public Optional<Role> findById(int id);


    @Query(value ="SELECT * FROM role r WHERE r.display = true", nativeQuery = true)
    public List<Role> findByRole();
    // public Role findByID(int id);
}