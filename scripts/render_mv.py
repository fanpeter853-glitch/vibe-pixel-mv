# -*- coding: utf-8 -*-
"""渲染一段像素 MV：python render_mv.py <工程目录> <起帧> <止帧> <名字>

工程目录里只需要 index.html + film.js（自建渲染器，不依赖 vibe-knowledge-film 引擎）。
页面需暴露 window.FPS、window.DUR、window.READY，并提供 seek(t)。
"""
import http.server, os, shutil, socketserver, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

FPS_DEFAULT = 30


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(directory):
    handler = lambda *a, **kw: Handler(*a, directory=str(directory), **kw)  # noqa: E731
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    import threading
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{port}/index.html"


def ffmpeg_path():
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    for name in ("ffmpeg", "ffmpeg.exe"):
        p = shutil.which(name)
        if p:
            return p
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        raise SystemExit("找不到 ffmpeg：设 FFMPEG 环境变量，或 pip install imageio-ffmpeg")


def launch(p):
    for kw in ({"channel": "chrome"}, {}):
        try:
            return p.chromium.launch(args=["--disable-lcd-text", "--force-color-profile=srgb"], **kw)
        except Exception:
            continue
    raise SystemExit("没有可用浏览器：python -m playwright install chromium")


def main():
    if len(sys.argv) < 5:
        raise SystemExit(__doc__)
    proj = Path(sys.argv[1]).resolve()
    a, b, name = int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
    (proj / "renders").mkdir(exist_ok=True)
    out = proj / "renders" / f"{name}.mp4"
    d = proj / "renders" / f"_tmp_{name}_{os.getpid()}"
    if d.exists():
        shutil.rmtree(d, ignore_errors=True)
    d.mkdir(parents=True)
    httpd, url = serve(proj)
    t0 = time.time()
    with sync_playwright() as p:
        br = launch(p)
        pg = br.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        pg.on("pageerror", lambda e: print("[pageerror]", str(e)[:200], flush=True))
        pg.goto(url)
        pg.wait_for_function("window.READY === true", timeout=120000)
        fps = pg.evaluate("window.FPS") or FPS_DEFAULT
        for i in range(a, b):
            pg.evaluate(f"seek({i / fps})")
            (d / f"{i - a:05d}.png").write_bytes(pg.screenshot(type="png"))
            if (i - a) % 50 == 0:
                print(f"{name} {i - a}/{b - a} ({time.time() - t0:.0f}s)", flush=True)
        br.close()
    httpd.shutdown()
    subprocess.run([ffmpeg_path(), "-v", "warning", "-y", "-framerate", str(fps),
                    "-start_number", "0", "-i", str(d / "%05d.png"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "14",
                    "-preset", "medium", str(out)], check=True)
    shutil.rmtree(d, ignore_errors=True)
    print(f"{name} done {out.stat().st_size / 1e6:.1f}MB ({time.time() - t0:.0f}s)", flush=True)


if __name__ == "__main__":
    main()
