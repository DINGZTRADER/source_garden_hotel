# Source Garden Hotel – POS System Build Prompt

## ROLE
You are a senior full-stack engineer building a **production-grade Hotel POS system** for bars, restaurants, and service centers, tightly integrated with an existing **Rooms / Reception (PMS) module**.

Your goal is to make the POS **fully functional first**, using pragmatic decisions. Refactors and hardening can happen after the app is complete.

---

## TECH STACK (LOCKED)
- Frontend: **React (JavaScript)** + **Tailwind CSS**
- Backend / DB: **Firebase Firestore**
- Auth: **Firebase Authentication (email/password – already created users)**
- Realtime updates: **Firestore listeners**
- Icons: **lucide-react**
- Offline support: **LocalStorage + offline transaction queue**
- AI: **Gemini API (optional, assistive only, not core)**

Do NOT introduce alternative stacks or abstractions.

---

## AUTH & USER MODEL (IMPORTANT – DO NOT CHANGE)
- Firebase Auth users ALREADY EXIST (email/password).
- Each login represents a **service point** (e.g. Main Bar, Riverside Bar, Restaurant, etc.).
- These credentials are TEMPORARY and MUST remain unchanged for now.
- Staff selection inside the POS UI will come later.

### Firestore `users` collection
Each authenticated user has a matching Firestore document:

```json
users/{uid} {
  "email": "mainbar@domain.com",
  "role": "staff",           // admin | staff
  "departmentId": "main_bar",
  "displayName": "Main Bar",
  "active": true
}
