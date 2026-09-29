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

export default function ReportScreen() {
  const babyId = useAuthStore((s) =>
    s.user?.role === "parent" ? s.user.babyId : "",
  );

  const [report, setReport] = useState<DailyReport | null>(null);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const fetchReport = useCallback(async () => {
    if (!babyId) {
      setReport(null);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const data = await reportService.getDailyReport(babyId, selectedDate);
      setReport(data);
    } catch (error) {
      console.error("[ParentReport] Gagal memuat laporan:", error);
      setReport(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [babyId, selectedDate]);
  const fetchReportHistory = useCallback(async () => {
    if (!babyId) {
      setReportHistory([]);
      setIsHistoryLoading(false);
      return;
    }

    try {
      const data = await reportService.getReportList(babyId);
      setReportHistory(data);
    } catch (error) {
      console.error("[ParentReport] Gagal memuat riwayat laporan:", error);
      setReportHistory([]);
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

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);

    if (h > 0) {
      return `${h}j ${m}m`;
    }

    return `${m}m`;
  };

  return (
    <SafeAreaView style={styles.safe}>
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
        <Text style={styles.title}>Laporan Harian</Text>

        <View style={styles.datePicker}>
          <TouchableOpacity onPress={() => goDay(-1)} style={styles.dateBtn}>
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
            <Text style={styles.dateText}>
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
        ) : !report ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>
              Tidak ada data rekam AI untuk tanggal ini.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, styles.sleepValue]}>
                  {formatDuration(report.totalSleepMinutes)}
                </Text>
                <Text style={styles.summaryLabel}>Total Tidur</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, styles.awakeValue]}>
                  {formatDuration(report.totalAwakeMinutes)}
                </Text>
                <Text style={styles.summaryLabel}>Total Bangun</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, styles.cryingValue]}>
                  {formatDuration(report.totalCryingMinutes)}
                </Text>
                <Text style={styles.summaryLabel}>Total Menangis</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {report.totalCryingEvents}
                </Text>
                <Text style={styles.summaryLabel}>Kejadian Menangis</Text>
              </View>
            </View>

            <View style={styles.historyCard}>
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
                          Tidur {Math.round(item.total_sleep_minutes)}m
                        </Text>

                        <Text
                          style={[
                            styles.historyMeta,
                            isSelected && styles.historyMetaSelected,
                          ]}
                        >
                          Bangun {Math.round(item.total_awake_minutes)}m
                        </Text>

                        <Text
                          style={[
                            styles.historyMeta,
                            isSelected && styles.historyMetaSelected,
                          ]}
                        >
                          Menangis {item.total_crying_events}x
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Alokasi Aktivitas Harian</Text>

              <View style={styles.stackedBarContainer}>
                <View style={styles.macroTrack}>
                  {dailyMacro.sleepPct > 0 && (
                    <View
                      style={[
                        styles.macroSeg,
                        {
                          flex: dailyMacro.sleepPct,
                          backgroundColor: "#1D9E75",
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
                          backgroundColor: "#EF9F27",
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
                          backgroundColor: "#E24B4A",
                        },
                      ]}
                    />
                  )}
                </View>

                <View style={styles.macroLegend}>
                  <LegendItem
                    label="Tidur"
                    color="#1D9E75"
                    pct={dailyMacro.sleepPct}
                  />
                  <LegendItem
                    label="Bangun"
                    color="#EF9F27"
                    pct={dailyMacro.awakePct}
                  />
                  <LegendItem
                    label="Menangis"
                    color="#E24B4A"
                    pct={dailyMacro.cryingPct}
                  />
                </View>
              </View>
            </View>

            <View style={styles.chartCard}>
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
                                  backgroundColor: "#1D9E75",
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
                                  backgroundColor: "#EF9F27",
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
                                  backgroundColor: "#E24B4A",
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
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#085041" },
  datePicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 8,
  },

  dateBtn: { padding: 8 },
  dateCenter: { flex: 1, alignItems: "center" },
  dateText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  centerBox: { alignItems: "center", paddingVertical: 80 },
  loadingText: { marginTop: 12, color: "#6B7280" },
  errorText: { marginTop: 12, color: "#6B7280", textAlign: "center" },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    elevation: 1,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#374151",
  },
  sleepValue: { color: "#0F6E56" },
  awakeValue: { color: "#B7791F" },
  cryingValue: { color: "#C53030" },
  summaryLabel: { marginTop: 4, fontSize: 12, color: "#6B7280" },
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
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
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 16,
    elevation: 1,
  },
  chartTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
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
