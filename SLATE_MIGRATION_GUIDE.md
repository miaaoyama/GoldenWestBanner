# SLATE MIGRATION GUIDE
## How to Import This System Into Slate

**Audience:** GWC staff (non-technical) who will move this eligibility pipeline into Slate.
**You do NOT need to be a developer to follow this guide.**

---

## What This System Does (Plain English)

1. Checks if students qualify for EOPS, CARE, and CalWORKs using their Banner data
2. Sends each qualifying student a personalized email with a click-to-accept link
3. Tracks whether the student clicked the link or not
4. If they didn't click within 3 days, flags them for staff follow-up
5. Students who are "conditionally" qualified (need one document) go directly to a staff queue

---

## Step 1: Create Custom Fields in Slate

Go to: **Slate → Database → Fields → New Field**

Create the following fields. Use these exact names so the CSV import maps correctly.

### Program Status Fields

| Field Name | Type | Options | Description |
|-----------|------|---------|-------------|
| `ep_eops_status` | Dropdown | confirmed, conditional, not_eligible, opted_out | EOPS eligibility result |
| `ep_care_status` | Dropdown | confirmed, conditional, not_eligible, opted_out | CARE eligibility result |
| `ep_calworks_status` | Dropdown | confirmed, conditional, not_eligible, opted_out | CalWORKs eligibility result |

### Email Tracking Fields

| Field Name | Type | Description |
|-----------|------|-------------|
| `ep_eops_email_sent` | DateTime | When the EOPS notification email was sent |
| `ep_eops_email_clicked` | DateTime | When the student clicked the link (blank = not clicked) |
| `ep_care_email_sent` | DateTime | When the CARE notification email was sent |
| `ep_care_email_clicked` | DateTime | When the student clicked the link |
| `ep_calworks_email_sent` | DateTime | When the CalWORKs notification was sent |
| `ep_calworks_email_clicked` | DateTime | When the student clicked the link |

### Acceptance Fields

| Field Name | Type | Description |
|-----------|------|-------------|
| `ep_eops_accepted_date` | DateTime | When student clicked "Accept" |
| `ep_eops_tier` | Dropdown (tier1, tier2, tier3) | Which tier they were placed in |
| `ep_care_accepted_date` | DateTime | When student accepted CARE |
| `ep_calworks_accepted_date` | DateTime | When student accepted CalWORKs |

### Staff Outreach Fields

| Field Name | Type | Options | Description |
|-----------|------|---------|-------------|
| `ep_eops_outreach_status` | Dropdown | needed, in_progress, completed, not_needed | Does staff need to reach out? |
| `ep_care_outreach_status` | Dropdown | needed, in_progress, completed, not_needed | Does staff need to reach out? |
| `ep_calworks_outreach_status` | Dropdown | needed, in_progress, completed, not_needed | Does staff need to reach out? |
| `ep_staff_notes` | Text (long) | — | Free-form notes from staff outreach calls |
| `ep_outreach_attempts` | Number | — | How many times staff has tried to contact |
| `ep_last_outreach_date` | DateTime | — | When staff last reached out |

### System Fields

| Field Name | Type | Description |
|-----------|------|-------------|
| `ep_last_eligibility_check` | DateTime | When the system last ran the eligibility check |
| `ep_priority_score` | Number | 0–5 priority score (higher = more urgent need) |
| `ep_pending_items` | Text | What documents the student still needs to provide |

---

## Step 2: Export Data from Our System

Run this command (or ask whoever manages the server):

```
Export location: /dashboard/export (click "Export to CSV" button)
```

The exported CSV will have columns that match the field names above exactly.

**Sample CSV row:**
```
cwid, first_name, last_name, email_gwc, ep_eops_status, ep_eops_email_sent, ep_eops_email_clicked, ep_eops_accepted_date, ep_eops_tier, ep_eops_outreach_status, ep_staff_notes
@30302410, Kylie, Sanchez, ksanchez12@student.goldenwestcollege.edu, confirmed, 2026-07-22T10:00:00Z, 2026-07-22T14:30:00Z, 2026-07-22T14:30:00Z, tier1, not_needed, ""
```

---

## Step 3: Import CSV Into Slate

1. Go to: **Slate → Database → Import**
2. Click **Upload** → select the CSV file
3. Slate will show a column mapping screen:

