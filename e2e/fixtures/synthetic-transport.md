Synthetic transport fixture: owned generated test-pattern pixels, no captured footage, audio, private data, or provider call. Browser tests decode and upload it; it is not assessment evidence.

Generated locally with FFmpeg 7.1.1 using:
```sh
ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc=size=320x240:rate=30 -t 2 -c:v libx264 -pix_fmt yuv420p -movflags +faststart -map_metadata -1 -y synthetic-transport.mp4
```

SHA-256: `b646c793b253b5a82e5d732cb373b514648503a8af83165c0830d9c14f8e3f2a`. H.264, yuv420p, 320×240, 2 seconds. Regeneration is optional; CI uses these Git-owned bytes and fails if they are missing.
