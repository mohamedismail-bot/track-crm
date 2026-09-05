import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "../api";
import { colors, formatDate, formatMoney } from "../theme";
import type { DashboardStats } from "@track-crm/shared";

const EMPTY: DashboardStats = {
  totalContacts: 0,
  activeDeals: 0,
  pipelineValue: 0,
  wonDeals: 0,
  recentActivities: [],
  contactsByStage: [],
  dealsByStage: [],
};

const stageColors: Record<string, string> = {
  lead: "#9ca3af",
  qualified: "#3b82f6",
  proposal: "#f59e0b",
  negotiation: "#8b5cf6",
  won: "#22c55e",
  lost: "#f87171",
};

function Loading() {
  return (
    <View style={styles.center}>
      <Text style={styles.muted}>Loading dashboard…</Text>
    </View>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.error}>{message}</Text>
      <Text style={styles.muted}>Is the API running on localhost:4000?</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.stats();
      setStats(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} />;

  const pipelineMax = Math.max(
    ...stats.dealsByStage.map((d) => d.value),
    1,
  );

  const cards = [
    { label: "Contacts", value: stats.totalContacts },
    { label: "Active Deals", value: stats.activeDeals },
    { label: "Pipeline", value: formatMoney(stats.pipelineValue) },
    { label: "Won", value: stats.wonDeals },
  ];

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={stats.recentActivities}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
      }
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Dashboard</Text>
          <View style={styles.cardsRow}>
            {cards.map((c) => (
              <View key={c.label} style={styles.card}>
                <Text style={styles.cardLabel}>{c.label}</Text>
                <Text style={styles.cardValue}>{c.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pipeline by Stage</Text>
            {stats.dealsByStage.length === 0 ? (
              <Text style={styles.muted}>No deals yet.</Text>
            ) : (
              stats.dealsByStage.map((d) => (
                <View key={d.stage} style={styles.pipelineRow}>
                  <View style={styles.pipelineTop}>
                    <Text style={styles.pipelineStage}>
                      {d.stage.charAt(0).toUpperCase() + d.stage.slice(1)}
                    </Text>
                    <Text style={styles.pipelineValue}>{formatMoney(d.value)}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${(d.value / pipelineMax) * 100}%`,
                          backgroundColor: stageColors[d.stage] ?? "#9ca3af",
                        },
                      ]}
                    />
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </>
      }
      ListEmptyComponent={
        <Text style={styles.muted}>No recent activity.</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.activityRow}>
          <Text style={styles.activityType}>{item.type}</Text>
          <View style={styles.activityBody}>
            <Text style={styles.activitySubject} numberOfLines={1}>
              {item.subject}
            </Text>
            <Text style={styles.muted}>
              {item.contactName} · {formatDate(item.createdAt)}
            </Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: 20 },
  title: { fontSize: 26, fontWeight: "700", color: colors.text },
  cardsRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16, justifyContent: "space-between" },
  card: { flexBasis: "47%", backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardLabel: { fontSize: 13, color: colors.textMuted },
  cardValue: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 4 },
  section: { marginTop: 20, backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginTop: 20, marginBottom: 4 },
  pipelineRow: { marginTop: 10 },
  pipelineTop: { flexDirection: "row", justifyContent: "space-between" },
  pipelineStage: { fontSize: 13, color: colors.textMuted, textTransform: "capitalize" },
  pipelineValue: { fontSize: 13, fontWeight: "600", color: colors.text },
  barTrack: { height: 8, backgroundColor: "#f3f4f6", borderRadius: 4, marginTop: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  activityRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginTop: 8, gap: 10 },
  activityType: { backgroundColor: "#f3f4f6", color: colors.textMuted, fontSize: 11, textTransform: "capitalize", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  activityBody: { flex: 1 },
  activitySubject: { fontSize: 14, fontWeight: "600", color: colors.text },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  error: { color: colors.danger, fontSize: 15, textAlign: "center", marginBottom: 6 },
});