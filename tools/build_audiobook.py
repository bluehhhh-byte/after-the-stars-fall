"""
Pre-render the whole novel as an audiobook with a neural male Korean voice (Edge TTS).

Output:
  audio/ch{N}.mp3   one CBR mp3 per chapter: [chapter title] + paragraphs, byte-concatenated
  audio/cues.json   { voice, rate, pitch, chapters: { "N": { starts: [sec...], duration: sec } } }
                    starts[i] = start time of paragraph i (title occupies 0..starts[0])

Usage:  python tools/build_audiobook.py            (full build, resumes finished chapters)
        python tools/build_audiobook.py --force    (rebuild everything)
Requires: pip install edge-tts mutagen
"""
import asyncio
import io
import json
import pathlib
import sys
import time

import edge_tts
from mutagen.mp3 import MP3

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "audio"
VOICE = "ko-KR-InJoonNeural"   # male; HyunsuMultilingualNeural is the alternative
RATE = "-8%"                   # calm literary pace
PITCH = "-10Hz"                # deeper, more composed tone
CONCURRENCY = 4
FORCE = "--force" in sys.argv


def load_novel():
    src = (ROOT / "novel-data.js").read_text(encoding="utf-8")
    return json.loads(src[src.index("{"): src.rindex("}") + 1])


async def synth(text, sem, tries=5):
    last = None
    async with sem:
        for i in range(tries):
            try:
                comm = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
                buf = io.BytesIO()
                async for chunk in comm.stream():
                    if chunk["type"] == "audio":
                        buf.write(chunk["data"])
                data = buf.getvalue()
                if len(data) < 400:
                    raise RuntimeError("empty audio")
                return data
            except Exception as e:  # network hiccups / throttling
                last = e
                await asyncio.sleep(1.5 * (i + 1))
    raise last


def mp3_seconds(data):
    return MP3(io.BytesIO(data)).info.length


async def build_chapter(ch, sem):
    title = f"{ch['number']}. {ch['subtitle']}."
    segments = [title] + ch["paragraphs"]
    datas = await asyncio.gather(*(synth(t, sem) for t in segments))
    out = io.BytesIO()
    t = 0.0
    starts = []
    for i, d in enumerate(datas):
        if i > 0:
            starts.append(round(t, 3))
        out.write(d)
        t += mp3_seconds(d)
    return out.getvalue(), {"starts": starts, "duration": round(t, 3)}


async def main():
    novel = load_novel()
    OUT.mkdir(exist_ok=True)
    cues_path = OUT / "cues.json"
    cues = {"voice": VOICE, "rate": RATE, "pitch": PITCH, "chapters": {}}
    if cues_path.exists() and not FORCE:
        try:
            old = json.loads(cues_path.read_text(encoding="utf-8"))
            if old.get("voice") == VOICE and old.get("rate") == RATE and old.get("pitch") == PITCH:
                cues["chapters"] = old.get("chapters", {})
        except Exception:
            pass

    sem = asyncio.Semaphore(CONCURRENCY)
    t0 = time.time()
    for ch in novel["chapters"]:
        key = str(ch["id"])
        mp3_path = OUT / f"ch{ch['id']}.mp3"
        if key in cues["chapters"] and mp3_path.exists() and not FORCE:
            print(f"ch{key}: cached", flush=True)
            continue
        data, cue = await build_chapter(ch, sem)
        mp3_path.write_bytes(data)
        cues["chapters"][key] = cue
        cues_path.write_text(json.dumps(cues, ensure_ascii=False), encoding="utf-8")
        print(f"ch{key}: {len(ch['paragraphs'])} paras, {cue['duration']/60:.1f} min, "
              f"{len(data)/1e6:.1f} MB, elapsed {time.time()-t0:.0f}s", flush=True)

    total = sum(c["duration"] for c in cues["chapters"].values())
    print(f"done: {total/60:.1f} min of audio, {sum(p.stat().st_size for p in OUT.glob('*.mp3'))/1e6:.1f} MB", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
