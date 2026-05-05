import http.server
import socketserver
import urllib.request
import urllib.error
import json
import os
import ssl
import threading

# --- Load Environment Variables (.env) ---
def load_env():
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    if '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key.strip()] = value.strip().strip("'\"")

load_env()
API_KEY = os.environ.get('OPENAI_API_KEY')

if not API_KEY:
    print("Warning: OPENAI_API_KEY is not set in the .env file.")

PORT = int(os.environ.get('PORT', 8080))

# Reusable SSL context (unverified for dev proxy)
SSL_CTX = ssl._create_unverified_context()


class ProxyHandler(http.server.SimpleHTTPRequestHandler):

    # Serve .js files with correct MIME type for ES modules
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
    }

    def end_headers(self):
        # Disable caching during development so browser always gets fresh files
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/chat':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)

            if not API_KEY:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': {'message': "API Key not configured on the server."}}).encode('utf-8'))
                return

            req = urllib.request.Request('https://api.openai.com/v1/chat/completions', data=post_data)
            req.add_header('Content-Type', 'application/json')
            req.add_header('Authorization', f'Bearer {API_KEY}')

            try:
                with urllib.request.urlopen(req, context=SSL_CTX, timeout=60) as response:
                    status = response.status
                    body = response.read()

                    self.send_response(status)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(body)
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(e.read())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': {'message': str(e)}}).encode('utf-8'))
        else:
            self.send_error(404, 'Not Found')

    def log_message(self, format, *args):
        """Log to both stderr and server.log."""
        message = format % args
        print(f"{self.client_address[0]} - - [{self.log_date_time_string()}] {message}")


# --- Start Server (threaded so static files aren't blocked by API calls) ---
class ThreadedServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

with ThreadedServer(("", PORT), ProxyHandler) as httpd:
    print(f"Serving on port {PORT} at http://localhost:{PORT}")
    print(f"  → Threading enabled (concurrent requests supported)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down.")
        httpd.shutdown()


