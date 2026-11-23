// A pretend backend that lives in the browser, used when the .env file has
// VITE_USE_MOCKS=true. It lets the whole frontend be used and demonstrated
// before the real backend has every endpoint (the analysis and report ones
// in particular). Set VITE_USE_MOCKS=false, or leave it out, to use the
// real backend at VITE_API_URL again.
//
// It answers the same addresses as the backend, with the same status codes
// and the same error shape ({ detail, errors }), so api.ts treats its
// answers exactly like real ones. Nothing else in the app knows it exists.
//
// The data is kept in localStorage, so it survives a page refresh. To start
// again from nothing, run localStorage.removeItem("tendersathi_mock_db") in
// the browser console.

import type {
  CompanyProfile,
  Condition,
  EligibilityStatus,
  PastContract,
  ReportItem,
  Tender,
  User,
} from "./api";

// What a pretend request returns: the status code and the JSON body.
export type MockResponse = { status: number; data: unknown };

type MockUser = User & { password: string };

type MockDb = {
  nextId: number;
  users: MockUser[];
  profiles: CompanyProfile[];
  contracts: PastContract[];
  tenders: Tender[];
  conditions: (Condition & { tender_id: number })[];
  results: { condition_id: number; status: EligibilityStatus; reason: string }[];
};

// ---- storage -----------------------------------------------------------------

const DB_KEY = "tendersathi_mock_db";

function emptyDb(): MockDb {
  return { nextId: 1, users: [], profiles: [], contracts: [], tenders: [], conditions: [], results: [] };
}

function loadDb(): MockDb {
  try {
    const saved = localStorage.getItem(DB_KEY);
    return saved ? (JSON.parse(saved) as MockDb) : emptyDb();
  } catch {
    return emptyDb();
  }
}

function saveDb(db: MockDb): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // Storage full or blocked: the data just won't survive a refresh.
  }
}

// ---- the sample analysis -----------------------------------------------------

// What "Analyze" finds in every uploaded tender, with the verdict the report
// gives for each. Taken from the backend's sample_conditions.json so the
// demo looks like the backend's own offline mode.
const SAMPLE: {
  category: string;
  text: string;
  page: number;
  clause: string;
  status: EligibilityStatus;
  reason: string;
}[] = [
  {
    category: "required_document",
    text: "The bidder must hold a valid trade licence, renewed for the current financial year.",
    page: 3,
    clause: "4.1(a)",
    status: "met",
    reason: "A trade licence number is recorded in the company profile.",
  },
  {
    category: "required_document",
    text: "The bidder must have a valid tax identification number and VAT registration certificate.",
    page: 3,
    clause: "4.1(b)",
    status: "met",
    reason: "Both a TIN and a VAT registration are recorded in the company profile.",
  },
  {
    category: "experience",
    text: "The bidder must have at least 5 years of general experience in construction works.",
    page: 4,
    clause: "4.2(a)",
    status: "met",
    reason: "The profile shows 8 years of experience, which is at least 5.",
  },
  {
    category: "similar_contracts",
    text: "The bidder must have successfully completed at least 2 works of similar nature, each valued at not less than 150 lakh, within the last 5 years.",
    page: 4,
    clause: "4.2(b)",
    status: "not_met",
    reason: "Only 1 past contract in the last 5 years is worth at least 150 lakh; 2 are needed.",
  },
  {
    category: "turnover",
    text: "The bidder's average annual construction turnover over the last 3 years must be at least 300 lakh.",
    page: 5,
    clause: "4.3(a)",
    status: "met",
    reason: "The annual turnover in the profile is 350 lakh, which is at least 300 lakh.",
  },
  {
    category: "liquid_assets",
    text: "The bidder must show liquid assets or available credit facilities of at least 75 lakh.",
    page: 5,
    clause: "4.3(b)",
    status: "met",
    reason: "The liquid assets in the profile are 90 lakh, which is at least 75 lakh.",
  },
  {
    category: "other",
    text: "The bidder must have key personnel including a site engineer with a B.Sc. in Civil Engineering.",
    page: 6,
    clause: "4.4(a)",
    status: "needs_review",
    reason: "The company profile does not list staff qualifications, so this needs checking by hand.",
  },
];

