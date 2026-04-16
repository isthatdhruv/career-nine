package com.kccitm.api.repository.Career9.counselling;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.BlockDateRequest;

@Repository
public interface BlockDateRequestRepository extends JpaRepository<BlockDateRequest, Long> {

    List<BlockDateRequest> findByCounsellorId(Long counsellorId);

    List<BlockDateRequest> findByCounsellorIdAndStatus(Long counsellorId, String status);

    List<BlockDateRequest> findByStatus(String status);
}
