# -*- coding: utf-8 -*-
"""拼段 + 垫原曲 + 抽封面：python mux.py <工程目录> <音源> <时长秒> <成片路径> [封面时刻]

音源从第 0 秒开始铺，所以视频第 0 帧必须等于歌曲第 0 秒（或你截取的那一段起点）。
"""
import os, shutil, subprocess, sys
from pathlib import Path

if os.environ.get("FFMPEG"):
    FF = os.environ["FFMPEG"]
else:
    FF = shutil.which("ffmpeg") or shutil.which("ffmpeg.exe")
    if not FF:
        try:
            import imageio_ffmpeg
            FF = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            raise SystemExit("找不到 ffmpeg：设 FFMPEG 环境变量")


def main():
    if len(sys.argv) < 5:
        raise SystemExit(__doc__)
    proj = Path(sys.argv[1]).resolve()
    audio = Path(sys.argv[2]).resolve()
    dur = float(sys.argv[3])
    out = Path(sys.argv[4]).resolve()
    cover_t = float(sys.argv[5]) if len(sys.argv) > 5 else dur * 0.55

    r = proj / "renders"
    parts = sorted(r.glob("s*.mp4"))
    if not parts:
        raise SystemExit(f"{r} 里没有 s*.mp4")
    lst = r / "_parts.txt"
    lst.write_text("".join(f"file '{q.name}'\n" for q in parts), encoding="utf-8")
    joined = r / "joined.mp4"
    subprocess.run([FF, "-v", "warning", "-y", "-f", "concat", "-safe", "0",
                    "-i", str(lst), "-c", "copy", str(joined)], check=True)

    fade = max(0.0, dur - 1.2)
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([FF, "-v", "warning", "-y", "-i", str(joined), "-i", str(audio),
                    "-map", "0:v", "-map", "1:a", "-t", f"{dur}",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-af", f"afade=in:st=0:d=0.15,afade=out:st={fade:.2f}:d=1.2",
                    str(out)], check=True)

    cover = out.parent / f"封面_{out.stem}.png"
    subprocess.run([FF, "-v", "error", "-y", "-ss", f"{cover_t}", "-i", str(out),
                    "-frames:v", "1", str(cover)], check=True)
    print(f"成片 {out}  {out.stat().st_size / 1e6:.1f}MB\n封面 {cover}")


if __name__ == "__main__":
    main()
