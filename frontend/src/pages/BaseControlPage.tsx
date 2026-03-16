import {useEffect, useRef, useState} from "react";
import {sendAction} from "../api/socket.ts";
import ControlButton from "../components/ControlButton.tsx";

const FPS = 20
const frameInterval = 1000 / FPS

const BaseControlPage = () => {
    const [ip, setIp] = useState("获取中...");
    const [status, setStatus] = useState("准备就绪");
    const [isSimulator, setIsSimulator] = useState(false);
    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [cameraAvailable, setCameraAvailable] = useState(false);

    // 当前正在执行的动作（用于模拟器每帧发送）
    const currentActionRef = useRef<string | null>(null);

    // 检查摄像头状态
    useEffect(() => {
        console.log("检查摄像头状态...");
        fetch("/api/camera/status")
            .then(res => {
                console.log("摄像头状态响应:", res);
                if (!res.ok) {
                    throw new Error(`HTTP错误! 状态: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                console.log("摄像头状态数据:", data);
                setCameraAvailable(data.available);
                setCameraEnabled(data.enabled);
            })
            .catch(err => {
                console.error("获取摄像头状态失败:", err);
                setCameraAvailable(false);
                setStatus("无法连接到摄像头服务");
            });
    }, []);

    // 切换摄像头
    const toggleCamera = () => {
        console.log("切换摄像头状态...");
        fetch("/api/camera/toggle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enable: !cameraEnabled })
        })
            .then(res => {
                console.log("切换摄像头响应:", res);
                if (!res.ok) {
                    throw new Error(`HTTP错误! 状态: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                console.log("切换摄像头数据:", data);
                setCameraEnabled(data.enabled);
                setStatus(data.enabled ? "摄像头已开启" : "摄像头已关闭");
            })
            .catch(err => {
                console.error("切换摄像头失败:", err);
                setStatus("摄像头切换失败: " + err.message);
            });
    };

    useEffect(() => {
        const getIp = () => {
            setStatus("获取 IP...");
            fetch("/api/ip")
                .then((res) => res.json())
                .then((data) => {
                    console.log("device ip:", data.ip);
                    setIp("IP: " + data.ip);
                    setStatus("准备就绪");
                })
                .catch(() => {
                    setStatus("获取 IP 失败");
                });
        };

        getIp();
    }, []);

    const send = (action: string) => {
        setStatus("执行: " + action);
        if (!isSimulator) {
            console.log("http send " + action);
            fetch(`/api/control?action=${action}&speed=50&time=0`)
                .then((res) => res.json())
                .then((data) => console.log(data))
                .catch((err) => setStatus("错误: " + err));
        }
    };

    // ==== 按钮事件处理 ====
    const handlePressStart = (action: string) => {
        currentActionRef.current = action;
        if (!isSimulator) {
            send(action); // 实车立即发
        }
    };

    const handlePressEnd = () => {
        currentActionRef.current = null;
        if (!isSimulator) {
            send("stop"); // 实车发 stop
        }
    };

    useEffect(() => {
        if (!isSimulator) return; // 只在模拟器模式运行
        let animationFrameId: number
        let lastTime = 0;
        const renderLoop = (currentTime: number) => {
            animationFrameId = window.requestAnimationFrame(renderLoop)
            const action = currentActionRef.current;
            const delta = currentTime - lastTime

            if (delta < frameInterval) return

            lastTime = currentTime - (delta % frameInterval)

            if (action !== null) {
                sendAction(action); // 每帧发送当前动作
            }
        };

        animationFrameId = requestAnimationFrame(renderLoop);

        return () => {
            window.cancelAnimationFrame(animationFrameId)
        }

    }, [isSimulator])

    const redirect = () => {
        setStatus("获取 IP...");
        fetch("/api/ip")
            .then((res) => res.json())
            .then((data) => {
                const targetUrl = "https://ai.maodouketang.cn/";
                const fullUrl = `${targetUrl}?ip=${encodeURIComponent(data.ip)}`;
                window.location.replace(fullUrl);
            })
            .catch((err) => {
                console.error("跳转失败:", err);
                setStatus("跳转失败");
                alert("无法获取IP，请稍后重试");
            });
    };

    // 屏幕模式状态
    const [screenMode, setScreenMode] = useState("竖屏");

    // 切换屏幕模式
    const toggleScreenMode = () => {
        setScreenMode(prevMode => prevMode === "竖屏" ? "横屏" : "竖屏");
    };

    // 摇杆状态
    const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    // 处理摇杆开始拖动
    const handleJoystickStart = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        handleJoystickMove(e);
    };

    // 处理摇杆移动
    const handleJoystickMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) return;

        const joystick = document.querySelector('.joystick-container') as HTMLElement;
        if (!joystick) return;

        const rect = joystick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let clientX: number, clientY: number;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = rect.width / 2 - 40; // 摇杆半径

        // 限制摇杆在最大范围内
        const limitedDistance = Math.min(distance, maxDistance);
        const angle = Math.atan2(deltaY, deltaX);

        const x = Math.cos(angle) * limitedDistance;
        const y = Math.sin(angle) * limitedDistance;

        setJoystickPosition({ x, y });

        // 根据摇杆位置发送控制命令
        if (limitedDistance > 10) { // 最小移动阈值
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // 左右移动
                if (deltaX > 0) {
                    handlePressStart("right");
                } else {
                    handlePressStart("left");
                }
            } else {
                // 上下移动
                if (deltaY > 0) {
                    handlePressStart("down");
                } else {
                    handlePressStart("up");
                }
            }
        } else {
            handlePressEnd();
        }
    };

    // 处理摇杆结束拖动
    const handleJoystickEnd = () => {
        setIsDragging(false);
        setJoystickPosition({ x: 0, y: 0 });
        handlePressEnd();
    };

    return (
        <div
            style={{
                fontFamily: "system-ui, sans-serif",
                background: "#f8fafc",
                color: "#1e293b",
                minHeight: "100vh",
                padding: "10px",
                textAlign: "center",
                overflow: "hidden",
            }}
        >
            <h2>机器人</h2>
            <div style={{opacity: 0.6}}>{ip}</div>

            {/* 屏幕模式显示框 */}
            <div
                style={{
                    marginTop: "15px",
                    padding: "8px 15px",
                    background: "#e2e8f0",
                    borderRadius: "12px",
                    display: "inline-block",
                    fontSize: "14px",
                    marginBottom: "10px",
                    cursor: "pointer",
                }}
                onClick={toggleScreenMode}
            >
                屏幕模式：
                <span
                    style={{
                        marginLeft: "8px",
                        color: screenMode === "横屏" ? "#22c55e" : "#3b82f6",
                        fontWeight: "bold",
                    }}
                >
                    横屏模式
                </span>
                <span style={{ marginLeft: "10px", marginRight: "10px" }}>|</span>
                <span
                    style={{
                        color: screenMode === "竖屏" ? "#22c55e" : "#3b82f6",
                        fontWeight: "bold",
                    }}
                >
                    竖屏模式
                </span>
                <span style={{ marginLeft: "10px" }}>
                    （当前：
                    <span style={{
                        color: "#22c55e",
                        fontWeight: "bold",
                    }}>
                        {screenMode}模式
                    </span>
                    ）
                </span>
            </div>

            {/* 模式状态和摄像头状态 */}
            <div
                style={{
                    marginTop: "15px",
                    padding: "8px 15px",
                    background: "#e2e8f0",
                    borderRadius: "12px",
                    display: "inline-block",
                    fontSize: "14px",
                    marginBottom: "20px",
                }}
            >
                模式：
                <span
                    style={{
                        marginLeft: "8px",
                        color: isSimulator ? "#22c55e" : "#3b82f6",
                        fontWeight: "bold",
                    }}
                >
                    {isSimulator ? "模拟" : "实车"}
                </span>
                <span style={{ marginLeft: "20px" }}>|</span>
                <span style={{ marginLeft: "20px" }}>
                    摄像头：
                    <span style={{
                        color: cameraEnabled ? "#22c55e" : "#ef4444",
                        fontWeight: "bold",
                    }}>
                        {cameraEnabled ? "开启" : "关闭"}
                    </span>
                </span>
            </div>

            {/* 横屏模式布局 */}
            {screenMode === "横屏" ? (
                <div style={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "flex-end",
                    height: "70vh",
                    gap: "20px",
                    paddingBottom: "20px",
                }}>
                    {/* 左侧摇杆控制 */}
                    <div style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        width: "280px",
                        height: "280px",
                        position: "relative",
                        marginBottom: "30px",
                    }}>
                        {/* 轮盘摇杆 */}
                        <div 
                            className="joystick-container"
                            style={{
                                width: "240px",
                                height: "240px",
                                borderRadius: "50%",
                                background: "rgba(30, 41, 59, 0.2)",
                                border: "2px solid #94a3b8",
                                position: "relative",
                                touchAction: "none",
                                cursor: "grab",
                            }}
                            onMouseDown={handleJoystickStart}
                            onTouchStart={handleJoystickStart}
                            onMouseMove={handleJoystickMove}
                            onTouchMove={handleJoystickMove}
                            onMouseUp={handleJoystickEnd}
                            onMouseLeave={handleJoystickEnd}
                            onTouchEnd={handleJoystickEnd}
                        >
                            {/* 摇杆中心 */}
                            <div style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                width: "80px",
                                height: "80px",
                                borderRadius: "50%",
                                background: "rgba(59, 130, 246, 0.8)",
                                border: "2px solid #3b82f6",
                                transform: `translate(calc(-50% + ${joystickPosition.x}px), calc(-50% + ${joystickPosition.y}px))`,
                                cursor: "grab",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                                transition: "transform 0.1s ease",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                color: "white",
                                fontWeight: "bold",
                                fontSize: "24px",
                            }}>
                                ↑
                            </div>
                        </div>
                    </div>

                    {/* 中间摄像头画面 */}
                    <div style={{
                        flex: 1,
                        maxWidth: "700px",
                        height: "90%",
                        position: "relative",
                    }}>
                        <div style={{
                            position: "relative",
                            border: cameraEnabled ? "2px solid #3b82f6" : "2px solid #6b7280",
                            borderRadius: "8px",
                            overflow: "hidden",
                            background: "#000",
                            width: "100%",
                            height: "100%",
                        }}>
                            {cameraEnabled ? (
                                <>
                                    <img
                                        src="/api/video_feed"
                                        alt="摄像头画面"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            display: "block",
                                        }}
                                    />
                                    <div style={{
                                        position: "absolute",
                                        top: "5px",
                                        left: "5px",
                                        background: "rgba(0,0,0,0.7)",
                                        color: "#fff",
                                        padding: "2px 8px",
                                        borderRadius: "4px",
                                        fontSize: "12px",
                                    }}>
                                        实时画面
                                    </div>
                                </>
                            ) : (
                                <div style={{
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    width: "100%",
                                    height: "100%",
                                    fontSize: "48px",
                                    color: "#6b7280",
                                }}>
                                    ↑
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 右侧技能按钮（圆弧排列） */}
                    <div style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        width: "400px",
                        height: "400px",
                        position: "relative",
                        marginBottom: "30px",
                    }}>
                        {/* 技能按钮圆弧排列（-180度到90度） */}
                        <ControlButton
                            size="small"
                            variant="danger"
                            onPressStart={() => handlePressStart("stop")}
                            onPressEnd={() => handlePressEnd()}
                            style={{
                                position: "absolute",
                                bottom: "20px",
                                left: "50%",
                                transform: "translateX(-50%)",
                            }}
                        >
                            ■
                        </ControlButton>
                        <ControlButton
                            size="small"
                            variant="success"
                            onClick={() => send("grab")}
                            style={{
                                position: "absolute",
                                right: "120px",
                                bottom: "100px",
                            }}
                        >
                            抓取
                        </ControlButton>
                        <ControlButton
                            size="small"
                            variant="secondary"
                            onClick={() => send("release")}
                            style={{
                                position: "absolute",
                                right: "50px",
                                top: "50%",
                                transform: "translateY(-50%)",
                            }}
                        >
                            释放
                        </ControlButton>
                        <ControlButton
                            size="small"
                            variant={cameraEnabled ? "danger" : "primary"}
                            onClick={toggleCamera}
                            style={{
                                position: "absolute",
                                right: "120px",
                                top: "100px",
                            }}
                        >
                            {cameraEnabled ? "关摄" : "开摄"}
                        </ControlButton>
                    </div>
                </div>
            ) : (
                /* 竖屏模式布局 */
                <>
                    {/* 视频流显示 */}
                    <div style={{
                        marginTop: "20px",
                        display: "flex",
                        justifyContent: "center",
                    }}>
                        <div style={{
                            position: "relative",
                            border: cameraEnabled ? "2px solid #3b82f6" : "2px solid #6b7280",
                            borderRadius: "8px",
                            overflow: "hidden",
                            background: "#000",
                            width: cameraEnabled ? "640px" : "320px",
                            height: cameraEnabled ? "480px" : "240px",
                        }}>
                            {cameraEnabled ? (
                                <>
                                    <img
                                        src="/api/video_feed"
                                        alt="摄像头画面"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            display: "block",
                                        }}
                                    />
                                    <div style={{
                                        position: "absolute",
                                        top: "5px",
                                        left: "5px",
                                        background: "rgba(0,0,0,0.7)",
                                        color: "#fff",
                                        padding: "2px 8px",
                                        borderRadius: "4px",
                                        fontSize: "12px",
                                    }}>
                                        实时画面
                                    </div>
                                </>
                            ) : (
                                <div style={{
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    width: "100%",
                                    height: "100%",
                                    fontSize: "48px",
                                    color: "#6b7280",
                                }}>
                                    ↑
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 方向区 */}
                    <div
                        style={{
                            display: "flex",
                            gap: "10px",
                            justifyItems: "center",
                            flexDirection: "column",
                            alignItems: "center",
                            marginTop: "20px"
                        }}
                    >
                        <div style={{display: 'flex', gap: "10px", position: "relative"}}>
                            <ControlButton
                                size="small"
                                onPressStart={() => handlePressStart("up")}
                                onPressEnd={() => handlePressEnd()}
                            >
                                ↑
                            </ControlButton>
                            <ControlButton
                                size="small"
                                variant="danger"
                                onPressStart={() => handlePressStart("stop")}
                                onPressEnd={() => handlePressEnd()}
                                style={{
                                    position: "absolute",
                                    top: "-5px",
                                    right: "-85px",
                                }}
                            >
                                ■
                            </ControlButton>
                        </div>
                        <div style={{display: 'flex', gap: "10px"}}>
                            <ControlButton
                                size="small"
                                onPressStart={() => handlePressStart("left")}
                                onPressEnd={() => handlePressEnd()}
                            >
                                ←
                            </ControlButton>
                            <ControlButton
                                size="small"
                                onPressStart={() => handlePressStart("down")}
                                onPressEnd={() => handlePressEnd()}
                            >
                                ↓
                            </ControlButton>
                            <ControlButton
                                size="small"
                                onPressStart={() => handlePressStart("right")}
                                onPressEnd={() => handlePressEnd()}
                            >
                                →
                            </ControlButton>
                        </div>
                    </div>

                    {/* 功能按钮 */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: "20px",
                            flexWrap: "wrap",
                            marginTop: "20px",
                        }}
                    >
                        <ControlButton
                            variant="success"
                            size="wide"
                            onClick={() => send("grab")}
                        >
                            抓取
                        </ControlButton>

                        <ControlButton
                            variant="secondary"
                            size="wide"
                            onClick={() => send("release")}
                        >
                            释放
                        </ControlButton>

                        <ControlButton
                            variant={cameraEnabled ? "danger" : "primary"}
                            size="wide"
                            onClick={toggleCamera}
                        >
                            {cameraEnabled ? "关闭摄像头" : "开启摄像头"}
                        </ControlButton>
                    </div>
                </>
            )}

            <div style={{marginTop: "20px", opacity: 0.5, fontSize: "13px"}}>
                {status}
            </div>
            
            
        </div>
    );
}

export default BaseControlPage;