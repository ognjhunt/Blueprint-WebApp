// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  list: vi.fn(),
  upload: vi.fn(),
  authorize: vi.fn(),
  target: vi.fn(),
}));
vi.mock("backblaze-b2", () => ({
  default: class {
    authorize = state.authorize;
    listFileVersions = state.list;
    uploadFile = state.upload;
    getUploadUrl = state.target;
  },
}));
beforeEach(() => {
  vi.resetModules();
  for (const mock of Object.values(state)) mock.mockReset();
  process.env.BACKBLAZE_B2_KEY_ID = "test-id";
  process.env.BACKBLAZE_B2_APPLICATION_KEY = "test-key";
  process.env.BACKBLAZE_B2_BUCKET_ID = "test-bucket";
  process.env.BACKBLAZE_B2_BUCKET_NAME = "test-bucket";
  state.authorize.mockResolvedValue({});
  state.target.mockResolvedValue({
    data: {
      uploadUrl: "https://storage.example/upload",
      authorizationToken: "test-token",
    },
  });
});
afterEach(() => {
  for (const key of [
    "BACKBLAZE_B2_KEY_ID",
    "BACKBLAZE_B2_APPLICATION_KEY",
    "BACKBLAZE_B2_BUCKET_ID",
    "BACKBLAZE_B2_BUCKET_NAME",
  ])
    delete process.env[key];
});
describe("small mesh B2 single-file transport", () => {
  const input = {
    objectPath: "captures/owner/intakes/id/mesh.usda",
    data: Buffer.from("#usda 1.0"),
    contentType: "application/octet-stream",
    sha1: "a".repeat(40),
  };
  it("uses upload-file for small bytes and retains real provider identity", async () => {
    state.list.mockResolvedValue({ data: { files: [] } });
    state.upload.mockResolvedValue({ data: { fileId: "file-one" } });
    const { uploadSmallBackblazeCapture } = await import(
      "../utils/storage-provider"
    );
    expect(await uploadSmallBackblazeCapture(input)).toMatchObject({
      fileId: "file-one",
      storageUri: `b2://test-bucket/${input.objectPath}`,
    });
    expect(state.upload).toHaveBeenCalledTimes(1);
  });
  it("reconciles a lost response by exact path, size, and provider checksum before creating another version", async () => {
    state.list.mockResolvedValue({
      data: {
        files: [
          {
            fileName: input.objectPath,
            fileId: "retained",
            action: "upload",
            contentLength: input.data.length,
            contentSha1: input.sha1,
          },
        ],
      },
    });
    const { uploadSmallBackblazeCapture } = await import(
      "../utils/storage-provider"
    );
    expect((await uploadSmallBackblazeCapture(input)).fileId).toBe("retained");
    expect(state.upload).not.toHaveBeenCalled();
  });
  it("rejects changed bytes at an existing immutable path", async () => {
    state.list.mockResolvedValue({
      data: {
        files: [
          {
            fileName: input.objectPath,
            fileId: "other",
            action: "upload",
            contentLength: input.data.length,
            contentSha1: "b".repeat(40),
          },
        ],
      },
    });
    const { uploadSmallBackblazeCapture } = await import(
      "../utils/storage-provider"
    );
    await expect(uploadSmallBackblazeCapture(input)).rejects.toThrow(
      "small_capture_existing_bytes_conflict",
    );
    expect(state.upload).not.toHaveBeenCalled();
  });
});
