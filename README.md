# BrightHR Lite – QA Automation Technical Task

End-to-end tests for the [BrightHR Lite sandbox](https://sandbox-app.brighthr.com/lite) written with **Playwright + TypeScript**, running in **GitHub Actions**.

> **Quick start for reviewers:** the task's required scenarios are in `tests/employees.spec.ts` and run with `npm run test:positive`. Everything else (negative, boundary, extended and unit tests) is additional coverage.

## Scenarios covered

### Positive paths – the task's required scenarios (`@positive`)
| # | Scenario | File |
|---|----------|------|
| 1 | Navigate to **Employees** from the left-hand panel and add an employee, filling in all fields including optional ones | `tests/employees.spec.ts` |
| 2 | Add another employee | `tests/employees.spec.ts` |
| 3 | Navigate to **Employees** and verify both employees are displayed | `tests/employees.spec.ts` |
| 4 | Run the build in CI | `.github/workflows/playwright.yml` |

### Negative paths (`@negative`)
Every negative test checks **behaviour** (the form or login page stays, nothing is submitted), then the **data** (the bad record is *not* in the list), then the **message** (a *soft* check, so a reworded message is reported without hiding the real result).

| Area | Test | Passes when | File |
|------|------|-------------|------|
| Login | Wrong password for the real account | Rejected, stays on login | `login.negative.spec.ts` |
| Login | Unknown email | Rejected | `login.negative.spec.ts` |
| Login | Badly formatted email | Rejected | `login.negative.spec.ts` |
| Login | Empty email and password | Rejected | `login.negative.spec.ts` |
| Login | Real email, empty password | Rejected | `login.negative.spec.ts` |
| Access control | Logged-out user opens the app | Sent to a login screen, no app content | `login.negative.spec.ts` |
| Required fields | Completely empty form | Save blocked | `employees.negative.spec.ts` |
| Required fields | No first name | Save blocked, not created | `employees.negative.spec.ts` |
| Required fields | No last name | Save blocked, not created | `employees.negative.spec.ts` |
| Required fields | First name of only spaces | Save blocked, not created | `employees.negative.spec.ts` |
| Invalid email ×5 | No @; nothing after @; nothing before @; two @; a space | Save blocked, not created | `employees.negative.spec.ts` |
| Invalid phone ×2 | Letters; symbols only | Characters refused as typed, **or** save blocked. **Currently a known BrightHR defect** (see below). | `employees.negative.spec.ts` |
| Boundary | 256-character first name | Handled gracefully: limited, blocked, or saved and listed | `employees.negative.spec.ts` |
| Security | HTML/script in a name (XSS) | Script never runs | `employees.negative.spec.ts` |
| Duplicate | Second employee with an email already in use | Save blocked, not created | `employees.negative.spec.ts` |
| Cancel | Fill the form, then cancel | Not created | `employees.negative.spec.ts` |

**Account-lockout safety:** the sandbox login is shared, so only one test sends a wrong password for the real email. The unknown-email and bad-format tests use made-up addresses.

### Extended coverage (`@extended`)
Extra positive and boundary tests, kept apart from the required journey so a problem here never blocks scenarios 1–3.

| Area | Test | Passes when | File |
|------|------|-------------|------|
| Saved data | Add an employee, open their profile | Name, email, phone, job title and start date are all shown (phone and date may be formatted differently) | `employees.extended.spec.ts` |
| Real-world names ×2 | *Anne-Marie O'Brien*, *José Núñez* | Saved and listed with the name unchanged | `employees.extended.spec.ts` |
| Boundary | 1-character first name (minimum) | Saved and listed | `employees.extended.spec.ts` |
| Boundary | First name at the length limit, and limit + 1 | Limit + 1 blocked; exactly the limit saved and listed. The limit is read from the field, or found by checking when Save becomes disabled, so the test adapts if BrightHR changes it | `employees.extended.spec.ts` |

### Unit tests (`@unit`) – 58 tests, no browser, about 3 seconds
| File | What it proves |
|------|----------------|
| `tests/unit/employeeFactory.unit.spec.ts` | Generated employees are complete, letters-only names, unique across 1,000 runs, valid `@example.com` emails, UK mobile numbers, past start dates; `ukDate` handles padding, year ends and leap days |
| `tests/unit/env.unit.spec.ts` | `requireEnv` returns and trims values, and fails with a helpful message when a variable is missing, empty or blank |
| `tests/unit/testData.unit.spec.ts` | Every "invalid" email and phone really is invalid (by the HTML standard); the login-URL rule matches login pages and never normal app pages |
| `tests/unit/displayPatterns.unit.spec.ts` | The phone and date patterns used on the profile page accept the formats the app may display (spaces, +44, "5 Sept 2026") and reject near misses |

The original unit tests were **mutation-tested**: removing date padding, shrinking the unique id, changing the email domain, removing trimming and slipping a valid email into the invalid list each made the suite fail.

## Project structure

```
brighthr/
├── .github/workflows/playwright.yml  # CI pipeline (GitHub Actions)
├── pages/
│   ├── LoginPage.ts                  # Page Object: login screen
│   └── EmployeesPage.ts              # Page Object: nav link, add-employee form, list
├── scripts/
│   ├── build-dashboard.cjs           # Builds the test report dashboard
│   ├── dashboard-server.cjs          # Local helper behind the Run tests button
│   └── dashboard-template.html       # Dashboard page design
├── tests/
│   ├── auth.setup.ts                 # Logs in once, saves the session
│   ├── employees.spec.ts             # Scenarios 1–3 (positive)
│   ├── employees.negative.spec.ts    # Required fields, invalid data, duplicate, boundary, XSS, cancel
│   ├── employees.extended.spec.ts    # Saved profile data, real-world names, length boundaries
│   ├── login.negative.spec.ts        # Bad credentials, access control
│   └── unit/                         # 58 browser-free unit tests
├── utils/
│   ├── employeeFactory.ts            # Unique test data generator (Faker)
│   ├── testData.ts                   # Negative/boundary/security test data
│   ├── displayPatterns.ts            # Matches phone numbers and dates as the app displays them
│   ├── env.ts                        # Fails fast if credentials are missing
│   └── paths.ts                      # Shared file paths (saved login session)
├── playwright.config.ts
├── .env.example                      # Template for local credentials
└── package.json
```

## Run it locally

Requires Node.js 20.19 or newer (check with `node -v`).

```bash
npm install
npx playwright install chromium
cp .env.example .env        # then add BRIGHTHR_EMAIL and BRIGHTHR_PASSWORD (see below)
npm run all                 # EVERYTHING: unit + browser tests, then opens the dashboard
npm run all:headed          # same, but you can watch the browser
npm test                    # everything: unit + E2E, headless (no dashboard)
npm run test:unit           # 58 unit tests, no browser (~3 seconds)
npm run test:e2e            # all browser tests (positive + negative)
npm run test:positive       # only the task's 3 scenarios
npm run test:negative       # only the negative paths
npm run test:extended       # only the extended coverage
npm run dashboard:serve     # dashboard with a Run tests button
npm run test:headed         # watch the browser
npm run test:ui             # Playwright UI mode – best for a live demo
npm run report              # open the last HTML report
```

**Credentials:** use the BrightHR Lite account from Step 1 of the task, or the fallback login given in the [task brief](https://github.com/brighthr/QA-Automation). They are never committed to this repo.

## Defects found by this suite

| Defect | Evidence | How the suite handles it |
|---|---|---|
| **The phone number field accepts letters and symbols.** Entering `abc-not-a-phone` or `!!!###$$$` leaves "Save new employee" enabled and the employee is saved. | The two phone-number negative tests on the BrightHR sandbox | Marked with `test.fail()` and a description, so the build stays green, the defect stays documented, and Playwright flags the tests when BrightHR fixes it. The dashboard shows them as **Known defect**. |

**How BrightHR blocks bad data:** on the real site, missing names, invalid emails and a 256-character name **disable the "Save new employee" button**. The tests treat a disabled Save button as "blocked", which is what a user experiences, instead of forcing a click a real user could not make.

## Test report dashboard

### Run tests with one button

```bash
npm run dashboard:serve
```

This opens the dashboard at `http://localhost:4321` with a **Run tests** button. Choose all tests, unit only, required scenarios or negative paths, and optionally tick **Show the browser**. The output streams live on the page, and the results refresh automatically when the run finishes. Press **Ctrl+C** in Terminal to stop the helper.

**Why a helper is needed:** browsers never let a web page run programs on your computer. `scripts/dashboard-server.cjs` is a small built-in Node server (no extra packages) that runs Playwright when you click. It listens on your own machine only, accepts just four fixed run types, and rejects requests from any other website. When the dashboard is opened as a file or a shared link, the button is hidden and a note explains how to get it.

### Build it after a run from Terminal

After a run, build a one-page overview of every scenario:

```bash
npm run test:unit      # results saved to reports/unit.json
npm run test:e2e       # results saved to reports/e2e.json
npm run dashboard      # writes dashboard/index.html
open dashboard/index.html
```

The dashboard lists **all 88 tests**, including any that have not run yet, shown on a test pyramid (unit → extra-coverage E2E → required scenarios). You can filter by layer, status or text, and expand any failure to see its error. CI builds it on every run and uploads it as the `test-dashboard` artifact.

Why both this and Playwright's report: Playwright's HTML report (`npm run report`) is for **debugging** one run, with traces, screenshots and video. The dashboard is for **reviewing coverage and status** at a glance.

## CI

The workflow runs on every push / pull request to `main` and on demand (**Actions → Playwright Tests → Run workflow**). It installs exact dependency versions with `npm ci`, type-checks, runs the unit tests (failing fast if a helper is broken), then the E2E tests, and uploads the HTML report (plus traces, screenshots and videos on failure) as build artifacts.

Credentials come from repository secrets: **Settings → Secrets and variables → Actions** → add `BRIGHTHR_EMAIL` and `BRIGHTHR_PASSWORD`.

## Design decisions (and the alternatives)

| Decision | Why | Alternative and its trade-off |
|---|---|---|
| **Playwright** over Cypress | Auto-waiting, built-in trace viewer, multi-tab/multi-domain support (login lives on a different subdomain), parallelism and cross-browser for free. | Cypress has a friendly runner but historically struggles with cross-origin redirects like the BrightHR login. |
| **TypeScript** | Mistakes in page-object calls fail at compile time; editor autocomplete. | JavaScript – faster start, errors only at runtime. |
| **Page Object Model** | Selectors in one place; tests read like the scenario. | Inline locators – fine for a one-off script, costly to maintain. |
| **Role/label locators with id fallback** | Match what the user sees, survive layout refactors, double as a light accessibility check. | CSS/XPath paths break on any layout change. `data-testid` would be most stable if the app provided it. |
| **Login once in a setup project** (`storageState`) | Faster, and login is tested once instead of hidden in every test. | Logging in inside `beforeEach` – simpler but slower and flakier. |
| **Unique generated data** (Faker + random id) | Shared sandbox is never reset; unique names stop scenario 3 passing on yesterday's data (false positive). `@example.com` emails never reach real people. | Static fixtures – readable, but need a clean database every run. |
| **`test.describe.serial`** | Scenario 3 depends on 1 and 2; serial mode skips later steps if an earlier one fails, so failures point at the real cause. | Fully independent tests (data seeded via API) – better at scale and parallelisable, but not how the task describes the journey. |
| **Web-first assertions, no fixed sleeps** | `expect(...).toBeVisible()` retries until true – no timing flakiness. | `waitForTimeout(5000)` – too short on slow days, wasted time on fast ones. |
| **Retries only in CI, 1 worker** | Absorbs sandbox network blips while still flagging flaky tests; single worker avoids races on one shared account. | Parallel workers need a separate account/data per worker. |
| **Trace/video/screenshot on failure only** | Full debug evidence exactly when needed, small artifacts otherwise. | `trace: 'on'` for every run – great for demos (`--trace on`), heavy for CI. |
| **GitHub Actions** | Free, zero infrastructure, visible from the repo link. `concurrency` stops two runs sharing the account at once. | Jenkins / Azure DevOps / GitLab CI – same steps, different YAML. |

## If a selector ever breaks

BrightHR can change its UI. To find the new locator:

```bash
npm run codegen
```

Log in, click the element, copy the suggested locator into the matching getter in `pages/`, and re-run. Because of the Page Object Model, that is usually a one-line change.

## What I would add next

- Clean-up of created employees (via API) so the shared account does not grow forever.
- Start-date edge cases (today, future dates, impossible dates) once the expected behaviour is confirmed with the team.
- API-level tests for employee creation, keeping UI tests for critical journeys only (testing pyramid).
- Custom Playwright fixtures for page objects, plus ESLint/Prettier in CI.
- Firefox and WebKit projects (already stubbed in the config) and sharding for a larger suite.
- Accessibility checks with `@axe-core/playwright` on the Employees pages.
