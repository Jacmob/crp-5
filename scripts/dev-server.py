"""Static file server for local development that disables browser caching,
so edited ES modules are always reloaded. Usage: python3 scripts/dev-server.py [port]"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8091
    root = Path(__file__).resolve().parent.parent
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(NoCacheHandler, directory=str(root)))
    print(f"Serving {root} at http://localhost:{port}")
    server.serve_forever()
