package com.example.authdemo.service;

import com.example.authdemo.model.Document;
import com.example.authdemo.model.SignatureField;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.List;

@Service
public class PdfService {

    private static final float SIG_WIDTH_RATIO = 0.20f;
    private static final float SIG_ASPECT_RATIO = 80f / 220f;

    /** Render ALL signatures onto the PDF (used for admin email) */
    public byte[] addSignatures(Document doc) {
        return renderSignatures(doc.getFileData(), doc.getSignatureFields());
    }

    /** Render only a specific participant's signatures onto the PDF */
    public byte[] addSignaturesForParticipant(Document doc, String email) {
        List<SignatureField> filtered = doc.getSignatureFields().stream()
                .filter(f -> f.getParticipantEmail().equalsIgnoreCase(email.trim()))
                .toList();
        return renderSignatures(doc.getFileData(), filtered);
    }

    private byte[] renderSignatures(byte[] pdfData, List<SignatureField> fields) {
        try {
            PDDocument pdf = PDDocument.load(pdfData);

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
                content.close();
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            pdf.save(out);
            pdf.close();

            return out.toByteArray();

        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
}
