"""
Pre-render the whole novel as an audiobook with neural Korean voices (Edge TTS), one set per voice.

Output (per voice key K in VOICES):
  audio/K/ch{N}.mp3   one CBR mp3 per chapter: [chapter title] + paragraphs, byte-concatenated
  audio/K/cues.json   { voice, rate, pitch, chapters: { "N": { starts: [sec...], duration: sec } } }
                      starts[i] = start time of paragraph i (title occupies 0..starts[0])

Usage:  python tools/build_audiobook.py            (full build, resumes finished chapters)
        python tools/build_audiobook.py --force    (rebuild everything)
        python tools/build_audiobook.py m          (only the voice keys given)
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
# Edge TTS offers three Korean voices: HyunsuMultilingual (M), InJoon (M), SunHi (F).
# Hyunsu is the calmer of the two men; slowed and lowered it reads like a quiet murmur.
VOICES = {
    "m": {"voice": "ko-KR-HyunsuMultilingualNeural", "rate": "-18%", "pitch": "-16Hz"},
    "f": {"voice": "ko-KR-SunHiNeural", "rate": "-14%", "pitch": "-6Hz"},
}
CONCURRENCY = 4
FORCE = "--force" in sys.argv
ONLY = [a for a in sys.argv[1:] if a in VOICES] or list(VOICES)


def load_novel():
    src = (ROOT / "novel-data.js").read_text(encoding="utf-8")
    return json.loads(src[src.index("{"): src.rindex("}") + 1])


async def synth(text, cfg, sem, tries=5):
    last = None
    async with sem:
        for i in range(tries):
            try:
                comm = edge_tts.Communicate(text, cfg["voice"], rate=cfg["rate"], pitch=cfg["pitch"])
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


async def build_chapter(ch, cfg, sem):
    title = f"{ch['number']}. {ch['subtitle']}."
    segments = [title] + ch["paragraphs"]
    datas = await asyncio.gather(*(synth(t, cfg, sem) for t in segments))
    out = io.BytesIO()
    t = 0.0
    starts = []
    for i, d in enumerate(datas):
        if i > 0:
            starts.append(round(t, 3))
        out.write(d)
        t += mp3_seconds(d)
    return out.getvalue(), {"starts": starts, "duration": round(t, 3)}


async def build_voice(key, cfg, novel, sem):
    out = OUT / key
    out.mkdir(parents=True, exist_ok=True)
    cues_path = out / "cues.json"
    cues = {**cfg, "chapters": {}}
    if cues_path.exists() and not FORCE:
        try:
            old = json.loads(cues_path.read_text(encoding="utf-8"))
            if all(old.get(k) == cfg[k] for k in cfg):
                cues["chapters"] = old.get("chapters", {})
        except Exception:
            pass

    t0 = time.time()
    for ch in novel["chapters"]:
        k = str(ch["id"])
        mp3_path = out / f"ch{ch['id']}.mp3"
        if k in cues["chapters"] and mp3_path.exists() and not FORCE:
            print(f"{key}/ch{k}: cached", flush=True)
            continue
        data, cue = await build_chapter(ch, cfg, sem)
        mp3_path.write_bytes(data)
        cues["chapters"][k] = cue
        cues_path.write_text(json.dumps(cues, ensure_ascii=False), encoding="utf-8")
        print(f"{key}/ch{k}: {len(ch['paragraphs'])} paras, {cue['duration']/60:.1f} min, "
              f"{len(data)/1e6:.1f} MB, elapsed {time.time()-t0:.0f}s", flush=True)

    total = sum(c["duration"] for c in cues["chapters"].values())
    size = sum(p.stat().st_size for p in out.glob("*.mp3")) / 1e6
    print(f"{key} done: {total/60:.1f} min of audio, {size:.1f} MB", flush=True)


async def main():
    novel = load_novel()
    sem = asyncio.Semaphore(CONCURRENCY)
    for key in ONLY:
        await build_voice(key, VOICES[key], novel, sem)


if __name__ == "__main__":
    asyncio.run(main())
