type AnyRow = Record<string, any>;
type Result<T = any> = Promise<{ data: T; error: any }>;

const BACKEND_BASE_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8787").replace(/\/$/, "");
const defaultUserId = "local-user-1";

const nowIso = () => new Date().toISOString();
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const profileDefaults = {
  id: defaultUserId,
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
db.set("mind_maps", []);
db.set("study_plans", []);
db.set("upsc_smart_notes", []);

let currentSession: any = {
  access_token: "local-access-token",
  refresh_token: "local-refresh-token",
  user: { id: defaultUserId, email: profileDefaults.email },
};

const getTable = (name: string) => {
  if (!db.has(name)) db.set(name, []);
  return db.get(name)!;
};

class QueryBuilder {
  private table: string;
  private filters: Array<{ col: string; value: any }> = [];
  private sort: { col: string; ascending: boolean } | null = null;
  private take: number | null = null;
  private action: "select" | "insert" | "update" | "delete" = "select";
  private inserted: AnyRow[] = [];
  private patch: AnyRow = {};
  private singleMode: "none" | "single" | "maybeSingle" = "none";

  constructor(table: string) {
    this.table = table;
  }

  select(_columns = "*") {
    this.action = "select";
    return this;
  }

  insert(payload: AnyRow | AnyRow[]) {
    this.action = "insert";
    const list = Array.isArray(payload) ? payload : [payload];
    const tableRows = getTable(this.table);
    this.inserted = list.map((row) => {
      const next = { id: row.id || uid(), created_at: row.created_at || nowIso(), ...row };
      tableRows.push(next);
      return next;
    });
    return this;
  }

  upsert(payload: AnyRow | AnyRow[]) {
    const list = Array.isArray(payload) ? payload : [payload];
    const tableRows = getTable(this.table);
    this.action = "insert";
    this.inserted = list.map((row) => {
      const existingIdx = tableRows.findIndex((r) => r.id === row.id);
      if (existingIdx >= 0) {
        tableRows[existingIdx] = { ...tableRows[existingIdx], ...row, updated_at: nowIso() };
        return tableRows[existingIdx];
      }
      const next = { id: row.id || uid(), created_at: row.created_at || nowIso(), ...row };
      tableRows.push(next);
      return next;
    });
    return this;
  }

  update(values: AnyRow) {
    this.action = "update";
    this.patch = values;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(col: string, value: any) {
    this.filters.push({ col, value });
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

  private filteredRows() {
    let rows = [...getTable(this.table)];
    for (const f of this.filters) {
      rows = rows.filter((r) => r[f.col] === f.value);
    }
    if (this.sort) {
      rows.sort((a, b) => {
        const av = a[this.sort!.col];
        const bv = b[this.sort!.col];
        if (av === bv) return 0;
        if (this.sort!.ascending) return av > bv ? 1 : -1;
        return av < bv ? 1 : -1;
      });
    }
    if (this.take !== null) rows = rows.slice(0, this.take);
    return rows;
  }

  private async exec(): Result<any> {
    try {
      const tableRows = getTable(this.table);
      let data: any = null;

      if (this.action === "insert") {
        data = this.inserted;
      } else if (this.action === "update") {
        const rows = this.filteredRows();
        for (const row of rows) Object.assign(row, this.patch, { updated_at: nowIso() });
        data = rows;
      } else if (this.action === "delete") {
        const rows = this.filteredRows();
        const ids = new Set(rows.map((r) => r.id));
        const remaining = tableRows.filter((r) => !ids.has(r.id));
        db.set(this.table, remaining);
        data = rows;
      } else {
        data = this.filteredRows();
      }

      if (this.singleMode === "single") {
        return { data: data?.[0] ?? null, error: null };
      }
      if (this.singleMode === "maybeSingle") {
        return { data: data?.[0] ?? null, error: null };
      }
      return { data: data ?? [], error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
}

const invokeFunction = async (name: string, args?: { body?: unknown; headers?: Record<string, string> }) => {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(args?.headers || {}),
      },
      body: JSON.stringify(args?.body ?? {}),
    });

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;
    if (!response.ok) {
      return { data: null, error: data || { message: `Function ${name} failed` } };
    }
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: { message: error?.message || "Network error" } };
  }
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
    getSession: async () => ({ data: { session: currentSession }, error: null }),
    getUser: async () => ({ data: { user: currentSession?.user ?? null }, error: null }),
    onAuthStateChange: (cb: any) => {
      cb?.("SIGNED_IN", currentSession);
      return { data: { subscription: { unsubscribe: () => undefined } } };
    },
    signInWithPassword: async ({ email }: any) => {
      currentSession = {
        access_token: "local-access-token",
        refresh_token: "local-refresh-token",
        user: { id: defaultUserId, email: email || profileDefaults.email },
      };
      return { data: { session: currentSession, user: currentSession.user }, error: null };
    },
    signUp: async ({ email }: any) => {
      currentSession = {
        access_token: "local-access-token",
        refresh_token: "local-refresh-token",
        user: { id: defaultUserId, email: email || profileDefaults.email },
      };
      return { data: { session: currentSession, user: currentSession.user }, error: null };
    },
    signOut: async () => {
      currentSession = null;
      return { error: null };
    },
    setSession: async (_tokens: any) => ({ data: { session: currentSession }, error: null }),
  },
  functions: {
    invoke: invokeFunction,
  },
  from: (table: string) => new QueryBuilder(table),
  channel: (_name: string) => createChannel(),
  removeChannel: (_channel: any) => undefined,
  storage: {
    from: (_bucket: string) => ({
      upload: async (_path: string, _file: any, _opts?: any) => ({ data: { path: _path }, error: null }),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: _path ? `${BACKEND_BASE_URL}/storage/${encodeURIComponent(_path)}` : "" } }),
      remove: async (_paths: string[]) => ({ data: null, error: null }),
    }),
  },
};
