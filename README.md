# bmad-demo
### A lightweight Node.js + MongoDB demo that syncs an NYU device inventory sheet into a clean, fast web UI

This project is a demo implementation of the BMAD workflow: pulling structured data from a Google Sheet, transforming it into MongoDB, and rendering a fast, spreadsheet-style interface that admissions managers can actually use. It is designed to show how a traditional Sheets-based process can feel instant and reliable when wrapped in a small Node.js service.

The demo focuses on clarity and performance rather than full production depth. It provides a working slice of the BMAD flow: authenticated access, a clean roster UI, automated sync, and audit-friendly signals.

---

## What this demo shows

- Sheet → Database sync  
  A small scheduler and API endpoint ingest the Devices Google Sheet into MongoDB every two minutes or on demand.

- Manager-focused grid UI  
  A responsive table shows device, assignee, status, condition and last-synced information with sorting and filtering.

- Access control  
  Only NYU admissions managers (Google OAuth + allowlist) can view the roster. Unauthorized users are blocked and logged.

- Governance testability  
  Anonymization toggle, sync banner, and audit trail entries demonstrate how oversight would work in a fuller rollout.

The goal is to replicate the feel of a polished internal tool without building the entire production platform.

---

## Tech Stack

- Node.js backend  
- Express APIs  
- MongoDB (Atlas or in-memory)  
- Google Sheets API  
- Google OAuth  
- Lightweight grid front-end (client-rendered)

This keeps the demo small, fast, and easy to deploy.

---

## Core Features (MVP)

1. Secure login for admissions managers (allowlisted `@nyu.edu` accounts)  
2. Scheduled + manual sync from Sheets  
3. Spreadsheet-style device grid with sort/filter  
4. Anonymization toggle for sensitive fields  
5. Audit log of sync and toggle actions  
6. Sync status banner showing last refresh time  
7. Normalized device record structure in MongoDB

---

## Directory Structure

bmad-demo/ \
├── src/ \
│---├── api/ \
│---├── workers/ \
│---├── models/ \
│---├── lib/ \
│---├── views/ \
│---└── utils/ \
├── scripts/ \
│---└── smoke.ts \
├── public/ \
├── docs/ \
│---├── PRD.md \
│---└── epics.md \
├── .env.example \
├── package.json \
└── README.md \

---

## Prerequisites

- Node.js 18+
- npm or pnpm
- MongoDB Atlas connection string (or use in-memory)
- Google Cloud credentials with Sheets API enabled
- A Devices Google Sheet

Populate `.env` based on `.env.example`.

---

## Running the demo

Install packages:
> npm install


Start development server:
> npm run dev


Trigger manual sync:
> curl -X POST http://localhost:3000/api/sync

Run smoke test:
> npm run smoke

Export smoke results:
> npm run smoke – –json smoke-results.json


---

## Smoke Test (scripts/smoke.ts)

The smoke test verifies the entire pipeline:

- spins up an isolated in-memory MongoDB replica set  
- seeds demo device rows  
- runs a full sync  
- records audit events  
- validates device grid data  
- toggles anonymization  
- outputs structured summary  

Designed for CI or local sanity checks.

---

## Deployment (demo-focused)

Optimized for Google App Engine Standard.

1. Configure OAuth, Sheets API, and MongoDB secrets  
2. Allow App Engine IPs in MongoDB Atlas  
3. Deploy via:
   > gcloud app deploy

 Typical demo expectations:

- authenticated load under 2 seconds  
- sheet edits reflected in under ~60 seconds  
- grid interactions under 200 ms  

---

## Goals of the Demo

This repository is *not* an asset-management production system. It is meant to:

1. Demonstrate that BMAD workflows can feel instant and polished  
2. Showcase governance signals  
3. Provide a controlled interface for stakeholder demos  

---

## Reference: PRD

See detailed requirements here: > docs/PRD.md

---

## License

Internal NYU demo use only.
