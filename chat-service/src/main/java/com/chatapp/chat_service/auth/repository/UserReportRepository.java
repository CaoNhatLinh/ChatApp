package com.chatapp.chat_service.auth.repository;

import com.chatapp.chat_service.auth.entity.UserReport;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserReportRepository extends CassandraRepository<UserReport, UserReport.UserReportKey> {

    @Query("SELECT * FROM user_reports WHERE reported_user_id = ?0")
    List<UserReport> findByReportedUserId(UUID reportedUserId);

    @Query("SELECT * FROM user_reports WHERE status = ?0 ALLOW FILTERING")
    List<UserReport> findByStatus(String status);

    @Query("SELECT * FROM user_reports WHERE reviewed_by = ?0 ALLOW FILTERING")
    List<UserReport> findByReviewedBy(UUID reviewedBy);
}
