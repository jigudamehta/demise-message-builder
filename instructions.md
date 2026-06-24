# Deployment & Setup Guide - Demise Message Builder PWA

Follow this guide to connect your Progressive Web App (PWA) to your Google Sheets database and activate the secure AI layout optimizer.

---

## Part 1: Setting up the Google Sheet

1. Create a new Google Spreadsheet in your Google Drive. Rename it to **Demise Message Database** (or any name you prefer).
2. Look at the top menu and select **Extensions &rarr; Apps Script**.
3. In the Apps Script code editor, delete any template code and paste the contents of [Code.gs](file:///e:/Antigraveti/Demise%20message/Code.gs).
4. Save the project (click the floppy disk icon).
5. In the toolbar dropdown, select the function **`setupSpreadsheet`** and click **Run**.
6. Google will ask for permission authorization. Approve the permissions.
7. Go back to your Google Sheet. You will see that 5 tabs have been automatically created and populated with sample columns and values:
   - `Settings`
   - `Templates`
   - `RelationMaster`
   - `CommunityMaster`
   - `LanguageMaster`

---

## Part 2: Deploying the Apps Script Web App

1. In the Apps Script editor, click **Deploy &rarr; New deployment** (top right).
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in the deployment details:
   - **Description**: `Demise PWA API`
   - **Execute as**: `Me (your email)`
   - **Who has access**: `Anyone` *(Note: This allows the PWA to call the spreadsheet backend securely)*
4. Click **Deploy**.
5. Copy the **Web App URL** provided on the success screen. It should look like this:
   `https://script.google.com/macros/s/AKfycb.../exec`

---

## Part 3: Connecting the PWA Frontend

You have two ways to connect your Web App URL to the frontend:

### Method A: Edit the JavaScript File (Recommended for production)
1. Open the [app.js](file:///e:/Antigraveti/Demise%20message/app.js) file.
2. Locate the line near the top:
   ```javascript
   let GAS_WEBAPP_URL = localStorage.getItem('demise_gas_url') || "";
   ```
3. Replace the empty string with your copied URL:
   ```javascript
   let GAS_WEBAPP_URL = localStorage.getItem('demise_gas_url') || "YOUR_COPIED_URL_HERE";
   ```
4. Save the file.

### Method B: Configure in the PWA Interface (No coding required)
1. Open the PWA in your browser.
2. Click the **Optimize** button in the AI Helper card at the bottom right.
3. The app will prompt you: *"To use the AI optimizer, please enter your deployed Google Apps Script URL:"*
4. Paste your copied URL and click **OK**.
5. The URL will be saved inside your browser's `localStorage` and will persist for future drafts.

---

## Part 4: Configuring AI & Fallback Priority

To use the **AI Spacing & Formatting Optimizer**, you need to provide API keys inside your Google Sheet:

1. Open your Google Sheet and go to the **Settings** tab.
2. Enter your API key(s) in the respective row values:
   - `GEMINI_API_KEY`: Get one for free from Google AI Studio.
   - `OPENAI_API_KEY`: Enter your OpenAI platform key (optional).
   - `OPENROUTER_API_KEY`: Enter your OpenRouter key (optional).
3. The priority order of fallback is set in `AI_PROVIDER_PRIORITY` (default: `Gemini,OpenAI,OpenRouter`). 
   - If `Gemini` is prioritized and has a key, the backend will call Gemini.
   - If the Gemini request fails or has no key, it automatically calls `OpenAI`.
   - If that fails, it falls back to `OpenRouter`.
   - If all fail, the app displays a clear notification to the user without crashing.

---

## Part 5: Modifying Templates & Relations

- **Templates**: To modify how announcements look, edit the `TemplateBody` column in the **Templates** tab. Do not change the placeholders (e.g. `{{DECEASED_NAME}}`, `{{RELATIONS}}`).
- **Communities**: Add new communities to the **CommunityMaster** tab. The PWA will automatically fetch them when synced.
- **Relations**: Add or change default relation headings and formatting styles in the **RelationMaster** tab.
