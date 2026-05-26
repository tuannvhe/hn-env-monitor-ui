// ChartDashboard.tsx - Tự động điều chỉnh khoảng cách trục Y

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
    short: "S",
    periodId: 1,
    order: 1,
    color: "#2e7d32",
  },
  {
    code: "afternoon",
    label: "Chiều",
    short: "C",
    periodId: 2,
    order: 2,
    color: "#1565c0",
  },
  {
    code: "evening",
    label: "Tối",
    short: "T",
    periodId: 3,
    order: 3,
    color: "#e65100",
  },
  {
    code: "night",
    label: "Đêm",
    short: "Đ",
    periodId: 4,
    order: 4,
    color: "#6a1b9a",
  },
];

// Ngưỡng an toàn
const TEMP_MIN = 18;
const TEMP_MAX = 25;
const HUM_MAX = 70;

export default function ChartDashboard() {
  const [locationId, setLocationId] = useState<number | null>(null);
  const [locations, setLocations] = useState<LocationLookup[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [gridData, setGridData] = useState<RollingGridResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<"temp" | "hum">("temp");
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(31, "day"),
    dayjs(),
  ]);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const [_, setYAxisRange] = useState<{ min: number; max: number }>({
    min: 0,
    max: 0,
  });

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

  // Hàm tạo dữ liệu cho chart - CHỈ HIỂN THỊ CÁC CA ĐÃ KÝ DUYỆT
  const buildChartData = useCallback(() => {
    if (!gridData?.dailyData) {
      return {
        labels: [] as string[],
        values: [] as number[],
        violations: 0,
        confirmedCount: 0,
        totalCount: 0,
        minValue: 0,
        maxValue: 0,
      };
    }

    const confirmedValues: number[] = [];
    const confirmedLabels: string[] = [];
    const dates = Object.keys(gridData.dailyData).sort();

    let totalCount = 0;
    let confirmedCount = 0;
    const violationsList: number[] = [];

    // Duyệt qua từng ngày và từng ca
    for (const date of dates) {
      const dayData = gridData.dailyData[date];
      for (const shift of SHIFTS) {
        const shiftData = dayData?.shifts?.[shift.code];
        const isConfirmed = dayData?.shifts?.[shift.code]?.isConfirmed ?? false;
        const val = shiftData
          ? metric === "temp"
            ? shiftData.temperature
            : shiftData.humidity
          : null;

        totalCount++;

        if (isConfirmed && val !== null) {
          confirmedCount++;
          confirmedValues.push(val);
          confirmedLabels.push(
            `${dayjs(date).format("DD/MM")} ${shift.short} ✓`,
          );
          violationsList.push(val);
        }
      }
    }

    // Tính violations chỉ trên các ca đã ký
    const violations = violationsList.filter((v) =>
      metric === "temp" ? v < TEMP_MIN || v > TEMP_MAX : v > HUM_MAX,
    ).length;

    // Tìm min/max để tự động điều chỉnh trục Y
    const minValue =
      confirmedValues.length > 0 ? Math.min(...confirmedValues) : 0;
    const maxValue =
      confirmedValues.length > 0 ? Math.max(...confirmedValues) : 0;

    return {
      labels: confirmedLabels,
      values: confirmedValues,
      violations,
      confirmedCount,
      totalCount,
      minValue,
      maxValue,
    };
  }, [gridData, metric]);

  // Hàm tính toán khoảng cách trục Y tự động
  const calculateYAxisRange = useCallback(
    (minVal: number, maxVal: number, isTemp: boolean) => {
      if (isTemp) {
        let yMin = 10;
        let yMax = 35;

        if (minVal < yMin) {
          yMin = Math.floor(minVal - 2);
        }
        if (maxVal > yMax) {
          yMax = Math.ceil(maxVal + 2);
        }

        yMin = Math.max(0, yMin);
        yMax = Math.min(50, yMax);

        return { min: yMin, max: yMax };
      } else {
        let yMin = 40;
        let yMax = 90;

        if (minVal < yMin) {
          yMin = Math.floor(minVal - 5);
        }
        if (maxVal > yMax) {
          yMax = Math.ceil(maxVal + 5);
        }

        yMin = Math.max(0, yMin);
        yMax = Math.min(100, yMax);

        return { min: yMin, max: yMax };
      }
    },
    [],
  );

  // Render chart
  useEffect(() => {
    if (!chartRef.current) return;

    const { labels, values, minValue, maxValue } = buildChartData();
    if (labels.length === 0) return;

    const isTemp = metric === "temp";
    const unit = isTemp ? "°C" : "%";
    const lineColor = isTemp ? "#378add" : "#1D9E75";
    const upperLimit = isTemp ? TEMP_MAX : HUM_MAX;
    const lowerLimit = isTemp ? TEMP_MIN : null;

    // Tính toán khoảng cách trục Y tự động
    const yRange = calculateYAxisRange(minValue, maxValue, isTemp);
    
    // Lưu vào state để hiển thị bên ngoài
    setYAxisRange(yRange);

    const pointColors = values.map((v) => {
      if (isTemp && (v < TEMP_MIN || v > TEMP_MAX)) return "#E24B4A";
      if (!isTemp && v > HUM_MAX) return "#E24B4A";
      return lineColor;
    });

    const pointRadius = values.map((v) => {
      if (isTemp && (v < TEMP_MIN || v > TEMP_MAX)) return 5;
      if (!isTemp && v > HUM_MAX) return 5;
      return 4;
    });

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const w = window as any;
    if (!w.Chart) return;

    const datasets: any[] = [
      {
        label: isTemp ? "Nhiệt độ (°C)" : "Độ ẩm (%)",
        data: values,
        borderColor: lineColor,
        backgroundColor: "transparent",
        pointBackgroundColor: pointColors,
        pointBorderColor: "white",
        pointBorderWidth: 1.5,
        pointRadius,
        pointHoverRadius: 7,
        borderWidth: 2.5,
        tension: 0.3,
        fill: false,
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
              label: (ctx: any) => {
                const value = ctx.parsed.y;
                const isViolation = isTemp 
                  ? (value < TEMP_MIN || value > TEMP_MAX) 
                  : (value > HUM_MAX);
                const icon = isViolation ? "⚠️" : "✅";
                return `${icon} ${ctx.dataset.label}: ${value.toFixed(1)}${unit}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              font: { size: 11, family: "'Inter', sans-serif", weight: "500" },
              autoSkip: true,
              maxRotation: 45,
              minRotation: 45,
              color: "#475569",
            },
            grid: { display: false },
            title: {
              display: true,
              text: "📅 Thời gian (Ngày - Ca đã ký duyệt)",
              color: "#94a3b8",
              font: { size: 11, weight: "500" },
              padding: { top: 8 },
            },
          },
          y: {
            min: yRange.min,
            max: yRange.max,
            ticks: {
              font: { size: 11, family: "'Inter', sans-serif" },
              color: "#475569",
              callback: (v: any) => `${v}${unit}`,
              stepSize: isTemp ? 5 : 10,
            },
            grid: { color: "#e2e8f0", lineWidth: 1, drawBorder: true },
            title: {
              display: true,
              text: isTemp ? "🌡️ Nhiệt độ" : "💧 Độ ẩm",
              color: "#94a3b8",
              font: { size: 11, weight: "500" },
              padding: { bottom: 8 },
            },
          },
        },
      },
    });
  }, [buildChartData, metric, calculateYAxisRange]);



  const { values, violations,} =
    buildChartData();

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
            <p>Temperature & humidity tracking (chỉ hiển thị ca đã ký duyệt)</p>
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
              <span>Trên các ca đã ký</span>
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
                  isTemp && (maxVal ?? 0) > TEMP_MAX ? styles.trendUp : ""
                }
              >
                {isTemp
                  ? (maxVal ?? 0) > TEMP_MAX
                    ? `⚠️ Vượt ngưỡng ${TEMP_MAX}${unit}`
                    : "Trong ngưỡng"
                  : (maxVal ?? 0) > HUM_MAX
                    ? `⚠️ Vượt ngưỡng ${HUM_MAX}${unit}`
                    : "Trong ngưỡng"}
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
                className={
                  isTemp && (minVal ?? 0) < TEMP_MIN ? styles.trendDown : ""
                }
              >
                {isTemp && (minVal ?? 0) < TEMP_MIN
                  ? `⚠️ Dưới ngưỡng ${TEMP_MIN}${unit}`
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
                    />
                    {isTemp ? "Nhiệt độ" : "Độ ẩm"} (đã ký)
                  </span>
                  <span className={styles.legendDot}>
                    <span
                      style={{
                        width: 20,
                        height: 0,
                        borderTop: "2px dashed #E24B4A",
                        display: "inline-block",
                      }}
                    />
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
                    />
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

          {/* Right Column */}
          <div className={styles.sidebar}>
            <div className={styles.statsRow}>
              <div className={styles.miniStatCard}>
                <div className={styles.miniStatLabel}>Tổng số buổi đã ký</div>
                <div className={styles.miniStatValue}>{nonNull.length}</div>
                <div className={styles.miniStatUnit}>ca</div>
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

            {/* Thông tin ngưỡng */}
            <div className={styles.infoCard}>
              <div className={styles.infoTitle}>📋 Ngưỡng cho phép</div>
              <div className={styles.infoRow}>
                <span>🌡️ Nhiệt độ:</span>
                <span>
                  <strong>
                    {TEMP_MIN}°C - {TEMP_MAX}°C
                  </strong>
                </span>
              </div>
              <div className={styles.infoRow}>
                <span>💧 Độ ẩm:</span>
                <span>
                  <strong>≤ {HUM_MAX}%</strong>
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
              <div className={styles.infoDivider} />
              <div className={styles.infoRow}>
                <span>✓ Đã ký duyệt:</span>
                <span>Hiển thị trên biểu đồ</span>
              </div>
              <div className={styles.infoRow}>
                <span>○ Chưa ký:</span>
                <span>Không hiển thị</span>
              </div>
            </div>
          </div>
        </div>

        
      </div>
      {/* Footer */}
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
  );
}

