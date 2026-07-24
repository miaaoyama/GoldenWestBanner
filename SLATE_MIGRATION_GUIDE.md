# SLATE MIGRATION GUIDE
## How to Migrate This System Into Slate

**Audience:** GWC staff (non-technical) who will move this eligibility pipeline into Slate.
**You do NOT need to be a developer to follow this guide.**

---

## What This System Does (Plain English)

1. Checks which campus programs each student qualifies for (EOPS, CARE, CalWORKs, DSPS, NextUp, Promise, Veterans, Basic Needs)
2. Sends each qualifying student a personalized email with an Accept/Opt-out link
3. Provides an SMS notification option (student replies Y or N)
4. Tracks whether the student accepted, opted out, or hasn't responded
5. Shows staff a dashboard with time-based urgency alerts (24h yellow, 48h red)
6. After 3 ignored emails, stops emailing and flags for staff phone outreach

---

## What You're Migrating

The system currently runs on AWS:
- **S3** — hosts the dashboard website
- **Lambda** — handles Accept/Opt-out clicks and tracking
- **DynamoDB** — stores all student tracking data
- **SES** — sends emails

When you migrate to Slate:
- **Slate replaces S3** — Slate Portal becomes the staff dashboard
- **Slate replaces Lambda** — Slate Rules handle automation
- **Slate replaces DynamoDB** — Slate's database stores tracking fields
- **Slate replaces SES** — Slate sends emails natively
- **The eligibility engine stays** — feeds results to Slate via CSV or API

---

## Step 1: Create Custom Fields in Slate

Go to: **Slate → Database → Fields → New Field**

Create these fields using the exact names shown (the `ep_` prefix keeps them grouped):

### Per-Program Fields (repeat for each program: eops, care, calworks, dsps, promise, nextup, basicneeds, vrc)

| Field Name | Type | Options | Description |
|-----------|------|---------|-------------|
| `ep_qualified_programs` | Text | — | Comma-separated list of 100% qualified programs |
| `ep_conditional_programs` | Text | — | Comma-separated list of conditional programs |

### Email Tracking Fields

| Field Name | Type | Description |
|-----------|------|-------------|
| `ep_eops_email_sent` | DateTime | When the notification email was sent |
| `ep_eops_email_clicked` | DateTime | When the student clicked Accept or Opt-out |
| `ep_eops_accepted_date` | DateTime | When student accepted |
| `ep_eops_email_attempts` | Number | How many times emailed (max 3) |

*(Repeat for care, calworks, dsps, promise, nextup, basicneeds, vrc)*

### Staff Outreach Fields

| Field Name | Type | Options | Description |
|-----------|------|---------|-------------|
| `ep_eops_outreach_status` | Dropdown | needed, in_progress, completed, not_needed | Does staff need to reach out? |
| `ep_staff_notes` | Text (long) | — | Free-form notes from staff outreach |
| `ep_outreach_attempts` | Number | — | How many times staff has tried to contact |
| `ep_last_outreach_date` | DateTime | — | When staff last reached out |
| `ep_priority_score` | Number | — | 0–5 priority score (higher = more urgent) |

---

## Step 2: Export Data From Our System

Run this from the localhost development server:

```bash
# Start the server
npm run dev

# Open in browser — downloads CSV file
http://localhost:3000/api/dashboard/export
```

Or use the API directly:
```bash
curl http://localhost:3000/api/dashboard/export > ep_student_export.csv
```

The CSV columns match the Slate field names exactly.

---

## Step 3: Import CSV Into Slate

1. Go to: **Slate → Database → Import**
2. Click **Upload** → select the CSV file
3. Slate shows a column mapping screen:

```
CSV Column              →  Slate Field
──────────────────────     ──────────────────
cwid                    →  [Student ID / CWID]  ← matches existing student
first_name              →  [skip — already in Slate]
last_name               →  [skip — already in Slate]
ep_qualified_programs   →  ep_qualified_programs
ep_conditional_programs →  ep_conditional_programs
ep_eops_email_sent      →  ep_eops_email_sent
ep_eops_email_clicked   →  ep_eops_email_clicked
ep_eops_accepted_date   →  ep_eops_accepted_date
ep_eops_outreach_status →  ep_eops_outreach_status
ep_staff_notes          →  ep_staff_notes
... (map all ep_ fields)
```

4. Click **Import**
5. Slate matches rows to existing students by CWID and fills in the new fields

---

## Step 4: Set Up Slate Rules (Replaces Our Automation)

### Rule 1: Send eligibility notification email

```
Slate → Campaigns → New Campaign:
  Name: "Eligibility Notification"
  Population: ep_qualified_programs IS NOT BLANK AND ep_eops_email_sent IS BLANK
  Template: [Create email with Accept/Opt-out links]
  Schedule: Daily at 9:00 AM Pacific (Mon-Fri only)
  Frequency Cap: Max 3 sends per student
  Cadence: 3 days between sends
  Suppression: Suppress if ep_eops_email_clicked IS NOT BLANK
```

### Rule 2: Flag non-responders after 3 days

