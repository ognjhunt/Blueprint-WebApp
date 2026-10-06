// @vitest-environment node
import express, { type Request } from "express";
import { describe, expect, it } from "vitest";

/** Exercise Express's actual req.ip/req.ips getters with a synthetic connection. */
function clientAddress(trust: string | number | boolean, remoteAddress: string, forwardedFor: string) {
  const app = express();
  app.set("trust proxy", trust);
  const request = Object.assign(Object.create(express.request), {
    app, socket: { remoteAddress }, headers: { "x-forwarded-for": forwardedFor },
  }) as Request;
  return { ip: request.ip, ips: request.ips };
}

describe("patched proxy trust boundary", () => {
  it.each([
    ["::ffff:10.0.0.0/8", "198.51.100.7"],
    ["::ffff:10.0.0.0/8", "::ffff:198.51.100.7"],
    ["::/1", "198.51.100.7"],
  ])("does not trust an external IPv4 peer through incomplete mapped subnet %s", (trust, peer) => {
    expect(clientAddress(trust, peer, "203.0.113.99")).toEqual({ ip: peer, ips: [] });
  });

  it.each(["10.0.0.0/8", "::ffff:10.0.0.0/104"])(
    "keeps the valid subnet %s restricted while accepting its genuine proxy", trust => {
      expect(clientAddress(trust, "198.51.100.7", "203.0.113.99"))
        .toEqual({ ip: "198.51.100.7", ips: [] });
      expect(clientAddress(trust, "10.1.2.3", "198.51.100.7"))
        .toEqual({ ip: "198.51.100.7", ips: ["198.51.100.7"] });
      expect(clientAddress(trust, "::ffff:10.1.2.3", "198.51.100.7"))
        .toEqual({ ip: "198.51.100.7", ips: ["198.51.100.7"] });
    },
  );

  it("preserves the production one-hop policy without trusting a forged farther hop", () => {
    expect(clientAddress(1, "10.1.2.3", "203.0.113.99, 198.51.100.7"))
      .toEqual({ ip: "198.51.100.7", ips: ["198.51.100.7"] });
    expect(clientAddress(false, "198.51.100.7", "203.0.113.99"))
      .toEqual({ ip: "198.51.100.7", ips: [] });
  });
});
