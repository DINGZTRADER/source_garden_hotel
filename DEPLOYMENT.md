Source Garden HMS — Final v1.0 Deployment Guide

Version: 1.0
System Type: Web-based Hotel Management System (POS + Front Office)
Deployment Model: Firebase Hosting + Firestore
Target Environment: Hotel desktop computers (Chrome browser)

1. System Overview (What This Is)

Source Garden HMS is a high-speed, browser-based hotel system designed for daily operations:

Front Office (rooms, check-in/out)

POS (bar, kitchen, services)

Stock sheets

Expenses & petty cash

Daily financial reports

Offline-safe POS (continues working during power/internet cuts)

The system runs in a web browser but is designed to feel like a desktop POS, with large buttons and fast workflows.

2. Prerequisites (One-Time Setup)

On the setup computer:

Node.js (LTS version)

Google Chrome

Internet connection (for initial deployment)

3. Create Firebase Project

Go to https://console.firebase.google.com/

Click Create a project

Project name:

source-garden-hms


Disable Google Analytics (optional)

Click Create project

4. Enable Required Firebase Services
4.1 Authentication

Firebase Console → Authentication

Click Get started

Open Sign-in method

Enable Anonymous

Save

4.2 Firestore Database

Firebase Console → Firestore Database

Click Create database

Choose Production mode

Select region:

africa-south1 (Johannesburg)


Enable

This region is optimal for Uganda and East Africa (lower latency, better reliability).

5. Register the Web App

Firebase Console → Project Settings (⚙️)

Scroll to Your apps

Click the Web icon (</>)

App name:

Source Garden HMS


Register app

Copy the firebaseConfig values

6. Configure the Application (Runtime Config)

Edit:

public/index.html


Add or update this block:

<script>
  window.__firebase_config = JSON.stringify({
    apiKey: "AIzaSyXXXXXXXXXXXX",
    authDomain: "source-garden-hms.firebaseapp.com",
    projectId: "source-garden-hms",
    storageBucket: "source-garden-hms.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
  });
</script>


⚠️ Note: These values are safe to expose in frontend apps.
Security is enforced via Firestore Rules, not by hiding this config.

7. Install Firebase CLI

Open a terminal and run:

npm install -g firebase-tools


Then log in:

firebase login


A browser window will open for authentication.

8. Initialize Firebase in the Project

From the project root:

firebase init


Choose:

Firestore ✅

Hosting ✅

Use existing project → source-garden-hms

Hosting public directory → build

Configure as single-page app → Yes

This creates:

firebase.json

.firebaserc

9. Set Firebase Project ID

Edit .firebaserc:

{
  "projects": {
    "default": "source-garden-hms"
  }
}

10. Deploy Firestore Rules
firebase deploy --only firestore:rules


Ensure rules:

Require authentication

Prevent deletion of sales, expenses, and closed work periods

11. Build the Application
npm run build


This creates the production build in the build/ folder.

12. Deploy to Firebase Hosting
firebase deploy --only hosting

13. Access the System

After deployment, Firebase will provide URLs like:

https://source-garden-hms.web.app

https://source-garden-hms.firebaseapp.com

These URLs can be:

Opened on hotel computers

Bookmarked

Set to open automatically on startup

14. Operator Login Codes
Code	User	Role	Access
1111	Administrator	Admin	Full system access
2222	Pauline	Staff	Riverside Bar POS
3333	Mustafa	Staff	Front Office
15. Updating the System

Whenever changes are made:

npm run build
firebase deploy --only hosting


No downtime for existing users.

16. Optional: Custom Domain

Firebase Console → Hosting

Add custom domain (e.g. hms.sourcegarden.ug)

Follow DNS instructions

17. Operational Support Checklist

If something looks wrong:

Check Firestore → data updates

Check Authentication → Anonymous enabled

Check Browser Console → errors

Refresh page (safe; POS is offline-protected)

Manager-Friendly Summary (Non-Technical)
What This System Is

Source Garden HMS is the hotel’s main operational system for:

Rooms

Bar & kitchen sales

Stock tracking

Expenses

Daily financial reporting

Staff use it on desktop computers in a web browser. No special software is required.

What Happens If Internet or Power Goes Off?

The bar POS keeps working

Sales are saved safely on the computer

When internet returns, everything syncs automatically

No sales are lost

How Staff Use It

Staff log in using a 4-digit code

Bar staff go straight to the POS

Reception goes straight to room management

Admin sees reports, stock, expenses, and closes shifts

How Secure Is It?

Only logged-in users can access data

Financial records cannot be altered once closed

Data is stored safely in Google’s cloud

Each shift is locked when closed

What the Manager Needs to Know

The system is already production-ready

Updates are simple and do not interrupt operations

Reports are available daily

The system can grow (more users, more departments)

Bottom Line

This system replaces manual books and disconnected POS tools with one clear, reliable source of truth for the hotel.