```
Slate → Rules → New Rule:
  Name: "Flag non-responders for outreach"
  Condition:
    ep_eops_email_sent IS NOT BLANK
    AND ep_eops_email_clicked IS BLANK
    AND ep_eops_email_sent is older than 3 days
  Action:
    Set ep_eops_outreach_status = "needed"
```

### Rule 3: Stop after 3 ignored emails

```
Slate → Rules → New Rule:
  Name: "Stop emailing after 3 attempts"
  Condition:
    ep_eops_email_attempts >= 3
    AND ep_eops_email_clicked IS BLANK
  Action:
    Set ep_eops_outreach_status = "needed"
    Remove from email campaign population
```

### Rule 4: Send SMS via Slate (Twilio integration)

```
Slate → Campaigns → New SMS Campaign:
  Population: ep_qualified_programs IS NOT BLANK
  Message: "Congratulations [First]! You qualify for [ep_qualified_programs]. 
            Reply Y to opt in or N to opt out."
  Schedule: Same as email campaign
  Suppression: Suppress if already accepted
```

---

## Step 5: Set Up Staff Dashboard in Slate

Replace the S3 dashboard with a Slate Reader:

```
Slate → Reader → New Reader View:
  Name: "Eligibility Pipeline — Staff Dashboard"

  Tab 1: "Needs Outreach"
    Filter: ep_eops_outreach_status = "needed"
    Columns: Name, Email, Programs, Email Sent, Days Since
    Sort: ep_eops_email_sent (oldest first)

  Tab 2: "Recently Accepted"
    Filter: ep_eops_accepted_date IS NOT BLANK (last 30 days)
    Columns: Name, Programs, Accepted Date, Method (email/SMS)

  Tab 3: "All Students"
    Filter: ep_qualified_programs IS NOT BLANK
    Columns: Name, Programs, Status, Priority Score
```

---

## Step 6: Keep the Eligibility Engine Running

The eligibility engine (`students.js` rules) is the one piece Slate cannot replace. It determines which students qualify for which programs.

**Option A — Nightly CSV feed:**
1. Run the eligibility engine nightly (via the localhost server or a scheduled Lambda)
2. Export results as CSV
3. Slate imports the CSV automatically (scheduled import)

**Option B — Direct API integration:**
1. The Lambda (`gwc-opt-in-handler`) stays running on AWS
2. Slate calls the Lambda's `/api/tracking` endpoint to get current eligibility
3. Slate stores the results in its own fields

**Option C — Rebuild rules in Slate:**
1. Recreate the eligibility logic as Slate Rules
2. This is the most work but eliminates the external dependency entirely

---

## What Slate Takes Over vs What Stays

| Component | Currently | After Migration |
|-----------|-----------|-----------------|
| Student profiles | students.js (mock) | Slate (real data from Banner/FAFSA) |
| Eligibility check | students.js rules | Stays external OR rebuilt in Slate |
| Email sending | AWS SES | Slate's built-in email |
| SMS sending | Not active (demo only) | Slate's Twilio integration |
| Click tracking | Lambda + DynamoDB | Slate (automatic, built-in) |
| Staff dashboard | S3 website | Slate Reader |
| Follow-up rules | Lambda cron | Slate Rules |
| Unsubscribe | Manual | Slate (CAN-SPAM compliant, automatic) |
| Student data | DynamoDB | Slate database |

---

## Field Naming Convention

All fields use the `ep_` prefix (eligibility pipeline):
- They're grouped together in Slate's field list
- Staff can search "ep_" to find all pipeline fields
- They won't conflict with existing Slate fields
- Adding new programs = add `ep_[program]_email_sent`, etc.

---

## After Migration Checklist

- [ ] Custom fields created in Slate
- [ ] CSV imported successfully (spot-check 5 students)
- [ ] Email campaign created with correct population filter
- [ ] Frequency cap set to 3 sends
- [ ] Send window set to Mon-Fri 8AM-5PM Pacific
- [ ] Suppression rule active (stop after click)
- [ ] Non-responder rule active (flag after 3 days)
- [ ] Staff Reader view created
- [ ] Eligibility feed scheduled (CSV or API)
- [ ] SMS campaign configured (if using Slate Twilio)
- [ ] Test with 5 students before going live
- [ ] Decommission S3 website + Lambda (after Slate is confirmed working)

---

## FAQ

**Q: Do I need to know how to code?**
A: No. You need Slate admin access. All steps are click-and-configure.

**Q: What if a field name is wrong?**
A: Rename it in Slate. The CSV import maps by column header.

**Q: Can I add more programs later?**
A: Yes. For each new program, add the `ep_[program]_*` fields and update the eligibility engine.

**Q: What happens to the old system after migration?**
A: Once Slate is confirmed working, you can shut down the S3 website, Lambda, and DynamoDB tables. The data lives in Slate permanently.

**Q: What if the school stops using Slate?**
A: The code on GitHub still works independently. Just re-deploy S3 + Lambda.

---

## Contact / Support

- GitHub: github.com/miaaoyama/GoldenWestBanner
- Eligibility rules: `public/students.js`
- Lambda code: deployed as `gwc-opt-in-handler` in AWS us-west-2
- API endpoint: `https://3mag8ec9a2.execute-api.us-west-2.amazonaws.com/prod`
