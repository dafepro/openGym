# Original playback test

`playback-test.mp4` is an original eight-second FFmpeg test pattern. It contains
no person, trainer footage, spoken instruction or exercise prescription. It is
only for seeking, playback-speed, range-response and video/workout separation
checks. The UI must visibly identify all demo assignments as synthetic.

Generated locally with FFmpeg:

```sh
ffmpeg -hide_banner -loglevel error -f lavfi -i 'testsrc2=size=960x540:rate=24:duration=8' -an -c:v libx264 -pix_fmt yuv420p -preset fast -crf 28 -movflags +faststart playback-test.mp4
```

The demo-only Vite plugin serves it at `/media/sample-playback`. Default builds
exclude both the clip and the synthetic catalog. Never put real media here.
