# Job Agent App

AI-powered job application platform — resume engine, job matching, and cover letter generation.

## What It Does

- **User authentication** — sign up, log in, password reset (Firebase Auth)
- **Resume engine** — upload PDF/DOCX, AI parsing, assessment, and rewrite
- **LinkedIn import** — export your LinkedIn profile as PDF, upload and parse
- **Job scraper** — scrapes tech companies daily via Greenhouse, Ashby & Lever APIs
- **Match scores** — ranks jobs based on your resume's skills and experience
- **Smart cover letters** — AI-generated from your parsed resume, tailored to each role
- **Application tracking** — Ready → Drafted → Applied pipeline (persisted per user)
- **Cloud storage** — all data saved to Firestore, accessible from any device

## Setup

### 1. Install & Run Locally

```bash
npm install
npm start
```

### 2. Environment

- Firebase Auth + Firestore for user data
- Claude API for resume parsing, assessment, and cover letter generation
- GitHub Actions for daily job scraping

## Architecture

```
Firebase Auth → Sign up / Log in
  → Firestore stores resume, assessment, job states per user
  → Security rules: users can only access their own data

GitHub Actions (daily cron)
  → scrape-jobs.js hits company ATS APIs
  → Filters for matching roles
  → Saves to data/jobs.json
  → Deploys to GitHub Pages

React App
  → Loads jobs from data/jobs.json
  → Loads user resume from Firestore
  → Computes match scores (client-side)
  → Cover letters via Claude API (personalized from resume)
```

## Tech Stack

React, Firebase Auth, Firestore, Claude API, GitHub Actions, GitHub Pages
