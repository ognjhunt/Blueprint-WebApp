import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

/** The protocol the Vite dev client asks for on its HMR socket (Vite's `HMR_HEADER`), at the app's base path. */
export const VITE_HMR_PROTOCOL = "vite-hmr";

/**
 * No route of this server is a WebSocket, so every upgrade request is refused (its socket destroyed), except, in
 * development only, the Vite dev server's own HMR socket, which `setupVite` attaches to this same server and answers
 * itself. Refusing that one too made the Vite client take each closed socket for a restarted server ("server
 * connection lost. Polling for restart...") and reload the page as soon as the server answered its ping: on every page
 * load, over and over. A browser test's page reloaded under its clicks (`e2e/site-answer.spec.ts`, "another place
 * chosen", 2026-11-20). In production there is no Vite: everything is refused, as before.
 */
export function refuseUpgrades(options: { viteHmr: () => boolean }) {
  return (req: IncomingMessage, socket: Duplex): void => {
    if (options.viteHmr() && req.headers["sec-websocket-protocol"] === VITE_HMR_PROTOCOL
      && new URL(req.url ?? "/", "http://localhost").pathname === "/") return;
    socket.destroy();
  };
}
