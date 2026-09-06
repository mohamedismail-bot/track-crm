import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../api";
import { colors, formatDate, formatMoney } from "../theme";
import { DEAL_STAGES, type Contact, type Deal } from "@parishia-smart/shared";

interface DealWithContact extends Deal {
  contactName: string;
}

const stageMeta: Record<string, { bg: string; text: string }> = {
  lead: { bg: "#f3f4f6", text: colors.text },
  qualified: { bg: "#dbeafe", text: "#1d4ed8" },
  proposal: { bg: "#fef3c7", text: "#b45309" },
  negotiation: { bg: "#ede9fe", text: "#7c3aed" },
  won: { bg: "#dcfce7", text: "#15803d" },
  lost: { bg: "#fee2e2", text: "#b91c1c" },
};

const emptyDeal = {
  name: "",
  contactId: "",
  amount: "",
  stage: "lead" as Deal["stage"],
  expectedCloseDate: "",
};

export default function DealsScreen() {
  const [deals, setDeals] = useState<DealWithContact[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DealWithContact | null>(null);
  const [form, setForm] = useState(emptyDeal);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([api.deals.list(), api.contacts.list()]);
      setDeals(d as unknown as DealWithContact[]);
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

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyDeal, contactId: contacts[0]?.id ?? "" });
    setShowForm(true);
  };

  const openEdit = (d: DealWithContact) => {
    setEditing(d);
    setForm({
      name: d.name,
      contactId: d.contactId,
      amount: String(d.amount),
      stage: d.stage,
      expectedCloseDate: d.expectedCloseDate ? d.expectedCloseDate.slice(0, 10) : "",
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.contactId) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        contactId: form.contactId,
        amount: Number(form.amount) || 0,
        stage: form.stage,
        expectedCloseDate: form.expectedCloseDate || null,
      };
      if (editing) {
        await api.deals.update(editing.id, payload);
      } else {
        await api.deals.create(payload);
      }
      setShowForm(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const moveStage = async (deal: DealWithContact, delta: number) => {
    const idx = DEAL_STAGES.indexOf(deal.stage);
    const next = DEAL_STAGES[idx + delta];
    if (!next) return;
    try {
      await api.deals.update(deal.id, { stage: next });
      setDeals((prev) =>
        prev.map((d) => (d.id === deal.id ? { ...d, stage: next } : d)),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading deals…</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={deals}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Deals</Text>
              <Text style={styles.muted}>
                {deals.length} deals ·{" "}
                {formatMoney(deals.reduce((s, d) => s + d.amount, 0))}
              </Text>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={openCreate}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.muted}>No deals yet.</Text>
        }
        renderItem={({ item }) => {
          const meta = stageMeta[item.stage] ?? stageMeta.lead;
          return (
            <View style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.dealName}>{item.name}</Text>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.badgeText, { color: meta.text }]}>
                    {item.stage}
                  </Text>
                </View>
              </View>
              <Text style={styles.muted}>
                {item.contactName} · closes {formatDate(item.expectedCloseDate)}
              </Text>
              <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
              <View style={styles.rowActions}>
                <View style={styles.stageNav}>
                  <TouchableOpacity
                    style={styles.stageButton}
                    onPress={() => moveStage(item, -1)}
                    disabled={DEAL_STAGES.indexOf(item.stage) === 0}
                  >
                    <Text style={styles.stageButtonText}>←</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stageButton}
                    onPress={() => moveStage(item, 1)}
                    disabled={DEAL_STAGES.indexOf(item.stage) === DEAL_STAGES.length - 1}
                  >
                    <Text style={styles.stageButtonText}>→</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.editRow}>
                  <TouchableOpacity onPress={() => openEdit(item)}>
                    <Text style={styles.edit}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      api.deals.remove(item.id).then(load).catch((e) => setError((e as Error).message))
                    }
                  >
                    <Text style={styles.delete}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {editing ? "Edit deal" : "New deal"}
            </Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(t) => setForm({ ...form, name: t })}
              placeholder="Deal name *"
            />
            {contacts.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setForm({ ...form, contactId: c.id })}
                style={[
                  styles.contactOption,
                  form.contactId === c.id && styles.contactOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.muted,
                    form.contactId === c.id && { color: colors.primary, fontWeight: "600" },
                  ]}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={styles.input}
              value={form.amount}
              onChangeText={(t) => setForm({ ...form, amount: t })}
              placeholder="Amount"
              keyboardType="numeric"
              returnKeyType="done"
            />
            <TextInput
              style={styles.input}
              value={form.expectedCloseDate}
              onChangeText={(t) => setForm({ ...form, expectedCloseDate: t })}
              placeholder="Close date (YYYY-MM-DD)"
              autoCapitalize="none"
            />
            <View style={styles.stageRow}>
              {DEAL_STAGES.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setForm({ ...form, stage: s })}
                  style={[styles.stageOption, form.stage === s && styles.stageOptionSelected]}
                >
                  <Text
                    style={[
                      styles.stageOptionText,
                      form.stage === s && { color: colors.primary, fontWeight: "600" },
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.5 }]}
                onPress={save}
                disabled={saving || !form.name.trim() || !form.contactId}
              >
                <Text style={styles.saveText}>{saving ? "Saving…" : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 26, fontWeight: "700", color: colors.text },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  error: { color: colors.danger, fontSize: 15, textAlign: "center", marginVertical: 20 },
  addButton: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  row: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  dealName: { fontSize: 16, fontWeight: "600", color: colors.text },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, textTransform: "capitalize", fontWeight: "600" },
  amount: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 6 },
  rowActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  stageNav: { flexDirection: "row", gap: 8 },
  stageButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  stageButtonText: { color: colors.textMuted, fontSize: 14 },
  editRow: { flexDirection: "row", gap: 14 },
  edit: { color: colors.primary, fontWeight: "600", fontSize: 14 },
  delete: { color: colors.danger, fontWeight: "600", fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 },
  modal: { backgroundColor: "#fff", borderRadius: 16, padding: 20, maxHeight: "85%" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 14 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 10 },
  contactOption: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6 },
  contactOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  stageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  stageOption: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  stageOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  stageOptionText: { fontSize: 13, color: colors.textMuted, textTransform: "capitalize" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  cancelButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  cancelText: { color: colors.textMuted, fontWeight: "600", fontSize: 15 },
  saveButton: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  saveText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});