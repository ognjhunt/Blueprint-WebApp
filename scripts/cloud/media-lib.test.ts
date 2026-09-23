// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  describeSource,
  digestMatches,
  normalizeSha256,
  parseFetchMediaArgs,
  parseGsUrl,
  parseMediaSource,
  redactUrl,
  safeOutputName,
  sourceFileName,
  summarizeFfprobe,
} from "./media-lib";

const HEX = "a".repeat(64);
const MIXED = "0123456789ABCDEFabcdef0123456789abcdef0123456789ABCDEF0123456789";

describe("parseGsUrl", () => {
  it("splits a gs:// URL into bucket and object", () => {
    expect(parseGsUrl("gs://b/p/x.MOV")).toEqual({ bucket: "b", object: "p/x.MOV" });
    expect(parseGsUrl("  gs://blueprint-8c1ca.appspot.com/captures/a b/video.mp4 ")).toEqual({
      bucket: "blueprint-8c1ca.appspot.com",
      object: "captures/a b/video.mp4",
    });
  });

  it.each([
    "https://b/x.mov",
    "gs://bucket",
    "gs://bucket/",
    "gs:///object",
    "gs://Bucket/object",
    "gs://bucket/folder/",
    "",
  ])("rejects %j", (url) => {
    expect(() => parseGsUrl(url)).toThrow();
  });
});

describe("normalizeSha256", () => {
  it("accepts bare hex or a sha256: prefix, in any case", () => {
    expect(normalizeSha256(HEX)).toBe(HEX);
    expect(normalizeSha256(`sha256:${HEX}`)).toBe(HEX);
    expect(normalizeSha256(` SHA256:${MIXED} `)).toBe(MIXED.toLowerCase());
  });

  it.each(["", "abc", "a".repeat(63), "a".repeat(65), "g".repeat(64), `md5:${HEX}`, `sha256:${HEX}0`])(
    "rejects %j",
    (value) => {
      expect(() => normalizeSha256(value)).toThrow(/SHA-256/);
    },
  );
});

describe("digestMatches", () => {
  it("compares normalized digests", () => {
    expect(digestMatches(`sha256:${MIXED}`, MIXED.toLowerCase())).toBe(true);
    expect(digestMatches(HEX, "b".repeat(64))).toBe(false);
  });

  it("never matches a malformed digest", () => {
    expect(digestMatches("", "")).toBe(false);
    expect(digestMatches("zz", "zz")).toBe(false);
  });
});

describe("safeOutputName", () => {
  it("keeps only the last path segment", () => {
    expect(safeOutputName("p/x.MOV")).toBe("x.MOV");
    expect(safeOutputName("../../etc/passwd")).toBe("passwd");
    expect(safeOutputName("..\\..\\windows\\evil.mp4")).toBe("evil.mp4");
  });

  it("drops control characters and leading dots", () => {
    expect(safeOutputName("vid\u0000eo\n.mp4")).toBe("video.mp4");
    expect(safeOutputName(".bashrc")).toBe("bashrc");
  });

  it("falls back when nothing usable is left", () => {
    expect(safeOutputName("")).toBe("media");
    expect(safeOutputName("../..")).toBe("media");
    expect(safeOutputName("dir/")).toBe("media");
    expect(safeOutputName("..", "fallback.bin")).toBe("fallback.bin");
  });

  it("caps the length and keeps the extension", () => {
    const name = safeOutputName(`${"x".repeat(300)}.mov`);
    expect(name).toHaveLength(200);
    expect(name.endsWith(".mov")).toBe(true);
  });
});

