type AnyRow = Record<string, any>;
type Result<T = any> = Promise<{ data: T; error: any }>;

const resolveBackendBaseUrl = () => {
  const configured = (import.meta.env.VITE_BACKEND_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const { origin, port } = window.location;
    if (port === "5173") return "http://localhost:8787";
    return origin.replace(/\/$/, "");
  }
  return "http://localhost:8787";
};

const BACKEND_BASE_URL = resolveBackendBaseUrl();
const SESSION_KEY = "upsc_backend_session";

let currentSession: any = null;
const listeners = new Set<(event: string, session: any) => void>();

const emitAuth = (event: string, session: any) => {
  listeners.forEach((cb) => cb(event, session));
};

const storeSession = (session: any | null) => {
  currentSession = session;
  if (session?.access_token) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
};

const loadStoredSession = () => {
  if (currentSession) return currentSession;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.access_token) currentSession = parsed;
    return currentSession;
  } catch {
    return null;
  }
};

const authHeaders = () => {
  const token = currentSession?.access_token || loadStoredSession()?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const apiPost = async (path: string, body: unknown, extraHeaders?: Record<string, string>) => {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(extraHeaders || {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;
    if (!response.ok) return { data: null, error: data || { message: `Request failed: ${path}` } };
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: { message: error?.message || "Network error" } };
  }
};

const apiGet = async (path: string) => {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
    });
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;
    if (!response.ok) return { data: null, error: data || { message: `Request failed: ${path}` } };
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: { message: error?.message || "Network error" } };
  }
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

  select(_columns = "*") {
    this.selectedColumns = _columns;
    if (this.action === "select") {
      this.action = "select";
    }
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

  private finish(data: any, error: any) {
    if (error) return { data: null, error };
    if (this.singleMode === "single" || this.singleMode === "maybeSingle") {
      return { data: Array.isArray(data) ? data[0] ?? null : data ?? null, error: null };
    }
    return { data: Array.isArray(data) ? data : data ?? [], error: null };
  }

  private async exec(): Result<any> {
    if (this.action === "select") {
      const { data, error } = await apiPost("/functions/v1/db/select", {
        table: this.table,
        columns: this.selectedColumns,
        filters: this.filters,
        order: this.sort,
        limit: this.take,
      });
      return this.finish(data?.data, error || data?.error);
    }

    if (this.action === "insert") {
      const { data, error } = await apiPost("/functions/v1/db/insert", {
        table: this.table,
        columns: this.selectedColumns,
        rows: this.rows,
      });
      return this.finish(data?.data, error || data?.error);
    }

    if (this.action === "upsert") {
      const { data, error } = await apiPost("/functions/v1/db/upsert", {
        table: this.table,
        columns: this.selectedColumns,
        rows: this.rows,
      });
      return this.finish(data?.data, error || data?.error);
    }

    if (this.action === "update") {
      const { data, error } = await apiPost("/functions/v1/db/update", {
        table: this.table,
        columns: this.selectedColumns,
        patch: this.patch,
        filters: this.filters,
      });
      return this.finish(data?.data, error || data?.error);
    }

    const { data, error } = await apiPost("/functions/v1/db/delete", {
      table: this.table,
      columns: this.selectedColumns,
      filters: this.filters,
    });
    return this.finish(data?.data, error || data?.error);
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
      if (currentSession?.access_token) {
        const { data, error } = await apiGet("/functions/v1/auth/session");
        if (!error && data?.session) {
          storeSession(data.session);
          return { data: { session: data.session }, error: null };
        }
        if (stored?.access_token) {
          return { data: { session: stored }, error: null };
        }
      }
      return { data: { session: null }, error: null };
    },
    getUser: async () => {
      const { data } = await supabase.auth.getSession();
      return { data: { user: data?.session?.user ?? null }, error: null };
    },
    onAuthStateChange: (cb: any) => {
      if (typeof cb === "function") listeners.add(cb);
      cb?.(currentSession ? "SIGNED_IN" : "SIGNED_OUT", currentSession);
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
      const session = data?.session ?? null;
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
      const session = data?.session ?? null;
      storeSession(session);
      emitAuth("SIGNED_IN", session);
      return { data: { session, user: session?.user ?? null }, error: null };
    },
    signOut: async () => {
      await apiPost("/functions/v1/auth/logout", {});
      storeSession(null);
      emitAuth("SIGNED_OUT", null);
      return { error: null };
    },
    setSession: async (session: any) => {
      storeSession(session);
      emitAuth("SIGNED_IN", session);
      return { data: { session }, error: null };
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
          return { data: { path: filePath, publicUrl: `${BACKEND_BASE_URL}${data?.data?.publicUrl || ""}` }, error: null };
        } catch (error: any) {
          return { data: null, error: { message: error?.message || "Upload failed" } };
        }
      },
      getPublicUrl: (filePath: string) => ({ data: { publicUrl: filePath ? `${BACKEND_BASE_URL}/storage/${bucket}/${filePath}` : "" } }),
      remove: async (paths: string[]) => {
        const { data, error } = await apiPost("/functions/v1/storage/remove", { bucket, paths });
        if (error) return { data: null, error };
        return { data: data?.data ?? null, error: null };
      },
    }),
  },
};
