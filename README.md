# GoldenWestBanner
### CANVA LINK FOR PRESENTATION 

https://canva.link/yinchl0ksefm1kj

### Automated Student Eligibility Pipeline — Golden West College

A proactive notification system that matches students to campus support programs based on their enrollment data, sends personalized emails with trackable accept/opt-out links, provides an SMS notification flow, and gives staff a real-time outreach dashboard.

---

## Live Demo Links

| Page | URL |
|------|-----|
| Staff Dashboard | http://gwc-eligibility-portal.s3-website-us-west-2.amazonaws.com/index.html |
| Email Demo | http://gwc-eligibility-portal.s3-website-us-west-2.amazonaws.com/email-preview.html |
| Phone SMS Demo | http://gwc-eligibility-portal.s3-website-us-west-2.amazonaws.com/phone.html |

---

## What It Does

1. **Checks eligibility** — rules engine evaluates each student against 8 program criteria
2. **Sends personalized emails** — via AWS SES with Accept and Opt-out links
3. **SMS notifications** — students can reply Y/N to opt in or out
4. **Tracks responses** — records who clicked, who opted in/out, who hasn't responded
5. **Alerts staff** — shows time-based urgency (24h yellow warning, 48h red alert)
6. **Exports to Slate** — CSV export formatted for direct import into Slate CRM

---

## Architecture

```
S3 (static frontend)  →  API Gateway  →  Lambda  →  DynamoDB
                                                  →  SES (emails)
```

- **S3** — hosts the dashboard, email demo, phone demo (permanent public URL)
- **Lambda** (`gwc-opt-in-handler`) — handles all API calls (tracking, accept, optout, SMS replies)
- **API Gateway** — routes requests to Lambda (public, no auth for demo)
- **DynamoDB** — stores student eligibility status, email tracking, opt-in/out decisions
- **SES** — sends personalized emails with trackable links
- **tracking.js** — separate file that syncs DynamoDB status to the dashboard UI (never overwrite on UI updates)

---

## Programs Matched

| Program | Criteria |
|---------|----------|
| EOPS | Low income + educationally disadvantaged + 12+ units |
| CARE | EOPS eligible + single parent + public assistance |
| CalWORKs | Receiving county CalWORKs cash aid |
| NextUp | Current/former foster youth |
| DSPS | Documented disability |
| Veterans | Veteran or active service member |
| Golden Promise | First-time, full-time CA resident |
| Basic Needs | Housing or food insecurity |

---

## Project Structure

```
GoldenWestBanner/
├── public/                          ← Hosted on S3 (the live site)
│   ├── index.html                   Staff dashboard
│   ├── index.js                     UI interactions
│   ├── portal.js                    Admin panel + eligibility modal
│   ├── students.js                  Student data + eligibility rules engine
│   ├── tracking.js                  DynamoDB sync (DO NOT overwrite on UI updates)
│   ├── email-preview.html           Email demo (cycles through students)
│   ├── phone.html                   SMS demo (iPhone mockup)
│   ├── styles/styles.css            Styling
│   ├── images/                      GWC logo + icons
│   ├── records/                     Individual student record pages
│   ├── txt files/                   Decision export samples
│   └── widget/                      Standalone widget for GWC's Banner portal
├── src/                             ← Localhost tools (seed + send emails)
│   ├── app/api/seed/                Seeds DynamoDB with students
│   ├── app/api/send-emails-batch/   Sends real emails via SES
│   ├── app/api/test-time/           Demo helper (backdate emails)
│   ├── app/api/cron/                Nightly outreach check
│   ├── app/api/dashboard/export/    CSV export for Slate
│   └── lib/db/                      DynamoDB schema + store
├── data/
│   └── eligibility_from_ui.json     Pre-computed eligibility (from students.js rules)
├── EMAIL_SCHEDULE.md                Email anti-spam rules documentation
├── SLATE_MIGRATION_GUIDE.md         Step-by-step for Slate import
├── WIDGET_IMPLEMENTATION_GUIDE.md   How to add widget to GWC's portal
└── README.md
```

---

## AWS Resources

| Service | Resource | Purpose |
|---------|----------|---------|
| S3 | `gwc-eligibility-portal` | Hosts static frontend |
| Lambda | `gwc-opt-in-handler` | API logic (tracking, accept, optout, SMS) |
| API Gateway | `gwc-opt-in-api` | Routes HTTP requests to Lambda |
| DynamoDB | `ep_students` | Student records + tracking |
| DynamoDB | `ep_accept_tokens` | Trackable email/optout link tokens |
| DynamoDB | `ep_outreach_log` | Audit log |
| SES | Sandbox mode | Email delivery |

Region: `us-west-2`

---

## Running Locally (Seed + Send Emails)

```bash
# Install dependencies
npm install

# Login to AWS
aws sso login --profile YOUR_PROFILE

# Start dev server with AWS credentials
eval "$(aws configure export-credentials --profile YOUR_PROFILE --format env)"
FORCE_SEND=true AWS_REGION=us-west-2 npm run dev

# Seed DynamoDB with students
curl http://localhost:3000/api/seed

# Send emails (max 3 per batch)
curl -X POST http://localhost:3000/api/send-emails-batch
```

---

## Updating the UI

When replacing frontend files (portal.js, index.js, students.js, styles):

1. Replace the files in `public/`
2. Make sure `portal.js` contains: `window._refreshAdmin = function() { renderAnalytics(); renderRoster(); };`
3. **DO NOT remove `tracking.js`** from `index.html`
4. Upload to S3: `aws s3 sync public/ s3://gwc-eligibility-portal/`

---

## Email Anti-Spam Rules

See `EMAIL_SCHEDULE.md` for full details:
- Max 3 emails per student per program
- 3 business days between emails
- Business hours only (Mon-Fri 8AM-5PM Pacific)
- Stop immediately after click (accept or opt-out)

---

## Migrating to Slate

See `SLATE_MIGRATION_GUIDE.md` — step-by-step for non-technical staff:
1. Create `ep_` custom fields in Slate
2. Export CSV from `/api/dashboard/export`
3. Import into Slate (matches by CWID)
4. Set up Slate Rules for automation
5. Slate takes over email/SMS/tracking

---

## Key Design Decisions

**Rules-based, not AI** — eligibility criteria are fixed legal requirements (California Title 5). Deterministic, free, instant, auditable.

**Tracking separate from UI** — `tracking.js` is its own file so UI updates never break the DynamoDB connection.

**Single Accept button** — one click accepts all qualified programs. No per-program friction.

**Idempotent sending** — re-running the send job never spams students.

**Slate-ready field naming** — all fields use `ep_` prefix for direct CSV import.

---

## Built With

- AWS (S3, Lambda, API Gateway, DynamoDB, SES)
- Next.js (localhost tools only)
- TypeScript
- UI by Team-13 / DXHub
- GWC brand colors: Primary Green `#0F603D`, Gold `#FFC522`

---

*Golden West College — 15744 Goldenwest St, Huntington Beach, CA 92647*
