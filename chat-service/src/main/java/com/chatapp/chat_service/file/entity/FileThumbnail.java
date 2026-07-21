package com.chatapp.chat_service.file.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyClass;
import org.springframework.data.cassandra.core.mapping.Table;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Table("file_thumbnails")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileThumbnail {

    @PrimaryKey
    private FileThumbnailKey key;

    @Column("thumbnail_url")
    private String thumbnailUrl;

    @Column("thumbnail_size")
    private int thumbnailSize;

    @Column("thumbnail_width")
    private Integer thumbnailWidth;

    @Column("thumbnail_height")
    private Integer thumbnailHeight;

    @Column("thumbnail_type")
    private String thumbnailType; // SMALL, MEDIUM, LARGE

    @Column("created_at")
    private Instant createdAt;

    @Column("file_size")
    private Long fileSize;

    @Column("file_type")
    private String fileType;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @PrimaryKeyClass
    public static class FileThumbnailKey implements Serializable {
        @Column("file_id")
        private UUID fileId;

        @Column("thumbnail_type")
        private String thumbnailType;
    }
}
