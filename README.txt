CodeLens AI — Account Login + Private Cloud Sync

WHAT THIS UPDATE ADDS
- Email/password sign-up and sign-in through Supabase Auth.
- Account & Sync panel in the workspace.
- Private cloud sync for personal C++ snippets and quiz/challenge learning progress.
- Per-account browser cache, so different accounts on the same PC do not share their saved content.
- One-time import of the older guest/local snippets and progress into the first account that connects.
- Manual Sync now button and automatic sync after changes.

WHAT IS NOT SYNCED
- Current editor contents / unsaved projects.
- AI Teacher conversation history.
- Compiler input/output or JDoodle credentials.
- Ollama models or local settings.

FILES IN THIS UPDATE
- src/App.tsx
- src/App.css
- src/lib/supabase.ts
- supabase/codelens-cloud-sync.sql
- .env.local.example (reference only; do not overwrite your real .env.local)

INSTALL THE APP UPDATE
1. Stop Vite with Ctrl+C.
2. In PowerShell, back up the current app files and extract this ZIP:

   $project = "$env:USERPROFILE\Documents\codelens-ai"
   $zip = "$HOME\Downloads\CodeLens-AI-Account-Cloud-Sync-Update.zip"
   $backup = Join-Path $project ("backup-cloud-sync-" + (Get-Date -Format "yyyyMMdd-HHmm"))
   New-Item -ItemType Directory -Path $backup -Force | Out-Null
   Copy-Item "$project\src\App.tsx" "$backup\App.tsx"
   Copy-Item "$project\src\App.css" "$backup\App.css"
   Expand-Archive -LiteralPath $zip -DestinationPath $project -Force

3. Install the Supabase JavaScript package:

   cd "$env:USERPROFILE\Documents\codelens-ai"
   npm.cmd install @supabase/supabase-js

SUPABASE SETUP
4. Open https://supabase.com/dashboard and select a Supabase project (or create one for CodeLens AI).
5. In Project Settings / API Keys (or the Connect dialog), copy:
   - Project URL
   - Publishable key (or legacy anon public key)
   Never use a secret key or service_role key in this browser app.
6. Open your EXISTING project .env.local in Notepad. Keep all existing JDoodle and Ollama lines. Add these two new lines at the bottom, replacing the placeholders with your real values:

   VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY

   Do not replace the whole file and do not share its contents or keys in chat.
7. In Supabase Dashboard -> SQL Editor -> New query, open the included supabase/codelens-cloud-sync.sql file, paste its full contents, and click Run.
8. In Supabase Dashboard -> Authentication -> URL Configuration, set Site URL to:

   http://localhost:5173

   Add this Redirect URL if it is not already allowed:

   http://localhost:5173/**

   For email-confirmation sign-up, check the inbox for the confirmation email. Return to the app after confirming. If you later deploy the site, add the deployed URL as a redirect URL too.
9. Restart Vite in PowerShell:

   cd "$env:USERPROFILE\Documents\codelens-ai"
   npm.cmd run dev

10. Open http://localhost:5173, enter the workspace, and select Account & Sync.
11. Create an account or sign in. When the status says Synced, personal snippets and learning progress are stored in your Supabase account and this browser.

IMPORTANT SAFETY NOTES
- The SQL enables Row Level Security and allows authenticated users to access only the row whose user_id matches their own auth.uid().
- The app uses only the public publishable/anon key from the browser. Do not place Supabase secret/service_role keys in any VITE_ variable.
- The SQL creates a separate table named public.codelens_user_data. It does not modify other tables in your Supabase project.
- Your existing .env.local, vite.config.ts, JDoodle compiler route, compiler credentials and Ollama route are not included or replaced by this update.
- If Account & Sync reports that the table is missing or access is denied, run the supplied SQL script, return to the app and press Sync now. Your browser cache remains available.
- Guest/local data is imported into the first account that successfully connects. Each later account gets its own separate cloud record.
