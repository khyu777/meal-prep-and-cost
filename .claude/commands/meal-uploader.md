# Meal Uploader

Uploads a `tracker-upload-*.json` file to the running backend tracker via
`backend/scripts/import-plan.ts`. Standalone alternative to the confirm-gate
at the end of `/meal-planner`.

---

## Step 1 — Find the upload file

Scan `meal-plan/` for files matching `tracker-upload-*.json`.

**None found:**
> "No tracker-upload file found. Run /meal-planner first."
> Exit.

**Exactly one found:**
Use it directly.

**Multiple found:**
Ask the user which one:

```
AskUserQuestion({
  "title": "Which upload file?",
  "questions": [
    {
      "id": "file",
      "label": "Choose a tracker-upload file to import",
      "type": "select",
      "options": ["tracker-upload-2026-06-06.json", "tracker-upload-2026-06-03.json"]
    }
  ]
})
```

---

## Step 2 — Health check

Run: `curl -s http://localhost:3002/health`

If that fails:
> "The backend isn't running. Start it first: `cd backend && npm run dev`"
> Exit.

---

## Step 3 — Run importer

```
cd backend && npm run import-plan -- ../meal-plan/<chosen-file>
```

Report the summary printed by the importer (ingredients created/reused/topped-up, meals created/failed).

If any meals failed, surface the individual error messages from the importer output.
