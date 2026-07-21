package com.chatapp.chat_service.auth.service;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.entity.UserReport;
import com.chatapp.chat_service.auth.repository.UserReportRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.chatapp.chat_service.kafka.KafkaEventProducer;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserReportService {

    private final UserReportRepository userReportRepository;
    private final UserService userService;
    private final KafkaEventProducer kafkaEventProducer;

    /**
     * Report a user
     */
    @Transactional
    public UserReport reportUser(UUID reporterId, UUID reportedUserId, String reason, String description) {
        // Cannot report yourself
        if (reporterId.equals(reportedUserId)) {
            throw new BadRequestException("Cannot report yourself");
        }

        // Check if reported user exists
        try {
            userService.getUserProfile(reportedUserId);
        } catch (Exception e) {
            throw new NotFoundException("User not found");
        }

        // Create report
        UUID reportId = Uuids.timeBased();
        UserReport.UserReportKey key = new UserReport.UserReportKey(reportId, reportedUserId);

        UserReport report = UserReport.builder()
                .key(key)
                .reportedAt(Instant.now())
                .reason(reason)
                .description(description)
                .status("PENDING")
                .build();

        userReportRepository.save(report);

        // Publish event
        kafkaEventProducer.publishUserReportEvent(reportId, reporterId, reportedUserId, reason);

        log.info("User {} reported user {} for reason: {}", reporterId, reportedUserId, reason);

        return report;
    }

    /**
     * Get all reports for a user
     */
    public List<UserReport> getReportsForUser(UUID reportedUserId) {
        return userReportRepository.findByReportedUserId(reportedUserId);
    }

    /**
     * Get all pending reports (for admin)
     */
    public List<UserReport> getPendingReports() {
        return userReportRepository.findByStatus("PENDING");
    }

    /**
     * Review a report (for admin)
     */
    @Transactional
    public void reviewReport(UUID reportId, UUID adminId, String status, String resolutionNote) {
        List<UserReport> reports = userReportRepository.findByReportedUserId(reportId);

        UserReport report = reports.stream()
                .filter(r -> r.getKey().getReportId().equals(reportId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Report not found"));

        report.setStatus(status);
        report.setReviewedBy(adminId);
        report.setReviewedAt(Instant.now());
        report.setResolutionNote(resolutionNote);

        userReportRepository.save(report);

        log.info("Report {} reviewed by admin {} with status: {}", reportId, adminId, status);
    }

    /**
     * Get reports by status (for admin)
     */
    public List<UserReport> getReportsByStatus(String status) {
        return userReportRepository.findByStatus(status);
    }
}
