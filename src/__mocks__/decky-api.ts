// Manual mock for @decky/api - prevents resolution of @decky/manifest on CI
import { vi } from 'vitest';

export const call = vi.fn();
export const routerHook = { addRoute: vi.fn(), removeRoute: vi.fn() };
export const toaster = { toast: vi.fn() };
