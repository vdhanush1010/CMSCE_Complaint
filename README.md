# CMSCE AI-Powered Complaint Management System 🎓⚡

A modern, production-grade Grievance Redressal and AI-Assisted Resolution Platform engineered for **CMS College of Engineering (CMSCE)**.

The system features real-time Natural Language Processing (NLP) complaint triage via **Google Gemini API** (with an intelligent deterministic rule-based fallback), automatic department dispatching, SLA breach countdown timers, multi-stage lifecycle state machines, and dedicated portals for **Students**, **Department Heads**, and **Executive Administrators**.

---

## 🏗 Architecture & Technology Stack

```text
cmsce_complaint/
├── backend/                       # Node.js + Express API Engine
│   ├── src/
│   │   ├── config/                # Mongoose connection to MongoDB
│   │   ├── models/                # User, Department, Complaint, Announcement
│   │   ├── services/              # AI Neural Triage (@google/genai + rule engine)
│   │   ├── routes/                # Auth, Complaints, Departments, Admin, AI
│   │   ├── middleware/            # JWT authentication & RBAC guards
│   │   └── scripts/               # Seed script (npm run seed)
│   ├── .env.example
│   └── server.js                  # Express entrypoint on port 5000
│
├── frontend/                      # React 18 + Vite Portal
│   ├── src/
│   │   ├── api/                   # Centralized API client (client.js)
│   │   ├── assets/                # High-res logos, crests, vector graphics
│   │   ├── components/
│   │   │   ├── student/           # Student Desk, Tracker, FeedbackCard, Modal
│   │   │   ├── admin/             # Dashboard, MetricCards, ControlPanel, Broadcasts
│   │   │   └── staff/             # Department-filtered queue & resolution workflow
│   │   ├── App.jsx                # React Router navigation
│   │   └── index.css              # Institutional branding & Tailwind CSS v3
│   ├── tailwind.config.js         # Color tokens: #084325 (Green), #EAB308 (Yellow)
│   └── vite.config.js             # Vite dev server with proxy to backend
│
└── package.json                   # Root orchestrator with concurrently
```

### Core Technologies
- **Backend**: Node.js v24+, Express 4.x, MongoDB (Mongoose 8.x), JWT, bcryptjs.
- **Artificial Intelligence**: Google Gemini 2.5 Flash via `@google/genai` with automatic keyword hazard detection fallback.
- **Frontend**: React 18, Vite 6, Tailwind CSS v3, React Router DOM v6, Lucide Icons.
- **Design Tokens**: Institutional Green (`#084325`), Accent Amber (`#EAB308`), Slate Neutrals (`#F8FAFC`, `#0F172A`).

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js** v18+ and **npm** v10+
- **MongoDB** running locally on port `27017` (e.g. `mongodb://127.0.0.1:27017/cmsce_db`)

### 2. Install Dependencies
From the repository root (`cmsce_complaint/`):
```bash
npm run install:all
```

### 3. Seed Database with Initial Data
Populates official departments, default administrative accounts, and sample grievance records:
```bash
npm run seed
```

### 4. Start Full Stack Concurrently
Spins up the Express backend (port 5000) and Vite frontend (port 5173) together:
```bash
npm run dev
```

- **Student Portal**: [http://localhost:5173](http://localhost:5173)
- **Staff & Admin Login**: [http://localhost:5173/office/login](http://localhost:5173/office/login)
- **Backend API**: [http://localhost:5000/api](http://localhost:5000/api)
- **API Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 🔐 Default Credentials (from Seed)

| Role | Portal / Destination | Email | Password | Scope / Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Executive Admin** | `/admin` or `/office/login` | `admin@cmsce.edu` | `admin123` | Campus-wide analytics, re-routing, staff provisioning, announcements |
| **Canteen Head** | `/staff` or `/office/login?type=staff` | `canteen@cmsce.edu` | `staff123` | Canteen Operations queue (4h SLA), resolution proofs |
| **Transport Head** | `/staff` or `/office/login?type=staff` | `transport@cmsce.edu` | `staff123` | Transport Management queue (12h SLA), route scheduling |
| **Student** | `/` (Student Desk) | `student1@cmsce.edu` | `Password123!` | File grievances, AI classification, track live SLA, submit 5★ feedback |

---

## 🧠 AI Triage Neural Engine

When a student submits a natural language grievance (e.g. *"Piece of metal found in lunch curry"* or *"Bus on Route 4 delayed 40 minutes"*):

1. **Semantic Analysis**:
   - Evaluates title, description, and safety context.
   - Assigns target department (`CANTEEN`, `TRANSPORT`, `HOSTEL`, `ACADEMIC`, `SPORTS`, `HOSPITALITY`).
   - Evaluates hazard severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
   - Calculates target SLA window (e.g., 4 hours for food contamination emergencies).
   - Generates confidence score and explainability reasoning.
2. **Interactive Modal Confirmation**:
   - Displays real-time breakdown to the student in `AIRoutingModal`.
   - Visualizes the 6-department campus grid and routes the ticket upon student approval.
3. **Pluggable Architecture**:
   - Uses `@google/genai` if `GEMINI_API_KEY` is present in `backend/.env`.
   - Seamlessly switches to a deterministic hazard rule engine if no API key is supplied or when offline.

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new student account | Public |
| `POST` | `/api/auth/login` | Login user & issue JWT token | Public |
| `GET` | `/api/auth/me` | Retrieve profile of authenticated user | Bearer Token |
| `POST` | `/api/ai/analyse-complaint` | Trigger live AI triage classification | Optional |
| `GET` | `/api/complaints` | Filterable complaints list (role & dept scoped) | Optional |
| `POST` | `/api/complaints` | Submit grievance with automated AI triage | Optional |
| `GET` | `/api/complaints/track/:ticketId` | Real-time SLA countdown and ticket stepper | Public |
| `PATCH` | `/api/complaints/:id/status` | Advance lifecycle status, re-route, priority | Staff / Admin |
| `POST` | `/api/complaints/:id/feedback` | Post-resolution 5-star rating or reopen request | Student |
| `GET` | `/api/admin/dashboard` | KPI analytics (Open, Critical, SLA Breaches) | Admin |
| `POST` | `/api/admin/staff` | Provision new Department Head account | Admin |
| `GET`/`POST` | `/api/announcements` | Campus-wide broadcast bulletins | Public / Admin |

---

## 📜 License
Internal Institutional Property of **CMS College of Engineering (CMSCE)**.
