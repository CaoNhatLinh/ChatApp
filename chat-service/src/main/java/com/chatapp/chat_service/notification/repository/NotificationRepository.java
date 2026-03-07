package com.chatapp.chat_service.notification.repository;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Repository;

import com.chatapp.chat_service.notification.entity.Notification;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationRepository extends CassandraRepository<Notification, UUID> {

    /**
     * Lấy notifications của user theo thời gian (mới nhất đầu tiên)
     */
    @Query("SELECT * FROM notifications WHERE user_id = ?0")
    Slice<Notification> findByUserId(UUID userId, Pageable pageable);

    /**
     * Lấy notifications chưa đọc của user.
     * Requires Secondary Index on is_read column.
     */
    @Query("SELECT * FROM notifications WHERE user_id = ?0 AND is_read = false")
    List<Notification> findUnreadByUserId(UUID userId);

    /**
     * Đếm notifications chưa đọc.
     * Requires Secondary Index on is_read.
     */
    @Query("SELECT COUNT(*) FROM notifications WHERE user_id = ?0 AND is_read = false")
    long countUnreadByUserId(UUID userId);

    /**
     * Lấy notifications theo loại.
     * Requires Secondary Index on type column.
     */
    @Query("SELECT * FROM notifications WHERE user_id = ?0 AND type = ?1")
    Slice<Notification> findByUserIdAndType(UUID userId, String type, Pageable pageable);



    /**
     * Đánh dấu notification đã đọc
     */
    @Query("UPDATE notifications SET is_read = true WHERE user_id = ?0 AND notification_id = ?1")
    void markAsRead(UUID userId, UUID notificationId);

    /**
     * Đánh dấu tất cả notifications đã đọc
     */
    @Query("UPDATE notifications SET is_read = true WHERE user_id = ?0")
    void markAllAsRead(UUID userId);

    /**
     * Xóa notification theo user và notification ID
     */
    @Query("DELETE FROM notifications WHERE user_id = ?0 AND notification_id = ?1")
    void deleteByUserIdAndNotificationId(UUID userId, UUID notificationId);

    /**
     * Xóa tất cả notifications của user
     */
    @Query("DELETE FROM notifications WHERE user_id = ?0")
    void deleteByUserId(UUID userId);

    /**
     * Đếm tổng số notifications của user
     */
    @Query("SELECT COUNT(*) FROM notifications WHERE user_id = ?0")
    long countByUserId(UUID userId);

    /**
     * Đếm notifications theo user và loại
     */
    @Query("SELECT COUNT(*) FROM notifications WHERE user_id = ?0 AND type = ?1")
    long countByUserIdAndType(UUID userId, String type);

    /**
     * Đếm notifications của user được tạo ra sau một ngày nhất định
     */
    @Query("SELECT COUNT(*) FROM notifications WHERE user_id = ?0 AND created_at > ?1")
    long countByUserIdAndCreatedAtAfter(UUID userId, Instant createdAt);

    /**
     * Tìm notifications theo user và khoảng thời gian
     */
    @Query("SELECT * FROM notifications WHERE user_id = ?0 AND created_at >= ?1 AND created_at <= ?2 ORDER BY created_at DESC")
    List<Notification> findByUserIdAndCreatedAtBetween(UUID userId, Instant startDate, Instant endDate);

    /**
     * @deprecated Tìm kiếm Full-text nên dùng Elasticsearch thay vì Cassandra LIKE.
     * Method này giữ lại cho backward compatibility nhưng KHÔNG nên dùng trong Production.
     * Requires Secondary Index on title and body columns.
     */
    @Deprecated
    @Query("SELECT * FROM notifications WHERE user_id = ?0 AND title LIKE ?1 ORDER BY notification_id DESC LIMIT ?2")
    List<Notification> searchByUserIdAndContent(UUID userId, String searchTerm, int limit);

    /**
     * Lấy notification mới nhất cho user
     */
    @Query("SELECT * FROM notifications WHERE user_id = ?0 ORDER BY created_at DESC LIMIT 1")
    Optional<Notification> findLatestByUserId(UUID userId);

    /**
     * Đánh dấu nhiều notifications là đã đọc
     */
    @Query("UPDATE notifications SET is_read = true WHERE user_id = ?0 AND notification_id IN ?1")
    void bulkMarkAsRead(UUID userId, List<UUID> notificationIds);
}