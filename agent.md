# 🧠 agent.md — Cursor AI Build Guide

## 🎯 Goal

Build an **AI-powered EduRapid System (CoFee alternative)** step-by-step using Cursor.

---

# 🚀 How to Use This File

- Follow phases **sequentially**
- DO NOT jump ahead
- Each step = small, testable output
- Ask Cursor to generate code ONLY for the current step

---

# 🧱 Tech Stack

- Frontend: Next.js
- Backend: Nodejs, Expressjs
- Database: MongoDB
- Payments: Razorpay
- Queue: BullMQ

---

# 📅 Phase 1: Project Setup

## Step 1: Initialize Backend (ExpressJs)

Prompt for Cursor:

```
Create a ExpressJs project with modules:
- auth
- users
- students
- fees
- payments
```

## Step 2: Setup MongoDB

Prompt:

```
Connect ExpressJs with MongoDB using Mongoose.
Create base schema with tenantId support.
```

## Step 3: Basic Auth

Prompt:

```
Implement JWT-based authentication with login/signup.
Add tenantId to JWT payload.
```

---

# 📅 Phase 2: Core Features

## Step 4: Student Module

Prompt:

```
Create Student schema with:
- name
- parentPhone
- tenantId
Add CRUD APIs.
```

## Step 5: Fee Module

Prompt:

```
Create Fee schema:
- studentId
- amount
- dueDate
- status
Add APIs to create and fetch fees.
```

## Step 6: Payment Link

Prompt:

```
Create API to generate payment link with feeId and signed token.
```

---

# 📅 Phase 3: Payments

## Step 7: Razorpay Integration

Prompt:

```
Integrate Razorpay to create order and return payment details.
```

## Step 8: Webhook Handling

Prompt:

```
Implement Razorpay webhook endpoint.
Verify signature.
Update payment status in DB.
Ensure idempotency.
```

---

# 📅 Phase 4: Notifications

## Step 9: Queue Setup

Prompt:

```
Setup BullMQ with Redis.
Create queue for notifications.
```

## Step 10: Reminder System

Prompt:

```
Create cron job to find due fees and push jobs to queue.
```

## Step 11: WhatsApp Integration

Prompt:

```
Integrate WhatsApp API to send payment reminders.
```

---

# 📅 Phase 5: Dashboard

## Step 12: Next.js Admin UI

Prompt:

```
Create dashboard to show:
- total fees
- paid
- pending
```

---

# 📅 Phase 6: AI Differentiation

## Step 13: Voice Agent

Prompt:

```
Integrate ElevenLabs API to generate voice reminder.
Trigger calls via API.
```

---

# ⚠️ Rules for Cursor

- Never generate full system at once
- Always write modular code
- Use clean architecture
- Add comments for each function
- Write testable services

---

# 🧩 Folder Structure

```
/src
  /auth
  /students
  /fees
  /payments
  /notifications
```

---

# ✅ Definition of Done (MVP)

- Admin can create student + fee
- Payment link works
- Payment updates via webhook
- Reminder is sent

---

# 🚀 Next Steps (After MVP)

- Add AI reminders
- Add analytics
- Add multi-channel notifications

---

# 💡 Pro Tip

Always test after each step.
Do NOT move forward if current step is broken.
