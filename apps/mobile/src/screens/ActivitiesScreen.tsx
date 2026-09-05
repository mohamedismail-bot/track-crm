import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../api";
import { colors, formatDate } from "../theme";
import { ACTIVITY_TYPES, type Activity, type Contact } from "@track-crm/shared";

interface ActivityWithContact extends Activity {
  contactName: string;
}

const typeIcon: Record<string, string> = {
  call: "📞",
  email: "✉️",
  meeting: "🤝",
  note: "📝",
  task: "✅",
};

const emptyForm = {
  contactId: "",
  type: "note" as Activity["type"],
  subject: "",
};

export default function ActivitiesScreen() {
  const [activities, setActivities] = useState<ActivityWithContact[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([api.activities.list(), api.contacts.list()]);
      setActivities(a as unknown as ActivityWithContact[]);
      setContacts(c);
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

  const save = async () => {
    if (!form.subject.trim() || !form.contactId) return;
    setSaving(true);
    try {
      await api.activities.create({
        contactId: form.contactId,
        type: form.type,
        subject: form.subject,
        description: null,
      });
      setForm({ ...emptyForm, contactId: form.contactId });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={activities}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
        />
      }
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Activities</Text>
          <Text style={[styles.muted, { marginBottom: 16 }]}>
            Calls, emails, meetings, notes, and tasks
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Log an activity</Text>
            {contacts.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setForm({ ...form, contactId: c.id })}
                style={[styles.pill, form.contactId === c.id && styles.pillSelected]}
              >
                <Text style={[styles.pillText, form.contactId === c.id && { color: colors.primary }]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.typeRow}>
              {ACTIVITY_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setForm({ ...form, type: t })}
                  style={[styles.pill, form.type === t && styles.pillSelected]}
                >
                  <Text style={[styles.pillText, form.type === t && { color: colors.primary, fontWeight: "600" }]}>
                    {typeIcon[t]} {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={form.subject}
              onChangeText={(t) => setForm({ ...form, subject: t })}
              placeholder="What happened? *"
            />
            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.5 }]}
              onPress={save}
              disabled={saving || !form.subject.trim() || !form.contactId}
            >
              <Text style={styles.saveText}>{saving ? "Adding…" : "Add activity"}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Recent</Text>
        </>
      }
      ListEmptyComponent={
        error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.muted}>No activity yet.</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.icon}>{typeIcon[item.type] ?? "•"}</Text>
          <View style={styles.rowBody}>
            <Text style={styles.subject}>{item.subject}</Text>
            <Text style={styles.muted}>
              {item.contactName} · {item.type}
            </Text>
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  title: { fontSize: 26, fontWeight: "700", color: colors.text },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  error: { color: colors.danger, fontSize: 15, textAlign: "center", marginVertical: 20 },
  formCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 4 },
  formTitle: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 8 },
  pill: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
  pillSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  pillText: { fontSize: 13, color: colors.textMuted, textTransform: "capitalize" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 8 },
  saveButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 10 },
  saveText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginTop: 20, marginBottom: 6 },
  row: { flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8, alignItems: "center", gap: 12 },
  icon: { fontSize: 20 },
  rowBody: { flex: 1 },
  subject: { fontSize: 14, fontWeight: "600", color: colors.text },
  date: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
});