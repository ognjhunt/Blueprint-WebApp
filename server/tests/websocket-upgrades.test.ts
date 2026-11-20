// @vitest-environment node
/**
 * The server refuses every WebSocket upgrade, except the Vite dev server's HMR socket in development: refusing that one
 * made the Vite client reload the page over and over (the site-answer e2e flake, 2026-11-20).
 */
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { refuseUpgrades, VITE_HMR_PROTOCOL } from "../utils/websocketUpgrades";

const upgrade = (url: string, protocol?: string) => ({ url, headers: protocol ? { "sec-websocket-protocol": protocol } : {} }) as IncomingMessage;
const socket = () => ({ destroy: vi.fn() });

describe("WebSocket upgrades", () => {
  it.each([
    ["any upgrade, in production", false, upgrade("/")],
    ["the HMR protocol, in production", false, upgrade("/", VITE_HMR_PROTOCOL)],
    ["another protocol, in development", true, upgrade("/", "graphql-ws")],
    ["no protocol, in development", true, upgrade("/?token=x")],
    ["the HMR protocol on another path, in development", true, upgrade("/api/socket", VITE_HMR_PROTOCOL)],
  ])("refuses %s", (_name, viteHmr, req) => {
    const target = socket();
    refuseUpgrades({ viteHmr: () => viteHmr })(req, target as unknown as Duplex);
    expect(target.destroy).toHaveBeenCalledOnce();
  });

  it("leaves the Vite dev server's HMR socket to Vite in development", () => {
    const target = socket();
    refuseUpgrades({ viteHmr: () => true })(upgrade("/?token=abc", VITE_HMR_PROTOCOL), target as unknown as Duplex);
    expect(target.destroy).not.toHaveBeenCalled();
  });
});
