import json
import os
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, 'data')
DATA_FILE = os.path.join(DATA_DIR, 'agendamentos.json')

os.makedirs(DATA_DIR, exist_ok=True)
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'w', encoding='utf-8') as fh:
        json.dump([], fh)


def read_agendamentos():
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def write_agendamentos(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)


class Handler(BaseHTTPRequestHandler):
    def _set_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_file(self, path):
        if path == '/':
            path = '/index.html'
        file_path = os.path.join(ROOT, path.lstrip('/'))
        if not file_path.startswith(ROOT):
            self.send_error(403)
            return
        if not os.path.isfile(file_path):
            self.send_error(404)
            return
        ext = os.path.splitext(file_path)[1].lower()
        mime_types = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.ico': 'image/x-icon',
        }
        content_type = mime_types.get(ext, 'application/octet-stream')
        with open(file_path, 'rb') as fh:
            body = fh.read()
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/agendamentos':
            self._set_json(200, read_agendamentos())
            return
        if parsed.path == '/api/ultima-localizacao':
            query = urllib.parse.parse_qs(parsed.query)
            url_planilha = query.get('url', [''])[0]
            if not url_planilha:
                self._set_json(400, {'error': 'Missing url'})
                return
            url_planilha = urllib.parse.unquote(url_planilha)
            req = urllib.request.Request(url_planilha, headers={
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'text/plain, text/csv, application/json, application/octet-stream, */*'
            })
            try:
                with urllib.request.urlopen(req) as response:
                    body = response.read().decode('utf-8', errors='ignore')
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain; charset=utf-8')
                self.send_header('Content-Length', str(len(body.encode('utf-8'))))
                self.end_headers()
                self.wfile.write(body.encode('utf-8'))
            except Exception as exc:
                self._set_json(502, {'error': str(exc)})
            return
        self._serve_file(parsed.path)

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/agendamentos':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            data = json.loads(body) if body else []
            write_agendamentos(data if isinstance(data, list) else [])
            self._set_json(200, {'ok': True})
            return
        self._set_json(404, {'error': 'Not found'})

    def do_POST(self):
        self.do_PUT()

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith('/api/agendamentos/'):
            agendamento_id = parsed.path.split('/')[-1]
            agendamentos = [item for item in read_agendamentos() if item.get('id') != agendamento_id]
            write_agendamentos(agendamentos)
            self._set_json(200, {'ok': True})
            return
        self._set_json(404, {'error': 'Not found'})


if __name__ == '__main__':
    host = '0.0.0.0'
    port = int(os.environ.get('PORT', 3000))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f'Servidor rodando em http://localhost:{port}')
    server.serve_forever()
