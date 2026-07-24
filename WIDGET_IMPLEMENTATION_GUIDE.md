# WIDGET IMPLEMENTATION GUIDE
## How to Add the Eligibility Notification Popup to GWC's Portal

**Audience:** GWC web team / IT staff
**Time to implement:** 15–30 minutes
**Risk:** Zero — the widget is one script tag. Removing it removes everything.

---

## What This Widget Does

When a student logs into MyGWC or the student portal, a popup appears telling them which programs they qualify for (EOPS, CARE, CalWORKs, etc.). The student can:
- **Accept** → they're enrolled, system records it
- **Not now** → popup dismissed for the session, shows again next login

The widget checks the backend first — if the student already accepted or opted out, **nothing shows** (no spam, no repeated popups).

---

## Prerequisites

Before implementing, confirm:
- [ ] The Lambda API is running (it's always on — serverless)
- [ ] You know the API URL: `https://3mag8ec9a2.execute-api.us-west-2.amazonaws.com/prod`
- [ ] You can edit the HTML template for the student portal page

---

## Step 1: Find the Portal Page Template

Locate the HTML file or template that renders the student portal page. This is typically:
- **Banner/MyGWC:** a theme file or custom HTML block in the portal config
- **Slate Portal:** the portal template editor
- **Custom website:** the main `index.html` or layout file

You need to add ONE line to this file.

---

## Step 2: Add the Script Tag

Paste this line **just before the closing `</body>` tag**:

```html
<script 
  src="https://YOUR-BACKEND-URL/widget/gwc-eligibility-widget.js"
  data-cwid="STUDENT_CWID_HERE"
  data-api="https://YOUR-BACKEND-URL">
</script>
```

### Replace the placeholders:

| Placeholder | What to put | Example |
|-------------|-------------|---------|
| `YOUR-BACKEND-URL` | The API URL (Lambda + API Gateway) | `https://3mag8ec9a2.execute-api.us-west-2.amazonaws.com/prod` |
| `STUDENT_CWID_HERE` | The logged-in student's CWID from the session | Depends on your portal system (see Step 3) |

---

## Step 3: Insert the Student's CWID Dynamically

The `data-cwid` attribute must contain the currently logged-in student's ID. How you get this depends on your portal system:

### If using Banner/MyGWC (Ellucian):
```html
<script 
  src="https://YOUR-BACKEND-URL/widget/gwc-eligibility-widget.js"
  data-cwid="<%= student.id %>"
  data-api="https://YOUR-BACKEND-URL">
</script>
```

### If using Slate Portal:
```html
<script 
  src="https://YOUR-BACKEND-URL/widget/gwc-eligibility-widget.js"
  data-cwid="{{record.id}}"
  data-api="https://YOUR-BACKEND-URL">
</script>
```

### If using a custom portal with session data:
```html
<script>
  document.write('<script src="https://YOUR-BACKEND-URL/widget/gwc-eligibility-widget.js" data-cwid="' + window.STUDENT_ID + '" data-api="https://YOUR-BACKEND-URL"><\/script>');
</script>
```

### For testing (hardcoded student):
```html
<script 
  src="https://YOUR-BACKEND-URL/widget/gwc-eligibility-widget.js"
  data-cwid="T00154237"
  data-api="https://YOUR-BACKEND-URL">
</script>
```

---

## Step 4: Test It

1. Open the portal page in your browser
2. The popup should appear if the student has un-notified programs
3. Click "Accept" — popup disappears, backend records it
4. Refresh the page — popup should NOT appear again (already accepted)
5. Open in incognito window — popup appears again (fresh session)

### Troubleshooting:

| Problem | Cause | Fix |
|---------|-------|-----|
| Popup doesn't appear | Student already accepted/opted out | Check `/api/tracking` for that CWID |
| Popup doesn't appear | API unreachable | Check `data-api` URL is correct |
| Popup doesn't appear | No CWID provided | Check `data-cwid` has a value |
| Popup appears every time | sessionStorage cleared | Normal — it uses session, not permanent storage |
| Styling looks wrong | CSS conflict | All widget CSS is scoped to `#gwc-elig-widget` — shouldn't conflict |

---

## Step 5: Go Live

Once testing works:
1. Replace the test CWID with the dynamic session variable (Step 3)
2. Replace the backend URL with the production URL
3. Deploy the portal template change
4. Done — every student who logs in will see the popup if they qualify

---

## How to Remove the Widget

Delete the `<script>` tag. That's it. No database cleanup, no CSS to remove, no other files to delete. The widget is entirely self-contained.

---

## How It Prevents Spam

The widget checks the backend BEFORE showing anything:

```
Student logs in → widget loads → calls /api/tracking
                                        ↓
                          "Has this student been notified?"
                                        ↓
                    YES (accepted/opted out) → shows nothing
                    NO (not yet notified) → shows popup
```

Additionally:
- `sessionStorage` prevents showing twice in the same browser session
- The backend records every acceptance/opt-out permanently
- Re-seeding the database resets everything (for testing only)

---

## Files Involved

| File | Location | Purpose |
|------|----------|---------|
| `gwc-eligibility-widget.js` | S3: `gwc-eligibility-portal` bucket `/widget/` | The widget itself |
| `/api/tracking` | Backend API | Checks student status |
| DynamoDB `ep_students` table | AWS | Stores who accepted/opted out |

---

## Notes for the Team

- The widget is **read-only** — it only checks status, it doesn't write to the database when showing the popup. Writing only happens when the student clicks Accept.
- The widget works on **any website** — it doesn't care if it's Banner, Slate, WordPress, or a custom page. As long as you can paste a script tag, it works.
- The widget loads **asynchronously** — it won't slow down the page. If the API is down, the widget silently does nothing.
- All styling is **scoped** — it uses `#gwc-elig-widget` as a namespace so it won't conflict with existing portal CSS.

---

## Contact

Questions about this widget:
- GitHub: github.com/miaaoyama/GoldenWestBanner
- Widget file: `public/widget/gwc-eligibility-widget.js`
- Backend API docs: see the main README.md
