package com.kccitm.api.repository.Career9;

import java.time.LocalDateTime;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.CommunicationLog;

@Repository
public interface CommunicationLogRepository extends JpaRepository<CommunicationLog, Long> {

    /**
     * Paginated, filterable search.
     * Any of channel/messageType/status/search/fromDate/toDate can be null to skip that filter.
     * `search` matches against recipient_name, recipient_email, or recipient_phone.
     */
    @Query("SELECT c FROM CommunicationLog c WHERE " +
           "(:channel IS NULL OR c.channel = :channel) AND " +
           "(:messageType IS NULL OR c.messageType = :messageType) AND " +
           "(:status IS NULL OR c.status = :status) AND " +
           "(:search IS NULL OR " +
           "   LOWER(COALESCE(c.recipientName, '')) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "   LOWER(COALESCE(c.recipientEmail, '')) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "   LOWER(COALESCE(c.recipientPhone, '')) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
           "(:fromDate IS NULL OR c.createdAt >= :fromDate) AND " +
           "(:toDate IS NULL OR c.createdAt <= :toDate) " +
           "ORDER BY c.createdAt DESC")
    Page<CommunicationLog> search(
            @Param("channel") String channel,
            @Param("messageType") String messageType,
            @Param("status") String status,
            @Param("search") String search,
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            Pageable pageable);
}
