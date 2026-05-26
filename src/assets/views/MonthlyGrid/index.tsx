import React, { useState, useEffect, useRef, useCallback } from "react";
import { Select, InputNumber, message, Spin, Button, Modal, Input } from "antd";
import {
  LoadingOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import "./monthlyGrid.css";
import dayjs from "dayjs";
import localeData from "dayjs/plugin/localeData";
import weekday from "dayjs/plugin/weekday";
import { usePermissions } from "../../hooks/usePermissions";

dayjs.extend(localeData);
dayjs.extend(weekday);

import { envLogService } from "../../services/envLog.service";
import type {
  RollingGridResponse,
  AbnormalReport,
  LocationLookup,
} from "../../interfaces/envLog.interface";
import { DatePicker } from "antd";

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;

const SHIFTS = [
  {
    code: "morning",
    periodId: 1,
    label: "BUỔI SÁNG",
    labelVi: "Buổi sáng",
    color: "#e8f5e9",
    accent: "#2e7d32",
  },
  {
    code: "afternoon",
    periodId: 2,
    label: "BUỔI CHIỀU",
    labelVi: "Buổi chiều",
    color: "#e3f2fd",
    accent: "#1565c0",
  },
  {
    code: "evening",
    periodId: 3,
    label: "BUỔI TỐI",
    labelVi: "Buổi tối",
    color: "#fff3e0",
    accent: "#e65100",
  },
  {
    code: "night",
    periodId: 4,
    label: "BUỔI ĐÊM",
    labelVi: "Buổi đêm",
    color: "#f3e5f5",
    accent: "#6a1b9a",
  },
];

const INITIAL_DAYS = 60;
const LOAD_MORE_DAYS = 30;
const SCROLL_THRESHOLD = 200;

const SHIFT_TIME_LIMITS: Record<
  string,
  { startHour: number; endHour: number }
> = {
  morning: { startHour: 8, endHour: 13 },
  afternoon: { startHour: 13, endHour: 18 },
  evening: { startHour: 18, endHour: 24 },
  night: { startHour: 0, endHour: 8 },
};

export default function ExcelInfiniteGrid() {
  const [locationId, setLocationId] = useState<number>(1);
  const [gridData, setGridData] = useState<RollingGridResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoadingLeft, setIsLoadingLeft] = useState(false);
  const [isLoadingRight, setIsLoadingRight] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [locationsReady, setLocationsReady] = useState(false);
  // const [abnormalRecords, setAbnormalRecords] = useState<AbnormalRecord[]>([]);
  const [showAbnormalModal, setShowAbnormalModal] = useState(false);
  const [newAbnormal, setNewAbnormal] = useState({
    date: "",
    shiftCode: "morning",
    issue: "",
    action: "",
  });
  const [dateList, setDateList] = useState<string[]>([]);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedConfirmKey, setSelectedConfirmKey] = useState<{
    date: string;
    shiftCode: string;
    shiftPeriodId: number;
  } | null>(null);
  const [_, setConfirmNote] = useState("");
  const [userName, setUserName] = useState("Quản lý");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const lastScrollLeftRef = useRef(0);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, "day"),
    dayjs().add(30, "day"),
  ]);
  const dateListRef = useRef<string[]>([]);
  const [locations, setLocations] = useState<LocationLookup[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [deviceCode, setDeviceCode] = useState<string>("");
  const [updatingDeviceCode, setUpdatingDeviceCode] = useState(false);
  const [loadingDirection, setLoadingDirection] = useState<
    "left" | "right" | null
  >(null);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [selectedResolveId, setSelectedResolveId] = useState<number | null>(
    null,
  );
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const handleApiError = (error: unknown, defaultMsg: string) => {
    const status = (error as { response?: { status?: number } })?.response
      ?.status;
    if (status === 403) {
      message.error("🚫 Bạn không có quyền thực hiện thao tác này!");
    } else {
      message.error(defaultMsg);
    }
  };
  const [resolutionNote, setResolutionNote] = useState("");
  // Thêm hàm xử lý cập nhật device code
  const handleUpdateDeviceCode = useCallback(async () => {
    if (!locationId) return;
    setUpdatingDeviceCode(true);
    try {
      await envLogService.updateDeviceCode(locationId, deviceCode);
      message.success("Đã cập nhật mã máy đo!");

      // Cập nhật lại danh sách locations
      const data = await envLogService.getLocations();
      setLocations(data);

      // Tìm location hiện tại để cập nhật deviceCode state
      const currentLocation = data.find((loc) => loc.id === locationId);
      if (currentLocation) {
        setDeviceCode(currentLocation.deviceCode || "");
      }
    } catch (error) {
      handleApiError(error, "Không thể cập nhật mã máy đo!");
    } finally {
      setUpdatingDeviceCode(false);
    }
  }, [locationId, deviceCode]);

  // Khi đổi location, cập nhật deviceCode từ locations
  useEffect(() => {
    const currentLocation = locations.find((loc) => loc.id === locationId);
    if (currentLocation) {
      setDeviceCode(currentLocation.deviceCode || "");
    }
  }, [locationId, locations]);
  useEffect(() => {
    const loadLocations = async () => {
      setLoadingLocations(true);
      try {
        const data = await envLogService.getLocations();
        setLocations(data);
        if (data.length > 0) {
          setLocationId(data[0].id); // set locationId đúng
        }
      } catch (error) {
        message.error("Không thể tải danh sách phòng kiểm tra!");
      } finally {
        setLoadingLocations(false);
        setLocationsReady(true); // đánh dấu đã sẵn sàng
      }
    };
    loadLocations();
  }, []); // chỉ chạy 1 lần

  useEffect(() => {
    dateListRef.current = dateList;
  }, [dateList]);
  const gridDataRef = useRef<RollingGridResponse | null>(null);
  useEffect(() => {
    gridDataRef.current = gridData;
  }, [gridData]);
  const fetchAndSet = useCallback(
    async (startDate: string, endDate: string) => {
      isLoadingRef.current = false;
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      try {
        const [data, reports] = await Promise.all([
          envLogService.getRollingGrid(locationId, startDate, endDate),
          envLogService.getAbnormalReports(locationId, startDate, endDate), // ← thêm
        ]);
        if (data && data.dailyData) {
          setGridData(data);
          const dates = Object.keys(data.dailyData).sort();
          setDateList(dates);
          dateListRef.current = dates;
          gridDataRef.current = data;
        }
        setAbnormalReports(reports); // ← thêm
      } catch {
        message.error("Lỗi kết nối API!");
      } finally {
        isLoadingRef.current = false;
      }
    },
    [locationId],
  );
  // Lấy tên user
  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      try {
        const userObj = JSON.parse(user);
        setUserName(userObj.fullName || userObj.username || "Quản lý");
      } catch {
        setUserName("Quản lý");
      }
    }
  }, []);

  // Kiểm tra ca đã được ký duyệt chưa
  const isShiftConfirmed = (date: string, shiftCode: string): boolean => {
    return (
      gridData?.dailyData?.[date]?.shifts?.[shiftCode]?.isConfirmed || false
    );
  };

  // Lấy tên người ký duyệt cho ca
  const getShiftConfirmedBy = (
    date: string,
    shiftCode: string,
  ): string | null => {
    return (
      gridData?.dailyData?.[date]?.shifts?.[shiftCode]?.confirmedBy || null
    );
  };

  const isEditable = (date: string, shiftCode: string): boolean => {
    if (isShiftConfirmed(date, shiftCode)) return false;

    const now = dayjs();
    const cellDate = dayjs(date);

    // Ngày trong tương lai → không cho edit
    if (cellDate.isAfter(now, "day")) return false;

    if (cellDate.isSame(now, "day")) {
      const currentHour = now.hour();
      const shiftLimit = SHIFT_TIME_LIMITS[shiftCode];

      if (shiftCode === "night") {
        // Ca đêm (0h-8h) của ngày X thực ra được nhập vào sáng sớm ngày X
        // Nếu đang là ban ngày (>= 8h) thì ca đêm hôm nay chưa bắt đầu
        // → chỉ cho edit ca đêm hôm nay nếu currentHour < 8 (tức đang trong ca đêm)
        if (currentHour >= shiftLimit.endHour) return false; // >= 8h → ca đêm chưa đến (của ngày mai)
      } else {
        // Các ca khác: chưa đến giờ bắt đầu thì không cho edit
        if (currentHour < shiftLimit.startHour) return false;
      }
    }

    return true;
  };

  const isTemperatureSafe = (temp: number | null): boolean => {
    if (temp === null) return true;
    return temp >= 18 && temp <= 25;
  };

  const isHumiditySafe = (humidity: number | null): boolean => {
    if (humidity === null) return true;
    return humidity <= 70;
  };

  const getCellClass = (
    date: string,
    shiftCode: string,
    value: number | null,
    isTemp: boolean,
  ): string => {
    let classes = "eg-cell";

    // Đã confirmed: giữ màu safe/warning bình thường, KHÔNG thêm eg-cell-disabled
    if (isShiftConfirmed(date, shiftCode)) {
      classes += " eg-cell-confirmed-data"; // ← thêm dòng này
      if (value !== null) {
        if (isTemp) {
          classes += isTemperatureSafe(value)
            ? " eg-cell-safe"
            : " eg-cell-warning";
        } else {
          classes += isHumiditySafe(value)
            ? " eg-cell-safe"
            : " eg-cell-warning";
        }
      }
      return classes;
    }

    // Chưa confirmed nhưng không editable (tương lai/chưa đến giờ): xám
    if (!isEditable(date, shiftCode)) {
      classes += " eg-cell-disabled";
      return classes;
    }

    // Editable bình thường
    if (value !== null) {
      if (isTemp) {
        classes += isTemperatureSafe(value)
          ? " eg-cell-safe"
          : " eg-cell-warning";
      } else {
        classes += isHumiditySafe(value) ? " eg-cell-safe" : " eg-cell-warning";
      }
    }
    return classes;
  };

  const scrollToToday = useCallback(() => {
    if (!scrollContainerRef.current || dateList.length === 0) return;
    const todayStr = dayjs().format("YYYY-MM-DD");
    const todayIndex = dateList.findIndex((d) => d === todayStr);
    if (todayIndex !== -1) {
      isProgrammaticScrollRef.current = true;
      const cellWidth = 70;
      const containerWidth = scrollContainerRef.current.clientWidth;
      const scrollPosition = Math.max(
        0,
        todayIndex * cellWidth - containerWidth / 2,
      );
      scrollContainerRef.current.scrollTo({
        left: scrollPosition,
        behavior: "smooth",
      });
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        setHasScrolledToToday(true);
      }, 500);
    }
  }, [dateList]);

  // Thay thế state
  const [abnormalReports, setAbnormalReports] = useState<AbnormalReport[]>([]);
  // Gọi trong loadDataForRange
  // Sửa lại loadDataForRange
  const loadDataForRange = useCallback(
    async (startDate: string, endDate: string, isLoadMore: boolean = false) => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      try {
        const [data, reports] = await Promise.all([
          envLogService.getRollingGrid(locationId, startDate, endDate),
          envLogService.getAbnormalReports(locationId, startDate, endDate),
        ]);

        if (data && data.dailyData) {
          if (isLoadMore) {
            setGridData((prev) => {
              const mergedDailyData = {
                ...(prev?.dailyData ?? {}),
                ...data.dailyData,
              };
              const allDates = Object.keys(mergedDailyData).sort();
              setDateList(allDates);
              dateListRef.current = allDates;
              return { ...data, dailyData: mergedDailyData };
            });
            // isLoadMore = true: KHÔNG set abnormal ở đây
            // loadMoreLeft/Right sẽ tự query lại toàn range sau khi merge xong
          } else {
            setGridData(data);
            const dates = Object.keys(data.dailyData).sort();
            setDateList(dates);
            dateListRef.current = dates;
            setAbnormalReports(reports); // ← chỉ set khi fresh load
          }
        }
        // ❌ XÓA dòng setAbnormalReports(reports) ở đây — đây là bug gốc
      } catch (error) {
        console.error("API Error:", error);
        message.error("Lỗi kết nối API!");
      } finally {
        isLoadingRef.current = false;
      }
    },
    [locationId],
  );
  // Thêm hàm resolve (xử lý báo cáo)
  const handleResolveReport = (id: number) => {
    setSelectedResolveId(id);
    setResolutionNote("");
    setResolveModalVisible(true);
  };
  const handleConfirmResolve = async () => {
    if (!selectedResolveId) return;
    setIsSaving(true);
    try {
      await envLogService.resolveAbnormalReport(
        selectedResolveId,
        userName, // resolvedBy từ token
        resolutionNote, // resolutionNote người dùng nhập
      );
      const currentDateList = dateListRef.current;
      if (currentDateList.length > 0) {
        const reports = await envLogService.getAbnormalReports(
          locationId,
          currentDateList[0],
          currentDateList[currentDateList.length - 1],
        );
        setAbnormalReports(reports);
      }
      message.success("Đã cập nhật trạng thái xử lý!");
      setResolveModalVisible(false);
      setSelectedResolveId(null);
      setResolutionNote("");
    } catch (error) {
      handleApiError(error, "Cập nhật thất bại!");
    } finally {
      setIsSaving(false);
    }
  };
  useEffect(() => {
    if (!locationsReady) return; // chờ locations load xong mới init

    const init = async () => {
      setLoading(true);
      setHasScrolledToToday(false);
      const today = dayjs().startOf("day");
      const startDate = today
        .subtract(INITIAL_DAYS / 2, "day")
        .format("YYYY-MM-DD");
      const endDate = today.add(INITIAL_DAYS / 2, "day").format("YYYY-MM-DD");
      await loadDataForRange(startDate, endDate, false);
      setLoading(false);
    };
    init();
  }, [locationId, locationsReady]);

  useEffect(() => {
    if (!loading && dateList.length > 0 && !hasScrolledToToday) {
      setTimeout(() => scrollToToday(), 300);
    }
  }, [loading, dateList, hasScrolledToToday, scrollToToday]);

  // Thay loadMoreLeft
  // ===== 2. FIX slide trái bị nhảy =====
  // Thêm ref để lưu scrollWidth TRƯỚC khi fetch, đọc SAU khi DOM update

  const loadMoreLeft = useCallback(async () => {
    if (isLoadingLeft || isLoadingRef.current || dateList.length === 0) return;
    setIsLoadingLeft(true);
    setLoadingDirection("left");
    isProgrammaticScrollRef.current = true;

    const leftBoundary = dayjs(dateList[0]);
    const newStartDate = leftBoundary
      .subtract(LOAD_MORE_DAYS, "day")
      .format("YYYY-MM-DD");
    const newEndDate = leftBoundary.subtract(1, "day").format("YYYY-MM-DD");

    // Đo TRƯỚC khi fetch
    const scrollLeftBefore = scrollContainerRef.current?.scrollLeft ?? 0;
    const scrollWidthBefore = scrollContainerRef.current?.scrollWidth ?? 0;

    await loadDataForRange(newStartDate, newEndDate, true);

    // Reload abnormal
    const fullList = dateListRef.current;
    if (fullList.length > 0) {
      const reports = await envLogService.getAbnormalReports(
        locationId,
        fullList[0],
        fullList[fullList.length - 1],
      );
      setAbnormalReports(reports);
    }

    // double-rAF: đợi React flush + browser layout xong
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          const scrollWidthAfter = scrollContainerRef.current.scrollWidth;
          const added = scrollWidthAfter - scrollWidthBefore;
          // Bù đúng width được thêm vào bên trái → viewport không nhảy
          scrollContainerRef.current.scrollLeft = scrollLeftBefore + added;
          lastScrollLeftRef.current = scrollContainerRef.current.scrollLeft;
        }
        isProgrammaticScrollRef.current = false;
        setIsLoadingLeft(false);
        setLoadingDirection(null);
      });
    });
  }, [dateList, loadDataForRange, isLoadingLeft, locationId]);

  // Thay loadMoreRight
  const loadMoreRight = useCallback(async () => {
    if (isLoadingRight || isLoadingRef.current || dateList.length === 0) return;
    setIsLoadingRight(true);
    setLoadingDirection("right");
    isProgrammaticScrollRef.current = true;

    const rightBoundary = dayjs(dateList[dateList.length - 1]);
    const newStartDate = rightBoundary.add(1, "day").format("YYYY-MM-DD");
    const newEndDate = rightBoundary
      .add(LOAD_MORE_DAYS, "day")
      .format("YYYY-MM-DD");
    const oldScrollLeft = scrollContainerRef.current?.scrollLeft || 0;

    await loadDataForRange(newStartDate, newEndDate, true);

    // Reload abnormal toàn range
    const fullList = dateListRef.current;
    if (fullList.length > 0) {
      const reports = await envLogService.getAbnormalReports(
        locationId,
        fullList[0],
        fullList[fullList.length - 1],
      );
      setAbnormalReports(reports);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          // Scroll right: giữ nguyên position cũ là đủ, DOM tự extend về phải
          scrollContainerRef.current.scrollLeft = oldScrollLeft;
          lastScrollLeftRef.current = oldScrollLeft;
        }
        isProgrammaticScrollRef.current = false;
        setIsLoadingRight(false);
        setLoadingDirection(null);
      });
    });
  }, [dateList, loadDataForRange, isLoadingRight, locationId]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isProgrammaticScrollRef.current) return;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      if (!scrollContainerRef.current || isProgrammaticScrollRef.current)
        return;
      const container = scrollContainerRef.current;
      const scrollLeft = container.scrollLeft;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      if (
        scrollLeft < SCROLL_THRESHOLD &&
        scrollLeft < lastScrollLeftRef.current
      )
        loadMoreLeft();
      if (
        scrollLeft + clientWidth > scrollWidth - SCROLL_THRESHOLD &&
        scrollLeft > lastScrollLeftRef.current
      )
        loadMoreRight();
      lastScrollLeftRef.current = scrollLeft;
    }, 100);
  }, [loadMoreLeft, loadMoreRight]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);
  // Thêm helper này vào trong component, trước handleConfirmClick
  // Sửa reloadCurrentRange
  const reloadCurrentRange = useCallback(async () => {
    const currentDateList = dateListRef.current;
    if (currentDateList.length === 0) return;
    isLoadingRef.current = false;
    try {
      const [data, reports] = await Promise.all([
        envLogService.getRollingGrid(
          locationId,
          currentDateList[0],
          currentDateList[currentDateList.length - 1],
        ),
        envLogService.getAbnormalReports(
          locationId,
          currentDateList[0],
          currentDateList[currentDateList.length - 1],
        ),
      ]);
      if (data && data.dailyData) {
        setGridData(data);
        setDateList(Object.keys(data.dailyData).sort());
      }
      setAbnormalReports(reports);
    } catch (error) {
      console.error("Lỗi tải lại dữ liệu:", error);
      message.error("Lỗi tải lại dữ liệu!");
    }
  }, [locationId]);
  // Xử lý ký duyệt cho từng ca
  const handleConfirmClick = (
    date: string,
    shiftCode: string,
    isConfirmed: boolean,
    // shiftLabel: string  ← xóa, không cần
  ) => {
    if (!isConfirmed) {
      const temp = getCellValue(date, shiftCode, true);
      const humidity = getCellValue(date, shiftCode, false);

      if (temp === null && humidity === null) {
        message.warning(`Chưa nhập nhiệt độ và độ ẩm cho buổi này!`);
        return;
      }
      if (temp === null) {
        message.warning(`Chưa nhập nhiệt độ cho buổi này!`);
        return;
      }
      if (humidity === null) {
        message.warning(`Chưa nhập độ ẩm cho buổi này!`);
        return;
      }

      const shiftPeriodId =
        SHIFTS.find((s) => s.code === shiftCode)?.periodId ?? 0;
      setSelectedConfirmKey({ date, shiftCode, shiftPeriodId });
      setConfirmNote("");
      setConfirmModalVisible(true);
    }
  };

  const handleConfirm = async () => {
    if (!selectedConfirmKey) return;
    setIsSaving(true);
    try {
      await envLogService.confirmShiftLog(
        locationId,
        selectedConfirmKey.date,
        selectedConfirmKey.shiftCode,
        userName,
        selectedConfirmKey.shiftPeriodId, // ← chỉ truyền shiftPeriodId, bỏ shiftLabel
      );
      message.success("Ký duyệt thành công!");
      setConfirmModalVisible(false);
      setSelectedConfirmKey(null);
      setConfirmNote("");
      await reloadCurrentRange();
    } catch (error) {
      handleApiError(error, "Ký duyệt thất bại!");
    } finally {
      setIsSaving(false);
    }
  };
  const handleAutoSave = async (
    value: number | null,
    shiftCode: string,
    dataType: string,
    dateKey: string,
    oldValue: number | null,
  ) => {
    if (!isEditable(dateKey, shiftCode)) {
      message.warning("Không thể nhập liệu cho thời gian này!");
      return;
    }

    if (value === oldValue) return;
    setIsSaving(true);
    const isTemp = dataType === "Nhiệt độ (°C)";
    try {
      await envLogService.saveCellLog({
        locationId,
        date: dateKey,
        shiftCode,
        temperature: isTemp ? value : undefined,
        humidity: !isTemp ? value : undefined,
        clearTemperature: isTemp && value === null, // ← thêm
        clearHumidity: !isTemp && value === null, // ← thêm
        userAction: "OP_Vinatech_Auto",
      });
      message.success(`Đã cập nhật ngày ${dayjs(dateKey).format("DD/MM")}`);
      setGridData((prev) => {
        if (!prev) return prev;
        const newDailyData = { ...prev.dailyData };
        if (!newDailyData[dateKey])
          newDailyData[dateKey] = {
            isConfirmed: false,
            confirmedBy: null,
            note: null,
            shifts: {},
          };
        if (!newDailyData[dateKey].shifts[shiftCode])
          newDailyData[dateKey].shifts[shiftCode] = {
            temperature: null,
            humidity: null,
            recordedBy: null,
            isConfirmed: false,
            confirmedBy: null,
          };
        if (isTemp) newDailyData[dateKey].shifts[shiftCode].temperature = value;
        else newDailyData[dateKey].shifts[shiftCode].humidity = value;
        return { ...prev, dailyData: newDailyData };
      });
    } catch (error) {
      handleApiError(error, "Lưu dữ liệu thất bại!");
    } finally {
      setIsSaving(false);
    }
  };

  // Thay thế handleAddAbnormal
  const handleAddAbnormal = async () => {
    if (!newAbnormal.issue.trim() || !newAbnormal.date) {
      message.warning("Nhập đầy đủ thông tin!");
      return;
    }

    const selectedDate = dayjs(newAbnormal.date);
    const now = dayjs();

    if (selectedDate.isAfter(now, "day")) {
      message.warning("⚠️ Không thể báo cáo cho ngày trong tương lai!");
      return;
    }

    if (selectedDate.isSame(now, "day")) {
      const shiftLimit = SHIFT_TIME_LIMITS[newAbnormal.shiftCode];
      const currentHour = now.hour();
      const shiftLabel = SHIFTS.find(
        (s) => s.code === newAbnormal.shiftCode,
      )?.labelVi;

      if (newAbnormal.shiftCode === "night") {
        if (currentHour >= shiftLimit.endHour) {
          message.warning(`⚠️ ${shiftLabel} hôm nay chưa bắt đầu!`);
          return;
        }
      } else {
        if (currentHour < shiftLimit.startHour) {
          message.warning(`⚠️ ${shiftLabel} hôm nay chưa bắt đầu!`);
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      await envLogService.createAbnormalReport({
        locationId,
        reportDate: newAbnormal.date,
        shiftCode: newAbnormal.shiftCode,
        issue: newAbnormal.issue,
        action: newAbnormal.action,
        reportedBy: userName,
      });
      await reloadCurrentRange();
      setNewAbnormal({ date: "", shiftCode: "morning", issue: "", action: "" });
      setShowAbnormalModal(false);
      message.success("Đã thêm báo cáo bất thường!");
    } catch (error) {
      handleApiError(error, "Thêm thất bại!");
    } finally {
      setIsSaving(false);
    }
  };
  // Thay thế deleteAbnormal
  const deleteAbnormal = async (id: number) => {
    setIsSaving(true);
    try {
      await envLogService.deleteAbnormalReport(id);
      setAbnormalReports((prev) => prev.filter((r) => r.id !== id));
      message.success("Đã xóa báo cáo!");
    } catch (error) {
      handleApiError(error, "Xóa thất bại!");
    } finally {
      setIsSaving(false);
    }
  };

  const getCellValue = (date: string, shiftCode: string, isTemp: boolean) => {
    return (
      gridData?.dailyData?.[date]?.shifts?.[shiftCode]?.[
        isTemp ? "temperature" : "humidity"
      ] ?? null
    );
  };

  const getDisplayRange = () => {
    if (dateList.length === 0) return "";
    return `${dayjs(dateList[0]).format("DD/MM/YYYY")} - ${dayjs(dateList[dateList.length - 1]).format("DD/MM/YYYY")}`;
  };

  const getMonthLabel = () => {
    if (dateList.length === 0) return "";
    const firstMonth = dayjs(dateList[0]).format("MM/YYYY");
    const lastMonth = dayjs(dateList[dateList.length - 1]).format("MM/YYYY");
    if (firstMonth === lastMonth) return dayjs(dateList[0]).format("MMMM YYYY");
    return `${dayjs(dateList[0]).format("MMM")} - ${dayjs(dateList[dateList.length - 1]).format("MMM YYYY")}`;
  };

  const LoadingOverlay = () => (
    <div className="eg-loading-overlay">
      <Spin size="large" description="Đang xử lý..." />
    </div>
  );

  if (loading) {
    return (
      <div className="eg-loading">
        <Spin size="large" description="Đang tải dữ liệu..." />
      </div>
    );
  }

  return (
    <div className="eg-page-wrapper">
      <div className="eg-root">
        {isSaving && <LoadingOverlay />}

        <div className="eg-iso-header">
          {/* {["Phụ trách", "Xác nhận", "Xét duyệt"].map((label) => (
            <div key={label} className="eg-iso-cell eg-iso-sign">
              <span className="eg-sign-label">{label}</span>
              <Input
                placeholder="Họ tên"
                variant="borderless"
                className="eg-sign-input"
              />
            </div>
          ))} */}
          <div className="eg-iso-cell eg-iso-main-title">
            <div className="eg-form-title">KIỂM TRA NHIỆT ĐỘ / ĐỘ ẨM</div>
            <div className="eg-form-month">{getMonthLabel().toUpperCase()}</div>
          </div>
        </div>
        <div className="eg-control-bar">
          <div className="eg-control-left">
            <span className="eg-ctrl-label">Phòng kiểm tra:</span>
            <Select
              value={locationId}
              size="small"
              style={{ width: 200 }}
              onChange={setLocationId}
              loading={loadingLocations}
              placeholder="Chọn phòng kiểm tra"
            >
              {locations.map((loc) => (
                <Option key={loc.id} value={loc.id}>
                  {loc.name} {loc.code ? `(${loc.code})` : ""}
                  {loc.deviceCode && ` - [${loc.deviceCode}]`}
                </Option>
              ))}
            </Select>

            <span className="eg-ctrl-label" style={{ marginLeft: 12 }}>
              Mã máy đo:
            </span>
            <Input
              placeholder="Nhập mã máy đo..."
              size="small"
              style={{ width: 120 }}
              value={deviceCode}
              onChange={(e) => setDeviceCode(e.target.value)}
              onBlur={handleUpdateDeviceCode}
              onPressEnter={handleUpdateDeviceCode}
              disabled={updatingDeviceCode || !canUpdate}
              suffix={updatingDeviceCode ? <Spin size="small" /> : null}
            />
          </div>

          <div className="eg-month-nav">
            <RangePicker
              size="small"
              value={dateRange}
              format="DD/MM/YYYY"
              allowClear={false}
              onChange={(dates) => {
                if (!dates || !dates[0] || !dates[1]) return;
                const [start, end] = dates as [dayjs.Dayjs, dayjs.Dayjs];
                setDateRange([start, end]);
                setHasScrolledToToday(false);
                fetchAndSet(
                  start.format("YYYY-MM-DD"),
                  end.format("YYYY-MM-DD"),
                );
              }}
              presets={[
                {
                  label: "7 ngày qua",
                  value: [dayjs().subtract(6, "day"), dayjs()],
                },
                {
                  label: "30 ngày qua",
                  value: [dayjs().subtract(29, "day"), dayjs()],
                },
                {
                  label: "Tháng này",
                  value: [dayjs().startOf("month"), dayjs().endOf("month")],
                },
                {
                  label: "Tháng trước",
                  value: [
                    dayjs().subtract(1, "month").startOf("month"),
                    dayjs().subtract(1, "month").endOf("month"),
                  ],
                },
                {
                  label: "Hôm nay + 60 ngày",
                  value: [dayjs().subtract(30, "day"), dayjs().add(30, "day")],
                },
              ]}
              style={{ width: 230 }}
            />
            <Button
              size="small"
              onClick={() => {
                const start = dayjs().subtract(INITIAL_DAYS / 2, "day");
                const end = dayjs().add(INITIAL_DAYS / 2, "day");
                setDateRange([start, end]);
                setHasScrolledToToday(false);
                fetchAndSet(
                  start.format("YYYY-MM-DD"),
                  end.format("YYYY-MM-DD"),
                ).then(() => {
                  setTimeout(() => scrollToToday(), 400);
                });
              }}
            >
              Hôm nay
            </Button>
            <span className="eg-month-label">
              {loadingDirection ? (
                <span
                  style={{
                    color: "#1565c0",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <LoadingOutlined spin style={{ fontSize: 11 }} />
                  {loadingDirection === "left"
                    ? "← Đang tải..."
                    : "Đang tải... →"}
                </span>
              ) : (
                getMonthLabel()
              )}
            </span>
          </div>

          <div className="eg-range-info">📅 {getDisplayRange()}</div>
          {canCreate && (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setShowAbnormalModal(true)}
              style={{ background: "#c0392b", borderColor: "#c0392b" }}
            >
              Báo cáo bất thường
            </Button>
          )}
        </div>
        {loadingDirection === "left" && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 60,
              background:
                "linear-gradient(to right, rgba(255,255,255,0.85), transparent)",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <Spin size="small" />
          </div>
        )}
        {loadingDirection === "right" && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: 60,
              background:
                "linear-gradient(to left, rgba(255,255,255,0.85), transparent)",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <Spin size="small" />
          </div>
        )}
        <div
          ref={scrollContainerRef}
          className="eg-table-wrap"
          onScroll={handleScroll}
        >
          <table className="eg-table">
            <thead>
              <tr>
                <th className="eg-th-fixed eg-th-shift">Ca đo</th>
                <th className="eg-th-fixed eg-th-type">Chỉ số</th>
                {dateList.map((date) => {
                  const dateObj = dayjs(date);
                  return (
                    <th
                      key={date}
                      className={`eg-th-date ${dateObj.isSame(dayjs(), "day") ? "eg-is-today" : ""}`}
                    >
                      <div className="eg-date-day">{dateObj.format("DD")}</div>
                      <div className="eg-date-wd">{dateObj.format("ddd")}</div>
                      <div className="eg-date-month">
                        {dateObj.format("MMM")}
                      </div>
                    </th>
                  );
                })}
                <th className="eg-th-fixed eg-th-confirm">
                  Ký
                  <br />
                  duyệt
                </th>
              </tr>
            </thead>
            <tbody>
              {SHIFTS.map((shift, shiftIdx) => (
                <React.Fragment key={shift.code}>
                  {shiftIdx > 0 && (
                    <tr className="eg-sep-row">
                      <td colSpan={3 + dateList.length} />
                    </tr>
                  )}
                  {/* Row Nhiệt độ */}
                  <tr className="eg-data-row">
                    <td
                      rowSpan={3}
                      className="eg-shift-cell"
                      style={{
                        background: shift.color,
                        borderLeft: `4px solid ${shift.accent}`,
                      }}
                    >
                      <span
                        className="eg-shift-text"
                        style={{ color: shift.accent }}
                      >
                        {shift.label}
                      </span>
                    </td>
                    <td className="eg-type-cell eg-type-temp">
                      🌡 Nhiệt độ (°C)
                    </td>
                    {dateList.map((date) => {
                      const val = getCellValue(date, shift.code, true);
                      const editable = isEditable(date, shift.code);
                      const isConfirmed = isShiftConfirmed(date, shift.code);
                      return (
                        <td
                          key={date}
                          className={getCellClass(date, shift.code, val, true)}
                        >
                          <InputNumber
                            size="small"
                            value={val}
                            controls={false}
                            className="eg-input"
                            disabled={
                              !editable || isSaving || isConfirmed || !canUpdate
                            }
                            min={0}
                            max={100}
                            step={0.1}
                            precision={1}
                            onBlur={(e) => {
                              const parsed =
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value);

                              if (
                                parsed !== null &&
                                (parsed < 0 || parsed > 100)
                              ) {
                                message.warning(
                                  `⚠️ Nhiệt độ ${parsed}°C không hợp lệ! (0-100°C)`,
                                );
                                return;
                              }
                              handleAutoSave(
                                parsed,
                                shift.code,
                                "Nhiệt độ (°C)",
                                date,
                                val,
                              );
                            }}
                          />
                        </td>
                      );
                    })}
                    {/* Cột ký duyệt cho từng ca */}
                    {/* <td className="eg-cell eg-cell-confirm" rowSpan={3}>
                      <div className="eg-confirm-wrapper">
                        <Checkbox
                          checked={isShiftConfirmed(date, shift.code)}
                          disabled={!isEditable(date, shift.code) || isSaving}
                          onChange={() => handleConfirmClick(date, shift.code, isShiftConfirmed(date, shift.code))}
                        />
                        {getShiftConfirmedBy(date, shift.code) && (
                          <span
                            className="eg-confirmed-by"
                            title={`Người ký: ${getShiftConfirmedBy(date, shift.code)}`}
                          >
                            {getShiftConfirmedBy(date, shift.code)}
                          </span>
                        )}
                      </div>
                    </td> */}
                  </tr>
                  {/* Row Độ ẩm */}
                  <tr className="eg-data-row">
                    <td className="eg-type-cell eg-type-hum">💧 Độ ẩm (%)</td>
                    {dateList.map((date) => {
                      const val = getCellValue(date, shift.code, false);
                      const editable = isEditable(date, shift.code);
                      const isConfirmed = isShiftConfirmed(date, shift.code);
                      return (
                        <td
                          key={date}
                          className={getCellClass(date, shift.code, val, false)}
                        >
                          <InputNumber
                            size="small"
                            value={val}
                            controls={false}
                            className="eg-input"
                            disabled={
                              !editable || isSaving || isConfirmed || !canUpdate
                            }
                            min={0}
                            max={100}
                            step={0.1}
                            precision={1}
                            onBlur={(e) => {
                              const parsed =
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value);

                              if (
                                parsed !== null &&
                                (parsed < 0 || parsed > 100)
                              ) {
                                message.warning(
                                  `⚠️ Độ ẩm ${parsed}% không hợp lệ! (0-100%)`,
                                );
                                return;
                              }
                              handleAutoSave(
                                parsed,
                                shift.code,
                                "Độ ẩm (%)",
                                date,
                                val,
                              );
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  {/* Row Ký xác nhận (ký tên của OP) */}
                  <tr className="eg-sign-row">
                    <td
                      className="eg-type-cell eg-type-sign"
                      style={{ borderLeft: `4px solid ${shift.accent}` }}
                    >
                      <span style={{ color: shift.accent }}>✎ Ký xác nhận</span>
                    </td>
                    {dateList.map((date) => {
                      const editable = isEditable(date, shift.code);
                      const isConfirmed = isShiftConfirmed(date, shift.code);
                      const confirmedBy = getShiftConfirmedBy(date, shift.code);

                      return (
                        <td
                          key={date}
                          className={`eg-cell eg-cell-sign${isConfirmed ? " eg-cell-confirmed" : ""}`}
                        >
                          {isConfirmed ? (
                            <span
                              className="eg-confirmed-name-only"
                              style={{ color: shift.accent }}
                              title={`Đã ký xác nhận — ${confirmedBy ?? userName}`}
                            >
                              {confirmedBy ?? userName}
                            </span>
                          ) : editable ? (
                            <button
                              className="eg-confirm-btn"
                              style={{
                                borderColor: shift.accent,
                                color: shift.accent,
                              }}
                              disabled={isSaving || !canUpdate}
                              onClick={
                                () =>
                                  handleConfirmClick(date, shift.code, false)
                                // ← bỏ shift.labelVi
                              }
                              title={`Ký duyệt ca ${shift.labelVi} ngày ${dayjs(date).format("DD/MM/YYYY")}`}
                            >
                              Ký
                            </button>
                          ) : (
                            <span className="eg-sign-placeholder">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="eg-guidelines">
          <span className="eg-gl-title">※ Hướng dẫn ※</span>
          <span className="eg-gl-text">
            ① Nhiệt độ an toàn: 18°C - 25°C | Độ ẩm an toàn: ≤70%
          </span>
          <span className="eg-gl-text">
            ② Ô màu xanh: Trong ngưỡng an toàn | Ô màu đỏ: Cảnh báo vượt ngưỡng
          </span>
          <span className="eg-gl-text">
            ③ Ô màu xám: Chưa đến thời gian nhập liệu
          </span>
          <span className="eg-gl-text">
            ④ ✓ Ký duyệt: Sau khi ký sẽ không thể chỉnh sửa dữ liệu của ca đó
          </span>
        </div>
      </div>
      <div className="eg-abnormal-wrapper">
        <div className="eg-abnormal">
          <div className="eg-ab-header">※ Diễn giải vấn đề bất thường ※</div>
          {abnormalReports.length === 0 ? (
            <div className="eg-ab-empty">
              Chưa ghi nhận vấn đề bất thường trong khoảng thời gian này.
            </div>
          ) : (
            <div className="eg-ab-scroll">
              <table className="eg-ab-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Buổi</th>
                    <th>Vấn đề bất thường</th>
                    <th>Phương án xử lý khẩn cấp</th>
                    <th>Người báo cáo</th>
                    <th>Phương án khắc phục</th>
                    <th>Người xử lý</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {abnormalReports.map((r) => (
                    <tr
                      key={r.id}
                      className={r.isResolved ? "eg-resolved-row" : ""}
                    >
                      <td>{dayjs(r.reportDate).format("DD/MM/YYYY")}</td>
                      <td>
                        {r.shiftName ||
                          (r.shiftCode === "morning"
                            ? "Buổi sáng"
                            : r.shiftCode === "afternoon"
                              ? "Buổi chiều"
                              : r.shiftCode === "evening"
                                ? "Buổi tối"
                                : "Buổi đêm")}
                      </td>
                      <td>{r.issue}</td>
                      <td>{r.action || "—"}</td>
                      <td>{r.reportedBy || "—"}</td>
                      <td>{r.resolutionNote || "—"}</td>
                      <td>{r.resolvedBy || "—"}</td>
                      <td>
                        <span
                          className={`eg-status-badge ${r.isResolved ? "resolved" : "pending"}`}
                        >
                          {r.isResolved ? "✓ Đã xử lý" : "⏳ Chưa xử lý"}
                        </span>
                      </td>
                      <td>
                        {!r.isResolved && canUpdate && (
                          <Button
                            type="link"
                            size="small"
                            onClick={() => handleResolveReport(r.id)}
                            disabled={isSaving}
                          >
                            Xử lý
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            type="link"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => deleteAbnormal(r.id)}
                            disabled={isSaving}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Modal
        title="Xác nhận ký duyệt"
        open={confirmModalVisible}
        onOk={handleConfirm}
        onCancel={() => {
          setConfirmModalVisible(false);
          setSelectedConfirmKey(null);
          setConfirmNote("");
        }}
        okText="Xác nhận ký"
        cancelText="Hủy bỏ"
        confirmLoading={isSaving}
        closable={false}
      >
        <div style={{ padding: "12px 0" }}>
          <p style={{ marginBottom: 16, color: "#ff4d4f" }}>
            ⚠️ <strong>Cảnh báo:</strong> Sau khi ký duyệt, dữ liệu của ca này
            sẽ KHÔNG THỂ chỉnh sửa!
          </p>
          <p style={{ marginBottom: 16 }}>
            Người ký: <strong>{userName}</strong>
          </p>
          <p style={{ marginBottom: 16 }}>
            Thời gian ký:{" "}
            <strong>
              {selectedConfirmKey
                ? `${dayjs(selectedConfirmKey.date).format("DD/MM/YYYY")} - ${
                    SHIFTS.find((s) => s.code === selectedConfirmKey.shiftCode)
                      ?.labelVi
                  }`
                : ""}
            </strong>
          </p>
          {/* <div>
            <label>Ghi chú (tùy chọn):</label>
            <TextArea
              rows={3}
              value={confirmNote}
              onChange={(e) => setConfirmNote(e.target.value)}
              placeholder="Nhập ghi chú nếu cần..."
            />
          </div> */}
        </div>
      </Modal>
      <Modal
        title="Báo cáo vấn đề bất thường"
        open={showAbnormalModal}
        onOk={handleAddAbnormal}
        onCancel={() => setShowAbnormalModal(false)}
        okText="Lưu lại"
        cancelText="Hủy bỏ"
        width={440}
        confirmLoading={isSaving}
        closable={false}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 12,
          }}
        >
          <div>
            <label className="eg-modal-label">Ngày phát hiện:</label>
            <Input
              type="date"
              value={newAbnormal.date}
              onChange={(e) =>
                setNewAbnormal({ ...newAbnormal, date: e.target.value })
              }
            />
          </div>
          <div>
            <label className="eg-modal-label">Ca trực:</label>
            <Select
              value={newAbnormal.shiftCode}
              style={{ width: "100%" }}
              onChange={(v) => setNewAbnormal({ ...newAbnormal, shiftCode: v })}
            >
              {SHIFTS.map((s) => {
                const isToday =
                  newAbnormal.date === dayjs().format("YYYY-MM-DD");
                const currentHour = dayjs().hour();
                const limit = SHIFT_TIME_LIMITS[s.code];
                const notStarted =
                  isToday &&
                  (s.code === "night"
                    ? currentHour >= limit.endHour
                    : currentHour < limit.startHour);
                return (
                  <Option key={s.code} value={s.code} disabled={notStarted}>
                    {s.labelVi}
                    {notStarted ? " (chưa đến giờ)" : ""}
                  </Option>
                );
              })}
            </Select>
          </div>
          <div>
            <label className="eg-modal-label">Mô tả sự cố:</label>
            <TextArea
              rows={3}
              value={newAbnormal.issue}
              placeholder="Nhập chi tiết hiện tượng bất thường..."
              onChange={(e) =>
                setNewAbnormal({ ...newAbnormal, issue: e.target.value })
              }
            />
          </div>
          <div>
            <label className="eg-modal-label">Phương án xử lý khẩn cấp:</label>
            <TextArea
              rows={2}
              value={newAbnormal.action}
              placeholder="Hành động khắc phục tại chỗ..."
              onChange={(e) =>
                setNewAbnormal({ ...newAbnormal, action: e.target.value })
              }
            />
          </div>
        </div>
      </Modal>
      <Modal
        title="Xác nhận xử lý vấn đề bất thường"
        open={resolveModalVisible}
        onOk={handleConfirmResolve}
        onCancel={() => {
          setResolveModalVisible(false);
          setSelectedResolveId(null);
          setResolutionNote("");
        }}
        okText="Xác nhận đã xử lý"
        cancelText="Hủy bỏ"
        confirmLoading={isSaving}
        closable={false}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 12,
          }}
        >
          <p>
            Người xử lý: <strong>{userName}</strong>
          </p>
          <div>
            <label className="eg-modal-label">Phương án khắc phục:</label>
            <TextArea
              rows={4}
              value={resolutionNote}
              placeholder="Mô tả chi tiết cách đã xử lý vấn đề..."
              onChange={(e) => setResolutionNote(e.target.value)}
            />
          </div>
        </div>
      </Modal>
      <div className="eg-footer">
        <div className="eg-footer-inner">
          {/* <span className="eg-footer-bar eg-footer-bar--left" />
          <span className="eg-footer-icon">⚙</span>
          <span className="eg-footer-text">
            Developed by <strong>Viet Nam EA Team</strong>
          </span>
          <span className="eg-footer-divider">|</span>
          <span className="eg-footer-copy">© 2026</span>
          <span className="eg-footer-icon">⚙</span>
          <span className="eg-footer-bar eg-footer-bar--right" /> */}
        </div>
      </div>
    </div>
  );
}
