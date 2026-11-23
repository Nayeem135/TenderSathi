// The one place that talks to the backend. Pages never call fetch()
// themselves; they call the functions exported from this file.
//
// It does three jobs:
// 1. reads the backend address from .env (VITE_API_URL),
// 2. adds the login token (JWT) to every request,
// 3. sends the user to the login page when the backend answers 401
//    ("you are not logged in", for example because the token has expired).

import { mockRequest } from "./mocks";

// import.meta.env holds the values from the .env file. If VITE_API_URL is
// not set, fall back to the usual local backend address.
const BASE_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// With VITE_USE_MOCKS=true in .env, no request reaches the backend; the
// pretend backend in mocks.ts answers instead. See that file.
export const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS === "true";

// ---- the token ---------------------------------------------------------------
// The token is kept in the browser's localStorage so the user stays logged
// in after refreshing the page.

const TOKEN_KEY = "tendersathi_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ---- errors ------------------------------------------------------------------

// The backend reports problems as { detail: "...", errors: { field: "..." } }.
// ApiError carries both parts, so a page can show the general message at the
// top of a form and each field's message under that field.
export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// Turns anything that was thrown into a message that can be shown to the user.
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

// ---- the request helper ------------------------------------------------------

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  // A plain object is sent as JSON. A FormData (used for file upload) is
  // sent as it is.
  body?: object | FormData;
  // false for login and register, which are used before there is a token.
  auth?: boolean;
};

// Sends one request and returns the JSON answer.
// <T> is the type of the answer, for example request<Tender[]>("/api/tenders").
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = {};

  // Job 2: attach the token.
  const token = auth ? getToken() : null;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // For a file upload the browser sets the Content-Type itself.
  const isForm = body instanceof FormData;
  if (body && !isForm) {
    headers["Content-Type"] = "application/json";
  }

  // The status code and the JSON answer, from the real backend or the mock.
  let status: number;
  let data: any;

  if (USE_MOCKS) {
    ({ status, data } = await mockRequest(method, path, body, token));
  } else {
    let response: Response;
    try {
      response = await fetch(BASE_URL + path, {
        method,
        headers,
        body: isForm ? body : body ? JSON.stringify(body) : undefined,
      });
    } catch {
      // fetch() itself fails when the backend is not running or there is no network.
      throw new ApiError(0, "Cannot reach the server. Check that the backend is running.");
    }
    status = response.status;
    // Read the JSON answer. If the body is empty or not JSON, use null.
    data = await response.json().catch(() => null);
  }

  // Job 3: the token was refused, so log out and go to the login page.
  if (status === 401 && token) {
    clearToken();
    window.location.assign("/login");
    throw new ApiError(401, "Your session has ended. Please log in again.");
  }

  // 204 means "done, nothing to send back" (used by delete).
  if (status === 204) {
    return undefined as T;
  }

  if (status < 200 || status >= 300) {
    const message = typeof data?.detail === "string" ? data.detail : "Something went wrong.";
    throw new ApiError(status, message, data?.errors ?? {});
  }
  return data as T;
}

// ---- auth (FR-01) ------------------------------------------------------------

export type Firm = { id: number; name: string };

export type User = {
  id: number;
  email: string;
  role: string;
  firm_id: number | null;
  firm: Firm | null;
  created_at: string;
};

// Creates the user and their firm. Does not log them in.
export function register(email: string, password: string, firmName: string): Promise<User> {
  return request<User>("/api/auth/register", {
    method: "POST",
    body: { email, password, firm_name: firmName },
    auth: false,
  });
}

