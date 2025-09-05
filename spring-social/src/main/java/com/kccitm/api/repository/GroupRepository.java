package com.kccitm.api.repository;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Group;




@Repository
public interface GroupRepository extends JpaRepository<Group, Integer> {



    // public List<Group> findByDisplay(Boolean display);

    // public List<Group> findByName(String Name);

    public Group getOne(int id);



    public Group findById(int id);

    
}
