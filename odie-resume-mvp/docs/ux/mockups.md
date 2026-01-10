# UX mockups (text-first)

Theme:
- black background
- royal blue accents
- white text

## 1) Login

┌───────────────────────────────────────────────┐
│  ODIE RESUME                                   │
│                                               │
│                 [ Email ]                     │
│                 [ Password ]                  │
│                 ( Sign in )                   │
│              ( Create account )               │
└───────────────────────────────────────────────┘


## 2) Home (ChatGPT-like)

┌───────────────────────────────────────────────┐
│  Odie Resume     Resumes  Bullets  Interview  │
│───────────────────────────────────────────────│
│                                               │
│          Paste your job posting here          │
│                                               │
│     ┌───────────────────────────────────┐     │
│     │  (multiline input ~8 lines)       │     │
│     └───────────────────────────────────┘     │
│                ( Generate )                   │
│                                               │
└───────────────────────────────────────────────┘


## 3) Bullets Library

┌───────────────────────────────────────────────┐
│  Odie Resume     Resumes  Bullets  Interview  │
│───────────────────────────────────────────────│
│  Search: [__________]   Filter: [All ▼]       │
│                                               │
│  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Bullet list  │  │  BulletEditor         │  │
│  │ - ...        │  │  Text: [...........]  │  │
│  │ - ...        │  │  Category: [....]     │  │
│  │              │  │  Skills: [chips]      │  │
│  │              │  │  ( Save ) ( Cancel )  │  │
│  └──────────────┘  └───────────────────────┘  │
└───────────────────────────────────────────────┘


## 4) Resume Builder (edit + preview)

┌─────────────────────────────────────────────────────────┐
│  Odie Resume     Resumes  Bullets  Interview            │
│─────────────────────────────────────────────────────────│
│  Resume: [SWE - Ramp ▼]   Template: [classic_v1 ▼]      │
│  ( Preview toggle )  ( Export PDF )                     │
│                                                         │
│  ┌───────────────────────────┐ ┌──────────────────────┐ │
│  │ Builder (DnD)             │ │ Preview (sticky)     │ │
│  │  Experience               │ │  (Rendered resume)   │ │
│  │   [bullet A]  [edit]      │ │                      │ │
│  │   [bullet B]  [edit]      │ │                      │ │
│  │  Projects                 │ │                      │ │
│  │   [bullet C]  [edit]      │ │                      │ │
│  └───────────────────────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────┘


## 5) Interview (text chat)

┌───────────────────────────────────────────────┐
│  Odie Resume     Resumes  Bullets  Interview  │
│───────────────────────────────────────────────│
│  Odie: Let’s start with your most recent job… │
│  You:  ...                                    │
│  Odie: What was the scale? any numbers?       │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ Your answer…                            │  │
│  └─────────────────────────────────────────┘  │
│   ( Send )     ( End interview )              │
└───────────────────────────────────────────────┘
