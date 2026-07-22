# GoldenWestBanner
### EOPS Eligibility Notification System — Golden West College

A Next.js web application that automatically shows a personalised notification banner to students who qualify for the **Extended Opportunity Programs and Services (EOPS)** program at Golden West College.

---

## What It Does

When a student loads the portal page, the system silently checks their academic and financial profile against the official EOPS eligibility criteria. If they qualify, a floating notification card slides in from the top of the screen with:

- A congratulations message addressed to the student by name
- A **"more information"** dropdown listing the eligibility requirements they met
- An **"Accept now"** button that takes them directly to the GWC EOPS application page
- An **"Opt-out"** button to dismiss the banner for the rest of their session
- Confetti animation to make the moment feel celebratory

If the student does not qualify, nothing is shown — no error, no message, the page loads normally.

---

## Why This Approach

### No AI agents or external services
The eligibility check is a pure rules-based engine written in TypeScript. It runs entirely inside the Next.js server — no calls to Bedrock, no Lambda, no third-party APIs. This means:

- **Fast** — the check adds zero latency, it runs in memory
- **Free to operate** — no per-request AI costs
- **Predictable** — the same student profile always produces the same result
- **Auditable** — every decision can be traced back to a specific rule

### Why rules-based and not AI?
EOPS eligibility is defined by California Title 5, Section 56220. The criteria are fixed, publicly documented, and binary (you either meet them or you don't). Using an AI model to answer a question that has a deterministic legal answer would add cost, latency, and unpredictability with no benefit.

### Transparent by design
Because the engine is a weighted checklist rather than a model, every eligibility decision decomposes into exactly which criteria passed and which failed. This matters for a financial aid program — if a student is told they qualify or don't qualify, the system can explain precisely why.

---

## EOPS Eligibility Rules

A student must meet **all five** of the following criteria:

| # | Criterion | Details |
|---|-----------|---------|
| 1 | **California Residency** | Must be a CA Resident or AB540 (undocumented) student |
| 2 | **Full-Time Enrollment** | 12+ units in progress (6+ for DSPS students) |
| 3 | **Unit Ceiling** | Fewer than 70 degree-applicable units completed |
| 4 | **Financial Need** | Qualifies for CA College Promise Grant (BOG Fee Waiver), CCPG, Pell Grant, income bracket ≤ $36k, SAI = 0, or homeless youth status |
| 5 | **Educational Qualifier** | At least one of: no HS diploma/GED, GPA ≤ 2.5, first-generation college student, underrepresented population, or current/former foster youth |

---

## How the Code Works

```
Student loads the page
        │
        ▼
page.tsx passes student profile to <EopsBanner>
        │
        ▼
EopsBanner (client component) sends POST /api/eops
        │
        ▼
src/app/api/eops/route.ts receives the request
        │
        ▼
src/lib/eopsEligibility.ts runs the 5 eligibility checks
        │
    eligible?
    ┌───┴───┐
   YES      NO
    │        │
    ▼        ▼
Banner    Nothing
slides    shown
in with
confetti
```

### File by file

| File | What it does |
|------|-------------|
| `src/app/page.tsx` | The portal page. Holds the student profile (mock for now, replace with real auth session in production) and renders the banner + dashboard |
| `src/app/api/eops/route.ts` | Next.js API route. Receives the student profile via POST, passes it to the eligibility engine, returns the result as JSON |
| `src/lib/eopsEligibility.ts` | The eligibility rules engine. Pure TypeScript — no dependencies, no network calls. Returns `eligible: true/false`, the reasons that passed, the reasons that failed, and the personalised banner message |
| `src/components/EopsBanner.tsx` | The React component. Calls the API on mount, renders the DXHub-designed notification card with confetti and dropdown if eligible. Dismissed per-session via `sessionStorage` |
| `src/components/StudentDashboard.tsx` | Placeholder page body (courses, schedule, resources cards) |
| `src/app/layout.tsx` | Next.js root layout — sets page title and base font |

### Testing locally against fake data

The `eops/` folder contains a Python version of the same rules engine plus a test runner:

```bash
# Run the eligibility check against all 100 fake student profiles
python3 eops/test_runner.py --verbose

# Also export results to CSV
python3 eops/test_runner.py --csv
```

The 100 fake student profiles in `data/students/` mirror the fields that come from CCCApply into Banner SIS and FAFSA/CADAA. They were generated with `data/generate_students.py` and are intended for testing only — every file includes `"data_classification": "FAKE — For Testing Only"`.

Test results on the 100 profiles:
- **26 eligible** (26%) — realistic for an actual EOPS-eligible population
- **74 not eligible** — most common reasons: non-CA residency (47), insufficient units (33)
- **0 missing data** — all profiles had enough information to make a decision

---

## Project Structure

```
GoldenWestBanner/
├── src/
│   ├── app/
│   │   ├── layout.tsx              Root layout
│   │   ├── page.tsx                Student portal page
│   │   └── api/eops/route.ts       EOPS eligibility API endpoint
│   ├── components/
│   │   ├── EopsBanner.tsx          Notification banner (DXHub design)
│   │   └── StudentDashboard.tsx    Page body placeholder
│   └── lib/
│       └── eopsEligibility.ts      TypeScript rules engine
├── eops/
│   ├── eligibility.py              Python rules engine (same logic)
│   └── test_runner.py              Test runner for 100 fake profiles
├── data/
│   ├── students/                   100 fake student JSON profiles
│   ├── generate_students.py        Profile generator script
│   ├── generate_pdf.py             PDF generator for the profiles
│   └── GoldenWest_Student_Profiles.pdf
├── package.json
├── tsconfig.json
└── next.config.js
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Open in browser
# http://localhost:3000
```

Requires Node.js 18 or higher.

---

## Deploying to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → sign in with GitHub
3. Click **Add New Project** → select `GoldenWestBanner`
4. Click **Deploy** — Vercel auto-detects Next.js, no configuration needed

Every push to `main` triggers an automatic redeploy.

---

## Connecting to Real Student Data

The `MOCK_STUDENT_PROFILE` object in `src/app/page.tsx` is a placeholder. In production, replace it with the authenticated student's real data from your identity provider:

```ts
// Example with NextAuth
import { getServerSession } from "next-auth";
const session = await getServerSession();
const profile = await fetchStudentProfile(session.user.cwid);
```

The profile object needs three sections matching the shape in `src/lib/eopsEligibility.ts`:
- `banner_sis` — from Banner SIS (residency, enrollment, units, GPA, special populations)
- `fafsa_cadaa` — from financial aid system (BOG waiver, CCPG, income bracket, Pell, SAI)
- `cccapply` — from CCCApply (HS diploma, foster youth, homeless youth, prior college attendance)

---

## Built With

- [Next.js 14](https://nextjs.org) — React framework (App Router)
- [TypeScript](https://www.typescriptlang.org)
- Banner design by **DXHub**
- EOPS eligibility criteria per California Title 5, §56220 and [GWC EOPS office](https://www.goldenwestcollege.edu/eops/)

---

*Golden West College — 15744 Goldenwest St, Huntington Beach, CA 92647*
