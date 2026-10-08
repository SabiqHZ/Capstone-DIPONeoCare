import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Image,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useAuthStore } from "../../stores/auth.store";
import { useBabyContext } from "../../context/BabyContext";
import { api } from "../../services/api";
import { deviceService } from "../../services/device.service";
import { reportService } from "../../services/report.service";
import { DailyReport } from "../../types";

const { width } = Dimensions.get("window");

export default function CameraScreen() {
  const user = useAuthStore((s) => s.user);
  const { state } = useBabyContext();

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [hasFrame, setHasFrame] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [apiDeviceOnline, setApiDeviceOnline] = useState<boolean | null>(null);

  const babyId = user?.role === "parent" ? user.babyId : null;
  const focusedStatus = babyId ? state.statuses[babyId] : null;

  const isDeviceOnline =
    focusedStatus?.deviceOnline ?? apiDeviceOnline ?? false;

  const getActivityDistribution = () => {
    if (!dailyReport) {
      return {
        sleepPct: 0,
        awakePct: 0,
        cryingPct: 0,
      };
    }

    let sleep = 0;
    let awake = 0;
    let crying = 0;

    for (const hour of dailyReport.hourlyActivities) {
      sleep += hour.sleepMinutes;
      awake += hour.awakeMinutes;
      crying += hour.cryingMinutes;
    }

    const total = sleep + awake + crying;

    if (total <= 0) {
      return {
        sleepPct: 0,
        awakePct: 0,
        cryingPct: 0,
      };
    }

    const sleepPct = Math.round((sleep / total) * 100);
    const awakePct = Math.round((awake / total) * 100);
    const cryingPct = Math.max(0, 100 - sleepPct - awakePct);

    return {
      sleepPct,
      awakePct,
      cryingPct,
    };
  };

  const activityDistribution = getActivityDistribution();

  const fetchDailyReport = async () => {
    if (!babyId) return;

    try {
      const today = new Date().toISOString().split("T")[0];
      const report = await reportService.getDailyReport(babyId, today);
      setDailyReport(report);
    } catch (error) {
      console.error(
        "[ParentCamera] Gagal memuat distribusi aktivitas harian:",
        error,
      );
      setDailyReport(null);
    }
  };
}
