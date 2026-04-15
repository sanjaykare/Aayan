package com.example.authdemo.controller;

import com.example.authdemo.model.User;
import com.example.authdemo.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/register")
    public String register(@RequestBody User user) {

        if(userRepository.findByEmail(user.getEmail()) != null){
            return "User already exists";
        }

        userRepository.save(user);
        return "User registered successfully";
    }

    @PostMapping("/login")
    public String login(@RequestBody User user){

        User existingUser = userRepository.findByEmail(user.getEmail());

        if(existingUser == null){
            return "User not found";
        }

        if(existingUser.getPassword().equals(user.getPassword())){
            return "Login successful";
        }

        return "Invalid password";
    }
}