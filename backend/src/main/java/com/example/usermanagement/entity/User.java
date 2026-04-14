package com.example.usermanagement.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    @Column(nullable = false)
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Please provide a valid email address")
    @Column(nullable = false, unique = true)
    private String email;

    public User() {}

    public User(String name, String email) {
        this.name  = name;
        this.email = email;
    }

    public Integer getId()             { return id; }
    public void    setId(Integer id)   { this.id = id; }

    public String getName()            { return name; }
    public void   setName(String name) { this.name = name; }

    public String getEmail()             { return email; }
    public void   setEmail(String email) { this.email = email; }

    @Override
    public String toString() {
        return "User{id=" + id + ", name='" + name + "', email='" + email + "'}";
    }
}
