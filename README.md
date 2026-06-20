# LeakLens

<p align="center">
  <img src="./public/favicon.png" width="64" height="64" alt="LeakLens Logo" />
</p>

<p align="center">
  <b>Real-Time Website Security Monitoring Platform</b><br>
  Continuously scan, score, and protect your web assets with actionable intelligence.
</p>

<p align="center">
  <a href="https://app-cam81mtn4utd.appmedo.com" target="_blank"><b>🚀 Live Demo</b></a> ·
  <a href="#features">Features</a> ·
  <a href="#tech-stack">Tech Stack</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#database-schema">Database</a> ·
  <a href="#edge-functions">Edge Functions</a> ·
  <a href="#pages">Pages</a>
</p>

---

## Overview

LeakLens is a production-ready SaaS application that empowers developers, security teams, and agencies to monitor their website security posture in real time. Users add their domains, verify ownership, and receive deep security scans covering SSL/TLS certificates, HTTP headers, DNS health, technology fingerprinting, exposed files, and more.

The platform computes a composite security score (0–100) per site, tracks trends over time, and surfaces vulnerabilities with severity ratings and clear remediation guidance.

## Features

| Feature | Description |
|---------|-------------|
| 🔐 **Domain Verification** | Verify ownership via DNS TXT record, HTML meta tag, or file upload |
| 🚀 **Dual Scan Modes** | Quick scan (~30s) for rapid checks; Full scan for deep analysis |
| 📊 **Security Score** | Composite 0–100 score across SSL, headers, cookies, DNS, exposure, and availability |
| ⏱️ **Auto-Scan Scheduling** | Hourly to monthly schedules with custom cron expressions |
| 📈 **Score History & Trends** | Track security posture changes over time with delta indicators |
| 🏥 **Site Health Dashboard** | Real-time SSL expiry tracking and HTTP response time monitoring |
| ⚡ **Live Health Checks** | One-click "Check Now" button performs live TLS handshakes and HTTP probes via Edge Function |
| 📉 **Risk Score Timeline** | Visual timeline of risk level changes across your portfolio |
| 🕵️ **Tech Stack Fingerprinting** | Detects server technologies, frameworks, and CDN usage |
| 📡 **Vulnerability Intelligence Feed** | Curated feed of recent CVEs and security advisories |
| 🔔 **Smart Notifications** | Alert on critical issues, score drops, SSL expiry, and scan completion |
| 📄 **Shareable Reports** | Generate public share links for scan reports with one toggle |
| 🔍 **Scan Comparison** | Side-by-side comparison of two scans to see improvements or regressions |
| 💳 **Pricing Plans** | $5 Starter and $9 Pro plans with 30-day free trial |
| 🌗 **Dark Mode** | Full dark theme support with system preference detection and toggle |

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + TypeScript + Vite |
| **Styling** | Tailwind CSS + shadcn/ui |
| **State Management** | React Context + Hooks |
| **Backend** | Supabase (Postgres + Auth + Edge Functions) |
| **Edge Runtime** | Deno (Supabase Edge Functions) |
| **Charts** | Recharts |
| **Date Utils** | date-fns |
| **Notifications** | sonner (toast) |
| **Icons** | Lucide React |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           User Browser                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  Landing     │  │  Dashboard   │  │ Site Health  │  │   Scan      │  │
│  │   Page       │  │    Page      │  │    Page      │  │   Pages     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │
│         │                 │                 │                 │         │
│         └─────────────────┴─────────────────┴─────────────────┘         │
│                                   │                                     │
│                    React Router + Context Providers                     │
│                                   │                                     │
└───────────────────────────────────┼─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Supabase Platform                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Supabase Edge Functions (Deno)                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐  │   │
│  │  │ verify-     │  │  run-scan   │  │  site-health-check      │  │   │
│  │  │ domain      │  │             │  │  (TLS + HTTP probe)      │  │   │
│  │  └─────────────┘  └─────────────┘  └──────────────────────────┘  │   │
│  │  ┌─────────────┐  ┌─────────────┐                                  │   │
│  │  │ scheduled-  │  │   CORS      │                                  │   │
│  │  │ scans       │  │   shared    │                                  │   │
│  │  └─────────────┘  └─────────────┘                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    PostgreSQL Database (RLS)                     │   │
│  │  profiles │ websites │ scan_results │ vulnerabilities │ notifications │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      Supabase Auth                               │   │
│  │  Email/Password │ OAuth (Google, GitHub) │ Anonymous │ SSO       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Database Schema

