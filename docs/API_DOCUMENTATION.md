# API Documentation

All client traffic goes through the **API Gateway** at `http://localhost:5000`.
The backend services also expose the same routes directly (on 4001/4002) for
isolated testing, but every non-`/health` route requires the internal API key
header, which only the gateway attaches automatically.

Authenticated routes require:

```
Authorization: Bearer <jwt>
```

---

## Auth (proxied to User Service)

### `POST /api/auth/register`
Create a new account. Publishes a `user.registered` event on success.

**Body**
```json
{
  "name": "Yash Sharma",
  "email": "yash@example.com",
  "password": "StrongPass123"
}
```

**201 Response**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": { "id": "...", "name": "Yash Sharma", "email": "yash@example.com", "role": "user", "isActive": true, "createdAt": "..." },
    "token": "<jwt>"
  }
}
```

Errors: `409` email already exists · `422` validation failed.

### `POST /api/auth/login`
Authenticate and receive a JWT. Publishes a `user.loggedIn` event.

**Body**
```json
{ "email": "yash@example.com", "password": "StrongPass123" }
```

**200 Response**: same shape as register. Errors: `401` invalid credentials.

---

## Users (proxied to User Service, requires JWT)

### `GET /api/users/me`
Returns the authenticated user's profile.

### `PATCH /api/users/me`
Update the authenticated user's profile. Publishes `user.updated`.

**Body**
```json
{ "name": "New Name" }
```

### `GET /api/users/:id`
Fetch a user's public profile by ID.

### `GET /api/users?page=1&limit=20`
List users (admin role only). Errors: `403` if caller is not `admin`.

---

## Notifications (proxied to Notification Service, requires JWT)

### `GET /api/notifications?page=1&limit=20`
List the authenticated user's notification history (paginated, newest first).

**200 Response**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "...",
        "userId": "...",
        "email": "yash@example.com",
        "type": "WELCOME",
        "subject": "Welcome! Your account has been created",
        "message": "Hi Yash Sharma, welcome aboard! ...",
        "status": "SENT",
        "sourceEvent": "user.registered",
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
  }
}
```

### `GET /api/notifications/:id`
Fetch a single notification. Errors: `403` if it doesn't belong to the caller
(unless caller is `admin`), `404` if not found.

---

## Health checks

Each service exposes an unauthenticated `GET /health`:

- `http://localhost:5000/health` (Gateway)
- `http://localhost:4001/health` (User Service)
- `http://localhost:4002/health` (Notification Service)

---

## Error format

All errors follow the same shape:

```json
{ "success": false, "message": "Human readable message", "details": [ /* optional, e.g. validation issues */ ] }
```

Common status codes: `400` bad request · `401` unauthenticated · `403`
forbidden · `404` not found · `409` conflict · `422` validation failed ·
`429` rate limited · `502` upstream (a backend service) unavailable.

---

## Events (internal, not HTTP — documented for completeness)

Published by User Service to NATS JetStream stream `USER_EVENTS`, consumed
by Notification Service. Not called directly by clients.

| Subject | Emitted when | Payload |
|---|---|---|
| `user.registered` | New account created | `{ userId, name, email }` |
| `user.updated` | Profile changed | `{ userId, email, changes }` |
| `user.loggedIn` | Successful login | `{ userId, email, at }` |
