package com.example.authdemo.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import com.example.authdemo.model.User;

public interface UserRepository extends MongoRepository<User, String> {

    User findByEmail(String email);
}