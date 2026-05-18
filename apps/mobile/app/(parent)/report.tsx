import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface EnhancedHourlyActivity {
  hour: number;
  sleepMinutes: number;
  awakeMinutes: number;
  cryingMinutes: number;
  faceCovered: number;
}

interface EnhancedDailyReport {
  totalCryingEvents: number;
  totalFaceCoveredEvents: number;
  hourlyActivities: EnhancedHourlyActivity[];
}

// Generator Dummy Data Otomatis 24 Jam (00 - 23) Kebal Peluru
const generateDummyReport = (): EnhancedDailyReport => {
  const hourlyActivities: EnhancedHourlyActivity[] = Array.from({ length: 24 }, (_, i) => {
    if (i >= 0 && i < 6) {
      // Dini Hari: Dominan Tidur
      return { hour: i, sleepMinutes: 50, awakeMinutes: 7, cryingMinutes: 3, faceCovered: i === 3 ? 1 : 0 };
    } else if (i >= 6 && i < 12) {
      // Pagi Hari: Dominan Bangun / Aktif
      return { hour: i, sleepMinutes: 10, awakeMinutes: 45, cryingMinutes: 5, faceCovered: i === 9 ? 2 : 0 };
    } else if (i >= 12 && i < 18) {
      // Siang-Sore: Siklus Seimbang (Tidur Siang)
      return { hour: i, sleepMinutes: 35, awakeMinutes: 20, cryingMinutes: 5, faceCovered: 0 };
    } else {
      // Malam Hari: Proses Tidur + Ada Insiden Tangisan
      return { hour: i, sleepMinutes: 42, awakeMinutes: 8, cryingMinutes: 10, faceCovered: i === 21 ? 1 : 0 };
    }
  });

  return {
    totalCryingEvents: 8,
    totalFaceCoveredEvents: 4, // Total akumulasi wajah tidak terdeteksi
    hourlyActivities,
  };
};

