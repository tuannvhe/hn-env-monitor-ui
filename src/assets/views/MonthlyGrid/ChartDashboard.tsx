// ChartDashboard.tsx - Hiển thị đủ 4 ca S, C, T, Đ
import { useState, useEffect, useCallback, useRef } from "react";
import { Select, Spin, Button, DatePicker } from "antd";
import {
  ReloadOutlined,
  DashOutlined,
  CloudOutlined,
  RiseOutlined,
  FallOutlined,
  ClockCircleOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { envLogService } from "../../services/envLog.service";
import type {
  RollingGridResponse,
  LocationLookup,
} from "../../interfaces/envLog.interface";
import styles from "./ChartDashboard.module.css";

const { RangePicker } = DatePicker;
const { Option } = Select;

// 4 ca: Sáng, Chiều, Tối, Đêm
const SHIFTS = [
  {
    code: "morning",
    label: "Sáng",
    short: "Sáng",
    periodId: 1,
    order: 1,
    color: "#2e7d32",
  },
  {
    code: "afternoon",
    label: "Chiều",
    short: "Chiều",
    periodId: 2,
    order: 2,
    color: "#1565c0",
  },
  {
    code: "evening",
    label: "Tối",
    short: "Tối",
    periodId: 3,
    order: 3,
    color: "#e65100",
  },
  {
    code: "night",
    label: "Đêm",
    short: "Đêm",
    periodId: 4,
    order: 4,
    color: "#6a1b9a",
  },
];

export default function ChartDashboard() {
  const [locationId, setLocationId] = useState<number | null>(null);
  const [locations, setLocations] = useState<LocationLookup[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [gridData, setGridData] = useState<RollingGridResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<"temp" | "hum">("temp");
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(13, "day"),
    dayjs(),
  ]);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoadingLocations(true);
      try {
        const data = await envLogService.getLocations();
        setLocations(data);
        if (data.length > 0) setLocationId(data[0].id);
      } finally {
        setLoadingLocations(false);
      }
    };
    load();
  }, []);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const data = await envLogService.getRollingGrid(
        locationId,
        dateRange[0].format("YYYY-MM-DD"),
        dateRange[1].format("YYYY-MM-DD"),
      );
      setGridData(data);
    } finally {
      setLoading(false);
    }
  }, [locationId, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Hàm tạo dữ liệu cho chart - LUÔN HIỂN THỊ ĐỦ 4 CA
  const buildChartData = useCallback(() => {
    if (!gridData?.dailyData) {
      return {
        labels: [] as string[],
        values: [] as number[],
        allValuesForChart: [] as (number | null)[],
        violations: 0,
        shiftRates: [] as {
          name: string;
          value: number;
          rank: number;
          color: string;
        }[],
      };
    }

    const labels: string[] = [];
    const values: number[] = [];
    const allValuesForChart: (number | null)[] = [];
    const dates = Object.keys(gridData.dailyData).sort();
    const shiftStats: Record<
      string,
      { total: number; count: number; violations: number }
    > = {};

    // Khởi tạo stats cho từng ca
    SHIFTS.forEach((shift) => {
      shiftStats[shift.code] = { total: 0, count: 0, violations: 0 };
    });

    // Duyệt qua từng ngày và từng ca theo đúng thứ tự S, C, T, Đ
    for (const date of dates) {
      const dayData = gridData.dailyData[date];
      // Duyệt qua tất cả 4 ca theo thứ tự cố định
      for (const shift of SHIFTS) {
        const shiftData = dayData?.shifts?.[shift.code];
        const val =
          metric === "temp"
            ? (shiftData?.temperature ?? null)
            : (shiftData?.humidity ?? null);

        // Tạo label: "DD/MM S", "DD/MM C", "DD/MM T", "DD/MM Đ"
        const label = `${dayjs(date).format("DD/MM")} ${shift.short}`;
        labels.push(label);
        allValuesForChart.push(val);

        // Thống kê nếu có giá trị
        if (val !== null) {
          values.push(val);
          shiftStats[shift.code].total += val;
          shiftStats[shift.code].count++;
          const isViolation =
            metric === "temp" ? val < 18 || val > 25 : val >= 70;
          if (isViolation) shiftStats[shift.code].violations++;
        }
      }
    }

    // Tính violations
    const violations = values.filter((v) =>
      metric === "temp" ? v < 18 || v > 25 : v > 70,
    ).length;

    // Tính tỷ lệ đạt cho từng ca
    const shiftRates: {
      name: string;
      value: number;
      rank: number;
      color: string;
    }[] = [];
    SHIFTS.forEach((shift) => {
      const stats = shiftStats[shift.code];
      const totalChecks = stats.count;
      const passed = totalChecks - stats.violations;
      const rate =
        totalChecks > 0 ? Math.round((passed / totalChecks) * 100) : 0;
      shiftRates.push({
        name: shift.label,
        value: rate,
        rank: 0,
        color: shift.color,
      });
    });

    // Xếp hạng
    shiftRates.sort((a, b) => b.value - a.value);
    shiftRates.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    return { labels, values, allValuesForChart, violations, shiftRates };
  }, [gridData, metric]);

  // Render chart
  useEffect(() => {
    if (!chartRef.current) return;

    const { labels, allValuesForChart } = buildChartData();
    if (labels.length === 0) return;

    const isTemp = metric === "temp";
    const unit = isTemp ? "°C" : "%";
    const lineColor = isTemp ? "#378add" : "#1D9E75";
    const upperLimit = isTemp ? 25 : 70;
    const lowerLimit = isTemp ? 18 : null;

    const pointColors = allValuesForChart.map((v) => {
      if (v === null) return "transparent";
      if (isTemp && (v < 18 || v > 25)) return "#E24B4A";
      if (!isTemp && v > 70) return "#E24B4A";
      return lineColor;
    });

    const pointRadius = allValuesForChart.map((v) => {
      if (v === null) return 0;
      if (isTemp && (v < 18 || v > 25)) return 5;
      if (!isTemp && v > 70) return 5;
      return 3;
    });

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const w = window as any;
    if (!w.Chart) return;

    const datasets: any[] = [
      {
        label: isTemp ? "Nhiệt độ (°C)" : "Độ ẩm (%)",
        data: allValuesForChart,
        borderColor: lineColor,
        backgroundColor: "transparent",
        pointBackgroundColor: pointColors,
        pointRadius,
        pointHoverRadius: 6,
        borderWidth: 2.5,
        tension: 0.35,
        spanGaps: true,
      },
      {
        label: "Ngưỡng trên",
        data: labels.map(() => upperLimit),
        borderColor: "#E24B4A",
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
      },
    ];

    if (lowerLimit !== null) {
      datasets.push({
        label: "Ngưỡng dưới",
        data: labels.map(() => lowerLimit),
        borderColor: "#E24B4A",
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
      });
    }

    chartInstanceRef.current = new w.Chart(chartRef.current, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "white",
            titleColor: "#1a202c",
            bodyColor: "#4a5568",
            borderColor: "#e2e8f0",
            borderWidth: 1,
            callbacks: {
              label: (ctx: any) =>
                ctx.parsed.y !== null
                  ? `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}${unit}`
                  : "Chưa có dữ liệu",
            },
          },
        },
        scales: {
          x: {
            ticks: {
              font: { size: 10, family: "'Inter', sans-serif" },
              autoSkip: true,
              maxRotation: 45,
              color: "#94a3b8",
            },
            grid: { display: false },
          },
          y: {
            min: isTemp ? 10 : 40,
            max: isTemp ? 35 : 90,
            ticks: {
              font: { size: 10, family: "'Inter', sans-serif" },
              color: "#94a3b8",
              callback: (v: any) => v + unit,
            },
            grid: { color: "#f1f5f9", lineWidth: 1 },
          },
        },
      },
    });
  }, [buildChartData, metric]);

  const { values, violations } = buildChartData();

  const nonNull = values;
  const avg = nonNull.length
    ? Math.round((nonNull.reduce((a, b) => a + b, 0) / nonNull.length) * 10) /
      10
    : null;
  const maxVal = nonNull.length
    ? Math.round(Math.max(...nonNull) * 10) / 10
    : null;
  const minVal = nonNull.length
    ? Math.round(Math.min(...nonNull) * 10) / 10
    : null;
  const unit = metric === "temp" ? "°C" : "%";
  const isTemp = metric === "temp";
  const passRate = nonNull.length
    ? Math.round(((nonNull.length - violations) / nonNull.length) * 100)
    : 100;

  return (
    <div className={styles.container}>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js" />

      <div className={styles.dashboardLayout}>
        {/* Header */}
        <div className={styles.dashboardHeader}>
          <div className={styles.headerTitle}>
            <h1>Biểu đồ giám sát nhiệt độ / độ ẩm</h1>
            <p>Real-time temperature & humidity tracking</p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.dateBadge}>
              <ClockCircleOutlined style={{ marginRight: 6 }} />
              {dayjs().format("DD/MM/YYYY")}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiTitle}>Trung bình</span>
              <div className={styles.kpiIcon}>
                {isTemp ? <DashOutlined /> : <CloudOutlined />}
              </div>
            </div>
            <div className={styles.kpiValue}>
              {avg !== null ? avg : "—"}
              {unit}
            </div>
            <div className={styles.kpiTrend}>
              <span>Toàn bộ ca</span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiTitle}>Cao nhất</span>
              <div className={styles.kpiIcon}>
                <RiseOutlined />
              </div>
            </div>
            <div className={styles.kpiValue}>
              {maxVal !== null ? maxVal : "—"}
              {unit}
            </div>
            <div className={styles.kpiTrend}>
              <span
                className={
                  isTemp
                    ? (maxVal ?? 0) > 25
                      ? styles.trendUp
                      : ""
                    : (maxVal ?? 0) >= 70
                      ? styles.trendUp
                      : "" // ← Thêm điều kiện cho độ ẩm
                }
              >
                {
                  isTemp
                    ? (maxVal ?? 0) > 25
                      ? "⚠️ Vượt ngưỡng"
                      : "Trong ngưỡng"
                    : (maxVal ?? 0) >= 70
                      ? "⚠️ Vượt ngưỡng"
                      : "Trong ngưỡng" // ← Sửa
                }
              </span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiTitle}>Thấp nhất</span>
              <div className={styles.kpiIcon}>
                <FallOutlined />
              </div>
            </div>
            <div className={styles.kpiValue}>
              {minVal !== null ? minVal : "—"}
              {unit}
            </div>
            <div className={styles.kpiTrend}>
              <span
                className={isTemp && (minVal ?? 0) < 18 ? styles.trendDown : ""}
              >
                {isTemp && (minVal ?? 0) < 18
                  ? "⚠️ Dưới ngưỡng"
                  : "Trong ngưỡng"}
              </span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiTitle}>Tỷ lệ đạt</span>
              <div className={styles.kpiIcon}>
                <CheckOutlined />
              </div>
            </div>
            <div className={styles.kpiValue}>{passRate}%</div>
            <div className={styles.kpiTrend}>
              <span
                className={violations === 0 ? styles.trendUp : styles.trendDown}
              >
                {violations === 0 ? "✅ Xuất sắc" : `⚠️ ${violations} cảnh báo`}
              </span>
            </div>
          </div>
        </div>

        {/* Main 2-Column Layout */}
        <div className={styles.mainGrid}>
          {/* Left Column - Chart */}
          <div className={styles.chartSection}>
            <div className={styles.chartHeader}>
              <div>
                <div className={styles.chartTitle}>
                  {isTemp ? "🌡️ Biểu đồ nhiệt độ" : "💧 Biểu đồ độ ẩm"}
                </div>
                <div className={styles.legendCustom}>
                  <span className={styles.legendDot}>
                    <span
                      style={{
                        width: 20,
                        height: 2,
                        background: isTemp ? "#378add" : "#1D9E75",
                        display: "inline-block",
                        borderRadius: 2,
                      }}
                    ></span>
                    {isTemp ? "Nhiệt độ" : "Độ ẩm"}
                  </span>
                  <span className={styles.legendDot}>
                    <span
                      style={{
                        width: 20,
                        height: 0,
                        borderTop: "2px dashed #E24B4A",
                        display: "inline-block",
                      }}
                    ></span>
                    Ngưỡng cảnh báo
                  </span>
                  <span className={styles.legendDot}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        background: "#E24B4A",
                        borderRadius: "50%",
                        display: "inline-block",
                      }}
                    ></span>
                    Vượt ngưỡng
                  </span>
                </div>
              </div>
              <div className={styles.chartControls}>
                <div className={styles.toggleGroup}>
                  <button
                    className={`${styles.toggleBtn} ${metric === "temp" ? styles.active : ""}`}
                    onClick={() => setMetric("temp")}
                  >
                    <DashOutlined /> Nhiệt độ
                  </button>
                  <button
                    className={`${styles.toggleBtn} ${metric === "hum" ? styles.active : ""}`}
                    onClick={() => setMetric("hum")}
                  >
                    <CloudOutlined /> Độ ẩm
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.chartWrapper}>
              {loading ? (
                <div className={styles.loadingOverlay}>
                  <Spin size="large" />
                </div>
              ) : (
                <canvas ref={chartRef} />
              )}
            </div>

            {/* Hiển thị thông tin số lượng ca để debug */}
            {/* <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "#94a3b8",
                textAlign: "center",
              }}
            >
              📊 Hiển thị {SHIFTS.length} ca/ngày:{" "}
              {SHIFTS.map((s) => s.short).join(", ")}
            </div> */}

            {/* Controls dưới chart */}
            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 12,
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <Select
                value={locationId ?? undefined}
                size="middle"
                style={{ width: 200 }}
                onChange={setLocationId}
                loading={loadingLocations}
                placeholder="Chọn phòng"
              >
                {locations.map((loc) => (
                  <Option key={loc.id} value={loc.id}>
                    {loc.name}
                  </Option>
                ))}
              </Select>

              <RangePicker
                size="middle"
                value={dateRange}
                format="DD/MM/YYYY"
                allowClear={false}
                onChange={(dates) => {
                  if (!dates || !dates[0] || !dates[1]) return;
                  setDateRange([dates[0], dates[1]]);
                }}
                presets={[
                  {
                    label: "7 ngày qua",
                    value: [dayjs().subtract(6, "day"), dayjs()],
                  },
                  {
                    label: "14 ngày qua",
                    value: [dayjs().subtract(13, "day"), dayjs()],
                  },
                  {
                    label: "30 ngày qua",
                    value: [dayjs().subtract(29, "day"), dayjs()],
                  },
                  {
                    label: "Tháng này",
                    value: [dayjs().startOf("month"), dayjs().endOf("month")],
                  },
                ]}
                style={{ width: 280 }}
              />

              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={fetchData}
                loading={loading}
              >
                Làm mới
              </Button>
            </div>
          </div>

          {/* Right Column - Top Shifts */}
          <div className={styles.sidebar}>
            <div className={styles.statsRow}>
              <div className={styles.miniStatCard}>
                <div className={styles.miniStatLabel}>Tổng số ca</div>
                <div className={styles.miniStatValue}>{nonNull.length}</div>
                <div className={styles.miniStatUnit}>ca đo</div>
              </div>
              <div className={styles.miniStatCard}>
                <div className={styles.miniStatLabel}>Số ca cảnh báo</div>
                <div
                  className={styles.miniStatValue}
                  style={{ color: violations > 0 ? "#E24B4A" : "#1D9E75" }}
                >
                  {violations}
                </div>
                <div className={styles.miniStatUnit}>ca</div>
              </div>
            </div>

            {/* Top ca đạt chuẩn */}
            {/* <div className={styles.topListCard}>
              <div className={styles.topListHeader}>
                <span className={styles.topListTitle}>
                  <TrophyOutlined
                    style={{ marginRight: 8, color: "#fbbf24" }}
                  />
                  Top ca đạt chuẩn
                </span>
                <span className={styles.topListBadge}>Theo tỷ lệ %</span>
              </div>
              {shiftRates && shiftRates.length > 0 ? (
                shiftRates.map((shift) => (
                  <div key={shift.name} className={styles.topListItem}>
                    <div className={styles.topItemRank}>#{shift.rank}</div>
                    <div className={styles.topItemName}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: shift.color,
                          marginRight: 8,
                        }}
                      />
                      {shift.name}
                    </div>
                    <div
                      className={styles.topItemValue}
                      style={{ color: shift.color }}
                    >
                      {shift.value}%
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}
                >
                  Chưa có dữ liệu
                </div>
              )}
            </div> */}

            {/* Thông tin ngưỡng */}
            <div className={styles.infoCard}>
              <div className={styles.infoTitle}>📋 Ngưỡng cho phép</div>
              <div className={styles.infoRow}>
                <span>🌡️ Nhiệt độ:</span>
                <span>
                  <strong>18°C - 25°C</strong>
                </span>
              </div>
              <div className={styles.infoRow}>
                <span>💧 Độ ẩm:</span>
                <span>
                  <strong>≤ 70%</strong>
                </span>
              </div>
              <div className={styles.infoDivider} />
              <div className={styles.infoRow}>
                <span>✅ Màu xanh:</span>
                <span>Trong ngưỡng an toàn</span>
              </div>
              <div className={styles.infoRow}>
                <span>🔴 Màu đỏ:</span>
                <span>Vượt ngưỡng cảnh báo</span>
              </div>
            </div>
          </div>
          <div className="eg-footer">
            <div className="eg-footer-inner">
              <span className="eg-footer-bar eg-footer-bar--left" />
              <span className="eg-footer-icon">⚙</span>
              <span className="eg-footer-text">
                Developed by <strong>Viet Nam EA Team</strong>
              </span>
              <span className="eg-footer-divider">|</span>
              <span className="eg-footer-copy">© 2026</span>
              <span className="eg-footer-icon">⚙</span>
              <span className="eg-footer-bar eg-footer-bar--right" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