// Returns the token for a correct email and password.
export function login(email: string, password: string): Promise<{ access_token: string }> {
  return request<{ access_token: string }>("/api/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

// The logged-in user and their firm.
export function getMe(): Promise<User> {
  return request<User>("/api/auth/me");
}

// ---- company profile (FR-02) -------------------------------------------------

// What the user can edit. Money amounts travel as text ("30000000.00") so
// that no precision is lost; null means "not filled in".
export type CompanyProfileInput = {
  business_type: string | null;
  trade_licence_no: string | null;
  tin: string | null;
  vat_reg: string | null;
  annual_turnover: string | null;
  liquid_assets: string | null;
  years_of_experience: number | null;
};

// What the server sends back: the same fields plus the ones it fills in.
export type CompanyProfile = CompanyProfileInput & {
  id: number;
  firm_id: number;
  updated_at: string;
};

export type PastContractInput = {
  title: string;
  client: string | null;
  value: string;
  type: string | null;
  year: number;
};

export type PastContract = PastContractInput & { id: number; firm_id: number };

export function getProfile(): Promise<CompanyProfile> {
  return request<CompanyProfile>("/api/profile");
}

// Replaces the whole profile, so every field must be sent.
export function saveProfile(profile: CompanyProfileInput): Promise<CompanyProfile> {
  return request<CompanyProfile>("/api/profile", { method: "PUT", body: profile });
}

export function listContracts(): Promise<PastContract[]> {
  return request<PastContract[]>("/api/profile/contracts");
}

export function addContract(contract: PastContractInput): Promise<PastContract> {
  return request<PastContract>("/api/profile/contracts", { method: "POST", body: contract });
}

export function deleteContract(id: number): Promise<void> {
  return request<void>(`/api/profile/contracts/${id}`, { method: "DELETE" });
}

// ---- tenders (FR-09 to FR-11) ------------------------------------------------

// The largest PDF the backend accepts (its MAX_UPLOAD_SIZE_MB setting).
// Checked in the browser too, so the user is told before a long upload.
export const MAX_UPLOAD_MB = 20;

export type Tender = {
  id: number;
  firm_id: number;
  title: string;
  status: string;
  uploaded_at: string;
};

// One requirement found in a tender document.
export type Condition = {
  id: number;
  category: string;
  text: string;
  page: number | null;
  clause: string | null;
};

export function listTenders(): Promise<Tender[]> {
  return request<Tender[]>("/api/tenders");
}

// A file cannot be sent as JSON, so it goes in a FormData, the same
// format an HTML form uses for uploads.
export function uploadTender(file: File, title: string): Promise<Tender> {
  const form = new FormData();
  form.append("file", file);
  if (title.trim() !== "") {
    form.append("title", title.trim());
  }
  return request<Tender>("/api/tenders", { method: "POST", body: form });
}

// Deletes the tender, its analysis and its PDF. Cannot be undone.
export function deleteTender(tenderId: number): Promise<void> {
  return request<void>(`/api/tenders/${tenderId}`, { method: "DELETE" });
}

// Asks the backend to read the PDF, work out its conditions, and check each
// one against the company profile. This can take a while for a long
// document. Run it again after changing the profile to update the report.
export function analyzeTender(tenderId: number): Promise<unknown> {
  return request<unknown>(`/api/tenders/${tenderId}/analyze`, { method: "POST" });
}

// The conditions found by the last analysis of this tender.
export function getConditions(tenderId: number): Promise<Condition[]> {
  return request<Condition[]>(`/api/tenders/${tenderId}/conditions`);
}

// ---- eligibility report (FR-12 to FR-14) -------------------------------------

export type EligibilityStatus = "met" | "not_met" | "needs_review";

// One condition together with the verdict on whether the firm meets it.
export type ReportItem = Condition & {
  status: EligibilityStatus;
  reason: string;
};

export type EligibilityReport = {
  tender: Tender;
  results: ReportItem[];
};

// The verdict for every condition of a tender, and the tender itself. The
// backend also sends the counts; the report page works them out itself.
export function getReport(tenderId: number): Promise<EligibilityReport> {
  return request<EligibilityReport>(`/api/tenders/${tenderId}/report`);
}
