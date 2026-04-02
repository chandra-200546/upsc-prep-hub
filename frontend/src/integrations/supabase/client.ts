const createQueryChain = () => {
  const result = { data: null, error: null };
  let proxy: any;
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (value: any) => void) => resolve(result);
      }
      return (..._args: any[]) => proxy;
    },
  };
  proxy = new Proxy({}, handler);
  return proxy;
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
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: (_cb: any) => ({
      data: { subscription: { unsubscribe: () => undefined } },
    }),
    signInWithPassword: async (_args: any) => ({ data: { session: null, user: null }, error: null }),
    signUp: async (_args: any) => ({ data: { session: null, user: null }, error: null }),
    signOut: async () => ({ error: null }),
    setSession: async (_tokens: any) => ({ data: { session: null }, error: null }),
  },
  functions: {
    invoke: async (_name: string, _args?: any) => ({ data: null, error: null }),
  },
  from: (_table: string) => createQueryChain(),
  channel: (_name: string) => createChannel(),
  removeChannel: (_channel: any) => undefined,
  storage: {
    from: (_bucket: string) => ({
      upload: async (_path: string, _file: any, _opts?: any) => ({ data: null, error: null }),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: "" } }),
      remove: async (_paths: string[]) => ({ data: null, error: null }),
    }),
  },
};
