# Doctor Tracker

## Description

Doctor Tracker is a secure administrative web application that helps hospitals manage doctors and their corresponding patients from one centralized portal. Administrators can view, search, filter, and manage doctor and patient records while also using dashboard analytics to understand patient distribution, doctor workload, and date-based trends.

## Setup Guide

### Frontend

```bash
git clone <FRONTEND_REPOSITORY_URL>
cd doctor-tracker-fe
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

Create `.env.example`:

```env
NEXT_PUBLIC_API_URL=
```

Run:

```bash
npm run dev
```

Frontend:

```text
http://localhost:3000
```

### Backend

```bash
git clone <BACKEND_REPOSITORY_URL>
cd doctor-tracker-be
npm install
```

Create `.env` with your MongoDB connection, frontend URL, authentication secret, and port.

Example `.env.example`:

```env
PORT=5000
MONGODB_URI=
CLIENT_URL=http://localhost:3000
JWT_SECRET=
COOKIE_NAME=doctor_tracker_session
```

Run:

```bash
npm run dev
```

Backend:

```text
http://localhost:5000/api/v1
```

## System Architecture

```text
User
 ↓
Next.js Frontend
 ↓
TanStack Query / Redux Toolkit
 ↓
Axios REST Requests
 ↓
Node.js + Express API
 ↓
Mongoose
 ↓
MongoDB
```

TanStack Query manages data received from the backend, while Redux Toolkit manages global client-side state such as authentication and UI state.

## Technical Decisions

### Why TanStack Query?

TanStack Query is used for server data such as doctors, patients, and dashboard analytics. It provides caching, loading states, error handling, refetching, and query invalidation after create, update, or delete operations.

This keeps API logic cleaner and avoids manually managing backend data with React state.

### Why Redux Toolkit?

Redux Toolkit is used for global client-side state such as authenticated user information and shared UI state.

Redux was chosen over only using Context API because it provides a more structured and scalable state-management approach, typed state access, predictable updates, and better debugging support.

The project separates responsibilities like this:

```text
API / Server Data → TanStack Query
Global Client State → Redux Toolkit
```

## Visual Evidence

Add screenshots inside:

```text
docs/screenshots/
```

Recommended screenshots:

```text
dashboard-desktop.png
dashboard-mobile.png
doctors-desktop.png
patients-desktop.png
login.png
```

Example:

```md
![Dashboard](docs/screenshots/dashboard-desktop.png)
![Mobile Dashboard](docs/screenshots/dashboard-mobile.png)
```

## Submission

Live Application:

```text
<DEPLOYED_PROJECT_URL>
```

Frontend GitHub:

```text
<FRONTEND_REPOSITORY_URL>
```

Backend GitHub:

```text
<BACKEND_REPOSITORY_URL>
```

Test credentials if required:

```text
Email: <TEST_ADMIN_EMAIL>
Password: <TEST_ADMIN_PASSWORD>
```
