package com.example.usermanagement.service;

import com.example.usermanagement.entity.User;
import com.example.usermanagement.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    @Autowired
    private UserRepository repo;

    public User saveUser(User user) {
        if (repo.existsByEmail(user.getEmail()))
            throw new RuntimeException("Email already registered: " + user.getEmail());
        return repo.save(user);
    }

    public List<User> getAllUsers() {
        return repo.findAll();
    }

    public List<User> searchUsers(String query) {
        if (query == null || query.isBlank()) return repo.findAll();
        return repo.searchByNameOrEmail(query.trim());
    }

    public User getUserById(Integer id) {
        return repo.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));
    }

    public User updateUser(User user) {
        User existing = getUserById(user.getId());
        if (!existing.getEmail().equalsIgnoreCase(user.getEmail())
                && repo.existsByEmail(user.getEmail()))
            throw new RuntimeException("Email already registered: " + user.getEmail());
        return repo.save(user);
    }

    public void deleteUser(Integer id) {
        getUserById(id);
        repo.deleteById(id);
    }
}
