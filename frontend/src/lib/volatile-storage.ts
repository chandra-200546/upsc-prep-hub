const createInMemoryStorage = (): Storage => {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
  };
  return storage;
};

export const installVolatileStorage = () => {
  if (typeof window === "undefined") return;

  const memoryLocalStorage = createInMemoryStorage();
  const memorySessionStorage = createInMemoryStorage();

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: memoryLocalStorage,
  });

  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: memorySessionStorage,
  });
};
