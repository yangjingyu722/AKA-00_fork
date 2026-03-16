from flask import Flask
from flask_cors import CORS


def create_app():
    app = Flask(__name__, static_folder="../static", template_folder="../templates")
    # 添加CORS配置，允许所有跨域请求
    CORS(app)
    
    from .routes.api import api_bp
    from .routes.frontend import frontend_bp

    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(frontend_bp)

    return app
