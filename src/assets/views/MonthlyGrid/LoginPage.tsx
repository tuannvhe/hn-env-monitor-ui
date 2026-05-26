// assets/views/MonthlyGrid/LoginPage.tsx
import React, { useState } from "react";
import { Form, Input, Button, Card, message, Alert } from "antd";
import { UserOutlined, LockOutlined, LoginOutlined } from "@ant-design/icons";
import { authService } from "../../services/auth.service";
import type { UserInfo } from "../../interfaces/auth.interface";
import "./login.css";

interface LoginPageProps {
  onLogin: (user: UserInfo, token: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.login(
        values.username,
        values.password,
      );

      if (response && response.token) {
        // 1. Giải mã token để lấy thông tin quyền (Claims)
        const decodedToken = authService.decodeToken(response.token);

        // 2. Map dữ liệu vào UserInfo
        const userInfo: UserInfo = {
          id: decodedToken.user?.id || 0,
          username: decodedToken.username || values.username,
          fullName: decodedToken.fullName || decodedToken.username || values.username,
          email: decodedToken.user?.email || "",
          role: decodedToken.role || "user",
          // Gán quyền từ token (chuyển đổi chuỗi "True" thành boolean)
          canCreate: decodedToken?.CanCreate === "True",
          canUpdate: decodedToken?.CanUpdate === "True",
          canDelete: decodedToken?.CanDelete === "True",
          position: decodedToken?.position || "—",
        };

        // 3. Lưu vào localStorage
        localStorage.setItem("accessToken", response.token);
        localStorage.setItem("user", JSON.stringify(userInfo));

        // 4. Cập nhật state của App
        onLogin(userInfo, response.token);
      } else {
        setError("Đăng nhập thất bại!");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      const errorMsg =
        error.response?.data?.message || "Sai tên đăng nhập hoặc mật khẩu / Không có quyền truy cập!";
      setError(errorMsg);
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-bg">
        <div className="login-overlay"></div>
      </div>
      <div className="login-particles" />
      <Card className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-icon">🌡️</span>
            <span className="logo-text">Env Monitor</span>
          </div>
          <h2>Hệ thống giám sát nhiệt độ / độ ẩm</h2>
          <p>Temperature & Humidity Monitoring System</p>
        </div>

        {error && (
          <Alert
            message="Lỗi đăng nhập"
            description={error}
            type="error"
            showIcon
            closable
            style={{ marginBottom: 20 }}
            onClose={() => setError(null)}
          />
        )}

        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: "Vui lòng nhập tên đăng nhập!" },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Tên đăng nhập"
              disabled={loading}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu!" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Mật khẩu"
              disabled={loading}
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              icon={<LoginOutlined />}
              loading={loading}
              size="large"
            >
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>

        <div className="login-footer">
          <span>Developed by Viet Nam EA Team | © 2026</span>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
