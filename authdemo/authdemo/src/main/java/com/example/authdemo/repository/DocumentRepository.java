package com.example.authdemo.repository;

import com.example.authdemo.model.Document;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface DocumentRepository extends MongoRepository<Document, String> {
    
    // The "fields" parameter completely strips both the raw PDF bytes AND the heavy Base64 signature images
    @Query(value = "{ 'participants.email': ?0 }", fields = "{ 'fileData': 0, 'signatureFields': 0 }")
    List<Document> findByParticipantEmailWithoutFileData(String email);

    // Fetch documents created/sent by an admin, without heavy binary data
    @Query(value = "{ 'createdBy': ?0 }", fields = "{ 'fileData': 0, 'signatureFields': 0 }")
    List<Document> findByCreatedByWithoutFileData(String createdBy);

}