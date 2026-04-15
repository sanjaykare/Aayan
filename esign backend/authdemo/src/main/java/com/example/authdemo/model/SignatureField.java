package com.example.authdemo.model;

import lombok.Data;

@Data
public class SignatureField {

    private String id;
    private String participantEmail;

    private float x;
    private float y;
    private int page;

    private String value; // base64 signature
}