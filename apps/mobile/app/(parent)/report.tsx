import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useAuthStore } from "../../stores/auth.store";
import { reportService } from "../../services/report.service";
import { DailyReport, ReportHistoryItem } from "../../types";
import { Colors } from "../../constants/colors";
import { Typography } from "../../constants/fonts";
import { Radii, Spacing } from "../../constants/ui";
import { useTheme } from "../../context/ThemeContext";

export default function ReportScreen() {
  const { isDark } = useTheme();
  const babyId = useAuthStore((s) =>
    s.user?.role === "parent" ? s.user.babyId : "",
  );

  const [report, setReport] = useState<DailyReport | null>(null);
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
      return { sleepPct: 0, awakePct: 0, cryingPct: 0 };
    }

    let sleep = 0;
    let awake = 0;
    let crying = 0;

    for (const hour of report.hourlyActivities) {
      sleep += hour.sleepMinutes;
      awake += hour.awakeMinutes;
      crying += hour.cryingMinutes;
    }

    return calculateSegments(sleep, awake, crying);
  }, [report]);

  const dailyInsight = useMemo(() => {
    if (!report) return null;
    const totals = [
      { label: "Tidur", value: report.totalSleepMinutes },
      { label: "Bangun", value: report.totalAwakeMinutes },
      { label: "Menangis", value: report.totalCryingMinutes },
    ];
    const top = totals.reduce((best, item) => item.value > best.value ? item : best);
    if (top.value <= 0) return "Belum ada aktivitas yang tercatat untuk hari ini.";
    return `${top.label} menjadi aktivitas terbanyak hari ini · ${formatDuration(top.value)} tercatat.`;
  }, [report]);

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);

    if (h > 0) {
      return `${h}j ${m}m`;
    }

    return `${m}m`;
  };

  return (
    <SafeAreaView style={[styles.safe, isDark && { backgroundColor: "#111827" }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              void Promise.all([fetchReport(), fetchReportHistory()]);
            }}
            colors={["#1D9E75"]}
          />
        }
      >
        <Text style={[styles.title, isDark && { color: "#A7F3D0" }]}>Laporan Harian</Text>

        <View style={[styles.datePicker, isDark && { backgroundColor: "#1F2937" }]}>
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
              <View style={[styles.summaryCard, isDark && { backgroundColor: "#1F2937" }]}>
                <Text style={[styles.summaryValue, styles.sleepValue]}>
                  {formatDuration(report.totalSleepMinutes)}
                </Text>
                <Text style={styles.summaryLabel}>Total Tidur</Text>
              </View>

              <View style={[styles.summaryCard, isDark && { backgroundColor: "#1F2937" }]}>
                <Text style={[styles.summaryValue, styles.awakeValue]}>
                  {formatDuration(report.totalAwakeMinutes)}
                </Text>
                <Text style={styles.summaryLabel}>Total Bangun</Text>
              </View>

              <View style={[styles.summaryCard, isDark && { backgroundColor: "#1F2937" }]}>
                <Text style={[styles.summaryValue, styles.cryingValue]}>
                  {formatDuration(report.totalCryingMinutes)}
                </Text>
                <Text style={styles.summaryLabel}>Total Menangis</Text>
              </View>

              <View style={[styles.summaryCard, isDark && { backgroundColor: "#1F2937" }]}>
                <Text style={styles.summaryValue}>
                  {report.totalCryingEvents}
                </Text>
                <Text style={styles.summaryLabel}>Kejadian Menangis</Text>
              </View>
            </View>

            {dailyInsight ? (
            <View style={[styles.insightCard, isDark && { backgroundColor: "#1F2937" }]}>
                <Text style={styles.insightLabel}>Ringkasan</Text>
                <Text style={styles.insightText}>{dailyInsight}</Text>
              </View>
            ) : null}

            <View style={[styles.historyCard, isDark && { backgroundColor: "#1F2937" }]}>
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

                        <Text style={[styles.historyMeta, isSelected && styles.historyMetaSelected]}>
                          Tidur {formatDuration(item.total_sleep_minutes)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View style={[styles.chartCard, isDark && { backgroundColor: "#1F2937" }]}>
              <Text style={styles.chartTitle}>Alokasi Aktivitas Harian</Text>

              <View style={styles.stackedBarContainer}>
                <View style={styles.macroTrack}>
                  {dailyMacro.sleepPct > 0 && (
                    <View
                      style={[
                        styles.macroSeg,
                        {
                          flex: dailyMacro.sleepPct,
                          backgroundColor: Colors.success,
                        },
                      ]}
                    />
                  )}
                  {dailyMacro.awakePct > 0 && (
                    <View
                      style={[
                        styles.macroSeg,
                        {
                          flex: dailyMacro.awakePct,
                          backgroundColor: Colors.info,
                        },
                      ]}
                    />
                  )}
                  {dailyMacro.cryingPct > 0 && (
                    <View
                      style={[
                        styles.macroSeg,
                        {
                          flex: dailyMacro.cryingPct,
                          backgroundColor: Colors.critical,
                        },
                      ]}
                    />
                  )}
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

            <View style={[styles.chartCard, isDark && { backgroundColor: "#1F2937" }]}>
              <Text style={styles.chartTitle}>
                Analisis Distribusi per Jam (00:00 - 24:00)
              </Text>

              {report.hourlyActivities
                .filter(
                  (hour) =>
                    hour.sleepMinutes + hour.awakeMinutes + hour.cryingMinutes >
                    0,
                )
                .map((hour) => {
                  const segments = calculateSegments(
                    hour.sleepMinutes,
                    hour.awakeMinutes,
                    hour.cryingMinutes,
                  );

                  const totalRecorded =
                    hour.sleepMinutes + hour.awakeMinutes + hour.cryingMinutes;

                  return (
                    <View key={hour.hour} style={styles.hourlyBlock}>
                      <View style={styles.hourlyRow}>
                        <Text style={styles.hourLabel}>
                          {hour.hour.toString().padStart(2, "0")}:00
                        </Text>

                        <View style={styles.hourlyTrack}>
                          {segments.sleepPct > 0 && (
                            <View
                              style={[
                                styles.barSeg,
                                {
                                  flex: hour.sleepMinutes,
                                  backgroundColor: Colors.success,
                                },
                              ]}
                            />
                          )}
                          {segments.awakePct > 0 && (
                            <View
                              style={[
                                styles.barSeg,
                                {
                                  flex: hour.awakeMinutes,
                                  backgroundColor: Colors.info,
                                },
                              ]}
                            />
                          )}
                          {segments.cryingPct > 0 && (
                            <View
                              style={[
                                styles.barSeg,
                                {
                                  flex: hour.cryingMinutes,
                                  backgroundColor: Colors.critical,
                                },
                              ]}
                            />
                          )}
                        </View>

                        <Text style={styles.hourTotal}>
                          {Math.round(totalRecorded)}m
                        </Text>
                      </View>
                    </View>
                  );
                })}

              {report.hourlyActivities.every(
                (hour) =>
                  hour.sleepMinutes + hour.awakeMinutes + hour.cryingMinutes ===
                  0,
              ) && (
                <Text style={styles.noDataText}>
                  Belum ada aktivitas yang terekam pada tanggal ini.
                </Text>
              )}
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

  dateBtn: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
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
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: Radii.card,
    padding: Spacing.cardPadding,
    gap: 12,
    elevation: 1,
  },
  insightCard: {
    backgroundColor: Colors.successLight,
    borderRadius: Radii.card,
    padding: Spacing.cardPadding,
    gap: Spacing.xs,
  },
  insightLabel: { ...Typography.captionStrong, color: Colors.successDark },
  insightText: { ...Typography.body, color: Colors.textPrimary, lineHeight: 21 },
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
  stackedBarContainer: { gap: 12 },
  macroTrack: {
    height: 32,
    borderRadius: 8,
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  macroSeg: { height: "100%" },
  macroLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: "#6B7280" },
  legendPct: { fontWeight: "700", color: "#374151" },
  hourlyBlock: { marginVertical: 6, gap: 4 },
  hourlyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  hourLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    width: 35,
    fontWeight: "600",
  },
  hourlyTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  barSeg: { height: "100%" },
  hourTotal: {
    fontSize: 11,
    color: "#9CA3AF",
    width: 40,
    textAlign: "right",
    fontWeight: "600",
  },
  noDataText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    paddingVertical: 16,
  },
});
