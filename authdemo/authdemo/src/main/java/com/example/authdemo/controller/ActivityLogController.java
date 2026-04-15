package com.example.authdemo.controller;

import com.example.authdemo.model.ActivityLog;
import com.example.authdemo.repository.ActivityLogRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/activity")
@CrossOrigin(origins = "*")
public class ActivityLogController {

    @Autowired
    private ActivityLogRepository repo;

    /**
     * Record a new activity event.
     * Body: { "docId": "...", "participantEmail": "...", "action": "LOGGED_IN" }
     */
    @PostMapping("/log")
    public String logActivity(@RequestBody Map<String, String> body) {
        ActivityLog log = new ActivityLog();
        log.setDocId(body.get("docId"));
        log.setParticipantEmail(body.get("participantEmail"));
        log.setAction(body.get("action"));
        log.setTimestamp(Instant.now().toString());
        repo.save(log);
        return "Logged";
    }

    /**
     * Get all activity logs for a document (admin overview).
     */
    @GetMapping("/{docId}")
    public List<ActivityLog> getLogsForDocument(@PathVariable("docId") String docId) {
        return repo.findByDocIdOrderByTimestampDesc(docId);
    }

    /**
     * Get activity logs for a specific participant on a document.
     */
    @GetMapping("/{docId}/{email}")
    public List<ActivityLog> getLogsForParticipant(
            @PathVariable("docId") String docId,
            @PathVariable("email") String email
    ) {
        return repo.findByDocIdAndParticipantEmailOrderByTimestampDesc(docId, email);
    }

    /**
     * Clear all activity logs for a specific participant on a document.
     */
    @DeleteMapping("/{docId}/{email}")
    public String clearLogsForParticipant(
            @PathVariable("docId") String docId,
            @PathVariable("email") String email
    ) {
        List<ActivityLog> logs = repo.findByDocIdAndParticipantEmailOrderByTimestampDesc(docId, email);
        repo.deleteAll(logs);
        return "Cleared";
    }
}
