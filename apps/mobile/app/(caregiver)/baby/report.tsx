import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Icon } from "../../../components/ui/Icon";
import { Colors } from "../../../constants/colors";
import { Fonts } from "../../../constants/fonts";
import { reportService } from "../../../services/report.service";
import { ReportHistoryItem } from "../../../types";

// Catatan: Pastikan interface DailyReport di types.ts milikmu sudah diubah menjadi seperti ini!
interface DailyReport {
  date: string;
  totalSleepMinutes: number;
  totalAwakeMinutes: number;
  totalCryingMinutes: number;
  totalCryingEvents: number;
  hourlyActivities: {
    hour: number;
    sleepMinutes: number;
    awakeMinutes: number;
    cryingMinutes: number;
  }[];
}

export default function NurseBabyReportScreen() {
  const router = useRouter();
  const { babyId, babyName } = useLocalSearchParams<{
    babyId: string;
    babyName: string;
  }>();

  const [report, setReport] = useState<DailyReport | null>(null);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const fetchReport = useCallback(async () => {
    if (!babyId) return;
    try {
      const data = await reportService.getDailyReport(babyId, selectedDate);
      setReport(data);
    } catch {
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
      console.error("[CaregiverReport] Gagal memuat riwayat laporan:", error);
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
    if (next <= today) setSelectedDate(next);
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  // Helper untuk format menit ke Jam & Menit
  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}j ${m}m`;
    return `${m}m`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon
            name="arrow-back"
            library="ionicons"
            size={22}
            color={Colors.secondaryDark}
          />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Laporan Harian AI</Text>
          <Text style={styles.headerSub}>{babyName}</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

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
            colors={[Colors.secondary]}
            tintColor={Colors.secondary}
          />
        }
      >
        {/* Date picker */}
        <View style={styles.datePicker}>
          <TouchableOpacity onPress={() => goDay(-1)} style={styles.dateBtn}>
            <Text style={styles.dateBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>
            {new Date(selectedDate).toLocaleDateString("id-ID", {
              weekday: "short",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
          <TouchableOpacity
            onPress={() => goDay(1)}
            style={styles.dateBtn}
            disabled={isToday}
          >
            <Text
              style={[styles.dateBtnText, isToday && { color: Colors.border }]}
            >
              ›
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={Colors.secondary} size="large" />
          </View>
        ) : !report ? (
          <View style={styles.centerBox}>
            <Icon
              name="bar-chart-outline"
              library="ionicons"
              size={48}
              color={Colors.textDisabled}
            />
            <Text style={styles.emptyText}>
              Tidak ada data rekam AI untuk tanggal ini
            </Text>
          </View>
        ) : (
          <>
            {/* Summary Metrik AI */}
            <View style={styles.summaryRow}>
              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: Colors.primaryLight },
                ]}
              >
                <Text style={[styles.summaryVal, { color: Colors.primary }]}>
                  {formatDuration(report.totalSleepMinutes)}
                </Text>
                <Text style={styles.summaryLabel}>Total Tidur</Text>
              </View>
              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: Colors.warningLight },
                ]}
              >
                <Text style={[styles.summaryVal, { color: Colors.warning }]}>
                  {formatDuration(report.totalAwakeMinutes)}
                </Text>
                <Text style={styles.summaryLabel}>Total Bangun</Text>
              </View>
              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: Colors.dangerLight },
                ]}
              >
                <Text style={[styles.summaryVal, { color: Colors.danger }]}>
                  {formatDuration(report.totalCryingMinutes)}
                </Text>
                <Text style={styles.summaryLabel}>Total Menangis</Text>
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
                  <ActivityIndicator size="small" color={Colors.secondary} />
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

            {/* Aktivitas Chart (Tidur, Bangun, Menangis) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Distribusi Aktivitas per Jam</Text>
              <View style={styles.legend}>
                {[
                  { color: Colors.primary, label: "Tidur" },
                  { color: Colors.warning, label: "Bangun" },
                  { color: Colors.danger, label: "Menangis" },
                ].map((l) => (
                  <View key={l.label} style={styles.legendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: l.color }]}
                    />
                    <Text style={styles.legendText}>{l.label}</Text>
                  </View>
                ))}
              </View>

              {report.hourlyActivities && report.hourlyActivities.length > 0 ? (
                report.hourlyActivities
                  .filter(
                    (h) =>
                      h.sleepMinutes + h.awakeMinutes + h.cryingMinutes > 0,
                  )
                  .map((h) => {
                    const totalRecorded =
                      h.sleepMinutes + h.awakeMinutes + h.cryingMinutes || 1;
                    return (
                      <View key={h.hour} style={styles.barRow}>
                        <Text style={styles.barHour}>
                          {h.hour.toString().padStart(2, "0")}:00
                        </Text>
                        <View style={styles.barTrack}>
                          {h.sleepMinutes > 0 && (
                            <View
                              style={[
                                styles.barSeg,
                                {
                                  flex: h.sleepMinutes,
                                  backgroundColor: Colors.primary,
                                },
                              ]}
                            />
                          )}
                          {h.awakeMinutes > 0 && (
                            <View
                              style={[
                                styles.barSeg,
                                {
                                  flex: h.awakeMinutes,
                                  backgroundColor: Colors.warning,
                                },
                              ]}
                            />
                          )}
                          {h.cryingMinutes > 0 && (
                            <View
                              style={[
                                styles.barSeg,
                                {
                                  flex: h.cryingMinutes,
                                  backgroundColor: Colors.danger,
                                },
                              ]}
                            />
                          )}
                          {/* Sisa waktu kosong/tidak terekam dalam 1 jam (60 menit) */}
                          <View
                            style={{ flex: Math.max(0, 60 - totalRecorded) }}
                          />
                        </View>
                        <Text style={styles.barVal}>{totalRecorded}m</Text>
                      </View>
                    );
                  })
              ) : (
                <Text style={styles.noData}>
                  Belum ada data aktivitas hari ini
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundNurse },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerCenter: { alignItems: "center" },
  headerTitle: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 16,
    color: Colors.secondaryDark,
  },
  headerSub: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  datePicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  dateBtn: { padding: 10 },
  dateBtnText: { fontSize: 24, color: Colors.secondary, fontWeight: "700" },
  dateText: {
    flex: 1,
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  centerBox: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 48,
  },
  emptyText: {
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    color: Colors.textMuted,
  },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  summaryVal: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 18, // Sedikit diperkecil agar format jam+menit muat
  },
  summaryLabel: {
    fontFamily: Fonts.interRegular,
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
  },
  historyCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  historyHeader: {
    gap: 3,
  },
  historyTitle: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  historySubtitle: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  historyList: {
    gap: 10,
  },
  historyItem: {
    width: 145,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.backgroundNurse,
    gap: 4,
  },
  historyItemSelected: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  historyDate: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  historyDateSelected: {
    color: Colors.secondaryDark,
  },
  historyMeta: {
    fontFamily: Fonts.interRegular,
    fontSize: 10,
    color: Colors.textMuted,
  },
  historyMetaSelected: {
    color: Colors.secondaryDark,
  },
  historyLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyLoadingText: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  historyEmpty: {
    fontFamily: Fonts.interRegular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  legend: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barHour: {
    fontFamily: Fonts.interRegular,
    fontSize: 10,
    color: Colors.textDisabled,
    width: 38,
  },
  barTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: Colors.borderLight,
  },
  barSeg: { height: "100%" },
  barVal: {
    fontFamily: Fonts.interRegular,
    fontSize: 10,
    color: Colors.textDisabled,
    width: 28,
    textAlign: "right",
  },
  noData: {
    fontFamily: Fonts.interRegular,
    fontSize: 13,
    color: Colors.textDisabled,
    textAlign: "center",
    paddingVertical: 16,
  },
});