```
CSV Column              →  Slate Field
──────────────────────     ──────────────────
cwid                    →  [Student ID / CWID]    ← this matches the student
first_name              →  [skip — already in Slate]
last_name               →  [skip — already in Slate]
email_gwc               →  [skip — already in Slate]
ep_eops_status          →  ep_eops_status         ← your new custom field
ep_eops_email_sent      →  ep_eops_email_sent
ep_eops_email_clicked   →  ep_eops_email_clicked
ep_eops_accepted_date   →  ep_eops_accepted_date
ep_eops_tier            →  ep_eops_tier
ep_eops_outreach_status →  ep_eops_outreach_status
ep_staff_notes          →  ep_staff_notes
```

4. Click **Import**
5. Done — every student record now has the eligibility data attached

---

## Step 4: Set Up Slate Rules (Replaces Our Automated System)

Once data is in Slate, create these rules to automate the same workflow:

### Rule 1: Flag students who didn't click (after 3 days)

```
Slate → Rules → New Rule:
  Name: "EP - Flag non-responders for outreach"
  Condition: 
    ep_eops_email_sent IS NOT BLANK
    AND ep_eops_email_clicked IS BLANK
    AND ep_eops_email_sent is older than 3 days
  Action:
    Set ep_eops_outreach_status = "needed"
```

### Rule 2: Auto-assign to staff queue

```
Slate → Rules → New Rule:
  Name: "EP - Assign conditional students to staff"
  Condition:
    ep_eops_status = "conditional"
    OR ep_care_status = "conditional"
    OR ep_calworks_status = "conditional"
  Action:
    Assign to reader bin: "Eligibility Pipeline - Needs Outreach"
```

### Rule 3: Send follow-up email via Slate

```
Slate → Campaigns → New Campaign:
  Name: "EP - EOPS Follow-Up (No Click)"
  Population: ep_eops_outreach_status = "needed"
  Template: [create email with EOPS info + new click link]
  Schedule: 3 days after first email
```

---

## Step 5: Set Up the Staff View in Slate

Replace our `/dashboard` page with a Slate Reader:

```
Slate → Reader → New Reader View:
  Name: "Eligibility Pipeline - Staff Dashboard"
  
  Tab 1: "Needs Outreach"
    Filter: ep_eops_outreach_status = "needed"
            OR ep_care_outreach_status = "needed"
    Columns: Name, Email, Program, Status, Email Sent, Days Since
    Sort: ep_eops_email_sent (oldest first)
  
  Tab 2: "Conditional - Needs Documents"
    Filter: ep_eops_status = "conditional" OR ep_care_status = "conditional"
    Columns: Name, Program, Pending Items, Staff Notes
  
  Tab 3: "Recently Accepted"
    Filter: ep_eops_accepted_date IS NOT BLANK (last 30 days)
    Columns: Name, Program, Accepted Date, Tier
```

---

## Step 6: Ongoing Sync (If Keeping Both Systems Running)

If you want to keep running our eligibility engine AND have Slate, set up a nightly sync:

```
Every night at 2 AM:
  1. Our system runs eligibility checks against Banner
  2. Exports results as CSV
  3. Slate imports the CSV automatically (Slate supports scheduled imports)
  
  OR
  
  Our system calls Slate's API directly:
  POST https://gwc.slate.org/api/v1/update
  Body: { cwid: "@30302410", ep_eops_status: "confirmed", ... }
```

---

## Field Naming Convention

All fields use the `ep_` prefix (short for "eligibility pipeline").

This means:
- They're grouped together in Slate's field list
- Staff can easily find them by searching "ep_"
- They won't conflict with any existing Slate fields
- If you add new programs later (DSPS, NextUp, etc.), just add `ep_dsps_status`, `ep_dsps_email_sent`, etc.

---

## FAQ for School Staff

**Q: Do I need to know how to code?**
A: No. You need Slate admin access to create fields and import CSVs. The instructions above are click-by-click.

**Q: What if a field name is wrong?**
A: Rename it in Slate. The CSV import uses the header row to match — just make sure the CSV column name matches the Slate field name.

**Q: What about students who weren't in the system before?**
A: New students get checked automatically. When you do the next CSV export, their records will be included.

**Q: Can I add more programs later?**
A: Yes. For each new program, add:
- `ep_[program]_status` (Dropdown)
- `ep_[program]_email_sent` (DateTime)
- `ep_[program]_email_clicked` (DateTime)
- `ep_[program]_outreach_status` (Dropdown)

**Q: What if the school stops using our system and only uses Slate?**
A: That's the goal! Once everything is in Slate, you don't need our system anymore. Slate handles email, tracking, staff views, and rules natively. Our system is just the bridge to get there.

---

## Contact / Support

If you have questions about this migration:
- GitHub repo: github.com/miaaoyama/GoldenWestBanner
- The eligibility rules are in: `src/lib/programsEligibility.ts`
- The field definitions match this guide exactly
