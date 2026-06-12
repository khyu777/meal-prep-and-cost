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

## Step 2 — Choose week

Ask the user which week this plan is for:

```
AskUserQuestion({
  "questions": [
    {
      "question": "Which week should these meals be planned for?",
      "header": "Plan week",
      "multiSelect": false,
      "options": [
        { "label": "This week", "description": "Week starting this Sunday" },
        { "label": "Next week", "description": "Week starting next Sunday" },
        { "label": "Custom date", "description": "Enter a specific Sunday (YYYY-MM-DD)" }
      ]
    }
  ]
})
```

Compute `weekStart` as a `YYYY-MM-DD` string:
- "This week" → if today is Sunday, use today; otherwise use the most recent past Sunday
- "Next week" → 7 days after "this week" Sunday
- "Custom date" → ask for the date via a follow-up free-text prompt

---

## Step 3 — Health check

Run: `curl -s http://localhost:3002/health`

If that fails:
> "The backend isn't running. Start it first: `cd backend && npm run dev`"
> Exit.

---

## Step 5 — Run importer

```
cd backend && npm run import-plan -- ../meal-plan/<chosen-file> --week <weekStart>
```

Report the summary printed by the importer (ingredients created/reused/topped-up, meals created/failed, plan created).

If any meals failed, surface the individual error messages from the importer output.
