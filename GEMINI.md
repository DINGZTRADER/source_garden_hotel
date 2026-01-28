GEMINI.md

Source Garden Hotel Management System (SGHMS)

1. Project Overview

The Source Garden Hotel Management System (SGHMS) is an internal hotel operations platform designed to manage:

Front Office (rooms, guest charges, payments)

POS operations (bar, restaurant, services)

Stock control

Expenses & petty cash

Shift close & drawer reconciliation

Daily financial reporting

Offline-tolerant sales capture

The system is intended for staff-only use on hotel-controlled computers.

2. Technology Stack

Frontend Framework: React (JavaScript)

Styling: Tailwind CSS

Backend / Data Store: Firebase (Firestore, Auth)

State Persistence: Browser LocalStorage

Offline Handling: Local transaction queue with replay

Icons: lucide-react

AI Integration: Google Gemini API (contextual suggestions only)

3. Deployment Model (Authoritative)

Primary Deployment: Web Application (Controlled Desktop Environment)

SGHMS is a web-based React application designed to operate as a desktop-style system within a hotel environment.

Key characteristics:

Runs in modern browsers (Chrome / Edge)

Used on fixed hotel computers (Front Office, Bar, Admin)

Not intended for public internet access

Not used on personal staff devices

Optimized for long-running sessions

Desktop-Grade Guarantees

Although not currently packaged as a Windows Electron application, the system provides desktop-equivalent operational guarantees, including:

Persistent local state (cart, work period, offline queue)

Offline transaction capture and replay

Safe recovery after browser refresh, crash, or power loss

Controlled startup flow (operator login)

Predictable navigation (no public routing)

Future Packaging

The architecture is compatible with future Electron or Progressive Web App (PWA) packaging if operational requirements demand a packaged .exe or installable desktop shell.

Electron packaging is explicitly deferred, not excluded.

4. Startup & Runtime Behavior

App starts via browser load (local server or hosted URL)

Operator login gate required (PIN-based)

Authenticated session maintained in-memory

No reliance on volatile browser session state

Safe to refresh or reopen browser at any time

5. Offline & Power-Failure Strategy

The system is designed for environments with unstable power and intermittent internet.

Implemented Safeguards

POS transactions are always queued locally first

Queue persists in LocalStorage

Sync attempts occur automatically when connectivity returns

Duplicate prevention via transaction IDs

UI clears immediately to preserve staff workflow

No sale is lost due to:

Power outage

Browser crash

Network interruption

6. Data Integrity & Auditability

All financial records are immutable once written

Shift close creates a locked work-period report

Declared vs expected totals stored

Variance calculations preserved

Void actions logged separately

Stock movements tracked via deltas (open / added / sold)

7. Security Model

Application is staff-only

Operator access via PIN codes

Admin-only access to reports, stock, expenses

No public authentication or customer access

Firebase security rules enforce role-based access (assumed)

8. Scope Clarifications
Item	In Scope	Notes
Public website	❌	Internal system only
Mobile app	❌	Desktop usage only
Electron build	❌ (for now)	Architecture compatible
Offline POS	✅	Implemented
Shift close	✅	Implemented
AI suggestions	✅	Non-critical, optional
9. Audit Alignment Statement

This project should be audited as:

A web-based internal hotel operations system with desktop-grade operational guarantees

Audit criteria must focus on:

Startup reliability

Offline resilience

Data integrity

Recovery behavior

Financial correctness

Desktop packaging (Electron) is not a prerequisite for audit success.

10. Ownership & Intent

SGHMS is being developed for real-world hotel operations in environments with:

Limited IT support

Power instability

Staff with minimal technical training

Reliability and clarity take precedence over architectural purity.

✅ End of GEMINI.md
What this achieves

✔ Resolves SGHMS-AUD-001

✔ Aligns code with documentation

✔ Keeps Electron optional

✔ Allows audit to proceed

✔ Sounds professional and intentional