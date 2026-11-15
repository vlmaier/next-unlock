// Runtime & Test shim for @decky/api when running outside Decky CEF (Vite dev harness & Vitest)

export const call = async (..._args: any[]): Promise<any> => null;

export const routerHook = {
  routes: new Map<string, any>(),
  addRoute(path: string, component: any, _opts?: any) {
    this.routes.set(path, component);
  },
  removeRoute(path: string) {
    this.routes.delete(path);
  },
};

export const toaster = {
  toast: (_toast: any) => {},
};

export const definePlugin = (fn: () => any) => {
  return fn;
};
