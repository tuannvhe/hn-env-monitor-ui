// App.tsx
import { useState, useEffect, useRef } from "react";
import {
  ConfigProvider,
  Spin,
  message,
  Modal,
  Descriptions,
  Avatar,
} from "antd";
import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import viVN from "antd/locale/vi_VN";
import ExcelInfiniteGrid from "./assets/views/MonthlyGrid/index";
import LoginPage from "./assets/views/MonthlyGrid/LoginPage";
import { authService, LOGOUT_EVENT } from "./assets/services/auth.service";
import type { UserInfo } from "./assets/interfaces/auth.interface";

message.config({
  top: 16,
  maxCount: 3,
  duration: 3,
  getContainer: () => document.body,
});

import ChartDashboard from "./assets/views/MonthlyGrid/ChartDashboard";

const AppWrapper = ({
  user,
  onLogout,
}: {
  user: UserInfo | null;
  onLogout: () => void;
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"grid" | "chart">("grid");

  // Lắng nghe sự kiện logout từ interceptor
  useEffect(() => {
    const handleLogoutEvent = () => {
      message.warning("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!");
      setTimeout(() => {
        onLogout();
      }, 500);
    };

    window.addEventListener(LOGOUT_EVENT as any, handleLogoutEvent);
    return () => {
      window.removeEventListener(LOGOUT_EVENT as any, handleLogoutEvent);
    };
  }, [onLogout]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* HEADER */}
      <header
        style={{
          padding: "0 24px",
          height: 64,
          background: "linear-gradient(135deg, #1a472a 0%, #0d2818 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: 12,
          margin: "12px 12px 0 12px",
          flexShrink: 0,
        }}
      >
        {/* Brand bên trái */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background:
                "linear-gradient(135deg, rgba(76,175,80,0.3), rgba(46,125,50,0.5))",
              border: "1px solid rgba(76,175,80,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <img
              src="/logo1.png"
              alt="logo"
              style={{
                width: 28,
                height: 28,
                objectFit: "contain",
                filter: "brightness(0) invert(1)",
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
                if (e.currentTarget.parentElement) {
                  e.currentTarget.parentElement.innerHTML = "🌡️";
                }
              }}
            />
          </div>

          <span
            style={{
              width: 1,
              height: 32,
              background: "rgba(255,255,255,0.2)",
              display: "inline-block",
              flexShrink: 0,
            }}
          />

          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "white" }}>
              Hệ thống giám sát nhiệt độ / độ ẩm
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
              Temperature & Humidity Monitoring System
            </div>
          </div>
        </div>

        {/* Phần giữa - Developed by */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.08)",
            padding: "6px 16px",
            borderRadius: 40,
            backdropFilter: "blur(4px)",
          }}
        >
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
            ⚙
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
            Developed by{" "}
            <strong style={{ color: "#ffd600", fontWeight: 600 }}>
              Viet Nam EA Team
            </strong>
          </span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
            ⚙
          </span>
        </div>

        {/* User pill + dropdown bên phải */}
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <div
            onClick={() => setDropdownOpen((o) => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "rgba(255,255,255,0.1)",
              padding: "6px 16px",
              borderRadius: 40,
              cursor: "pointer",
              border: dropdownOpen
                ? "1px solid rgba(255,255,255,0.3)"
                : "1px solid transparent",
              transition: "border 0.2s",
              userSelect: "none",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                background: "linear-gradient(135deg, #4caf50, #2e7d32)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{ fontSize: 16, fontWeight: "bold", color: "white" }}
              >
                {(
                  user?.fullName?.charAt(0) ||
                  user?.username?.charAt(0) ||
                  "U"
                ).toUpperCase()}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "white" }}>
                {user?.fullName || "Operator"}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                {user?.position || "—"} - ({user?.username || "Nhân viên"})
              </div>
            </div>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="2"
              style={{
                transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                background: "#fff",
                borderRadius: 10,
                minWidth: 200,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                border: "1px solid #e8e8e8",
                overflow: "hidden",
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  background: "#f8fffe",
                  borderBottom: "1px solid #e8f5e9",
                }}
              >
                <div
                  style={{ fontWeight: 600, fontSize: 13, color: "#1b5e20" }}
                >
                  {user?.fullName || user?.username}
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  {user?.position}
                </div>
              </div>

              <div
                onClick={() => {
                  setProfileModalVisible(true);
                  setDropdownOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 16px",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#333",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#f5f5f5")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <UserOutlined style={{ color: "#1565c0" }} />
                Thông tin cá nhân
              </div>

              <div
                style={{ height: 1, background: "#f0f0f0", margin: "0 12px" }}
              />

              <div
                onClick={() => {
                  setLogoutModalVisible(true);
                  setDropdownOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 16px",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#c0392b",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#fff5f5")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <LogoutOutlined />
                Đăng xuất
              </div>
            </div>
          )}
        </div>
      </header>

      {/* TAB BAR */}
      <div
        style={{
          display: "flex",
          gap: 0,
          margin: "8px 12px 0",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        {[
          { key: "grid", label: "📋 Bảng nhập liệu" },
          { key: "chart", label: "📊 Biểu đồ" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key as "grid" | "chart")}
            style={{
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: view === tab.key ? 600 : 400,
              color: view === tab.key ? "#1a472a" : "#666",
              background: "transparent",
              border: "none",
              borderBottom:
                view === tab.key
                  ? "2px solid #1a472a"
                  : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, minHeight: 0, padding: "0 12px" }}>
        {view === "grid" ? <ExcelInfiniteGrid /> : <ChartDashboard />}
      </div>

      {/* FOOTER */}
      <footer
        style={{
          marginTop: "auto",
          padding: "12px 24px",
          textAlign: "center",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          background: "linear-gradient(90deg, #f8fafc, #f1f5f9)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            fontSize: 11,
            color: "#64748b",
            flexWrap: "wrap",
          }}
        >
          <span>© 2026</span>
          <span>|</span>
          <span>📧 support@hn-env-monitor.com</span>
        </div>
      </footer>

      {/* Modal xác nhận đăng xuất */}
      <Modal
        title={<span style={{ color: "#c0392b" }}>⚠️ Xác nhận đăng xuất</span>}
        open={logoutModalVisible}
        onOk={() => {
          setLogoutModalVisible(false);
          onLogout();
        }}
        onCancel={() => setLogoutModalVisible(false)}
        okText="Đăng xuất"
        cancelText="Hủy bỏ"
        okButtonProps={{ danger: true }}
        width={360}
        closable={false}
      >
        <p style={{ marginTop: 8 }}>
          Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?
        </p>
      </Modal>

      {/* Modal thông tin cá nhân */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <UserOutlined style={{ color: "#1565c0" }} />
            Thông tin cá nhân
          </div>
        }
        open={profileModalVisible}
        onCancel={() => setProfileModalVisible(false)}
        closable={false}
        footer={null}
        width={420}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "16px 0 8px",
          }}
        >
          <Avatar
            size={72}
            style={{
              background: "linear-gradient(135deg, #4caf50, #2e7d32)",
              fontSize: 28,
              marginBottom: 16,
            }}
          >
            {(
              user?.fullName?.charAt(0) ||
              user?.username?.charAt(0) ||
              "U"
            ).toUpperCase()}
          </Avatar>
          <Descriptions
            column={1}
            bordered
            size="small"
            style={{ width: "100%" }}
          >
            <Descriptions.Item label="Họ và tên">
              {user?.fullName || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Tên đăng nhập">
              {user?.username || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Vai trò">
              {user?.position || "Nhân viên"}
            </Descriptions.Item>
            <Descriptions.Item label="Cơ sở">VVT_F3</Descriptions.Item>
            <Descriptions.Item label="Email">
              {(user as any)?.email || "—"}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </Modal>
    </div>
  );
};

function App() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const logoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hàm xử lý logout
  const handleLogout = () => {
    // Clear timeout nếu có
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }

    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    //message.info("Đã đăng xuất");
  };

  // Thiết lập timeout tự động logout dựa trên thời gian hết hạn của token
  const setupAutoLogout = (token: string) => {
    // Clear timeout cũ
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }

    const expiryTime = authService.getTokenExpiryTime(token);
    if (expiryTime) {
      const currentTime = Date.now();
      const timeUntilExpiry = expiryTime - currentTime;

      if (timeUntilExpiry > 0) {
        // console.log(
        //   `Token sẽ hết hạn sau ${Math.floor(timeUntilExpiry / 60000)} phút`,
        // );
        logoutTimeoutRef.current = setTimeout(() => {
          //console.log("Token expired, auto logging out...");
          message.warning("Phiên đăng nhập đã hết hạn!");
          handleLogout();
        }, timeUntilExpiry);
      } else {
        // Token đã hết hạn
        //console.log("Token already expired");
        handleLogout();
      }
    }
  };

  // Kiểm tra token khi khởi động
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("accessToken");
      const storedUser = localStorage.getItem("user");

      if (token && storedUser) {
        // Kiểm tra token hết hạn
        if (authService.isTokenExpired(token)) {
          //console.log("Token expired on app start");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("user");
          message.warning(
            "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!",
          );
        } else {
          try {
            const userInfo = JSON.parse(storedUser);
            setUser(userInfo);
            setIsAuthenticated(true);
            // Thiết lập auto logout
            setupAutoLogout(token);
          } catch {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("user");
          }
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Lắng nghe sự kiện logout từ interceptor
  useEffect(() => {
    const handleLogoutEvent = () => {
      //.log("Logout event received from interceptor");
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
        logoutTimeoutRef.current = null;
      }
      message.warning("Phiên đăng nhập đã hết hạn!");
      handleLogout();
    };

    window.addEventListener(LOGOUT_EVENT as any, handleLogoutEvent);
    return () => {
      window.removeEventListener(LOGOUT_EVENT as any, handleLogoutEvent);
    };
  }, []);

  const handleLogin = (userInfo: UserInfo, token: string) => {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("user", JSON.stringify(userInfo));
    setUser(userInfo);
    setIsAuthenticated(true);
    // Thiết lập auto logout sau khi login
    setupAutoLogout(token);
    message.success(`Chào mừng ${userInfo.fullName || userInfo.username}!`);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <Spin size="large" tip="Đang khởi động hệ thống..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <ConfigProvider locale={viVN}>
      <AppWrapper user={user} onLogout={handleLogout} />
    </ConfigProvider>
  );
}

export default App;
