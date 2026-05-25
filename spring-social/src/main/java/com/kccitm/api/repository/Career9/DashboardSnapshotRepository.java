package com.kccitm.api.repository.Career9;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.career9.DashboardSnapshot;

public interface DashboardSnapshotRepository extends JpaRepository<DashboardSnapshot, Long> {

    Optional<DashboardSnapshot> findBySnapshotKey(String snapshotKey);
}
