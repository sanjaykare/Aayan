package com.example.authdemo.service;

import com.example.authdemo.model.*;
import com.example.authdemo.repository.DocumentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
public class DocumentService {

    @Autowired
    private DocumentRepository repo;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PdfService pdfService;

    public String send(MultipartFile file, String participantsJson,
                       String fieldsJson, String createdBy, String signingOrder) {

        try {

            ObjectMapper mapper = new ObjectMapper();

            List<Participant> participants =
                    mapper.readValue(participantsJson,
                            new TypeReference<List<Participant>>() {});

            List<SignatureField> fields =
                    mapper.readValue(fieldsJson,
                            new TypeReference<List<SignatureField>>() {});

            for (int i = 0; i < participants.size(); i++) {
                participants.get(i).setStatus("pending");
                participants.get(i).setOrderIndex(i);
            }

            Document doc = new Document();
            doc.setFileName(file.getOriginalFilename());
            doc.setFileData(file.getBytes());
            doc.setParticipants(participants);
            doc.setSignatureFields(fields);
            doc.setCreatedBy(createdBy);
            doc.setStatus("pending");
            doc.setCreatedAt(java.time.Instant.now().toString());
            doc.setSigningOrder(signingOrder != null ? signingOrder : "all");

            repo.save(doc);

            if ("sequential".equals(signingOrder)) {
                // Only send email to the first participant (orderIndex == 0)
                Participant first = participants.stream()
                        .filter(p -> p.getOrderIndex() == 0)
                        .findFirst().orElse(null);
                if (first != null) {
                    sendSigningEmail(first, doc.getId(), createdBy);
                }
            } else {
                // Send to all participants at once
                for (Participant p : participants) {
                    sendSigningEmail(p, doc.getId(), createdBy);
                }
            }

            return "Sent for signing";

        } catch (Exception e) {
            return e.getMessage();
        }
    }

    private void sendSigningEmail(Participant p, String docId, String createdBy) {
        String link = "http://localhost:4200/participant-login?docId=" + docId;
        String text = createdBy +
                " has requested your signature.\n\n" +
                "Click here to sign:\n" + link;
        emailService.sendSimpleEmail(
                p.getEmail(),
                "Document Signing Request",
                text
        );
    }

    public Document getById(String id, String email) {
        Document doc = repo.findById(id).orElse(null);
        if (doc != null && email != null && !email.isEmpty()) {
            // Filter fields to only include those belonging to the participant
            List<SignatureField> filteredFields = doc.getSignatureFields().stream()
                    .filter(f -> f.getParticipantEmail().equalsIgnoreCase(email.trim()))
                    .toList();
            doc.setSignatureFields(filteredFields);
        }
        return doc;
    }

    public List<Document> getDocsForUser(String email) {
        // Use optimized DB query that completely skips loading the gigantic fileData bytes
        // and instantly fetches documents tied to this user.
        return repo.findByParticipantEmailWithoutFileData(email);
    }

    public String sign(String docId, String email, String signature) {

        Document doc = repo.findById(docId).orElse(null);

        if (doc == null) return "Not found";

        // Find the signing participant and record their orderIndex
        int signedOrderIndex = -1;
        for (Participant p : doc.getParticipants()) {
            if (p.getEmail().equals(email)) {
                p.setStatus("signed");
                signedOrderIndex = p.getOrderIndex();
            }
        }

        for (SignatureField f : doc.getSignatureFields()) {
            if (f.getParticipantEmail().equals(email)) {
                f.setValue(signature);
            }
        }

        boolean allSigned = doc.getParticipants()
                .stream()
                .allMatch(p -> p.getStatus().equals("signed"));

        if (allSigned) {
            doc.setStatus("completed");

            byte[] signedPdf = pdfService.addSignatures(doc);

            emailService.sendWithAttachment(
                    doc.getCreatedBy(),
                    signedPdf,
                    "signed.pdf"
            );

        } else {
            doc.setStatus("partial");

            // If sequential mode, send email to the next pending participant
            if ("sequential".equals(doc.getSigningOrder()) && signedOrderIndex >= 0) {
                final int nextIndex = signedOrderIndex + 1;
                Participant nextParticipant = doc.getParticipants().stream()
                        .filter(p -> p.getOrderIndex() == nextIndex && "pending".equals(p.getStatus()))
                        .findFirst().orElse(null);
                if (nextParticipant != null) {
                    sendSigningEmail(nextParticipant, doc.getId(), doc.getCreatedBy());
                }
            }
        }

        repo.save(doc);

        return "Signed";
    }

    public List<Document> getDocsSentByAdmin(String email) {
        return repo.findByCreatedByWithoutFileData(email);
    }

    public void deleteById(String id) {
        repo.deleteById(id);
    }
}