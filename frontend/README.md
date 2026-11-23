# TenderSathi frontend

React + TypeScript + Tailwind, built with Vite.

## Run it

You need Node.js 20 or newer, and the backend running on http://localhost:8000.

```
cd frontend
npm install
cp .env.example .env
npm run dev
```

Then open http://localhost:5173.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server; the page reloads when a file is saved. |
| `npm run build` | Checks the types and builds the app into `dist/`. |
| `npm run preview` | Serves the built app, to check it before deploying. |
| `npm test` | Runs the tests once (Vitest + React Testing Library). |
| `npm run test:watch` | Runs the tests again every time a file is saved. |

The tests are next to the code they test, named `*.test.ts(x)`:
`pages/RegisterPage.test.tsx` checks the register form's validation, and `mocks.test.ts`
checks that the pretend backend answers like the real one.

## Where things are

```
src/
├── main.tsx        starts the app
├── App.tsx         the list of pages (routes)
├── api.ts          every call to the backend goes through here
├── mocks.ts        pretend backend, used when VITE_USE_MOCKS=true
├── auth.tsx        login state, shared with every page; guards private pages
├── authSchemas.ts  login and register rules (zod, used with react-hook-form)
├── theme.tsx       light / dark / system theme, remembered in the browser
├── exportCsv.ts    saves a report as a CSV file for Excel
├── validation.ts   the checks used by the company profile forms
├── format.ts       how money and dates are shown
├── profileCompleteness.ts  how much of the profile is filled in
├── index.css       loads Tailwind; brand colour, font, and the light and dark
│                   values of every theme colour (change the look here)
├── pages/          one file per screen
│   ├── LoginPage, RegisterPage
│   ├── DashboardPage   overview, "getting started" steps, recent tenders
│   ├── ProfilePage     company profile and past contracts
│   ├── TendersPage     upload, list, analyze, conditions
│   └── ReportPage      eligibility report for one tender, with filters and print
└── components/     pieces used by the pages
    ├── Layout          dark sidebar, top bar with breadcrumbs (slide-in menu on a phone)
    ├── UserMenu        the account menu in the top-right corner (log out is here)
    ├── AuthShell       the split-screen frame of the login and register pages
    ├── Card, PageHeader, EmptyState, Logo
    ├── Field, Button, Message, Spinner, Skeleton
    ├── ConfirmDialog   "are you sure?" box before deleting
    ├── PasswordField   password box with show/hide and a strength meter
    ├── ThemeSwitcher   Light / Dark / System buttons, and the quick toggle
    ├── DonutChart      the ring chart on the dashboard and report
    ├── StatusLabel, TenderStatusBadge
    ├── ProfileForm, PastContracts
    └── UploadTenderForm, ConditionsTable
```

## Working without the backend (mock mode)

Set `VITE_USE_MOCKS=true` in `.env` and restart `npm run dev`. Every request is then
answered by a pretend backend in the browser (`src/mocks.ts`) instead of the real
one, and a "Mock data" bar shows under the navigation. Registering, logging in, the
profile, uploading, analyzing and the report all work, with sample conditions taken
from the backend's `sample_conditions.json`. The data is kept in localStorage; run
`localStorage.removeItem("tendersathi_mock_db")` in the browser console to clear it.

Set it back to `false` (or remove it) to use the real backend at `VITE_API_URL`.

Every page works against the real backend too, including analyzing and the report.
Without a `GEMINI_API_KEY` the backend runs in its own offline fallback mode, so mock
mode is only needed when the backend is not running at all.

## How it is built

### Where the login token is kept, and what that costs

After a successful login the backend returns a JWT. `api.ts` saves it in the
browser's `localStorage` under `tendersathi_token`, and `auth.tsx` keeps a copy in
React state so the screen updates when it changes. Every request adds it as an
`Authorization: Bearer <token>` header. Logging out deletes it from both places; a
401 answer from the backend does the same and sends the user to `/login`.

Why localStorage:

- **The user stays logged in after a refresh**, and in other tabs. Keeping the token
  only in React state would log them out every time the page reloads.
