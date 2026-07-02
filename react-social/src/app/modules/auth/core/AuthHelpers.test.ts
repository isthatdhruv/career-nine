/**
 * Phase 18 Plan 04 — silent-refresh-and-retry-once interceptor tests.
 *
 * Five scenarios:
 *  (a) 401 → silent refresh → retry succeeds → user sees no interruption.
 *  (b) 401 → silent refresh → retry still 401 → logout + redirect.
 *  (c) refresh itself returns 401 → logout + redirect, original request rejected.
 *  (d) two concurrent 401s share a single /auth/refresh call (dedupe).
 *  (e) 401 on /auth/login is NOT silently refreshed (skip-list).
 *
 * Mocking strategy: replace `axios.defaults.adapter` with a custom adapter that
 * resolves per-request based on a routing table populated by each test. This
 * exercises the FULL interceptor chain (request + response) end-to-end —
 * no axios-mock-adapter dependency required.
 *
 * Per project CLAUDE.md the test file does not run a TypeScript compile
 * check; `react-scripts test` (Jest under the hood) does its own transpile.
 */
import axios from "axios";
import { setupAxios, IMPERSONATION_STORAGE_KEY } from "./AuthHelpers";

// jsdom location mutation for redirect assertions
const originalLocation = window.location;
beforeAll(() => {
  // @ts-ignore
  delete window.location;
  // @ts-ignore
  window.location = { ...originalLocation, href: "" };
});
afterAll(() => {
  // @ts-ignore
  window.location = originalLocation;
});

// Silence the toast import side-effect
jest.mock("../../../utils/toast", () => ({
  showErrorToast: jest.fn(),
}));

// ─── Test adapter ────────────────────────────────────────────────────────────
// Each test registers (method, url) → response handlers. The adapter routes
// every request through them, simulating a real server's status codes.
type Handler = () => [number, any?];
type Routes = Map<string, Handler>;

function makeAdapter(routes: Routes) {
  return (config: any) => {
    const method = (config.method || "get").toLowerCase();
    const url = config.url || "";
    const key = `${method} ${url}`;
    const handler = routes.get(key);
    if (!handler) {
      return Promise.reject(
        Object.assign(new Error(`No handler for ${key}`), {
          config,
          response: { status: 404, data: { message: "No handler" }, config },
        })
      );
    }
    const [status, data] = handler();
    if (status >= 200 && status < 300) {
      return Promise.resolve({
        data,
        status,
        statusText: "",
        headers: {},
        config,
        request: {},
      });
    }
    // Axios rejects non-2xx by default.
    const err: any = new Error(`Request failed with status ${status}`);
    err.config = config;
    err.response = { data: data ?? {}, status, statusText: "", headers: {}, config };
    return Promise.reject(err);
  };
}

describe("AuthHelpers silent-refresh interceptor", () => {
  let routes: Routes;

  beforeAll(() => {
    setupAxios(axios);
  });

  beforeEach(async () => {
    routes = new Map();
    axios.defaults.adapter = makeAdapter(routes) as any;
    window.location.href = "";
    // Flush any pending setTimeout(0) cleanup from a prior test's
    // inFlightRefresh promise — otherwise the module-scope reference can
    // linger and short-circuit the next test's "no refresh expected" path.
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("(a) 401 → silent refresh → retry succeeds → user sees no interruption", async () => {
    let getCalls = 0;
    routes.set("get /data", () => {
      getCalls++;
      return getCalls === 1 ? [401, { message: "Token expired" }] : [200, { ok: true }];
    });
    routes.set("post /auth/refresh", () => [204]);

    const res = await axios.get("/data");

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
    expect(getCalls).toBe(2);
    expect(window.location.href).toBe(""); // no redirect
  });

  test("(b) 401 → silent refresh → retry still 401 → logout + redirect", async () => {
    routes.set("get /data", () => [401, {}]);
    routes.set("post /auth/refresh", () => [204]);

    await expect(axios.get("/data")).rejects.toBeDefined();
    expect(window.location.href).toBe("/auth");
  });

  test("(c) refresh itself returns 401 → logout + redirect, original request rejected", async () => {
    routes.set("get /data", () => [401, {}]);
    routes.set("post /auth/refresh", () => [401, {}]);

    await expect(axios.get("/data")).rejects.toBeDefined();
    expect(window.location.href).toBe("/auth");
  });

  test("(d) two concurrent 401s share a single /auth/refresh call (dedupe)", async () => {
    let refreshCalls = 0;
    let aCalls = 0;
    let bCalls = 0;
    routes.set("get /dataA", () => {
      aCalls++;
      return aCalls === 1 ? [401, {}] : [200, { which: "A" }];
    });
    routes.set("get /dataB", () => {
      bCalls++;
      return bCalls === 1 ? [401, {}] : [200, { which: "B" }];
    });
    routes.set("post /auth/refresh", () => {
      refreshCalls++;
      return [204];
    });

    // Fire both at the same tick so they 401 before either has finished refreshing.
    const [resA, resB] = await Promise.all([
      axios.get("/dataA"),
      axios.get("/dataB"),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.data).toEqual({ which: "A" });
    expect(resB.data).toEqual({ which: "B" });
    // CRITICAL: exactly one /auth/refresh call, despite two concurrent 401s.
    expect(refreshCalls).toBe(1);
  });

  test("(e) 401 on /auth/login is NOT silently refreshed (skip-list)", async () => {
    let refreshCalls = 0;
    routes.set("post /auth/login", () => [401, {}]);
    routes.set("post /auth/refresh", () => {
      refreshCalls++;
      return [204];
    });

    await expect(
      axios.post("/auth/login", { email: "x", password: "y" })
    ).rejects.toBeDefined();
    expect(refreshCalls).toBe(0);
    expect(window.location.href).toBe("/auth");
  });
});

describe("impersonation interceptor", () => {
  // Note: window.location is replaced with a plain mock object in the
  // top-level beforeAll (for redirect assertions), so history.pushState
  // does not update it — set pathname directly on the mock instead.
  beforeEach(() => {
    window.location.pathname = "/student/dashboard";
  });

  afterEach(() => {
    sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY);
    window.location.pathname = "/";
  });

  it("injects Bearer and disables credentials when impersonating an own-API call", async () => {
    sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, "imp.jwt.token");
    let seen: any = null;
    axios.defaults.adapter = (async (config: any) => {
      seen = config;
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    }) as any;

    await axios.get(`${process.env.REACT_APP_API_URL}/student-portal/my-info/1`);

    expect(seen.headers.Authorization).toBe("Bearer imp.jwt.token");
    expect(seen.withCredentials).toBe(false);
  });

  it("leaves credentials on and adds no Bearer when not impersonating", async () => {
    let seen: any = null;
    axios.defaults.adapter = (async (config: any) => {
      seen = config;
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    }) as any;

    await axios.get(`${process.env.REACT_APP_API_URL}/student-portal/my-info/1`);

    expect(seen.headers.Authorization).toBeUndefined();
    expect(seen.withCredentials).toBe(true);
  });

  it("does not inject Bearer even with an impersonation JWT set, when the tab is on a non-student route (admin tab falls back to normal cookie session)", async () => {
    sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, "imp.jwt.token");
    window.location.pathname = "/group-student";
    let seen: any = null;
    axios.defaults.adapter = (async (config: any) => {
      seen = config;
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    }) as any;

    await axios.get(`${process.env.REACT_APP_API_URL}/student-portal/my-info/1`);

    expect(seen.headers.Authorization).toBeUndefined();
    expect(seen.withCredentials).toBe(true);
  });
});
