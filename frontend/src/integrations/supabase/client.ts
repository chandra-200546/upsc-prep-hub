type AnyRow = Record<string, any>;
type Result<T = any> = Promise<{ data: T; error: any }>;

const backendCandidates = () => {
  const configured = (import.meta.env.VITE_BACKEND_URL || "").trim();
  const hostDerived =
    typeof window !== "undefined" && window.location?.hostname
      ? `${window.location.protocol}//${window.location.hostname}:8787`
      : "";
  const fromWindow = typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
  const local = "http://localhost:8787";
  const localAlt = "http://127.0.0.1:8787";
  return Array.from(
    new Set([configured, hostDerived, local, localAlt, fromWindow].filter(Boolean).map((x) => x.replace(/\/$/, ""))),
  );
};

let activeBackendBase = backendCandidates()[0] || "http://localhost:8787";
const ALLOW_LOCAL_FALLBACK = String(import.meta.env.VITE_ALLOW_LOCAL_FALLBACK || "").toLowerCase() === "true";
const SESSION_KEY = "upsc_backend_session";
const LOCAL_USER_KEY = "upsc_local_user";

const nowIso = () => new Date().toISOString();
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const profileDefaults = {
  id: "local-user-1",
  name: "Aspirant",
  email: "aspirant@local.app",
  target_year: 2027,
  optional_subject: "Public Administration",
  mentor_personality: "friendly",
  total_xp: 0,
  level: 1,
  current_streak: 1,
  last_login_date: nowIso().slice(0, 10),
  profile_photo_url: "",
  created_at: nowIso(),
};

const db = new Map<string, AnyRow[]>();
db.set("profiles", [profileDefaults]);
db.set("chat_messages", []);
db.set("prelims_attempts", []);
db.set("mains_submissions", []);
db.set("study_plan", []);
db.set("upsc_smart_notes", []);

const getTable = (name: string) => {
  if (!db.has(name)) db.set(name, []);
  return db.get(name)!;
};

let currentSession: any = null;
const listeners = new Set<(event: string, session: any) => void>();

const emitAuth = (event: string, session: any) => {
  listeners.forEach((cb) => cb(event, session));
};

const getLocalUser = () => {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const normalizeSession = (session: any | null) => {
  if (!session?.user) return null;
  return {
    access_token: session.access_token || `local-token-${session.user.id}`,
    refresh_token: session.refresh_token || `local-refresh-${session.user.id}`,
    user: session.user,
  };
};

const storeSession = (session: any | null) => {
  const normalized = normalizeSession(session);
  currentSession = normalized;
  if (normalized?.access_token) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
};

const loadStoredSession = () => {
  if (currentSession?.access_token) return currentSession;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.access_token && parsed?.user?.id) {
        currentSession = parsed;
        return currentSession;
      }
    }
  } catch {
    // ignore
  }

  const localUser = getLocalUser();
  if (localUser?.id) {
    currentSession = {
      access_token: `local-token-${localUser.id}`,
      refresh_token: `local-refresh-${localUser.id}`,
      user: { id: localUser.id, email: localUser.email || "" },
    };
    return currentSession;
  }

  return null;
};

const authHeaders = () => {
  const token = currentSession?.access_token || loadStoredSession()?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const apiPost = async (path: string, body: unknown, extraHeaders?: Record<string, string>) => {
  const attempts = [activeBackendBase, ...backendCandidates().filter((c) => c !== activeBackendBase)];
  let lastErr = "";
  for (const base of attempts) {
    try {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
          ...(extraHeaders || {}),
        },
        body: JSON.stringify(body ?? {}),
      });
      const raw = await response.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      if (response.ok) {
        if (!data || typeof data !== "object") {
          throw new Error("Invalid backend response");
        }
        activeBackendBase = base;
        return { data, error: null };
      }
      if (response.status === 404 && base !== attempts[attempts.length - 1]) continue;
      return { data: null, error: data || { message: `Request failed: ${path}` } };
    } catch (error: any) {
      lastErr = error?.message || String(error || "");
      // try next candidate
    }
  }
  return { data: null, error: { message: `Failed to fetch backend API (${attempts.join(", ")}). ${lastErr}`.trim() } };
};

