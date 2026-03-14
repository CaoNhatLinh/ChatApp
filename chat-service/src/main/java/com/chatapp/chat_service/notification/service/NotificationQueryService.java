package com.chatapp.chat_service.notification.service;

import com.chatapp.chat_service.notification.dto.NotificationDto;
import com.chatapp.chat_service.notification.dto.NotificationStatsDto;
import com.chatapp.chat_service.notification.entity.Notification;
import com.chatapp.chat_service.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import com.chatapp.chat_service.elasticsearch.service.NotificationElasticsearchService;

/**
 * Handles querying and reading notifications:
 * paginated lists, filtering, search, stats, unread count
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationQueryService {

    private final NotificationRepository notificationRepository;
    private final RedisTemplate<String, Object> redisTemplate;
    private final NotificationHelper helper;

    public NotificationService.NotificationPage getNotifications(UUID userId, int page, int size) {
        String cacheKey = "user_notifications:" + userId + ":" + page + ":" + size;

        @SuppressWarnings("unchecked")
        List<NotificationDto> cached = (List<NotificationDto>) redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            boolean hasNext = cached.size() == size;
            return new NotificationService.NotificationPage(cached, hasNext, !cached.isEmpty());
        }

        Pageable pageable = PageRequest.of(page, size);
        Slice<Notification> notifications = notificationRepository.findByUserId(userId, pageable);

        List<NotificationDto> dtos = notifications.getContent().stream()
                .map(helper::mapToDto)
                .collect(Collectors.toList());

        redisTemplate.opsForValue().set(cacheKey, dtos, Duration.ofMinutes(10));
        return new NotificationService.NotificationPage(dtos, notifications.hasNext(), notifications.hasContent());
    }

    public NotificationService.NotificationPage getNotifications(UUID userId, Pageable pageable) {
        return getNotifications(userId, pageable.getPageNumber(), pageable.getPageSize());
    }

    public NotificationService.NotificationPage getNotificationsByType(UUID userId, String type, int page, int size) {
        String cacheKey = "user_notifications_type:" + userId + ":" + type + ":" + page + ":" + size;

        @SuppressWarnings("unchecked")
        List<NotificationDto> cached = (List<NotificationDto>) redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            boolean hasNext = cached.size() == size;
            return new NotificationService.NotificationPage(cached, hasNext, !cached.isEmpty());
        }

        Pageable pageable = PageRequest.of(page, size);
        Slice<Notification> notifications = notificationRepository.findByUserIdAndType(userId, type, pageable);

        List<NotificationDto> dtos = notifications.getContent().stream()
                .map(helper::mapToDto)
                .collect(Collectors.toList());

        redisTemplate.opsForValue().set(cacheKey, dtos, Duration.ofMinutes(10));
        return new NotificationService.NotificationPage(dtos, notifications.hasNext(), notifications.hasContent());
    }

    public Long getUnreadCount(UUID userId) {
        String cacheKey = "unread_count:" + userId;
        Long cachedCount = (Long) redisTemplate.opsForValue().get(cacheKey);
        if (cachedCount != null) return cachedCount;

        long count = notificationRepository.countUnreadByUserId(userId);
        redisTemplate.opsForValue().set(cacheKey, count, Duration.ofMinutes(5));
        return count;
    }

    public boolean hasUnreadNotifications(UUID userId) {
        return getUnreadCount(userId) > 0;
    }

    public List<NotificationDto> getUnreadNotifications(UUID userId) {
        String cacheKey = "unread_notifications:" + userId;

        @SuppressWarnings("unchecked")
        List<NotificationDto> cached = (List<NotificationDto>) redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) return cached;

        List<Notification> notifications = notificationRepository.findUnreadByUserId(userId);
        List<NotificationDto> dtos = notifications.stream()
                .map(helper::mapToDto)
                .collect(Collectors.toList());

        redisTemplate.opsForValue().set(cacheKey, dtos, Duration.ofMinutes(5));
        return dtos;
    }

    public Optional<NotificationDto> getLatestNotification(UUID userId) {
        return notificationRepository.findLatestByUserId(userId).map(helper::mapToDto);
    }

    public List<NotificationDto> getNotificationsByDateRange(UUID userId, Instant startDate, Instant endDate) {
        return notificationRepository.findByUserIdAndCreatedAtBetween(userId, startDate, endDate).stream()
                .map(helper::mapToDto)
                .collect(Collectors.toList());
    }

    @Autowired(required = false)
    private NotificationElasticsearchService elasticsearchService;


    public List<NotificationDto> searchNotifications(UUID userId, String searchTerm, int limit) {
        if (elasticsearchService != null) {
            return elasticsearchService.searchNotifications(userId, searchTerm, limit).stream()
                    .map(helper::mapToDto)
                    .collect(Collectors.toList());
        }
        
        // Fallback to old deprecated method if Elasticsearch is disabled
        return searchNotificationsFallback(userId, searchTerm, limit);
    }
    
    @SuppressWarnings("deprecation")
    private List<NotificationDto> searchNotificationsFallback(UUID userId, String searchTerm, int limit) {
        return notificationRepository.searchByUserIdAndContent(userId, searchTerm, limit).stream()
                .map(helper::mapToDto)
                .collect(Collectors.toList());
    }

    public NotificationStatsDto getNotificationStats(UUID userId) {
        String cacheKey = "notification_stats:" + userId;
        NotificationStatsDto cached = (NotificationStatsDto) redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) return cached;

        long totalCount = notificationRepository.countByUserId(userId);
        long unreadCount = notificationRepository.countUnreadByUserId(userId);
        Instant weekAgo = Instant.now().minus(7, ChronoUnit.DAYS);
        long weeklyCount = notificationRepository.countByUserIdAndCreatedAtAfter(userId, weekAgo);

        List<String> types = List.of("MESSAGE", "REACTION", "MENTION", "REPLY", "FRIEND_REQUEST", "CONVERSATION_INVITE", "POLL", "PIN_MESSAGE", "SYSTEM");
        
        Map<String, Long> typeStats = types.parallelStream()
                .map(type -> new AbstractMap.SimpleEntry<>(type, notificationRepository.countByUserIdAndType(userId, type)))
                .filter(entry -> entry.getValue() > 0)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

        NotificationStatsDto stats = NotificationStatsDto.builder()
                .userId(userId)
                .totalCount(totalCount)
                .unreadCount(unreadCount)
                .readCount(totalCount - unreadCount)
                .weeklyCount(weeklyCount)
                .typeStats(typeStats)
                .lastUpdated(Instant.now())
                .build();

        redisTemplate.opsForValue().set(cacheKey, stats, Duration.ofHours(1));
        return stats;
    }
}
