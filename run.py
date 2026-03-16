import os

from app import create_app

app = create_app()

if __name__ == '__main__':
    default_port = 5000 if os.name == "nt" else 80
    port = int(os.getenv("APP_HTTP_PORT", str(default_port)))
    print(f"Starting server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True, threaded=True)
