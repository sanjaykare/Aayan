package com.example.authdemo.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;
import org.springframework.data.mongodb.core.index.CompoundIndex;

@Data
@org.springframework.data.mongodb.core.mapping.Document
@CompoundIndex(name = "participant_email_idx", def = "{'participants.email': 1}")
public class Document {

    @Id
    private String id;

    private String fileName;

    @JsonIgnore
    private byte[] fileData;

    private String createdBy;
    private List<Participant> participants;
    private List<SignatureField> signatureFields;

    private String status;
    private String createdAt;
    private String signingOrder; // "all" or "sequential"
}