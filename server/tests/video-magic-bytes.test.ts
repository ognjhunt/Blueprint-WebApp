// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isAcceptedVideoHeader, VIDEO_SIGNATURE_BYTES } from "../utils/videoMagicBytes";

const hex = (value: string) => Buffer.from(value.replace(/\s+/g, ""), "hex");

/**
 * Real container openings, byte for byte. The ISO-BMFF ones are the first
 * bytes of files written by an iPhone camera (`qt  `), ffmpeg/MediaRecorder
 * MP4 (`isom`, `mp42`, `iso5`), iTunes M4V (`M4V `) and pre-`ftyp` QuickTime.
 */
const accepted: Record<string, Buffer> = {
  "iPhone MOV (ftyp qt  )": hex("00000014 66747970 71742020 00000000 71742020"),
  "MP4 (ftyp isom)": hex("00000020 66747970 69736f6d 00000200 69736f6d 69736f32 61766331 6d703431"),
  "MP4 (ftyp mp42)": hex("00000018 66747970 6d703432 00000000 69736f6d 6d703432"),
  "fragmented MP4 from MediaRecorder (ftyp iso5)": hex("0000001c 66747970 69736f35 00000200 69736f35 69736f36 6d703431"),
  "M4V (ftyp M4V )": hex("0000001c 66747970 4d345620 00000001 4d345620 4d344120 6d703432"),
  "legacy QuickTime opening with wide then mdat": hex("00000008 77696465 0001c2a1 6d646174"),
  "legacy QuickTime opening with moov": hex("00000c85 6d6f6f76 0000006c 6d766864"),
  "QuickTime mdat with 64-bit size": hex("00000001 6d646174 00000000 00010000"),
};

const refused: Record<string, Buffer> = {
  "WebM / Matroska (EBML) — .webm is not an accepted upload": hex("1a45dfa3 9f428681 01427781 0142f281"),
  JPEG: hex("ffd8ffe0 00104a46 49460001 01000001"),
  PNG: hex("89504e47 0d0a1a0a 0000000d 49484452"),
  PDF: Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3", "latin1"),
  ZIP: hex("504b0304 14000000 08000000 21000000"),
  HTML: Buffer.from("<!doctype html><html>"),
  "empty file": Buffer.alloc(0),
  "shorter than a box header": hex("00000014 66747970"),
  "ftyp box too small to hold a brand": hex("0000000c 66747970 71742020 00000000"),
  "ftyp with a non-printable brand": hex("00000014 66747970 00ff0102 00000000"),
  "unknown leading box": hex("00000010 61626364 00000000 00000000"),
  "QuickTime atom with an impossible size": hex("00000004 6d646174 00000000 00000000"),
};

describe("video container signatures", () => {
  it.each(Object.entries(accepted))("accepts %s", (_name, bytes) => {
    expect(isAcceptedVideoHeader(bytes.subarray(0, VIDEO_SIGNATURE_BYTES))).toBe(true);
  });

  it.each(Object.entries(refused))("refuses %s", (_name, bytes) => {
    expect(isAcceptedVideoHeader(bytes.subarray(0, VIDEO_SIGNATURE_BYTES))).toBe(false);
  });

  it("needs no more than the signature window", () => {
    expect(VIDEO_SIGNATURE_BYTES).toBeLessThanOrEqual(16);
    expect(isAcceptedVideoHeader(new Uint8Array(accepted["iPhone MOV (ftyp qt  )"]).subarray(0, 12))).toBe(true);
  });
});
