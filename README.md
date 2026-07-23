# GoldenWestBanner
### Automated Student Eligibility Pipeline — Golden West College

A proactive notification system that matches students to campus support programs (EOPS, CARE, CalWORKs, and more) based on their enrollment data, sends personalized emails with trackable accept/opt-out links, and provides staff with a real-time outreach dashboard.

---

## What It Does

1. **Checks eligibility** — rules engine evaluates each student against program criteria
2. **Sends personalized emails** — via AWS SES with Accept and Opt-out links
3. **Tracks responses** — records who clicked, who opted in/out, who hasn't responded
4. **Alerts staff** — shows time-based urgency (24h yellow warning, 48h red alert)
5. **Exports to Slate** — CSV export formatted for direct import into Technolutions Slate CRM

---

## Architecture

```
students.js (UI rules engine)  →  DynamoDB (tracking/actions)  →  Portal UI (dashboard)
                                        ↕
                                   AWS SES (emails)
                                        ↕
                                   Phone mockup (SMS simulation)
```

- **Portal UI** (`public/index.html`) — Team-13 student dashboard showing eligibility + tracking status
- **Backend API** (`src/app/api/`) — Next.js API routes that read/write DynamoDB and send emails
- **DynamoDB** — stores student eligibility status, email tracking, opt-in/out decisions, staff notes
- **AWS SES** — sends personalized emails with trackable accept/opt-out links
- **Phone mockup** (`/phone`) — simulates SMS notifications with Y/N reply handling

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

## Running Locally

```bash
# Install dependencies
npm install

# Set up AWS credentials (needed for DynamoDB + SES)
aws sso login --profile YOUR_PROFILE
eval "$(aws configure export-credentials --profile YOUR_PROFILE --format env)"

# Start the dev server
AWS_REGION=us-west-2 npm run dev

# Seed the database with 25 students
open http://localhost:3000/api/seed

# Send emails to all eligible students
curl -X POST http://localhost:3000/api/send-emails-batch

# Open the dashboard
open http://localhost:3000/index.html

# Open the phone SMS mockup
open http://localhost:3000/phone
```

Requires Node.js 18+ and AWS credentials with DynamoDB/SES access.

---

## API Endpoints

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/api/seed` | GET | Seeds DynamoDB with 25 students (same as portal UI) |
| `/api/send-emails-batch` | POST | Sends emails to all confirmed students (idempotent) |
| `/api/accept?token=xxx` | GET | Student clicks Accept link — records in DynamoDB, shows confetti |
| `/api/optout?token=xxx` | GET | Student clicks Opt-out link — records in DynamoDB |
| `/api/tracking` | GET | Returns tracking status for all students |
| `/api/sms-reply` | POST | Handles Y/N SMS replies from phone mockup |
| `/api/sms-accept` | POST | Records SMS opt-in directly by CWID |
| `/api/sms-optout` | POST | Records SMS opt-out directly by CWID |
| `/api/test-time` | GET | Backdates emails for 24h/48h alert demo |
| `/api/cron/check-outreach` | GET | Flags students who haven't responded after 3 days |
| `/api/dashboard` | GET | Returns data for staff views |
| `/api/dashboard/export` | GET | Downloads CSV for Slate import |
| `/api/dashboard/note` | POST | Staff adds notes/logs calls per student |

---

## Project Structure

```
GoldenWestBanner/
├── public/                          ← Dashboard UI (Team-13)
│   ├── index.html                   Main portal page
│   ├── index.js                     Frontend logic
│   ├── portal.js                    Admin panel + eligibility modal + tracking overlay
│   ├── students.js                  Student data + eligibility rules engine
│   ├── styles/styles.css            Styling
│   ├── records/                     Individual student record pages
│   └── widget/                      Standalone widget for GWC's Banner portal
├── src/
│   ├── app/
│   │   ├── api/                     All backend API routes
│   │   ├── phone/page.tsx           SMS phone mockup page
│   │   ├── layout.tsx               Root layout
│   │   └── page.tsx                 Redirects to /index.html
│   ├── components/
│   │   ├── PhoneMockup.tsx          iPhone SMS simulation component
│   │   └── SmsSimulationPanel.tsx   SMS panel (fetches students from DynamoDB)
│   └── lib/
│       ├── db/schema.ts             Database schema (Slate-ready field names)
│       ├── db/store.ts              DynamoDB read/write operations
│       ├── programsEligibility.ts   Multi-program eligibility engine
│       └── sms/sendSms.ts           SMS module (ready, disabled until sender registered)
├── data/
│   └── eligibility_from_ui.json     Pre-computed eligibility (from students.js rules)
├── presentation.pptx                10-slide presentation for Canva
├── SLATE_MIGRATION_GUIDE.md         Step-by-step for school staff to import into Slate
├── WIDGET_IMPLEMENTATION_GUIDE.md   How to add the popup widget to GWC's portal
├── README.md
├── package.json
└── .gitignore
```

---

## AWS Resources Used

| Service | Resource | Purpose |
|---------|----------|---------|
| DynamoDB | `ep_students` table + GSI | Student eligibility + tracking data |
| DynamoDB | `ep_accept_tokens` table | Trackable email link tokens |
| DynamoDB | `ep_outreach_log` table | Audit log of all actions |
| SES | Sandbox mode | Sends notification emails |

Region: `us-west-2` | Account: `731049002539`

---

## Key Design Decisions

**Rules-based, not AI** — eligibility criteria are fixed legal requirements (California Title 5). A rules engine is deterministic, free, instant, and auditable. No Bedrock/AI needed.

**Idempotent email sending** — re-running the send job never spams students. It checks `ep_[program]_email_sent` before sending.

**Slate-ready field naming** — all fields use the `ep_` prefix so they map directly to Slate custom fields on import.

**Single source of truth** — DynamoDB holds all tracking data. The portal UI, phone mockup, and staff tools all read from the same place.

---

## Migrating to Slate

See `SLATE_MIGRATION_GUIDE.md` for complete step-by-step instructions. Summary:
1. Create `ep_` custom fields in Slate
2. Export CSV from `/api/dashboard/export`
3. Import CSV into Slate (matches by CWID)
4. Set up Slate Rules to automate follow-ups
5. Slate takes over email/SMS/tracking natively

---

## Built With

- [Next.js 14](https://nextjs.org) — App Router
- [TypeScript](https://www.typescriptlang.org)
- [AWS DynamoDB](https://aws.amazon.com/dynamodb/) — Database
- [AWS SES](https://aws.amazon.com/ses/) — Email delivery
- UI by **Team-13 / DXHub**
- GWC brand colors: Primary Green `#0F603D`, Gold `#FFC522`

---

*Golden West College — 15744 Goldenwest St, Huntington Beach, CA 92647*
