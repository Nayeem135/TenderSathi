// Checks that the pretend backend (mocks.ts) answers like the real one, so
// the app behaves the same with VITE_USE_MOCKS=true.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockRequest } from "./mocks";

// The mock waits a little before answering; skip the waiting in tests.
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function call(method: string, path: string, body?: object | FormData, token: string | null = null) {
  const pending = mockRequest(method, path, body, token);
  await vi.runAllTimersAsync();
  return pending;
}

async function registerAndLogin(email = "owner@example.com") {
  await call("POST", "/api/auth/register", { email, password: "secret123", firm_name: "Rahman Builders" });
  const login = await call("POST", "/api/auth/login", { email, password: "secret123" });
  return (login.data as { access_token: string }).access_token;
}

describe("mock backend", () => {
  it("refuses a second account with the same email, like the backend", async () => {
    await registerAndLogin();
    const again = await call("POST", "/api/auth/register", {
      email: "OWNER@example.com",
      password: "secret123",
      firm_name: "Other",
    });
    expect(again).toEqual({
      status: 409,
      data: { detail: "Email already registered", errors: { email: "An account with this email already exists" } },
    });
  });

  it("refuses a wrong password and requests without a token", async () => {
    await registerAndLogin();
    const wrong = await call("POST", "/api/auth/login", { email: "owner@example.com", password: "nope" });
    expect(wrong.status).toBe(401);
    expect((await call("GET", "/api/tenders")).status).toBe(401);
  });

  it("uploads, analyzes, and reports on a tender", async () => {
    const token = await registerAndLogin();

    const form = new FormData();
    form.append("file", new File(["%PDF-1.7"], "Road works.pdf", { type: "application/pdf" }));
    const upload = await call("POST", "/api/tenders", form, token);
    expect(upload.status).toBe(201);
    const tender = upload.data as { id: number; title: string; status: string };
    expect(tender).toMatchObject({ title: "Road works", status: "uploaded" });

    expect((await call("POST", `/api/tenders/${tender.id}/analyze`, undefined, token)).status).toBe(200);

    const conditions = await call("GET", `/api/tenders/${tender.id}/conditions`, undefined, token);
    expect(conditions.data).toHaveLength(7);

    const report = await call("GET", `/api/tenders/${tender.id}/report`, undefined, token);
    const statuses = (report.data as { results: { status: string }[] }).results.map((r) => r.status);
    expect(statuses.filter((s) => s === "met")).toHaveLength(5);
    expect(statuses).toContain("not_met");
    expect(statuses).toContain("needs_review");

    // Analyzing again replaces the old conditions rather than adding more.
    await call("POST", `/api/tenders/${tender.id}/analyze`, undefined, token);
    const again = await call("GET", `/api/tenders/${tender.id}/conditions`, undefined, token);
    expect(again.data).toHaveLength(7);
  });

  it("does not show one firm's tenders to another", async () => {
    const first = await registerAndLogin("first@example.com");
    const form = new FormData();
    form.append("file", new File(["%PDF"], "a.pdf", { type: "application/pdf" }));
    const tender = (await call("POST", "/api/tenders", form, first)).data as { id: number };

    const second = await registerAndLogin("second@example.com");
    expect((await call("GET", "/api/tenders", undefined, second)).data).toEqual([]);
    expect((await call("GET", `/api/tenders/${tender.id}/report`, undefined, second)).status).toBe(404);
  });

  it("refuses a file that is not a PDF", async () => {
    const token = await registerAndLogin();
    const form = new FormData();
    form.append("file", new File(["hello"], "notes.txt", { type: "text/plain" }));
    expect((await call("POST", "/api/tenders", form, token)).status).toBe(415);
  });
});