describe("sources", () => {
  it("accepts gs:// and https:// only", () => {
    expect(parseMediaSource("gs://b/p/x.MOV")).toEqual({ kind: "gs", bucket: "b", object: "p/x.MOV" });
    expect(parseMediaSource("https://example.com/v.mp4")).toEqual({ kind: "https", url: "https://example.com/v.mp4" });
    expect(() => parseMediaSource("http://example.com/v.mp4")).toThrow(/https/);
    expect(() => parseMediaSource("file:///etc/passwd")).toThrow(/https/);
    expect(() => parseMediaSource("not a url")).toThrow(/https/);
  });

  it("names the output after the object or the decoded URL path", () => {
    expect(sourceFileName(parseMediaSource("gs://b/captures/run-1/IMG_0001.MOV"))).toBe("IMG_0001.MOV");
    const firebaseUrl =
      "https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/captures%2Frun-1%2Fclip.mov?alt=media&token=abc";
    expect(sourceFileName(parseMediaSource(firebaseUrl))).toBe("clip.mov");
    expect(sourceFileName(parseMediaSource("https://example.com/a/%2E%2E%2F%2E%2E%2Fescape.mp4"))).toBe("escape.mp4");
    expect(sourceFileName(parseMediaSource("https://example.com/"))).toBe("media");
  });

  it("never prints a signed URL's token or credentials", () => {
    const signed = "https://user:pass@storage.example.com/o/v.mov?X-Goog-Signature=SECRET123&token=SECRET456#frag";
    const shown = redactUrl(signed);
    expect(shown).toBe("https://storage.example.com/o/v.mov?<redacted>");
    expect(shown).not.toMatch(/SECRET|user|pass|frag/);
    expect(describeSource(parseMediaSource(signed))).not.toMatch(/SECRET/);
    expect(describeSource(parseMediaSource("gs://b/p/x.MOV"))).toBe("gs://b/p/x.MOV");
    expect(redactUrl("https://example.com/v.mp4")).toBe("https://example.com/v.mp4");
  });
});

describe("parseFetchMediaArgs", () => {
  it("reads the source, digest and output directory", () => {
    expect(parseFetchMediaArgs(["gs://b/x.mov", "--sha256", `sha256:${HEX}`, "--out", "/tmp/o"])).toEqual({
      source: "gs://b/x.mov",
      sha256: HEX,
      outDir: "/tmp/o",
      help: false,
    });
    expect(parseFetchMediaArgs([`--sha256=${HEX}`, "https://e.com/v.mp4", "--out=dir"])).toMatchObject({
      source: "https://e.com/v.mp4",
      sha256: HEX,
      outDir: "dir",
    });
    expect(parseFetchMediaArgs(["--help"]).help).toBe(true);
  });

  it("requires a source and a well-formed digest", () => {
    expect(() => parseFetchMediaArgs(["--sha256", HEX])).toThrow(/missing source/);
    expect(() => parseFetchMediaArgs(["gs://b/x.mov"])).toThrow(/missing --sha256/);
    expect(() => parseFetchMediaArgs(["gs://b/x.mov", "--sha256", "abc"])).toThrow(/SHA-256/);
    expect(() => parseFetchMediaArgs(["gs://b/x.mov", "--sha256"])).toThrow(/needs a value/);
    expect(() => parseFetchMediaArgs(["gs://b/x.mov", "--sha256", HEX, "--bogus"])).toThrow(/unknown option/);
    expect(() => parseFetchMediaArgs(["gs://b/x.mov", "gs://b/y.mov", "--sha256", HEX])).toThrow(/unexpected/);
  });
});

describe("summarizeFfprobe", () => {
  it("condenses format and the first video and audio streams", () => {
    const probe = {
      format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "12.345", bit_rate: "8000000" },
      streams: [
        {
          codec_type: "video",
          codec_name: "hevc",
          width: 1920,
          height: 1080,
          avg_frame_rate: "30/1",
          nb_frames: "370",
          side_data_list: [{ side_data_type: "Display Matrix", rotation: -90 }],
        },
        { codec_type: "audio", codec_name: "aac", channels: 2, sample_rate: "44100" },
        { codec_type: "data", codec_name: "none" },
      ],
    };
    expect(summarizeFfprobe(probe)).toEqual({
      format: "mov,mp4,m4a,3gp,3g2,mj2",
      duration_seconds: 12.345,
      bit_rate: 8000000,
      streams: 3,
      video: { codec: "hevc", width: 1920, height: 1080, rotation: -90, frame_rate: "30/1", frames: 370 },
      audio: { codec: "aac", channels: 2, sample_rate: 44100 },
    });
  });

  it("falls back to the legacy rotate tag and tolerates junk", () => {
    const summary = summarizeFfprobe({ streams: [{ codec_type: "video", tags: { rotate: "90" } }] });
    expect(summary.video?.rotation).toBe(90);
    expect(summarizeFfprobe(null)).toEqual({ streams: 0 });
    expect(summarizeFfprobe({ streams: "nope" })).toEqual({ streams: 0 });
  });
});