export default function ReportScreen() {
  const [report] = useState<EnhancedDailyReport>(generateDummyReport());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  // Kalkulasi segmen grafik persentase akumulatif (Total 100%)
  const calculateSegments = (s: number, a: number, c: number) => {
    const total = s + a + c;
    if (total === 0) return { sP: 0, aP: 0, cP: 0, total: 0 };
    const sP = (s / total) * 100;
    const aP = (a / total) * 100;
    const cP = 100 - sP - aP; 
    return { sP, aP, cP, total };
  };

  const dailyMacro = useMemo(() => {
    let s = 0, a = 0, c = 0;
    report.hourlyActivities.forEach(h => {
      s += h.sleepMinutes;
      a += h.awakeMinutes;
      c += h.cryingMinutes;
    });
    return calculateSegments(s, a, c);
  }, [report]);

  const goDay = (dir: -1 | 1) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    const next = d.toISOString().split('T')[0];
    if (next <= new Date().toISOString().split('T')[0]) setSelectedDate(next);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#1D9E75']} />
        }
      >
        <Text style={styles.title}>Laporan Harian </Text>

        {/* Date Picker */}
        <View style={styles.datePicker}>
          <TouchableOpacity onPress={() => goDay(-1)} style={styles.dateBtn}>
            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5"><Path d="M15 18l-6-6 6-6" /></Svg>
          </TouchableOpacity>
          <View style={styles.dateCenter}>
            <Text style={styles.dateText}>
              {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity onPress={() => goDay(1)} style={styles.dateBtn} disabled={selectedDate === new Date().toISOString().split('T')[0]}>
            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={selectedDate === new Date().toISOString().split('T')[0] ? "#D1D5DB" : "#1D9E75"} strokeWidth="2.5"><Path d="M9 18l6-6-6-6" /></Svg>
          </TouchableOpacity>
        </View>

        {/* Ringkasan Makro Harian - Stacked Bar 100% */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Alokasi Aktivitas Harian (100%)</Text>
          <View style={styles.stackedBarContainer}>
            <View style={styles.macroTrack}>
              {dailyMacro.sP > 0 && <View style={[styles.macroSeg, { flex: dailyMacro.sP, backgroundColor: '#1D9E75' }]} />}
              {dailyMacro.aP > 0 && <View style={[styles.macroSeg, { flex: dailyMacro.aP, backgroundColor: '#EF9F27' }]} />}
              {dailyMacro.cP > 0 && <View style={[styles.macroSeg, { flex: dailyMacro.cP, backgroundColor: '#E24B4A' }]} />}
            </View>
            <View style={styles.macroLegend}>
              <LegendItem label="Tidur" color="#1D9E75" pct={dailyMacro.sP} />
              <LegendItem label="Bangun" color="#EF9F27" pct={dailyMacro.aP} />
              <LegendItem label="Menangis" color="#E24B4A" pct={dailyMacro.cP} />
            </View>
          </View>
        </View>

        {/* KARTU TOTAL WAJAH TIDAK TERDETEKSI (DUMMY METRIC) */}
        <View style={styles.anomalyCard}>
          <View style={styles.anomalyHeader}>
            <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
              <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </Svg>
            <Text style={styles.anomalyTitle}>Keamanan Visual</Text>
          </View>
          <Text style={styles.anomalyValue}>
            {report.totalFaceCoveredEvents} <Text style={styles.anomalyUnit}>Insiden Wajah Tak Terdeteksi</Text>
          </Text>
        </View>

        {/* Grafik Distribusi Gabungan Per Jam (00 - 24) */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Analisis Distribusi per Jam (00:00 - 24:00)</Text>
          {report.hourlyActivities.map((h) => {
            const segments = calculateSegments(h.sleepMinutes, h.awakeMinutes, h.cryingMinutes);
            return (
              <View key={h.hour} style={styles.hourlyBlock}>
                <View style={styles.hourlyRow}>
                  <Text style={styles.hourLabel}>{h.hour.toString().padStart(2, '0')}:00</Text>
                  <View style={styles.hourlyTrack}>
                    {segments.sP > 0 && <View style={[styles.barSeg, { flex: segments.sP, backgroundColor: '#1D9E75' }]} />}
                    {segments.aP > 0 && <View style={[styles.barSeg, { flex: segments.aP, backgroundColor: '#EF9F27' }]} />}
                    {segments.cP > 0 && <View style={[styles.barSeg, { flex: segments.cP, backgroundColor: '#E24B4A' }]} />}
                  </View>
                  <Text style={styles.hourTotal}>100%</Text>
                </View>
                
                {/* Tanda Anomali di Bawah Jam Jika Wajah Hilang */}
                {h.faceCovered > 0 && (
                  <View style={styles.anomalyIndicator}>
                    <View style={styles.anomalyDot} />
                    <Text style={styles.anomalyText}>Terdeteksi wajah tertutup/hilang {h.faceCovered}x pada jam ini</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LegendItem({ label, color, pct }: { label: string; color: string; pct: number }) {
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
  safe: { flex: 1, backgroundColor: '#F0F9F5' },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#085041' },
  datePicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 8, elevation: 1 },
  dateBtn: { padding: 8 },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  centerBox: { alignItems: 'center', paddingVertical: 80 },
  loadingText: { marginTop: 12, color: '#6B7280' },
  errorText: { marginTop: 12, color: '#6B7280', textAlign: 'center' },
  chartCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 16, elevation: 1 },
  chartTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  stackedBarContainer: { gap: 12 },
  macroTrack: { height: 32, borderRadius: 8, flexDirection: 'row', overflow: 'hidden', backgroundColor: '#F3F4F6' },
  macroSeg: { height: '100%' },
  macroLegend: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#6B7280' },
  legendPct: { fontWeight: '700', color: '#374151' },
  hourlyBlock: { marginVertical: 6, gap: 4 },
  hourlyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hourLabel: { fontSize: 11, color: '#9CA3AF', width: 35, fontWeight: '600' },
  hourlyTrack: { flex: 1, height: 14, borderRadius: 7, flexDirection: 'row', overflow: 'hidden', backgroundColor: '#F3F4F6' },
  barSeg: { height: '100%' },
  hourTotal: { fontSize: 11, color: '#9CA3AF', width: 32, textAlign: 'right', fontWeight: '600' },
  anomalyCard: { backgroundColor: '#F5F3FF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#DDD6FE', elevation: 1 },
  anomalyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  anomalyTitle: { fontSize: 12, fontWeight: '600', color: '#7C3AED', textTransform: 'uppercase' },
  anomalyValue: { fontSize: 24, fontWeight: '800', color: '#5B21B6' },
  anomalyUnit: { fontSize: 12, fontWeight: '500', color: '#7C3AED' },
  anomalyIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 45 },
  anomalyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7C3AED' },
  anomalyText: { fontSize: 10, color: '#7C3AED', fontWeight: '600' },
});