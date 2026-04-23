package com.example.authdemo.service;

import com.example.authdemo.model.Document;
import com.example.authdemo.model.SignatureField;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.interactive.digitalsignature.PDSignature;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.Certificate;
import java.util.Arrays;
import java.util.Base64;
import java.util.Calendar;
import java.util.List;

@Service
public class PdfService {

    private static final float SIG_WIDTH_RATIO = 0.20f;
    private static final float SIG_ASPECT_RATIO = 80f / 220f;

    /** Render ALL signatures onto the PDF (used for admin email) */
    public byte[] addSignatures(Document doc) {
        return renderSignatures(doc.getFileData(), doc.getSignatureFields(), true);
    }

    /**
     * Render ALL signed signatures onto the PDF for participant download.
     * Shows every signature that has been submitted so far (not just theirs).
     */
    public byte[] addSignaturesForParticipant(Document doc, String email) {
        // Render ALL signatures that have a value (i.e. all signed ones), not just this participant's
        List<SignatureField> signed = doc.getSignatureFields().stream()
                .filter(f -> f.getValue() != null)
                .toList();
        return renderSignatures(doc.getFileData(), signed, false);
    }

    /**
     * Core rendering: stamp signature images onto PDF pages.
     * @param applyDigitalSig whether to apply the cryptographic digital signature (only for final completed docs)
     */
    private byte[] renderSignatures(byte[] pdfData, List<SignatureField> fields, boolean applyDigitalSig) {
        byte[] renderedPdf = null;
        try {
            PDDocument pdf = PDDocument.load(pdfData);
            java.util.Map<Integer, Integer> pageStampCounts = new java.util.HashMap<>();

            for (SignatureField field : fields) {
                if (field.getValue() == null) continue;

                String base64 = field.getValue().split(",")[1];
                byte[] imageBytes = Base64.getDecoder().decode(base64);

                PDImageXObject image =
                        PDImageXObject.createFromByteArray(pdf, imageBytes, "sig");

                int pageIndex = field.getPage() - 1;
                if (pageIndex < 0 || pageIndex >= pdf.getNumberOfPages()) continue;

                PDPage page = pdf.getPage(pageIndex);
                PDRectangle mediaBox = page.getMediaBox();
                float pageWidth = mediaBox.getWidth();
                float pageHeight = mediaBox.getHeight();

                float xPercent = field.getX();
                float yPercent = field.getY();

                float sigWidth = pageWidth * SIG_WIDTH_RATIO;
                float sigHeight = sigWidth * SIG_ASPECT_RATIO;

                float xPos = (xPercent / 100f) * pageWidth;
                float yFromTop = (yPercent / 100f) * pageHeight;
                float yPos = pageHeight - yFromTop - sigHeight;

                PDPageContentStream content =
                        new PDPageContentStream(pdf, page,
                                PDPageContentStream.AppendMode.APPEND, true);

                content.drawImage(image, xPos, yPos, sigWidth, sigHeight);

                // Add visual certificate stamp at the bottom of the page
                int stampCount = pageStampCounts.getOrDefault(pageIndex, 0);
                float yTextPos = 15 + (stampCount * 12); // start 15 units from bottom, stack upwards
                
                content.beginText();
                content.setFont(org.apache.pdfbox.pdmodel.font.PDType1Font.HELVETICA, 8);
                content.newLineAtOffset(15, yTextPos);
                
                String timestamp = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss z").format(new java.util.Date());
                content.showText("Digitally Signed by: " + field.getParticipantEmail() + " | Date: " + timestamp + " | Secured by KareXpert");
                content.endText();
                
                pageStampCounts.put(pageIndex, stampCount + 1);

                content.close();
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            pdf.save(out);
            pdf.close();

            renderedPdf = out.toByteArray();

        } catch (Exception e) {
            System.err.println("ERROR rendering signatures onto PDF:");
            e.printStackTrace();
            return null;
        }

        // Apply encryption + cryptographic digital signature only for final completed documents
        if (applyDigitalSig && renderedPdf != null) {
            try {
                // Step 1: Encrypt the PDF (lock editing permissions)
                byte[] encryptedPdf = applyEncryption(renderedPdf);
                // Step 2: Apply digital signature on the encrypted PDF
                return applyDigitalSignature(encryptedPdf);
            } catch (Exception e) {
                System.err.println("WARNING: Encryption/Digital signature failed, returning PDF without crypto seal:");
                e.printStackTrace();
                // Fall back to the rendered PDF without security rather than returning null
                return renderedPdf;
            }
        }

        return renderedPdf;
    }

    /**
     * Pass 1: Apply encryption to lock the PDF from editing/copying.
     * The document opens without a password but cannot be modified.
     */
    private byte[] applyEncryption(byte[] pdfBytes) throws Exception {
        try (PDDocument pdf = PDDocument.load(pdfBytes)) {
            AccessPermission ap = new AccessPermission();
            ap.setCanModify(false);
            ap.setCanExtractContent(false);
            ap.setCanExtractForAccessibility(false); // Disables "Content copying for accessibility"
            ap.setCanModifyAnnotations(false);
            ap.setCanFillInForm(false);

            StandardProtectionPolicy spp = new StandardProtectionPolicy(
                    java.util.UUID.randomUUID().toString(), "", ap);
            spp.setEncryptionKeyLength(128);
            spp.setPermissions(ap);
            pdf.protect(spp);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            pdf.save(out);
            return out.toByteArray();
        }
    }

    /**
     * Pass 2: Apply a PKCS7 cryptographic digital signature to the PDF.
     * This makes the PDF tamper-proof: any modification after signing
     * will be flagged by Adobe Acrobat Reader.
     */
    private byte[] applyDigitalSignature(byte[] pdfBytes) throws Exception {
        // Load the encrypted PDF fresh for incremental signing
        try (PDDocument pdf = PDDocument.load(pdfBytes, "")) {

            // Load Keystore
            KeyStore keystore = KeyStore.getInstance("PKCS12");
            try (InputStream is = new ClassPathResource("esign_keystore.p12").getInputStream()) {
                keystore.load(is, "password123".toCharArray());
            }
            CustomPdfSigner signer = new CustomPdfSigner(keystore, "password123", "esign");

            // Setup Signature Dictionary
            PDSignature signature = new PDSignature();
            signature.setFilter(PDSignature.FILTER_ADOBE_PPKLITE);
            signature.setSubFilter(PDSignature.SUBFILTER_ADBE_PKCS7_DETACHED);
            signature.setName("Esign App Server");
            signature.setLocation("Server");
            signature.setReason("Certified Document - All Parties Signed");
            signature.setSignDate(Calendar.getInstance());

            pdf.addSignature(signature, signer);

            ByteArrayOutputStream finalOut = new ByteArrayOutputStream();
            pdf.saveIncremental(finalOut);
            return finalOut.toByteArray();
        }
    }

    private static class CustomPdfSigner implements org.apache.pdfbox.pdmodel.interactive.digitalsignature.SignatureInterface {
        private final PrivateKey privateKey;
        private final Certificate[] certificateChain;

        public CustomPdfSigner(KeyStore keystore, String password, String alias) throws Exception {
            this.privateKey = (PrivateKey) keystore.getKey(alias, password.toCharArray());
            this.certificateChain = keystore.getCertificateChain(alias);
        }

        @Override
        public byte[] sign(InputStream content) throws java.io.IOException {
            try {
                org.bouncycastle.cms.CMSSignedDataGenerator gen = new org.bouncycastle.cms.CMSSignedDataGenerator();
                java.security.cert.X509Certificate cert = (java.security.cert.X509Certificate) certificateChain[0];
                org.bouncycastle.operator.ContentSigner sha256Signer = new org.bouncycastle.operator.jcajce.JcaContentSignerBuilder("SHA256WithRSA").build(privateKey);

                gen.addSignerInfoGenerator(new org.bouncycastle.cms.jcajce.JcaSignerInfoGeneratorBuilder(
                        new org.bouncycastle.operator.jcajce.JcaDigestCalculatorProviderBuilder().build()).build(sha256Signer, cert));

                gen.addCertificates(new org.bouncycastle.cert.jcajce.JcaCertStore(Arrays.asList(certificateChain)));

                byte[] buffer = content.readAllBytes();
                org.bouncycastle.cms.CMSProcessableByteArray msg = new org.bouncycastle.cms.CMSProcessableByteArray(buffer);
                org.bouncycastle.cms.CMSSignedData signedData = gen.generate(msg, false);
                return signedData.getEncoded();
            } catch (Exception e) {
                throw new java.io.IOException("Could not sign pdf", e);
            }
        }
    }
}

