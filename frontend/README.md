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

## Where things are

```
src/
├── main.tsx        starts the app
├── App.tsx         the list of pages (routes)
├── api.ts          every call to the backend goes through here
├── auth.tsx        login state, shared with every page; guards private pages
├── validation.ts   the checks used by the forms
├── format.ts       how money and dates are shown
├── index.css       loads Tailwind
├── pages/          one file per screen
│   ├── LoginPage, RegisterPage
│   ├── ProfilePage     company profile and past contracts
│   ├── TendersPage     upload, list, analyze, conditions
│   └── ReportPage      eligibility report for one tender
└── components/     pieces used by the pages
    ├── Layout          top bar and navigation (collapses to a menu on a phone)
    ├── Field, Button, Message, StatusLabel
    ├── ProfileForm, PastContracts
    └── UploadTenderForm, ConditionsTable
```

## Backend addresses still to confirm

`api.ts` calls three addresses that the backend did not have when this was written:
`POST /api/tenders/{id}/analyze`, `GET /api/tenders/{id}/conditions` and
`GET /api/tenders/{id}/report`. Until the backend provides them, the Analyze button,
the conditions table and the report page show an error. If the backend uses different
addresses or field names, `api.ts` is the only file to change.