const apiGet = async (path: string) => {
  const attempts = [activeBackendBase, ...backendCandidates().filter((c) => c !== activeBackendBase)];
  let lastErr = "";
  for (const base of attempts) {
    try {
      const response = await fetch(`${base}${path}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
      });
      const raw = await response.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      if (response.ok) {
        if (!data || typeof data !== "object") {
          throw new Error("Invalid backend response");
        }
        activeBackendBase = base;
        return { data, error: null };
      }
      if (response.status === 404 && base !== attempts[attempts.length - 1]) continue;
      return { data: null, error: data || { message: `Request failed: ${path}` } };
    } catch (error: any) {
      lastErr = error?.message || String(error || "");
      // try next candidate
    }
  }
  return { data: null, error: { message: `Failed to fetch backend API (${attempts.join(", ")}). ${lastErr}`.trim() } };
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

class QueryBuilder {
  private table: string;
  private filters: Array<{ col: string; value: any; op?: "eq" | "gte" | "lte" }> = [];
  private sort: { col: string; ascending: boolean } | null = null;
  private take: number | null = null;
  private action: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private rows: AnyRow[] = [];
  private patch: AnyRow = {};
  private selectedColumns = "*";
  private singleMode: "none" | "single" | "maybeSingle" = "none";

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*") {
    this.selectedColumns = columns;
    return this;
  }

  insert(payload: AnyRow | AnyRow[]) {
    this.action = "insert";
    this.rows = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  upsert(payload: AnyRow | AnyRow[]) {
    this.action = "upsert";
    this.rows = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(values: AnyRow) {
    this.action = "update";
    this.patch = values || {};
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(col: string, value: any) {
    this.filters.push({ col, value, op: "eq" });
    return this;
  }

  gte(col: string, value: any) {
    this.filters.push({ col, value, op: "gte" });
    return this;
  }

  lte(col: string, value: any) {
    this.filters.push({ col, value, op: "lte" });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.sort = { col, ascending: opts?.ascending !== false };
    return this;
  }

  limit(value: number) {
    this.take = value;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  then(resolve: (value: { data: any; error: any }) => void, reject?: (reason?: any) => void) {
    this.exec().then(resolve).catch(reject);
  }

  private localFilter(rows: AnyRow[]) {
    let result = [...rows];
    for (const f of this.filters) {
      result = result.filter((row) => {
        const left = row?.[f.col];
        const right = f.value;
        if (f.op === "gte") return left >= right;
        if (f.op === "lte") return left <= right;
        return left === right;
      });
    }
    if (this.sort) {
      result.sort((a, b) => {
        const av = a?.[this.sort!.col];
        const bv = b?.[this.sort!.col];
        if (av === bv) return 0;
        if (this.sort!.ascending) return av > bv ? 1 : -1;
        return av < bv ? 1 : -1;
      });
    }
    if (this.take !== null) result = result.slice(0, this.take);
    return result;
  }

  private localExec() {
    const rows = getTable(this.table);

    if (this.action === "select") return this.localFilter(rows);

    if (this.action === "insert") {
      const inserted = this.rows.map((r) => {
        const row = { id: r.id || uid(), created_at: r.created_at || nowIso(), ...r };
        rows.push(row);
        return row;
      });
      return inserted;
    }

    if (this.action === "upsert") {
      const out: AnyRow[] = [];
      this.rows.forEach((r) => {
        const id = r.id || uid();
        const idx = rows.findIndex((x) => x.id === id);
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...r, id, updated_at: nowIso() };
          out.push(rows[idx]);
        } else {
          const created = { id, created_at: r.created_at || nowIso(), ...r };
          rows.push(created);
          out.push(created);
        }
      });
      return out;
    }

    if (this.action === "update") {
      const target = this.localFilter(rows);
      target.forEach((r) => Object.assign(r, this.patch, { updated_at: nowIso() }));
      return target;
    }

    const target = this.localFilter(rows);
    const ids = new Set(target.map((r) => r.id));
    const kept = rows.filter((r) => !ids.has(r.id));
    db.set(this.table, kept);
    return target;
  }

  private finish(data: any, error: any) {
    if (error) return { data: null, error };
    if (this.singleMode === "single" || this.singleMode === "maybeSingle") {
      return { data: Array.isArray(data) ? data[0] ?? null : data ?? null, error: null };
    }
    return { data: Array.isArray(data) ? data : data ?? [], error: null };
  }

  private async exec(): Result<any> {
    let response: { data: any; error: any } = { data: null, error: null };
    if (this.action === "select") {
      response = await apiPost("/functions/v1/db/select", {
        table: this.table,
        columns: this.selectedColumns,
        filters: this.filters,
        order: this.sort,
        limit: this.take,
      });
      if (!response.error) return this.finish(response.data?.data, null);
    } else if (this.action === "insert") {
      response = await apiPost("/functions/v1/db/insert", { table: this.table, rows: this.rows, columns: this.selectedColumns });
      if (!response.error) return this.finish(response.data?.data, null);
    } else if (this.action === "upsert") {
      response = await apiPost("/functions/v1/db/upsert", { table: this.table, rows: this.rows, columns: this.selectedColumns });
      if (!response.error) return this.finish(response.data?.data, null);
    } else if (this.action === "update") {
      response = await apiPost("/functions/v1/db/update", {
        table: this.table,
        patch: this.patch,
        filters: this.filters,
        columns: this.selectedColumns,
      });
      if (!response.error) return this.finish(response.data?.data, null);
    } else {
      response = await apiPost("/functions/v1/db/delete", { table: this.table, filters: this.filters, columns: this.selectedColumns });
      if (!response.error) return this.finish(response.data?.data, null);
    }

    if (ALLOW_LOCAL_FALLBACK) {
      return this.finish(this.localExec(), null);
    }
    return this.finish(null, response.error || { message: "Backend request failed and local fallback is disabled." });
  }
}

const invokeFunction = async (name: string, args?: { body?: unknown; headers?: Record<string, string> }) => {
  const { data, error } = await apiPost(`/functions/v1/${name}`, args?.body ?? {}, args?.headers);
  if (error) return { data: null, error };
  return { data, error: null };
};

const createChannel = () => {
  const channel: any = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: () => undefined,
  };
  return channel;
};

export const supabase: any = {
  auth: {
    getSession: async () => {
      const stored = loadStoredSession();
      if (stored?.access_token) {
        const { data, error } = await apiGet("/functions/v1/auth/session");
        if (!error && data?.session) {
          storeSession(data.session);
          return { data: { session: data.session }, error: null };
        }
        return { data: { session: stored }, error: null };
      }
      return { data: { session: null }, error: null };
    },
    getUser: async () => {
      const { data } = await supabase.auth.getSession();
      return { data: { user: data?.session?.user ?? null }, error: null };
    },
    onAuthStateChange: (cb: any) => {
      const session = loadStoredSession();
      if (typeof cb === "function") listeners.add(cb);
      cb?.(session ? "SIGNED_IN" : "SIGNED_OUT", session);
      return {
        data: {
          subscription: {
            unsubscribe: () => listeners.delete(cb),
          },
        },
      };
    },
    signInWithPassword: async ({ email, password }: any) => {
      const { data, error } = await apiPost("/functions/v1/auth/login", { email, password });
      if (error) return { data: { session: null, user: null }, error };
      const session = normalizeSession(data?.session ?? null);
      storeSession(session);
      emitAuth("SIGNED_IN", session);
      return { data: { session, user: session?.user ?? null }, error: null };
    },
    signUp: async ({ email, password, options }: any) => {
      const { data, error } = await apiPost("/functions/v1/auth/signup", {
        email,
        password,
        name: options?.data?.name || "Aspirant",
      });
      if (error) return { data: { session: null, user: null }, error };
      const session = normalizeSession(data?.session ?? null);
      storeSession(session);
      emitAuth("SIGNED_IN", session);
      return { data: { session, user: session?.user ?? null }, error: null };
    },
    signInWithIdToken: async ({ provider, token }: any) => {
      if (String(provider || "").toLowerCase() !== "google") {
        return { data: { session: null, user: null }, error: { message: "Unsupported provider" } };
      }
      const { data, error } = await apiPost("/functions/v1/auth/google", { idToken: token });
      if (error) return { data: { session: null, user: null }, error };
      const session = normalizeSession(data?.session ?? null);
      storeSession(session);
      emitAuth("SIGNED_IN", session);
      return { data: { session, user: session?.user ?? null }, error: null };
    },
    resetPasswordForEmail: async (email: string, options?: any) => {
      const newPassword = String(options?.newPassword || "").trim();
      if (!newPassword) {
        return { data: null, error: { message: "newPassword is required" } };
      }
      const { data, error } = await apiPost("/functions/v1/auth/forgot-password", { email, newPassword });
      if (error) return { data: null, error };
      return { data: data ?? { ok: true }, error: null };
    },
    updateUser: async ({ password, currentPassword }: any) => {
      const { data, error } = await apiPost("/functions/v1/auth/update-password", {
        currentPassword: String(currentPassword || ""),
        newPassword: String(password || ""),
      });
      if (error) return { data: null, error };
      return { data: data ?? { ok: true }, error: null };
    },
    signOut: async () => {
      await apiPost("/functions/v1/auth/logout", {});
      storeSession(null);
      emitAuth("SIGNED_OUT", null);
      return { error: null };
    },
    setSession: async (session: any) => {
      const normalized = normalizeSession(session);
      storeSession(normalized);
      emitAuth("SIGNED_IN", normalized);
      return { data: { session: normalized }, error: null };
    },
  },
  functions: {
    invoke: invokeFunction,
  },
  from: (table: string) => new QueryBuilder(table),
  channel: (_name: string) => createChannel(),
  removeChannel: (_channel: any) => undefined,
  storage: {
    from: (bucket: string) => ({
      upload: async (filePath: string, file: any, _opts?: any) => {
        try {
          const base64 = await fileToBase64(file as File);
          const { data, error } = await apiPost("/functions/v1/storage/upload", {
            bucket,
            path: filePath,
            base64,
          });
          if (error) return { data: null, error };
          return { data: { path: filePath, publicUrl: `${activeBackendBase}${data?.data?.publicUrl || ""}` }, error: null };
        } catch (error: any) {
          return { data: null, error: { message: error?.message || "Upload failed" } };
        }
      },
      getPublicUrl: (filePath: string) => ({ data: { publicUrl: filePath ? `${activeBackendBase}/storage/${bucket}/${filePath}` : "" } }),
      remove: async (paths: string[]) => {
        const { data, error } = await apiPost("/functions/v1/storage/remove", { bucket, paths });
        if (error) return { data: null, error };
        return { data: data?.data ?? null, error: null };
      },
    }),
  },
};
