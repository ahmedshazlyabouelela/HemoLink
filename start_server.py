from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket

HOST = "0.0.0.0"
PORT = 2020
ROOT = Path(__file__).resolve().parent

if __name__ == "__main__":
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    try:
        server = ThreadingHTTPServer((HOST, PORT), handler)
    except OSError as exc:
        print(f"Cannot start on {HOST}:{PORT}: {exc}")
        raise SystemExit(1)
    print(f"HemoLink is listening on {HOST}:{PORT}")
    print(f"On this computer: http://localhost:{PORT}")
    print("On another device: http://YOUR-COMPUTER-LAN-IP:2020")
    print("Keep this window open. Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()
