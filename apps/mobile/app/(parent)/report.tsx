import { SafeAreaView } from "react-native-safe-area-context";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text as NativeText,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useAuthStore } from "../../stores/auth.store";
import { reportService } from "../../services/report.service";
import { DailyReport, ReportHistoryItem } from "../../types";
import { Colors } from "../../constants/colors";
import { formatDurationMinutes } from "../../utils/duration";
import { Fonts, Typography } from "../../constants/fonts";
import { Radii, Spacing } from "../../constants/ui";
import { useTheme } from "../../context/ThemeContext";

const Text = ({ style, ...props }: ComponentProps<typeof NativeText>) => (
  <NativeText
    {...props}
    style={[{ fontFamily: Fonts.poppinsRegular }, style]}
  />
);

export default function ReportScreen() {
  const { isDark } = useTheme();
  const babyId = useAuthStore((s) =>
    s.user?.role === "parent" ? s.user.babyId : "",
  );

  const [report, setReport] = useState<DailyReport | null>(null);
  const [previousReport, setPreviousReport] = useState<DailyReport | null>(
    null,
  );
  const [isPreviousReportLoading, setIsPreviousReportLoading] = useState(true);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isHistoryError, setIsHistoryError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isReportError, setIsReportError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const fetchReport = useCallback(async () => {
    if (!babyId) {
      setReport(null);
      setIsReportError(false);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const data = await reportService.getDailyReport(babyId, selectedDate);
      // Respons sukses tanpa payload diperlakukan sebagai laporan kosong.
      setReport(data ?? null);
      setIsReportError(false);
    } catch (error) {
      console.error("[ParentReport] Gagal memuat laporan:", error);
      setReport(null);
      setIsReportError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [babyId, selectedDate]);

  const previousDate = useMemo(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day - 1))
      .toISOString()
      .slice(0, 10);
  }, [selectedDate]);

  const fetchPreviousReport = useCallback(async () => {
    if (!babyId) {
      setPreviousReport(null);
      setIsPreviousReportLoading(false);
      return;
    }

    setIsPreviousReportLoading(true);
    setPreviousReport(null);
    try {
      const data = await reportService.getDailyReport(babyId, previousDate);
      setPreviousReport(data ?? null);
    } catch (error) {
      console.warn(
        "[ParentReport] Data hari sebelumnya tidak tersedia:",
        error,
      );
      setPreviousReport(null);
    } finally {
      setIsPreviousReportLoading(false);
    }
  }, [babyId, previousDate]);
  const fetchReportHistory = useCallback(async () => {
    if (!babyId) {
      setReportHistory([]);
      setIsHistoryError(false);
      setIsHistoryLoading(false);
      return;
    }

    try {
      const data = await reportService.getReportList(babyId);
      setReportHistory(data ?? []);
      setIsHistoryError(false);
    } catch (error) {
      console.error("[ParentReport] Gagal memuat riwayat laporan:", error);
      setReportHistory([]);
      setIsHistoryError(true);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [babyId]);

  useEffect(() => {
    setIsLoading(true);
    void fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    setIsHistoryLoading(true);
    void fetchReportHistory();
  }, [fetchReportHistory]);

  useEffect(() => {
    void fetchPreviousReport();
  }, [fetchPreviousReport]);

  const goDay = (dir: -1 | 1) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);

    const today = new Date().toISOString().split("T")[0];
    const next = d.toISOString().split("T")[0];

    if (next <= today) {
      setSelectedDate(next);
    }
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const calculateSegments = (sleep: number, awake: number, crying: number) => {
    const total = sleep + awake + crying;

    if (total === 0) {
      return { sleepPct: 0, awakePct: 0, cryingPct: 0 };
    }

    const sleepPct = (sleep / total) * 100;
    const awakePct = (awake / total) * 100;
    const cryingPct = 100 - sleepPct - awakePct;

    return { sleepPct, awakePct, cryingPct };
  };

  const dailyMacro = useMemo(() => {
    if (!report) {
      return {
        sleepMinutes: 0,
        awakeMinutes: 0,
        cryingMinutes: 0,
        totalMinutes: 0,
        sleepPct: 0,
        awakePct: 0,
        cryingPct: 0,
      };
    }

    let sleep = 0;
    let awake = 0;
    let crying = 0;

    for (const hour of report.hourlyActivities) {
      sleep += hour.sleepMinutes;
      awake += hour.awakeMinutes;
      crying += hour.cryingMinutes;
    }

    return {
      sleepMinutes: sleep,
      awakeMinutes: awake,
      cryingMinutes: crying,
      totalMinutes: sleep + awake + crying,
      ...calculateSegments(sleep, awake, crying),
    };
  }, [report]);

  const hasReportData = (value: DailyReport | null) =>
    Boolean(
      value?.hourlyActivities.some(
        (hour) =>
          hour.sleepMinutes + hour.awakeMinutes + hour.cryingMinutes > 0,
      ),
    );

  const comparisonText = (current: number, previous: number) => {
    if (isPreviousReportLoading) return "Membandingkan dengan kemarin…";
    if (!hasReportData(report)) return "Belum ada data hari ini";
    if (!hasReportData(previousReport)) return "Belum ada data pembanding";

    const difference = current - previous;
    if (difference === 0) return "Sama seperti kemarin";
    return `${difference > 0 ? "+" : "−"}${formatDuration(Math.abs(difference))} dari kemarin`;
  };

  const eventComparisonText = (current: number, previous: number) => {
    if (isPreviousReportLoading) return "Membandingkan dengan kemarin…";
    if (!hasReportData(report)) return "Belum ada data hari ini";
    if (!hasReportData(previousReport)) return "Belum ada data pembanding";

    const difference = current - previous;
    if (difference === 0) return "Sama seperti kemarin";
    return `${difference > 0 ? "+" : "−"}${Math.abs(difference)} kejadian dari kemarin`;
  };

  const formatDuration = formatDurationMinutes;

  return (
    <SafeAreaView
      style={[styles.safe, isDark && { backgroundColor: "#111827" }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              void Promise.all([
                fetchReport(),
                fetchReportHistory(),
                fetchPreviousReport(),
              ]);
            }}
            colors={["#1D9E75"]}
          />
        }
      >
        <Text style={[styles.title, isDark && { color: "#A7F3D0" }]}>
          Laporan Harian
        </Text>

        <View
          style={[styles.datePicker, isDark && { backgroundColor: "#1F2937" }]}
        >
          <TouchableOpacity
            onPress={() => goDay(-1)}
            style={styles.dateBtn}
            accessibilityRole="button"
            accessibilityLabel="Lihat hari sebelumnya"
            accessibilityHint="Menampilkan laporan untuk satu hari sebelumnya"
          >
            <Svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1D9E75"
              strokeWidth="2.5"
            >
              <Path d="M15 18l-6-6 6-6" />
            </Svg>
          </TouchableOpacity>

          <View style={styles.dateCenter}>
            <Text style={[styles.dateText, isDark && { color: "#F3F4F6" }]}>
              {new Date(selectedDate).toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => goDay(1)}
            style={styles.dateBtn}
            disabled={isToday}
            accessibilityRole="button"
            accessibilityLabel="Lihat hari berikutnya"
            accessibilityHint="Menampilkan laporan untuk satu hari berikutnya"
          >
            <Svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isToday ? "#D1D5DB" : "#1D9E75"}
              strokeWidth="2.5"
            >
              <Path d="M9 18l6-6-6-6" />
            </Svg>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#1D9E75" />
            <Text style={styles.loadingText}>Memuat laporan...</Text>
          </View>
        ) : !babyId ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>
              Data bayi untuk akun orang tua tidak ditemukan.
            </Text>
          </View>
        ) : isReportError ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>
              Laporan gagal dimuat. Silakan coba lagi.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                setIsLoading(true);
                setIsReportError(false);
                void fetchReport();
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Coba Lagi</Text>
            </TouchableOpacity>
          </View>
        ) : !report ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>
              Belum ada catatan pemantauan untuk tanggal ini.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryGrid}>
              <View
                style={[
                  styles.summaryCard,
                  isDark && { backgroundColor: "#1F2937" },
                ]}
              >
                <Text style={[styles.summaryValue, styles.sleepValue]}>
                  {formatDuration(report.totalSleepMinutes)}
                </Text>
                <Text style={styles.summaryLabel}>Total Tidur</Text>
                <Text style={styles.summaryComparison}>
                  {comparisonText(
                    report.totalSleepMinutes,
                    previousReport?.totalSleepMinutes ?? 0,
                  )}
                </Text>
              </View>

              <View
                style={[
                  styles.summaryCard,
                  isDark && { backgroundColor: "#1F2937" },
                ]}
              >
                <Text style={[styles.summaryValue, styles.awakeValue]}>
                  {formatDuration(report.totalAwakeMinutes)}
                </Text>
                <Text style={styles.summaryLabel}>Total Bangun</Text>
                <Text style={styles.summaryComparison}>
                  {comparisonText(
                    report.totalAwakeMinutes,
                    previousReport?.totalAwakeMinutes ?? 0,
                  )}
                </Text>
              </View>

              <View
                style={[
                  styles.summaryCard,
                  isDark && { backgroundColor: "#1F2937" },
                ]}
              >
                <Text style={[styles.summaryValue, styles.cryingValue]}>
                  {formatDuration(report.totalCryingMinutes)}
                </Text>
                <Text style={styles.summaryLabel}>Total Menangis</Text>
                <Text style={styles.summaryComparison}>
                  {comparisonText(
                    report.totalCryingMinutes,
                    previousReport?.totalCryingMinutes ?? 0,
                  )}
                </Text>
              </View>

              <View
                style={[
                  styles.summaryCard,
                  isDark && { backgroundColor: "#1F2937" },
                ]}
              >
                <Text style={styles.summaryValue}>
                  {report.totalCryingEvents}
                </Text>
                <Text style={styles.summaryLabel}>Kejadian Menangis</Text>
                <Text style={styles.summaryComparison}>
                  {eventComparisonText(
                    report.totalCryingEvents,
                    previousReport?.totalCryingEvents ?? 0,
                  )}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.historyCard,
                isDark && { backgroundColor: "#1F2937" },
              ]}
            >
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>Riwayat Laporan</Text>
                <Text style={styles.historySubtitle}>
                  Pilih tanggal laporan
                </Text>
              </View>

              {isHistoryLoading ? (
                <View style={styles.historyLoading}>
                  <ActivityIndicator size="small" color="#1D9E75" />
                  <Text style={styles.historyLoadingText}>
                    Memuat riwayat...
                  </Text>
                </View>
              ) : isHistoryError ? (
                <View style={styles.historyErrorContainer}>
                  <Text style={styles.historyError}>
                    Riwayat laporan gagal dimuat. Silakan coba lagi.
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => {
                      setIsHistoryLoading(true);
                      setIsHistoryError(false);
                      void fetchReportHistory();
                    }}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryButtonText}>Coba Lagi</Text>
                  </TouchableOpacity>
                </View>
              ) : reportHistory.length === 0 ? (
                <Text style={styles.historyEmpty}>
                  Belum ada riwayat laporan.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.historyList}
                >
                  {reportHistory.map((item) => {
                    const isSelected = item.date === selectedDate;

                    return (
                      <TouchableOpacity
                        key={item.date}
                        style={[
                          styles.historyItem,
                          isSelected && styles.historyItemSelected,
                        ]}
                        onPress={() => setSelectedDate(item.date)}
                      >
                        <Text
                          style={[
                            styles.historyDate,
                            isSelected && styles.historyDateSelected,
                          ]}
                        >
                          {new Date(`${item.date}T00:00:00`).toLocaleDateString(
                            "id-ID",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </Text>

                        <Text
                          style={[
                            styles.historyMeta,
                            isSelected && styles.historyMetaSelected,
                          ]}
                        >
                          Tidur {formatDuration(item.total_sleep_minutes)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View
              style={[
                styles.chartCard,
                isDark && { backgroundColor: "#1F2937" },
              ]}
            >
              <Text style={styles.chartTitle}>Distribusi Aktivitas Harian</Text>
              <Text style={styles.chartSubtitle}>
                Proporsi dari durasi aktivitas yang tercatat
              </Text>

              <View style={styles.donutContent}>
                <View style={styles.donutWrap}>
                  <Svg width={160} height={160} viewBox="0 0 160 160">
                    <Circle
                      cx={80}
                      cy={80}
                      r={54}
                      fill="none"
                      stroke={isDark ? "#374151" : "#E5E7EB"}
                      strokeWidth={20}
                    />
                    {dailyMacro.totalMinutes > 0 ? (
                      <>
                        <Circle
                          cx={80}
                          cy={80}
                          r={54}
                          fill="none"
                          stroke={Colors.success}
                          strokeWidth={20}
                          strokeDasharray={`${(2 * Math.PI * 54 * dailyMacro.sleepPct) / 100} ${2 * Math.PI * 54}`}
                          transform="rotate(-90 80 80)"
                        />
                        <Circle
                          cx={80}
                          cy={80}
                          r={54}
                          fill="none"
                          stroke={Colors.info}
                          strokeWidth={20}
                          strokeDasharray={`${(2 * Math.PI * 54 * dailyMacro.awakePct) / 100} ${2 * Math.PI * 54}`}
                          strokeDashoffset={
                            -(2 * Math.PI * 54 * dailyMacro.sleepPct) / 100
                          }
                          transform="rotate(-90 80 80)"
                        />
                        <Circle
                          cx={80}
                          cy={80}
                          r={54}
                          fill="none"
                          stroke={Colors.critical}
                          strokeWidth={20}
                          strokeDasharray={`${(2 * Math.PI * 54 * dailyMacro.cryingPct) / 100} ${2 * Math.PI * 54}`}
                          strokeDashoffset={
                            (-2 *
                              Math.PI *
                              54 *
                              (dailyMacro.sleepPct + dailyMacro.awakePct)) /
                            100
                          }
                          transform="rotate(-90 80 80)"
                        />
                      </>
                    ) : null}
                  </Svg>
                  <View style={styles.donutCenter}>
                    <Text
                      style={[
                        styles.donutTotal,
                        isDark && { color: "#F9FAFB" },
                      ]}
                    >
                      {dailyMacro.totalMinutes > 0
                        ? formatDuration(dailyMacro.totalMinutes)
                        : "—"}
                    </Text>
                    <Text style={styles.donutCaption}>tercatat</Text>
                  </View>
                </View>

                <View style={styles.macroLegend}>
                  <LegendItem
                    label="Tidur"
                    color={Colors.success}
                    pct={dailyMacro.sleepPct}
                  />
                  <LegendItem
                    label="Bangun"
                    color={Colors.info}
                    pct={dailyMacro.awakePct}
                  />
                  <LegendItem
                    label="Menangis"
                    color={Colors.critical}
                    pct={dailyMacro.cryingPct}
                  />
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LegendItem({
  label,
  color,
  pct,
}: {
  label: string;
  color: string;
  pct: number;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>
        {label} <Text style={styles.legendPct}>{Math.round(pct)}%</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F0F9F5" },
  content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 40 },
  title: { ...Typography.h1, color: "#085041" },
  datePicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: Radii.control,
    padding: Spacing.sm,
  },

  dateBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dateCenter: { flex: 1, alignItems: "center" },
  dateText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  centerBox: { alignItems: "center", paddingVertical: 80 },
  loadingText: { marginTop: 12, color: "#6B7280" },
  errorText: { marginTop: 12, color: "#6B7280", textAlign: "center" },
  retryButton: {
    marginTop: 8,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#E8F7F1",
  },
  retryButtonText: { color: "#0F6E56", fontWeight: "700", fontSize: 13 },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: Radii.card,
    padding: Spacing.cardPadding,
    elevation: 1,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#374151",
  },
  sleepValue: { color: Colors.successDark },
  awakeValue: { color: Colors.info },
  cryingValue: { color: Colors.criticalDark },
  summaryLabel: { marginTop: 4, fontSize: 12, color: "#6B7280" },
  summaryComparison: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 14,
    color: "#6B7280",
  },
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: Radii.card,
    padding: Spacing.cardPadding,
    gap: 12,
    elevation: 1,
  },
  historyHeader: {
    gap: 3,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  historySubtitle: {
    fontSize: 11,
    color: "#6B7280",
  },
  historyList: {
    gap: 10,
  },
  historyItem: {
    width: 145,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    gap: 4,
  },
  historyItemSelected: {
    backgroundColor: "#E8F7F1",
    borderWidth: 1,
    borderColor: "#1D9E75",
  },
  historyDate: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  historyDateSelected: {
    color: "#0F6E56",
  },
  historyMeta: {
    fontSize: 10,
    color: "#6B7280",
  },
  historyMetaSelected: {
    color: "#35685A",
  },
  historyLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyLoadingText: {
    fontSize: 11,
    color: "#6B7280",
  },
  historyEmpty: {
    fontSize: 12,
    color: "#6B7280",
  },
  historyErrorContainer: { gap: 8, alignItems: "flex-start" },
  historyError: { fontSize: 12, color: "#B42318" },
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: Radii.card,
    padding: Spacing.cardPadding,
    gap: 16,
    elevation: 1,
  },
  chartTitle: { ...Typography.bodyStrong, color: "#111827" },
  chartSubtitle: { ...Typography.caption, color: "#6B7280", marginTop: -10 },
  donutContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  donutWrap: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  donutCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  donutTotal: {
    ...Typography.bodyStrong,
    color: "#111827",
  },
  donutCaption: {
    ...Typography.caption,
    color: "#6B7280",
  },
  macroLegend: {
    flex: 1,
    gap: 14,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: "#6B7280" },
  legendPct: { fontWeight: "700", color: "#374151" },
});
