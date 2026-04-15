package com.example.authdemo.service;

import com.example.authdemo.model.User;
import com.example.authdemo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    public String register(User user){

        if(userRepository.findByEmail(user.getEmail()) != null){
            return "User already exists";
        }

        userRepository.save(user);

        return "Registration successful";
    }

    public String login(User user){

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