// ---- helpers -----------------------------------------------------------------

function ok(data: unknown, status = 200): MockResponse {
  return { status, data };
}

function fail(status: number, detail: string, errors?: Record<string, string>): MockResponse {
  return { status, data: errors ? { detail, errors } : { detail } };
}

const NOT_LOGGED_IN = fail(401, "Not authenticated");
const NOT_FOUND = fail(404, "Not found");

// The pretend token is just "mock-token-<user id>".
function userFromToken(db: MockDb, token: string | null): MockUser | undefined {
  const id = Number(token?.replace("mock-token-", ""));
  return db.users.find((user) => user.id === id);
}

function withoutPassword(user: MockUser): User {
  const { password: _password, ...rest } = user;
  return rest;
}

function profileFor(db: MockDb, firmId: number): CompanyProfile {
  let profile = db.profiles.find((item) => item.firm_id === firmId);
  if (!profile) {
    // Like the backend, an empty profile is created on first use.
    profile = {
      id: db.nextId++,
      firm_id: firmId,
      business_type: null,
      trade_licence_no: null,
      tin: null,
      vat_reg: null,
      annual_turnover: null,
      liquid_assets: null,
      years_of_experience: null,
      updated_at: new Date().toISOString(),
    };
    db.profiles.push(profile);
  }
  return profile;
}

// Waits a little, so loading states can be seen as they would be for real.
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- the pretend endpoints ---------------------------------------------------

export async function mockRequest(
  method: string,
  path: string,
  body: object | FormData | undefined,
  token: string | null,
): Promise<MockResponse> {
  // Analysis is slow in real life; make it slow here too.
  await wait(path.endsWith("/analyze") ? 1500 : 300);

  const db = loadDb();
  const response = route(db, method, path, body, token);
  saveDb(db);
  return response;
}

