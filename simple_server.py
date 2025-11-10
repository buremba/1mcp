#!/usr/bin/env python3
"""
Simple HTTP server that responds with Hello World
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from datetime import datetime

class SimpleHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests"""
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Simple HTTP Server</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 50px auto;
                    padding: 20px;
                    background-color: #f0f0f0;
                }}
                .container {{
                    background-color: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }}
                h1 {{ color: #333; }}
                .info {{ color: #666; margin-top: 20px; }}
                .emoji {{ font-size: 3em; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="emoji">👋</div>
                <h1>Hello from Simple HTTP Server!</h1>
                <p>This is a basic Python HTTP server.</p>
                <div class="info">
                    <p><strong>Path:</strong> {self.path}</p>
                    <p><strong>Time:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                </div>
            </div>
        </body>
        </html>
        """
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        """Log requests to stdout"""
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {format % args}")

def run_server(port=8080):
    """Start the HTTP server"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, SimpleHandler)
    print(f"Server running on http://localhost:{port}")
    print("Press Ctrl+C to stop the server")
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()
