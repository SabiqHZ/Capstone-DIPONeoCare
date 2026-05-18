import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';

// --- Komponen SVG ---
const HomeIcon = ({ color = "#9CA3AF", size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Polyline points="9 22 9 12 15 12 15 22" />
  </Svg>
);

const CameraIcon = ({ color = "#9CA3AF", size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <Circle cx="12" cy="13" r="4" />
  </Svg>
);

const ReportIcon = ({ color = "#9CA3AF", size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="18" y1="20" x2="18" y2="10" />
    <Line x1="12" y1="20" x2="12" y2="4" />
    <Line x1="6" y1="20" x2="6" y2="14" />
  </Svg>
);
// --------------------

function TabIcon({
  IconComponent,
  label,
  focused,
}: {
  IconComponent: React.ElementType;
  label: string;
  focused: boolean;
}) {
  const iconColor = focused ? '#1D9E75' : '#9CA3AF';

  return (
    <View style={styles.tabItem}>
      <IconComponent color={iconColor} size={24} />
      <Text 
        numberOfLines={1} 
        style={[styles.label, focused ? styles.labelActive : null]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function ParentLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: 72,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon IconComponent={HomeIcon} label="Dashboard" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon IconComponent={CameraIcon} label="Kamera" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon IconComponent={ReportIcon} label="Laporan" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
    minWidth: 80, // Memastikan kontainer memiliki lebar minimal agar teks tidak tergencet
  },
  label: { 
    fontSize: 10, // Sedikit disesuaikan agar lebih proporsional jika tidak terlipat
    color: '#9CA3AF', 
    fontWeight: '500',
  },
  labelActive: { 
    color: '#1D9E75', 
    fontWeight: '700' 
  },
});