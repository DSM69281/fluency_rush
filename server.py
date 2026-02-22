"""
FLUENCY RUSH — Servidor Python
================================
Requisitos:
    pip install flask flask-cors

Uso:
    python server.py

Depois em outro terminal:
    ngrok http 5000
"""

import json
import time
import threading
import os
from pathlib import Path
from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS

# ── Configuração ───────────────────────────────────────────────────────────────
BASE_DIR  = Path(__file__).parent
DATA_FILE = BASE_DIR / "data" / "db.json"
STATIC    = BASE_DIR / "static"
FRONTEND_DIRS = [STATIC, BASE_DIR]

app  = Flask(__name__, static_folder=str(STATIC))
CORS(app)

db_lock = threading.Lock()

# ── SSE — clientes conectados ──────────────────────────────────────────────────
sse_clients: list = []
sse_lock = threading.Lock()

def broadcast(event: str, payload: dict):
    """Envia um evento SSE para todos os clientes conectados."""
    msg = f"event: {event}\ndata: {json.dumps(payload)}\n\n"
    with sse_lock:
        dead = []
        for q in sse_clients:
            try:
                q.append(msg)
            except Exception:
                dead.append(q)
        for q in dead:
            sse_clients.remove(q)

# ── Helpers de persistência ────────────────────────────────────────────────────
def read_db() -> dict:
    with db_lock:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)

def write_db(data: dict):
    with db_lock:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

# ── Rotas estáticas ────────────────────────────────────────────────────────────
@app.route("/")
def index():
    for directory in FRONTEND_DIRS:
        index_file = directory / "index.html"
        if index_file.exists():
            return send_from_directory(str(directory), "index.html")
    return ("index.html não encontrado (procurei em: static/ e raiz do projeto)", 404)

@app.route("/<path:filename>")
def static_files(filename):
    for directory in FRONTEND_DIRS:
        file_path = directory / filename
        if file_path.exists():
            return send_from_directory(str(directory), filename)
    return ("Arquivo não encontrado", 404)

# ── SSE — stream de eventos em tempo real ─────────────────────────────────────
@app.route("/events")
def events():
    queue = []
    with sse_lock:
        sse_clients.append(queue)

    def generate():
        # Envia estado inicial ao conectar
        db = read_db()
        yield f"event: init\ndata: {json.dumps(db)}\n\n"

        while True:
            if queue:
                yield queue.pop(0)
            else:
                # heartbeat a cada 15s para manter conexão
                yield ": keep-alive\n\n"
                time.sleep(15)

    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache",
                             "X-Accel-Buffering": "no"})

# ── API: Usuários ──────────────────────────────────────────────────────────────
@app.route("/api/users", methods=["GET"])
def get_users():
    db = read_db()
    return jsonify(db["users"])

@app.route("/api/users/<user_id>", methods=["POST"])
def upsert_user(user_id):
    body = request.get_json(force=True)
    db   = read_db()

    if user_id not in db["users"]:
        # Novo usuário
        db["users"][user_id] = {
            "name":      body.get("name", user_id),
            "xp":        0,
            "streak":    1,
            "joinedAt":  int(time.time() * 1000),
            "lastSeen":  int(time.time() * 1000),
        }
        is_new = True
    else:
        db["users"][user_id]["lastSeen"] = int(time.time() * 1000)
        if "name" in body:
            db["users"][user_id]["name"] = body["name"]
        is_new = False

    write_db(db)
    broadcast("users", db["users"])
    return jsonify({"ok": True, "new": is_new, "user": db["users"][user_id]})

@app.route("/api/users/<user_id>/xp", methods=["PATCH"])
def add_xp(user_id):
    body   = request.get_json(force=True)
    amount = int(body.get("amount", 0))
    db     = read_db()

    if user_id not in db["users"]:
        return jsonify({"error": "user not found"}), 404

    db["users"][user_id]["xp"] += amount
    write_db(db)
    broadcast("users", db["users"])
    return jsonify({"ok": True, "xp": db["users"][user_id]["xp"]})

# ── API: Feed ──────────────────────────────────────────────────────────────────
@app.route("/api/feed", methods=["GET"])
def get_feed():
    db = read_db()
    return jsonify(db["feed"][-50:])

@app.route("/api/feed", methods=["POST"])
def post_feed():
    body = request.get_json(force=True)
    db   = read_db()

    entry = {
        "name":   body.get("name", "Anônimo"),
        "action": body.get("action", ""),
        "xp":     body.get("xp", 0),
        "ts":     int(time.time() * 1000),
    }
    db["feed"].append(entry)
    db["feed"] = db["feed"][-200:]   # mantém só os 200 últimos
    write_db(db)
    broadcast("feed", db["feed"][-20:])
    return jsonify({"ok": True})

# ── API: Chat ──────────────────────────────────────────────────────────────────
@app.route("/api/chat", methods=["GET"])
def get_chat():
    db = read_db()
    return jsonify(db["chat"][-60:])

@app.route("/api/chat", methods=["POST"])
def post_chat():
    body = request.get_json(force=True)
    db   = read_db()

    msg = {
        "name": body.get("name", "Anônimo"),
        "text": body.get("text", "")[:300],
        "ts":   int(time.time() * 1000),
    }
    db["chat"].append(msg)
    db["chat"] = db["chat"][-300:]   # mantém só as 300 últimas
    write_db(db)
    broadcast("chat", db["chat"][-40:])
    return jsonify({"ok": True})

# ── API: Reset (utilitário de dev) ─────────────────────────────────────────────
@app.route("/api/reset", methods=["POST"])
def reset_db():
    write_db({"users": {}, "feed": [], "chat": []})
    broadcast("init", {"users": {}, "feed": [], "chat": []})
    return jsonify({"ok": True, "msg": "Banco resetado!"})

# ── Inicialização ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        write_db({"users": {}, "feed": [], "chat": []})

    print("\n" + "═"*50)
    print("  🚀 FLUENCY RUSH — Servidor iniciado!")
    print("  📡 Local:  http://localhost:5000")
    print("  🌐 Para expor externamente: ngrok http 5000")
    print("═"*50 + "\n")

    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
