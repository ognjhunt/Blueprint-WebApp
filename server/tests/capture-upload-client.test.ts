// @vitest-environment node
import {webcrypto} from "node:crypto";
import {afterEach, describe, expect, it, vi} from "vitest";
import type {User} from "firebase/auth";
vi.mock("@/lib/csrf", () => ({withCsrfHeader: async (headers: unknown) => headers}));
vi.mock("@/lib/firebaseAuthHeaders", () => ({withFirebaseAuthHeaders: async (_user: unknown, headers: object) =>
  ({...headers, Authorization: "Bearer test-owner-session"})}));
import {uploadCaptureFile, type CaptureUploadSession} from "../../client/src/lib/captureUploads";
afterEach(() => vi.unstubAllGlobals());
function source() {
  const file = new File(["abcd"], "source.mp4", {type: "video/mp4"});
  const session = {session_id: "capture-owned-1", original_filename: file.name, size_bytes: file.size,
    capture_authority_profile: "monocular_video", part_size_bytes: 2, expected_part_count: 2,
    storage_provider: "firebase", uploaded_parts: []} as unknown as CaptureUploadSession;
  return {file, session, currentUser: {} as User};
}
describe("browser owner upload transport", () => {
  it("uploads a short native video through the server-declared single-file transport", async () => {
    const input=source();input.session.upload_transport="single_file";
    const fetch=vi.fn(async(_url:string,_init:RequestInit)=>new Response(JSON.stringify({status:"stored"})));vi.stubGlobal("fetch",fetch);
    expect(await uploadCaptureFile(input)).toEqual({status:"stored"});
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe("/api/capture-uploads/capture-owned-1/file");
    expect(fetch.mock.calls[0][1].body).toBeInstanceOf(FormData);
  });
  it("sends existing Firebase parts through the authenticated same-origin API without a B2 grant", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const requests: Array<{url: string; init: RequestInit}> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      requests.push({url, init}); return new Response(JSON.stringify(url.endsWith("/complete") ? {status: "stored"} : {ok: true}));
    }));
    expect(await uploadCaptureFile(source())).toEqual({status: "stored"});
    expect(requests.map(r => r.url)).toEqual(["/api/capture-uploads/capture-owned-1/parts/1",
      "/api/capture-uploads/capture-owned-1/parts/2", "/api/capture-uploads/capture-owned-1/complete"]);
    for (const row of requests.slice(0, 2)) {
      expect(row.init.body).toBeInstanceOf(FormData);
      expect((row.init.headers as Record<string, string>).Authorization).toBe("Bearer test-owner-session");
      expect((row.init.headers as Record<string, string>)["x-blueprint-content-sha1"]).toMatch(/^[a-f0-9]{40}$/);
    }
    expect(JSON.parse(requests[2].init.body as string).part_sha1_array).toHaveLength(2);
  });
  it("refuses a changed reselected file before uploading or completing it", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const input = source(); input.session.uploaded_parts = [{partNumber: 1, contentLength: 2, contentSha1: "a".repeat(40)}];
    await expect(uploadCaptureFile(input)).rejects.toThrow("does not match the reselected file");
    expect(fetch).not.toHaveBeenCalled();
  });
});
