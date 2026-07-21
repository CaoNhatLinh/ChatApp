package com.chatapp.chat_service.file.repository;

import com.chatapp.chat_service.file.entity.FileThumbnail;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FileThumbnailRepository extends CassandraRepository<FileThumbnail, FileThumbnail.FileThumbnailKey> {

    @Query("SELECT * FROM file_thumbnails WHERE file_id = ?0")
    List<FileThumbnail> findByFileId(UUID fileId);

    @Query("SELECT * FROM file_thumbnails WHERE file_id = ?0 AND thumbnail_type = ?1")
    FileThumbnail findByFileIdAndThumbnailType(UUID fileId, String thumbnailType);

    @Query("DELETE FROM file_thumbnails WHERE file_id = ?0")
    void deleteByFileId(UUID fileId);

    @Query("DELETE FROM file_thumbnails WHERE file_id = ?0 AND thumbnail_type = ?1")
    void deleteByFileIdAndThumbnailType(UUID fileId, String thumbnailType);
}
