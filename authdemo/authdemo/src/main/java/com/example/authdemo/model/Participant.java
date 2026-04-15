package com.example.authdemo.model;

import lombok.Data;

@Data
public class Participant {
    private String name;
    private String email;
    private String status; // pending / signed
    private int orderIndex; // position in signing sequence (0-based)
}