function route(
  db: MockDb,
  method: string,
  path: string,
  body: object | FormData | undefined,
  token: string | null,
): MockResponse {
  const json = (body ?? {}) as Record<string, unknown>;

  // ---- auth, no token needed

  if (method === "POST" && path === "/api/auth/register") {
    const email = String(json.email ?? "").trim().toLowerCase();
    if (db.users.some((user) => user.email === email)) {
      return fail(409, "Email already registered", {
        email: "An account with this email already exists",
      });
    }
    const firm = { id: db.nextId++, name: String(json.firm_name ?? "").trim() };
    const user: MockUser = {
      id: db.nextId++,
      email,
      password: String(json.password ?? ""),
      role: "owner",
      firm_id: firm.id,
      firm,
      created_at: new Date().toISOString(),
    };
    db.users.push(user);
    return ok(withoutPassword(user), 201);
  }

  if (method === "POST" && path === "/api/auth/login") {
    const email = String(json.email ?? "").trim().toLowerCase();
    const user = db.users.find((item) => item.email === email);
    if (!user || user.password !== json.password) {
      return fail(401, "Invalid email or password");
    }
    return ok({ access_token: `mock-token-${user.id}`, token_type: "bearer" });
  }

  // ---- everything else needs a logged-in user with a firm

  const user = userFromToken(db, token);
  if (!user || user.firm_id === null) return NOT_LOGGED_IN;
  const firmId = user.firm_id;

  if (method === "GET" && path === "/api/auth/me") {
    return ok(withoutPassword(user));
  }

  // ---- company profile

  if (path === "/api/profile") {
    const profile = profileFor(db, firmId);
    if (method === "GET") return ok(profile);
    if (method === "PUT") {
      Object.assign(profile, json, { updated_at: new Date().toISOString() });
      return ok(profile);
    }
  }

  if (path === "/api/profile/contracts") {
    if (method === "GET") {
      return ok(db.contracts.filter((item) => item.firm_id === firmId));
    }
    if (method === "POST") {
      const contract = { ...(json as object), id: db.nextId++, firm_id: firmId } as PastContract;
      db.contracts.push(contract);
      return ok(contract, 201);
    }
  }

  const contractMatch = path.match(/^\/api\/profile\/contracts\/(\d+)$/);
  if (method === "DELETE" && contractMatch) {
    const id = Number(contractMatch[1]);
    const index = db.contracts.findIndex((item) => item.id === id && item.firm_id === firmId);
    if (index === -1) return NOT_FOUND;
    db.contracts.splice(index, 1);
    return ok(null, 204);
  }

  // ---- tenders

  if (path === "/api/tenders") {
    if (method === "GET") {
      const mine = db.tenders.filter((item) => item.firm_id === firmId);
      return ok(mine.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at)));
    }
    if (method === "POST" && body instanceof FormData) {
      const file = body.get("file");
      if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pdf")) {
        return fail(415, "Unsupported file type", { file: "Only PDF files are accepted" });
      }
      const title = String(body.get("title") ?? "").trim() || file.name.replace(/\.pdf$/i, "");
      const tender: Tender = {
        id: db.nextId++,
        firm_id: firmId,
        title,
        status: "uploaded",
        uploaded_at: new Date().toISOString(),
      };
      db.tenders.push(tender);
      return ok(tender, 201);
    }
  }

  const deleteMatch = path.match(/^\/api\/tenders\/(\d+)$/);
  if (method === "DELETE" && deleteMatch) {
    const index = db.tenders.findIndex((t) => t.id === Number(deleteMatch[1]) && t.firm_id === firmId);
    if (index === -1) return NOT_FOUND;
    const [removed] = db.tenders.splice(index, 1);
    const gone = new Set(db.conditions.filter((c) => c.tender_id === removed.id).map((c) => c.id));
    db.conditions = db.conditions.filter((c) => !gone.has(c.id));
    db.results = db.results.filter((r) => !gone.has(r.condition_id));
    return ok(null, 204);
  }

  const tenderMatch = path.match(/^\/api\/tenders\/(\d+)\/(analyze|conditions|report)$/);
  if (tenderMatch) {
    const tender = db.tenders.find(
      (item) => item.id === Number(tenderMatch[1]) && item.firm_id === firmId,
    );
    if (!tender) return NOT_FOUND;
    const action = tenderMatch[2];

    if (method === "POST" && action === "analyze") {
      // Replace any earlier analysis of this tender.
      const old = new Set(db.conditions.filter((c) => c.tender_id === tender.id).map((c) => c.id));
      db.conditions = db.conditions.filter((c) => !old.has(c.id));
      db.results = db.results.filter((r) => !old.has(r.condition_id));

      for (const sample of SAMPLE) {
        const id = db.nextId++;
        const { status, reason, ...condition } = sample;
        db.conditions.push({ ...condition, id, tender_id: tender.id });
        db.results.push({ condition_id: id, status, reason });
      }
      tender.status = "analyzed";
      return ok({ conditions: SAMPLE.length });
    }

    const conditions = db.conditions.filter((c) => c.tender_id === tender.id);

    if (method === "GET" && action === "conditions") {
      return ok(conditions.map(({ tender_id: _tenderId, ...condition }) => condition));
    }

    if (method === "GET" && action === "report") {
      const results: ReportItem[] = conditions.map(({ tender_id: _tenderId, ...condition }) => {
        const result = db.results.find((r) => r.condition_id === condition.id);
        return {
          ...condition,
          status: result?.status ?? "needs_review",
          reason: result?.reason ?? "No verdict was recorded for this condition.",
        };
      });
      return ok({ tender, results });
    }
  }

  return NOT_FOUND;
}
