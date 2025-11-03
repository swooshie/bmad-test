# BMAD Demo NodeJS Project – Epic Breakdown

**Author:** Aditya  
**Date:** 2025-11-03  
**Project Level:** Level 2 demo  
**Target Scale:** NYU Admissions manager demo (single Google Sheet source, single MongoDB namespace)  
**Source PRD:** docs/PRD.md (updated 2025-11-03)

---

## Overview

This document decomposes the refreshed PRD into thematic epics and bite-sized stories sized for 200k-context development agents. Each story includes acceptance criteria, prerequisites, and references to the functional requirements (FR) it satisfies so traceability remains intact during implementation.

Epic sequencing emphasizes:

1. Locking down access and configuration so only admissions managers reach the experience.
2. Building a reliable ingest pipeline from Google Sheets into MongoDB with audit-ready signals.
3. Delivering a premium manager dashboard that showcases sync speed, anonymization, and governance cues.
4. Providing observability, audit trails, and operational guardrails for demo readiness.

---

## Epic Structure Summary

1. **Epic A – Secure Access & Configuration**  
   Guard the experience behind NYU admissions manager credentials, manage allowlists, and capture configuration so the demo environment is trustworthy from first load. *(Covers FR-001, FR-002, FR-003)*

2. **Epic B – Sync Automation & Data Integrity**  
   Implement scheduled and manual ingest from Google Sheets into MongoDB, normalize records, and harden error handling so the roster stays accurate within 60 seconds. *(Covers FR-004, FR-005, FR-006, FR-012)*

3. **Epic C – Manager Dashboard Experience**  
   Deliver the responsive spreadsheet-like UI with status banner, anonymization toggle, and governance cues that wow admissions managers during the demo. *(Covers FR-005, FR-007, FR-008, FR-009, FR-011)*

4. **Epic D – Governance & Observability Guardrails**  
   Provide audit trails, telemetry, and operational safeguards so stakeholders can prove accountability and recover quickly if issues arise. *(Covers FR-010 plus supporting NFRs)*

These epics align to the PRD while maintaining independence and 200k-context-friendly scope.

---
