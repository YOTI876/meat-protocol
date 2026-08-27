# Putting a real track in

The score the game ships with is synthesised — `js/music.js` builds it out of
oscillators while you play. That is not because a recording would be worse. It
is because a recording has an owner, and picking one is a licensing decision
rather than a technical one.

So the game prefers a file when it finds one. Drop a track in here and it
plays instead of the synth:

| file | plays |
|---|---|
| `audio/wave.ogg` (or `.mp3`, `.wav`) | the whole run — waves, shops, corridors |
| `audio/boss.ogg` (or `.mp3`, `.wav`) | boss fights and the finale |

Either one on its own is fine. If only `boss.mp3` is here, bosses use it and
the rest of the run stays synthesised. Both missing is the current behaviour
and nothing changes.

Tracks are looped, and they crossfade over about a second when a boss starts,
so pick something that survives being looped — no long intro, no cold ending.

They ride the same bus the synth does, which means **the volume keys, mute,
and the duck under a boss roar all still work** without you doing anything.

## Where to get one you are allowed to use

These are the places that hand out music with a licence attached. Read the
licence — most want a credit line, and a credit line costs you one row in the
README.

- **incompetech.com** — Kevin MacLeod, CC-BY. Enormous, well organised, has a
  metal/rock section. Credit required.
- **freemusicarchive.org** — filter by licence. Mixed quality, some excellent.
- **opengameart.org** — written for games, so already loop-friendly. Licences
  vary per track, check each one.
- **patrickdearteaga.com** — CC-BY, game-oriented, several rock tracks.
- **freesound.org** — more for effects than songs, but worth knowing about.

If you buy something from a stock library instead, the standard licence
usually covers a game — check that it covers *distribution*, not just
"personal projects".

## Format

`.ogg` is tried first, then `.mp3`, then `.wav`. Ogg is the best trade for
this: it loops without the silent padding an MP3 encoder adds at the start,
which matters when the track is on repeat for twenty minutes.

Keep them reasonably small. They are fetched and decoded on the first frame of
audio, and a 40MB wav is a visible pause.
