// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  authAdmin: null,
}));

function buildMockResponse() {
  const response = {
    locals: {},
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe("verifyFirebaseToken configuration guard", () => {
  it("returns 503 when Firebase Admin auth is unavailable even if a bearer token is provided", async () => {
    const request = {
      headers: {
        authorization: "Bearer test-token",
      },
    } as Request;
    const response = buildMockResponse();
    const next = vi.fn() as NextFunction;

    await verifyFirebaseToken(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      error: expect.stringMatching(/Firebase Admin auth is not configured/i),
    });
  });
});