- **No CSRF risk.** The browser never attaches the token on its own; only our code
  adds the header. A malicious site cannot make the user's browser send an
  authenticated request to our API, which it could if the token were a cookie.
- **It works with the backend as it is.** The backend reads a bearer header and does
  not set cookies.

What it costs:

- **Any JavaScript running on the page can read it.** If an attacker ever got script
  into the page (XSS), for example through a compromised npm package or by
  displaying user text as raw HTML, they could copy the token and use it from
  their own machine until it expires.
- **Logging out does not cancel the token.** It only forgets it in this browser. A
  copied token keeps working until it expires, because the backend keeps no list of
  revoked tokens.

How the risk is kept small:

- React escapes everything it displays, and the app never uses
  `dangerouslySetInnerHTML`, so tender text and server messages cannot run as code.
- Tokens expire after 60 minutes (`ACCESS_TOKEN_EXPIRE_MINUTES` in the backend), which
  limits how long a stolen token is useful.
- Only `api.ts` touches the token, so changing how it is stored means changing one file.

The safer alternative is an **httpOnly cookie**, which JavaScript cannot read at all,
so XSS cannot steal it. It needs backend work: setting the cookie on login, reading
it on each request, CSRF protection (a SameSite cookie plus a CSRF token), and CORS
set to allow credentials. That is the right step before real deployment. For the
capstone, localStorage was chosen because it is simpler and the trade-offs above are
understood.

### Why the forms are checked in the browser and again on the server

The two checks do different jobs:

- **The browser check is for the user.** It answers immediately, under the field that
  is wrong, without a network request, and it shows every problem at once. The rules
  for login and register are zod schemas in `authSchemas.ts`, used by
  react-hook-form; the profile forms use the small functions in `validation.ts`.
- **The server check is for security and correctness.** Anything in the browser can be
  skipped: someone can turn off JavaScript, edit the code in the developer tools, or
  call the API directly with curl. So the backend never trusts what it receives and
  checks every rule again (Pydantic schemas in `backend/app/schemas/`). Some rules can
  only be checked on the server anyway, such as "this email is already registered".

The rules are the same on both sides (password at least 8 characters with a letter
and a digit, amounts not negative, contract year from 1990 to this year). When the
server does refuse something, it answers `{ detail, errors: { field: message } }`, and
the forms show `detail` at the top and each `errors` entry under its own field. That
is how "An account with this email already exists" appears under the email field.

### How the components and state are organised

The layers, from the outside in:

1. **`main.tsx`** wraps the app in `BrowserRouter` (addresses) and `AuthProvider`
   (login state), so every page can use both.
2. **`App.tsx`** maps addresses to pages. Private pages sit inside `ProtectedRoute`,
   which sends anyone without a token to `/login`, and inside `Layout`, which draws
   the navigation bar.
3. **`pages/`** has one component per screen. A page loads its own data when it opens
   (`useEffect`), and keeps its loading, error and result state with `useState`.
4. **`components/`** holds the pieces. Some are plain building blocks with no state of
   their own (`Field`, `Button`, `Message`, `StatusLabel`); others are parts of a page
   that look after their own data (`ProfileForm`, `PastContracts`,
   `UploadTenderForm`).
5. **`api.ts`** is the only file that talks to the backend. Components call functions
   like `getProfile()` and never use `fetch` themselves. Addresses, the token, error
   handling and the mock switch all live in this one file.

How the state is divided:

- **Shared by the whole app:** only the login token, in `AuthProvider` (React
  context). It is the one thing many unrelated parts of the app need.
- **Kept on the server:** profiles, contracts, tenders, conditions and reports. Each
  page fetches what it shows when it opens. After a change it either fetches again
  (adding a contract, analyzing a tender) or updates its list only once the server
  has confirmed the change (deleting a contract, uploading a tender). The server
  stays the one source of truth, which is why the app needs no global store such
  as Redux.
- **Kept in one component:** form values, field errors, "saving…" and "loading…"
  flags. Login and register use react-hook-form for this; the other forms use
  `useState`.
- **Passed down or up:** when a parent needs to know about a change, it passes a
  callback. For example, `UploadTenderForm` calls `onUploaded(tender)` so
  `TendersPage` can add the new tender to its list.
