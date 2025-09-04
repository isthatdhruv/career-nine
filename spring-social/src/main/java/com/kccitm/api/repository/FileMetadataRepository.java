package com.kccitm.api.repository;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.FileMetadata;

@Repository
public interface FileMetadataRepository extends JpaRepository<FileMetadata, Integer>{
    public List<FileMetadata> findByName(String Name);
}
