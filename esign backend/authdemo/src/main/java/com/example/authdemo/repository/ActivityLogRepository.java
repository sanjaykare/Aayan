package com.example.authdemo.repository;

import com.example.authdemo.model.ActivityLog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ActivityLogRepository extends MongoRepository<ActivityLog, String> {

    List<ActivityLog> findByDocIdOrderByTimestampDesc(String docId);

    List<ActivityLog> findByDocIdAndParticipantEmailOrderByTimestampDesc(String docId, String participantEmail);
}
