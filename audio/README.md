# The music

The game plays these three, streamed and looped:

| file | plays |
|---|---|
| `feral-angel-waltz.mp3` | **the run** — every wave, every floor but the last |
| `burn-the-world-waltz.mp3` | **boss fights**, and an angry PACI |
| `mesmerizing-galaxy-loop.mp3` | **the last floor, all of it** — every wave, its boss, and the finale |

The title screen is deliberately silent.

The last floor outranks everything: once you walk in, it is one unbroken piece
until the run ends. Boss fights on that floor do not interrupt it.

## Changing them

`tracks.json` is the whole configuration:

```json
{
  "wave":  "feral-angel-waltz.mp3",
  "boss":  "burn-the-world-waltz.mp3",
  "final": "mesmerizing-galaxy-loop.mp3"
}
```

Drop a file in this folder, put its name in here, reload. `.mp3`, `.ogg` and
`.wav` all work — anything the browser plays. Any entry may be `null`, and a
track set to `null` falls back to the synthesised score rather than borrowing
another track's music.

`N` toggles music on and off in game, and the setting sticks between runs.

## How they are played

They are `<audio>` elements streamed through Web Audio, **not** decoded into
buffers. `decodeAudioData()` would hold each whole song as float PCM — roughly
21MB a minute at 44.1kHz stereo, so these three would sit near a quarter of a
gigabyte of resident memory for a 13MB download. Streaming costs a buffer
instead of a song.

The trade is that looping an MP3 is not perfectly gapless the way a buffer loop
is. For multi-minute tracks playing under gunfire, that is the right side of
the trade. If you ever want a short, seamless loop instead, that is the one
case where decoding to a buffer is worth it.

They ride the same bus the synth does, so the volume keys, mute, and the duck
under a boss roar all apply with nothing extra wired up.

## Licensing

All three are royalty-free, per the source they came from.

One thing that is easy to miss: *royalty-free* means there is no per-use fee —
the part that normally costs money. It does not automatically mean no
attribution. A good share of royalty-free licences still want a credit line,
and some separate personal use from commercial. Nothing to do about it while
this is a project you and your friends play; worth a look at the actual terms
if it ever gets sold or put on a storefront.

If a credit line is wanted, the tidy place for it is the README, one row per
track. Leave this list here so future-you knows where they came from:

| track | source | licence |
|---|---|---|
| `feral-angel-waltz.mp3` | *(fill in)* | royalty-free |
| `burn-the-world-waltz.mp3` | *(fill in)* | royalty-free |
| `mesmerizing-galaxy-loop.mp3` | *(fill in)* | royalty-free |

If you ever want replacements whose terms are spelled out in public:

- **incompetech.com** — Kevin MacLeod, CC-BY. Large, well organised. Credit required.
- **freemusicarchive.org** — filter by licence.
- **opengameart.org** — written for games, so already loop-friendly.
- **patrickdearteaga.com** — CC-BY, game-oriented.

## Format notes

Keep an eye on file size — they are fetched over the network as the game runs.
13MB total is fine. A hundred would not be.
