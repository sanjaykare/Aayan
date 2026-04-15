package com.example.authdemo.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document(collection = "activity_logs")
public class ActivityLog {

    @Id
    private String id;

    private String docId;
    private String participantEmail;
    private String action; // LOGGED_IN, VIEWED_DASHBOARD, OPENED_PDF, SIGNED_PDF
    private String timestamp;
}
