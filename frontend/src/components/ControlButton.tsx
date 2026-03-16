import {useState} from "react";

type ButtonProps = {
    children: React.ReactNode;
    onPressStart?: () => void;
    onPressEnd?: () => void;
    onClick?: () => void;
    variant?: "primary" | "danger" | "success" | "secondary";
    size?: "square" | "wide" | "small";
    style?: React.CSSProperties;
};

const colorMap = {
    primary: "#2563eb",
    danger: "#ef4444",
    success: "#22c55e",
    secondary: "#1e293b",
};

const pressedColorMap = {
    primary: "#1d4ed8",
    danger: "#dc2626",
    success: "#16a34a",
    secondary: "#0f172a",
};

const ControlButton = ({
                           children,
                           variant = "primary",
                           size = "square",
                           onPressStart,
                           onPressEnd,
                           onClick,
                           style,
                       }: ButtonProps) => {
    const [isPressed, setIsPressed] = useState(false);
    const baseSize =
        size === "square"
            ? {width: "22vw", height: "22vw", maxWidth: "110px", maxHeight: "110px"}
            : size === "small"
            ? {width: "15vw", height: "15vw", maxWidth: "75px", maxHeight: "75px"}
            : {width: "40vw", height: "60px", maxWidth: "200px"};

    const handlePressStart = () => {
        setIsPressed(true);
        onPressStart?.();
    };

    const handlePressEnd = () => {
        setIsPressed(false);
        onPressEnd?.();
    };

    return (
        <button
            onPointerDown={handlePressStart}
            onPointerUp={handlePressEnd}
            onPointerLeave={handlePressEnd}
            onClick={(e) => {
                e.preventDefault(); // 防止默认行为（如表单提交）
                onClick?.();
            }}
            style={{
                ...baseSize,
                borderRadius: "50%",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                background: isPressed ? pressedColorMap[variant] : colorMap[variant],
                color: "white",
                fontWeight: "bold",
                fontSize: "20px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                transition: "all 0.2s ease",
                boxShadow: isPressed
                    ? "0 4px 12px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.2)"   // 按下时阴影变浅/变小
                    : "0 8px 20px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.3)",
                transform: isPressed ? "scale(0.95) translateY(2px)" : "scale(1) translateY(0)",
                touchAction: "none",
                cursor: "pointer",
                ...style,
            }}
        >
            {children}
        </button>
    )
}

export default ControlButton