### `profiles`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | FK → auth.users |
| email | text | User email |
| full_name | text | Display name |
| avatar_url | text | Profile picture |
| role | enum | `user` or `admin` |
| email_alerts | boolean | Alert preference |
| alert_score_drop_threshold | int | Notify when score drops below |

### `websites`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK → profiles |
| domain | text | Monitored domain |
| display_name | text | Friendly name |
| verification_status | enum | `pending` / `verified` / `failed` |
| verification_method | enum | `dns_txt` / `meta_tag` / `file_upload` |
| verification_token | text | Verification challenge |
| scan_frequency | enum | `hourly` to `monthly` or `custom` |
| scan_enabled | boolean | Auto-scan toggle |
| last_score | int | Latest security score |
| last_risk_level | enum | `low` / `medium` / `high` / `critical` |
| last_scan_at | timestamptz | Most recent scan time |

### `scan_results`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| website_id | uuid | FK → websites |
| status | enum | `pending` / `running` / `completed` / `failed` |
| score | int | Composite security score (0–100) |
| risk_level | enum | Overall risk assessment |
| ssl_score | int | SSL/TLS sub-score |
| headers_score | int | Security headers sub-score |
| cookies_score | int | Cookie security sub-score |
| dns_score | int | DNS health sub-score |
| domain_score | int | Domain security sub-score |
| exposure_score | int | Exposed files sub-score |
| availability_score | int | Uptime/response sub-score |
| ssl_valid | boolean | Certificate validity |
| ssl_expiry_date | timestamptz | Certificate expiration |
| ssl_issuer | text | Certificate authority |
| https_enforced | boolean | HTTPS redirect check |
| http_status | int | HTTP response code |
| response_time_ms | int | Response time in milliseconds |
| security_headers | jsonb | Headers audit results |
| technologies | text[] | Detected tech stack |
| exposed_files | jsonb | Exposed file findings |
| scan_mode | enum | `quick` or `full` |
| share_token | text | Public report token |
| share_enabled | boolean | Public sharing toggle |
| started_at / completed_at | timestamptz | Scan timing |

### `vulnerabilities`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| scan_id | uuid | FK → scan_results |
| severity | enum | `info` / `low` / `medium` / `high` / `critical` |
| title | text | Vulnerability name |
| description | text | Detailed explanation |
| category | text | e.g. SSL, Headers, Exposure |
| remediation | text | Fix guidance |
| cve_id | text | Associated CVE |
| fixed | boolean | Resolved status |

### `notifications`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK → profiles |
| type | enum | `critical_issue`, `score_drop`, `ssl_expiry`, `scan_complete`, `scan_failed` |
| title | text | Notification headline |
| message | text | Body content |
| website_id | uuid | Related site (optional) |
| read | boolean | Read status |
| created_at | timestamptz | Timestamp |

## Edge Functions

| Function | Path | Purpose |
|----------|------|---------|
| `verify-domain` | `/verify-domain` | Validates domain ownership via DNS, meta tag, or file |
| `run-scan` | `/run-scan` | Performs deep security scan and stores results |
| `scheduled-scans` | `/scheduled-scans` | Cron-triggered scan queue processor |
| `site-health-check` | `/site-health-check` | Live TLS handshake + HTTP probe for real-time SSL/uptime data |

## Pages

