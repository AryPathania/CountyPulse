# Spec: Home page (simple JD input)

Status: Draft  
Owner: UI Agent  
Date: 2026-01-10

## Goal
A minimalist home screen similar to ChatGPT:
- black background
- centered input box
- short helper text: “Paste your job posting here”
- submit triggers draft generation

## Layout
- top nav:
  - Resumes
  - Bullets
  - Interview
  - Account
- body:
  - heading text
  - centered multiline input (not full-screen)
  - submit button

## Acceptance criteria
- Logged-in user sees home
- Submitting JD creates a job draft and navigates to draft resume

## Test plan
- Playwright:
  - login → home → paste JD → create draft

