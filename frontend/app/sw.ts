/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// The backend API lives on a different origin, so defaultCache's generic
// cross-origin matcher (NetworkFirst, 1hr) would otherwise cache its GET
// responses. Dexie (see lib/db/offlineDb.ts) is the real offline data store
// for this app now — a second, user-agnostic cache in Cache Storage can
// serve stale data, and since it isn't scoped per logged-in user, it can
// leak one account's data to another on a shared device. Force the API
// origin to NetworkOnly, checked before any of the generic matchers below.
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").origin;
  } catch {
    return null;
  }
})();

const runtimeCaching: RuntimeCaching[] = [
  ...(apiOrigin
    ? [
        {
          matcher: ({ url }: { url: URL }) => url.origin === apiOrigin,
          handler: new NetworkOnly(),
        },
      ]
    : []),
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
