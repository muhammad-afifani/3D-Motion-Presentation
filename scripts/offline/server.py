#!/usr/bin/env python3
"""server.py — cadangan bila Node tidak ada (Python 3.7+, tanpa paket tambahan).

Menyajikan folder app/ di http://localhost:<port>/ dengan MIME type EKSPLISIT
(.js/.mjs -> text/javascript; ES module dan Web Worker gagal bila .js disajikan sebagai text/plain).
File yang tidak ada -> 404 (bukan index.html palsu). Tanpa daftar isi folder.

  python3 server.py            (Windows: py -3 server.py)
  python3 server.py --open --port 9000
"""
import http.server
import os
import socketserver
import sys
import webbrowser

MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
    ".map": "application/json; charset=utf-8",
}

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app")


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**MIME, "": "application/octet-stream"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def guess_type(self, path):
        return MIME.get(os.path.splitext(path)[1].lower(), "application/octet-stream")

    def list_directory(self, path):  # tanpa daftar isi folder
        self.send_error(404, "Not found")
        return None

    def send_error(self, code, message=None, explain=None):
        # galat sebagai teks polos (bukan halaman HTML), jelas berbeda dari index.html
        body = ("%d %s: %s" % (code, message or "Error", self.path)).encode("utf-8")
        self.send_response(code, message)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # content/*.json bisa diedit lalu reload
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = False


def main():
    args = sys.argv[1:]
    port = int(args[args.index("--port") + 1]) if "--port" in args else 8080
    for p in range(port, port + 20):
        try:
            httpd = Server(("127.0.0.1", p), Handler)
        except OSError:
            continue
        url = "http://localhost:%d/" % p
        print("Server presentasi berjalan: " + url)
        print("Biarkan jendela ini terbuka selama presentasi. Tekan Ctrl+C untuk berhenti.")
        sys.stdout.flush()
        if "--open" in args:
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        return
    print("Tidak menemukan port kosong.")
    sys.exit(1)


if __name__ == "__main__":
    main()
