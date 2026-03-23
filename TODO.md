# JobAgent App — Master TODO & Product Roadmap

## Status Legend
- ✅ DONE
- 🔧 IN PROGRESS
- ⬜ TODO

---

## PHASE 0: HOUSEKEEPING & QUICK FIXES

✅ Build job scraper (scrapes 24 companies via Greenhouse, Ashby, Lever)
✅ React frontend with dark theme, filters, sort, search, stats dashboard
✅ GitHub Actions daily cron (8 AM ET) — scrape + deploy
✅ AI cover letter generation via Claude API
✅ Quick-Fill contact panel (click-to-copy)
✅ Application status tracking (Ready → Drafted → Applied)
✅ Steel Studio Skin applied
✅ Persist application status across reloads (localStorage)
✅ Set up email notifications (GitHub secrets)
✅ Days-since-posted aging with color coding + date filter
✅ Split personal agent from user-facing product (two repos)

⬜ P0-1: Create GitHub repo (sonnysteele23/job-agent-app) & deploy
⬜ P0-2: Fix PAT workflow scope

---

## PHASE 1: JOB LISTINGS IMPROVEMENTS

✅ P1-1: Auto-load job descriptions from ATS APIs (collapsible accordion)
✅ P1-2: Days-since-posted aging with color coding + date filter
✅ P1-3: Parse salary data from job postings (already implemented in scraper)
✅ P1-4: Add more companies (Duolingo, Discord, Canva, GitLab, Benchling, Reddit, Squarespace, Twitch, GitHub, Spotify, Visa, Bosch)
✅ P1-5: Add SmartRecruiters ATS platform + removed UX-only filter (scrapes ALL roles, matching is client-side)

---

## PHASE 2: USER SYSTEM & MULTI-USER SUPPORT

✅ P2-1: User authentication (Firebase Auth — email/password, sign up/login/reset)
✅ P2-2: User profile page (contact info from parsed resume, Quick-Fill)
✅ P2-3: Backend/database (Firestore — resume, assessment, job states per user)

---

## PHASE 3: RESUME ENGINE

✅ P3-1: Resume upload & parsing (PDF/DOCX → extract work history, skills)
✅ P3-2: Resume assessment & feedback (score ring, issue cards, suggested fixes)
✅ P3-3: Resume rewrite assistant (before/after diff, change log)
✅ P3-4: LinkedIn profile import (PDF export with step-by-step guide)

---

## PHASE 4: INTELLIGENT JOB MATCHING

✅ P4-1: Resume-based job matching (match score badges, "Best Match" sort, resume prompt banner)
✅ P4-2: Smart cover letters (personalized from parsed resume, falls back to hardcoded)

---

## PHASE 5: MONETIZATION

⬜ P5-1: Stripe subscription billing (Free / Pro $19/mo / Premium $39/mo)
⬜ P5-2: Payment flow (pricing page, checkout, billing portal)

---

## PHASE 6: AUTO-APPLY (FUTURE)

⬜ P6-1: Auto-apply to corporate sites (browser automation, TBD)

---

## FUTURE: Upgrade to Firebase Blaze plan for on-demand per-user scraping via Cloud Functions

## BUILD ORDER: P0 → P3 → P1 → P2 → P4 → P5 → P6
