import os
try:
    import fcntl
    _HAS_FCNTL = True
except Exception:
    _HAS_FCNTL = False
import socket
import struct
import time
import threading

from flask import Blueprint, request, jsonify, Response

# 视频流相关
try:
    import cv2
    import numpy as np
    _HAS_CV2 = True
except ImportError:
    _HAS_CV2 = False
    np = None

if os.name == "nt":
    class STS3215:
        def __init__(self, *_, **__):
            pass

    def grab(_):
        return None

    def release(_):
        return None

    def arm_init(_):
        return None

    class Motor:
        def __init__(self, *_, **__):
            pass

    def forward(*_, **__):
        return None

    def backward(*_, **__):
        return None

    def turn_left(*_, **__):
        return None

    def turn_right(*_, **__):
        return None

    def sleep(*_, **__):
        return None

    def brake(*_, **__):
        return None
else:
    from arm import STS3215, grab, release, arm_init
    from motor import Motor, forward, backward, turn_left, turn_right, sleep, brake

left_motor = Motor(4, 0, 1)
right_motor = Motor(4, 2, 3)

servo = STS3215("/dev/ttyS2", baudrate=115200)
arm_init(servo)

api_bp = Blueprint("api", __name__)


@api_bp.route("/ip")
def ip():
    return jsonify({
        "ip": get_ip()
    })


@api_bp.route('/control', methods=['GET'])
def control():
    action = request.args.get('action')
    speed = int(request.args.get('speed', 50))
    milliseconds = float(request.args.get('time', 0))

    speed = speed * 240 // 50
    # --- 运动逻辑 ---
    if action == 'up':
        # print('up')
        forward(left_motor, right_motor, speed)
    elif action == 'down':
        # print('down')
        backward(left_motor, right_motor, speed)
    elif action == 'left':
        # print('left')
        turn_left(left_motor, right_motor, speed)
    elif action == 'right':
        # print('right')
        turn_right(left_motor, right_motor, speed)
    elif action == 'stop':
        # print('stop')
        brake(left_motor, right_motor)
    elif action == 'grab':
        # print('grab')
        grab(servo)
    elif action == 'release':
        # print('release')
        release(servo)

    if milliseconds > 0 and action in ['up', 'down', 'left', 'right']:
        time.sleep(milliseconds / 1000.0)
        # sleep(left_motor, right_motor)

        return jsonify({"status": "success", "message": f"{action} for {milliseconds}s done"})

    return jsonify({"status": "success", "action": action})


# ==================== MJPEG 视频流功能 ====================

# 全局视频流相关变量
_video_capture = None
_video_lock = threading.Lock()
_video_enabled = False

def get_video_capture():
    """获取或创建视频捕获对象"""
    global _video_capture, _video_enabled
    if _video_capture is None and _HAS_CV2:
        _video_capture = cv2.VideoCapture(0)
        if _video_capture.isOpened():
            _video_enabled = True
    return _video_capture

def generate_frames():
    """生成 MJPEG 帧"""
    global _video_enabled
    cap = get_video_capture()
    if cap is None or not cap.isOpened():
        # 如果没有摄像头，生成测试画面
        while True:
            frame = generate_test_frame()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            time.sleep(0.033)  # 30 FPS
        return
    
    while _video_enabled:
        with _video_lock:
            success, frame = cap.read()
        if not success:
            break
        
        # 压缩为 JPEG
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
        
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

def generate_test_frame():
    """生成测试画面（没有摄像头时使用）"""
    if not _HAS_CV2:
        return b''
    
    # 创建一个彩色测试画面
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # 添加渐变色背景
    for i in range(480):
        frame[i, :] = [i % 255, (i * 2) % 255, (i * 3) % 255]
    
    # 添加文字
    cv2.putText(frame, "No Camera Detected", (150, 240), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    cv2.putText(frame, "AKA-00 Robot", (220, 280), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    
    ret, buffer = cv2.imencode('.jpg', frame)
    return buffer.tobytes() if ret else b''

@api_bp.route('/video_feed')
def video_feed():
    """MJPEG 视频流接口"""
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@api_bp.route('/camera/status')
def camera_status():
    """获取摄像头状态"""
    cap = get_video_capture()
    return jsonify({
        "enabled": _video_enabled,
        "available": cap is not None and cap.isOpened(),
        "has_cv2": _HAS_CV2
    })

@api_bp.route('/camera/toggle', methods=['POST'])
def toggle_camera():
    """开启/关闭摄像头"""
    global _video_enabled, _video_capture
    
    try:
        data = request.get_json() or {}
        enable = data.get('enable', not _video_enabled)
        
        if enable:
            cap = get_video_capture()
            _video_enabled = cap is not None and cap.isOpened()
        else:
            _video_enabled = False
            if _video_capture is not None:
                _video_capture.release()
                _video_capture = None
        
        return jsonify({"enabled": _video_enabled, "status": "success"})
    except Exception as e:
        print(f"摄像头切换失败: {e}")
        return jsonify({"enabled": _video_enabled, "status": "error", "message": str(e)}), 500


# ==================== IP 获取函数 ====================

def get_ip(ifname="wlan0"):
    if not _HAS_FCNTL:
        return socket.gethostbyname(socket.gethostname())
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    return socket.inet_ntoa(
        fcntl.ioctl(
            s.fileno(),
            0x8915,
            struct.pack('256s', ifname[:15].encode('utf-8'))
        )[20:24]
    )
