# Source Garden HMS - Operations & Deployment Guide

This document provides complete instructions for setting up, running, and deploying the Source Garden Hotel Management System (SGHMS).

## 1. Prerequisites

Before you begin, ensure you have the following installed on your computer:

* **Node.js**: Version 16 or higher (Recommended: v18 LTS). [Download Here](https://nodejs.org/)
* **Git**: For version control. [Download Here](https://git-scm.com/)
* **Firebase CLI**: For deploying the application.

    ```bash
    npm install -g firebase-tools
    ```

## 2. Installation & Local Development

Follow these steps to run the application on your local machine for testing or development.

1. **Clone the Repository** (if you haven't already):

    ```bash
    git clone https://github.com/YOUR_USERNAME/source-garden-hms.git
    cd source-garden-hms
    ```

2. **Install Dependencies**:

    ```bash
    npm install
    ```

3. **Start the Development Server**:

    ```bash
    npm start
    ```

    The app will open automatically in your browser at `http://localhost:3000`.

## 3. Deployment (Final Version)

This application is deployed using **Firebase Hosting**. While the app runs locally as a standard web app, deployment makes it accessible via a URL.

### Step 1: Login to Firebase

If you haven't logged in recently, authenticate with your Google account:

```bash
firebase login
```

### Step 2: Build the Application

Create the optimized production build. This compiles your React code into static files in the `build/` directory.

```bash
npm run build
```

* *Success Check*: You should see a `build` folder appear in your project directory containing `index.html` and static assets.

### Step 3: Deploy to Live

Upload the build folder to Firebase Hosting.

```bash
firebase deploy
```

* **Partial Deploy**: To deploy *only* the hosting files (skipping Firestore rules/indexes), you can run:

    ```bash
    firebase deploy --only hosting
    ```

After success, the terminal will display your **Hosting URL** (e.g., `https://source-garden-hms.web.app`).

## 4. GitHub Workflow

We use GitHub to store code history and collaborate.

### Saving Changes

When you have made changes to the code:

1. **Check Status**: See which files have changed.

    ```bash
    git status
    ```

2. **Stage Files**: Add files to the staging area.

    ```bash
    git add .
    ```

3. **Commit**: Save the snapshot with a descriptive message.

    ```bash
    git commit -m "Update login integration and fix offline queue"
    ```

4. **Push**: Upload your changes to GitHub.

    ```bash
    git push origin main
    ```

## 5. Troubleshooting Common Issues

### "Permission Denied" on Firebase Deploy

* **Cause**: You might be logged into the wrong Google account or don't have permission on the Firebase project.
* **Fix**: Run `firebase logout` then `firebase login` with the correct account.

### App Shows Blank Screen after Deploy

* **Cause**: Caching issues or build errors.
* **Fix**:
    1. Open the console (F12) to see errors.
    2. Try a Hard Refresh (Ctrl + F5).
    3. Run `npm run build` again locally to ensure no errors occurred during build.

### Updates Not Showing

* **Cause**: Service Worker or browser cache.
* **Fix**: The app is designed to work offline. New versions might take a second refresh to load. Close all tabs and reopen the app.

---
**Note**: This project is capable of strictly offline operation, but deployment requires an internet connection.
