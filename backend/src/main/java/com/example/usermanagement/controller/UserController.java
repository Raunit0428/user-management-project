package com.example.usermanagement.controller;

import com.example.usermanagement.entity.User;
import com.example.usermanagement.service.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/users")
public class UserController {

    @Autowired
    private UserService service;

    // CREATE
    @PostMapping
    public ResponseEntity<?> createUser(@Valid @RequestBody User user) {
        try {
            return ResponseEntity.ok(service.saveUser(user));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // READ ALL
    @GetMapping
    public ResponseEntity<List<User>> getUsers() {
        return ResponseEntity.ok(service.getAllUsers());
    }

    // SEARCH by name or email — used by live search bar
    @GetMapping("/search")
    public ResponseEntity<List<User>> searchUsers(@RequestParam String q) {
        return ResponseEntity.ok(service.searchUsers(q));
    }

    // READ BY ID
    @GetMapping("/{id}")
    public ResponseEntity<?> getUser(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(service.getUserById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // UPDATE
    @PutMapping
    public ResponseEntity<?> updateUser(@Valid @RequestBody User user) {
        try {
            return ResponseEntity.ok(service.updateUser(user));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // DELETE
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Integer id) {
        try {
            service.deleteUser(id);
            return ResponseEntity.ok(Map.of("message", "User deleted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Validation error handler
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationErrors(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError err : ex.getBindingResult().getFieldErrors()) {
            errors.put(err.getField(), err.getDefaultMessage());
        }
        return ResponseEntity.badRequest().body(errors);
    }
}
