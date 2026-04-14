# 👤 User Management System

A full-stack CRUD application built with **Spring Boot** (Backend) and **HTML/CSS/JS** (Frontend).

---

## 🏗 Project Structure

```
user-management-project/
├── backend/                          ← Spring Boot Maven Project
│   ├── src/main/java/com/example/usermanagement/
│   │   ├── UserManagementApplication.java
│   │   ├── controller/UserController.java
│   │   ├── service/UserService.java
│   │   ├── repository/UserRepository.java
│   │   └── entity/User.java
│   ├── src/main/resources/
│   │   └── application.properties
│   └── pom.xml
│
└── frontend/                         ← Plain HTML/CSS/JS
    ├── index.html
    ├── style.css
    └── script.js
```

---

## ⚙️ Prerequisites

- Java 17+
- Maven 3.6+
- MySQL 8.x
- Any modern browser

---

## 🚀 Setup & Run

### 1. MySQL Setup

```sql
CREATE DATABASE user_db;
```

### 2. Configure Database

Edit `backend/src/main/resources/application.properties`:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/user_db
spring.datasource.username=root
spring.datasource.password=YOUR_PASSWORD
```

### 3. Run Backend

```bash
cd backend
mvn spring-boot:run
```

Backend starts at: `http://localhost:8080`

### 4. Run Frontend

Open `frontend/index.html` directly in your browser.

---

## 🔌 REST API Endpoints

| Method | Endpoint      | Description       |
|--------|---------------|-------------------|
| POST   | /users        | Create a new user |
| GET    | /users        | Get all users     |
| GET    | /users/{id}   | Get user by ID    |
| PUT    | /users        | Update a user     |
| DELETE | /users/{id}   | Delete a user     |

---

## 🧪 Sample API Test (cURL)

```bash
# Create user
curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'

# Get all users
curl http://localhost:8080/users

# Delete user
curl -X DELETE http://localhost:8080/users/1
```
