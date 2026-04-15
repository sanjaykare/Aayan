package com.example.authdemo.controller;

import com.example.authdemo.model.Document;
import com.example.authdemo.service.DocumentService;
import com.example.authdemo.service.EmailService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents")
@CrossOrigin(origins = "*")
public class DocumentController {

    @Autowired
    private DocumentService service;

    @Autowired
    private EmailService emailService;

    @Autowired
    private com.example.authdemo.service.PdfService pdfService;

    @GetMapping("/test-email")
    public String testEmail() {
        emailService.sendSimpleEmail(
                "zutshiaayan@gmail.com",
                "Test Email",
                "Email is working"
        );
        return "Email sent";
    }

    @PostMapping("/send-for-signing")
    public String sendForSigning(
            @RequestParam("file") MultipartFile file,
            @RequestParam("participants") String participants,
            @RequestParam("signatureFields") String fields,
            @RequestParam("createdBy") String createdBy,
            @RequestParam(value = "signingOrder", defaultValue = "all") String signingOrder
    ) {
        return service.send(file, participants, fields, createdBy, signingOrder);
    }

    @GetMapping("/get/{id}")
    public Document getDocument(
            @PathVariable("id") String id,
            @RequestParam(value = "email", required = false) String email
    ) {
        return service.getById(id, email);
    }

    @GetMapping(value = "/get/{id}/pdf", produces = org.springframework.http.MediaType.APPLICATION_PDF_VALUE)
    public @ResponseBody byte[] getDocumentPdf(
            @PathVariable("id") String id,
            @RequestParam(value = "email", required = false) String email
    ) {
        Document doc = service.getById(id, null); // get full document with all fields
        if (doc == null) return null;

        // If email provided, generate PDF with only that participant's signature
        if (email != null && !email.isEmpty()) {
            byte[] result = pdfService.addSignaturesForParticipant(doc, email);
            return result != null ? result : doc.getFileData();
        }

        // No email = return the raw original PDF
        return doc.getFileData();
    }

    @GetMapping("/user/{email}")
    public List<Document> getDocs(@PathVariable("email") String email) {
        return service.getDocsForUser(email);
    }

    @PostMapping("/sign")
    public String sign(@RequestBody Map<String, String> req) {
        return service.sign(
                req.get("docId"),
                req.get("email"),
                req.get("signature")
        );
    }
    @GetMapping("/sent-by/{email}")
    public List<Document> getSentByAdmin(@PathVariable("email") String email) {
        return service.getDocsSentByAdmin(email);
    }

    @DeleteMapping("/{id}")
    public void deleteDocument(@PathVariable("id") String id) {
        service.deleteById(id);
    }
}