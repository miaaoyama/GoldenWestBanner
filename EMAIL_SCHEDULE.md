# EMAIL SCHEDULE & ANTI-SPAM RULES

## How the Email System Works

When deployed in production, the email system runs on a fixed schedule with strict anti-spam protections.

---

## Schedule

| Action | When | Frequency |
|--------|------|-----------|
| Eligibility check (new students) | Daily at 2:00 AM Pacific | Mon–Fri only |
| Send notification emails | Daily at 9:00 AM Pacific | Mon–Fri only |
| Flag non-responders for staff | Daily at 6:00 AM Pacific | Mon–Fri only |

**Business hours only:** Emails are NEVER sent on weekends or outside 8AM–5PM Pacific. If the system runs outside these hours, it skips and waits until the next business day.

---

## Anti-Spam Rules

### Rule 1: Maximum 3 emails per program
Each student receives at most 3 emails per program. After the 3rd ignored email, the system **permanently stops** emailing them and flags them for staff phone outreach.

```
Email 1: Sent when student is first identified as eligible
Email 2: Sent 3 days later (if no response)
Email 3: Sent 3 days after that (if still no response)
After 3:  STOP — student flagged for staff to call
```

### Rule 2: Stop after click
If a student clicks **either** Accept or Opt Out, they are **never emailed again** for that program. One click = done.

### Rule 3: Wait between emails
Minimum 3 business days between emails to the same student for the same program. No daily spam.

### Rule 4: Business hours only
Emails only send Monday through Friday, 8:00 AM – 5:00 PM Pacific Time. No weekend emails, no late-night emails.

---

## Timeline for a Typical Student

```
Day 1 (Monday 9AM):    First email sent
                        "Congratulations! You qualify for EOPS..."

Day 2-3:               Waiting for response

Day 4 (Thursday 9AM):  No click detected → Second email sent
                        "Reminder: You qualify for EOPS..."

Day 5-6:               Waiting for response

Day 7 (Monday 9AM):    No click detected → Third email sent (FINAL)
                        "Reminder 3 of 3: Click Accept or Opt Out to stop"

Day 8+:                STOP emailing
                        Student flagged as "Needs Outreach" for staff
                        Dashboard shows red alert
                        Staff should call or meet in person
```

---

## What Stops Emails Immediately

| Student action | Result |
|---------------|--------|
| Clicks "Accept" in email | ✅ Enrolled, never emailed again |
| Clicks "Opt Out" in email | ✅ Opted out, never emailed again |
| Replies "Y" to SMS | ✅ Enrolled, never emailed again |
| Replies "N" to SMS | ✅ Opted out, never emailed again |
| Ignores 3 emails | ⛔ Emails stop, flagged for staff call |

---

## DynamoDB Fields That Control This

| Field | Type | Purpose |
|-------|------|---------|
| `ep_[program]_email_attempts` | Number | How many times emailed (0, 1, 2, or 3) |
| `ep_[program]_email_sent` | DateTime | When the last email was sent |
| `ep_[program]_email_clicked` | DateTime | When student clicked (null = hasn't clicked) |
| `ep_[program]_outreach_status` | String | "needed" after 3 ignored emails |

---

## For Testing (Override Business Hours)

During testing/demo, set this environment variable to skip the business hours check:

```
FORCE_SEND=true
```

This only affects the business hours rule. Max 3 attempts and stop-after-click still apply.

---

## Slate Equivalent

When migrating to Slate, these rules become Slate Campaign settings:
- **Frequency cap:** 3 sends per program
- **Suppression:** suppress after click
- **Schedule:** Slate's built-in send window (Mon-Fri 8AM-5PM)
- **Cadence:** 3-day intervals between sends