### Public Pages
| Route | Description |
|-------|-------------|
| `/` | Landing page with animated hero, feature grid, pricing, and CTA |
| `/login` | Authentication with email/password, OAuth, and SSO |
| `/register` | Account creation with email verification |
| `/pricing` | Plan comparison with feature matrix |
| `/report/:token` | Public shareable scan report (no login required) |

### Dashboard (Auth Required)
| Route | Description |
|-------|-------------|
| `/dashboard` | Minimal overview with stats, site list, tools, and alerts |
| `/websites` | Full site management list |
| `/websites/add` | Add new domain with verification method selection |
| `/websites/:id` | Site detail with scan history, settings, and score trends |
| `/websites/:id/verify` | Domain verification status and instructions |
| `/websites/:id/compare` | Side-by-side scan comparison |
| `/scans` | Global scan history across all sites |
| `/scans/:scanId` | Individual scan detail with vulnerabilities and findings |
| `/scans/:scanId/progress` | Real-time scan progress with animated indicators |
| `/notifications` | All alerts and notifications with read/unread status |
| `/settings` | Profile, preferences, and account management |

### Security Tools (Auth Required)
| Route | Description |
|-------|-------------|
| `/site-health` | SSL expiry + response time dashboard with live checks |
| `/risk-timeline` | Visual timeline of risk level changes per site |
| `/vuln-feed` | Curated vulnerability intelligence and CVE feed |
| `/tech-fingerprint` | Technology detection and stack analysis |
| `/breach-detection` | Breach monitoring and exposure alerts |
| `/ssl-tracker` | Dedicated SSL certificate tracking and timeline |

## Design Highlights

- **Dark Mode** — Full dark theme with system preference detection, manual toggle, and localStorage persistence
- **Animated Hero** — Gradient mesh background with floating orbs and glassmorphism stat cards
- **Minimal Dashboard** — Clean stat row with muted backgrounds, hover-reveal actions, and focused information hierarchy
- **Responsive** — Mobile-first with collapsible sidebar navigation and adaptive grids
- **Accessibility** — Semantic HTML, keyboard navigation, ARIA labels, and focus-visible states
- **Toast Notifications** — Success, error, and info toasts via sonner

## Project Structure

```
├── public/
│   ├── favicon.png
│   └── images/
├── supabase/
│   └── functions/
│       ├── _shared/cors.ts
│       ├── verify-domain/
│       ├── run-scan/
│       ├── scheduled-scans/
│       └── site-health-check/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── routes.tsx
│   ├── index.css
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── layouts/         # AppLayout, sidebar, mobile nav
│   │   ├── scan/            # ScanModeSelector, progress indicators
│   │   └── common/          # RouteGuard, PageMeta
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── ThemeContext.tsx
│   ├── db/
│   │   └── supabase.ts
│   ├── hooks/
│   ├── lib/
│   │   └── utils.ts
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── SiteHealthPage.tsx
│   │   └── ... (27 pages total)
│   ├── services/
│   │   └── api.ts           # All Supabase interactions
│   └── types/
│       └── types.ts         # Shared TypeScript definitions
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── components.json
```

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run linter
npm run lint

# Type check
npx tsc --noEmit
```

## Key Design Decisions

1. **Edge Functions for Security Checks** — All third-party network operations (TLS handshakes, HTTP probes, DNS lookups) run on Deno Edge Functions to keep secrets server-side and avoid CORS issues.
2. **Row-Level Security (RLS)** — Every database table has RLS enabled with explicit policies for `anon`, `authenticated`, and `admin` roles. No table is left unprotected.
3. **Composite Scoring** — Security scores are computed from weighted sub-scores (SSL, headers, cookies, DNS, domain, exposure, availability) rather than a single binary pass/fail.
4. **Scan Modes** — Quick scans provide rapid feedback for CI/CD workflows; full scans perform deep analysis for comprehensive audits.
5. **Minimal Dashboard** — Information density is intentionally low. Critical metrics are immediately visible; secondary actions are hover-revealed to reduce visual noise.

---

<p align="center">
  Built with precision. Monitored with confidence.
</p>
