import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../api";
import { colors, formatDate } from "../theme";
import { CONTACT_STATUSES, type Contact } from "@parishia-smart/shared";

const statusColors: Record<string, string> = {
  lead: "#f3f4f6",
  prospect: "#dbeafe",
  customer: "#dcfce7",
  inactive: "#fee2e2",
};

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  title: "",
  status: "lead" as Contact["status"],
  notes: "",
};

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.contacts.list();
      setContacts(data);
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
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      company: c.company ?? "",
      title: c.title ?? "",
      status: c.status,
      notes: c.notes ?? "",
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        company: form.company || null,
        title: form.title || null,
        status: form.status,
        notes: form.notes || null,
      };
      if (editing) {
        await api.contacts.update(editing.id, payload);
      } else {
        await api.contacts.create(payload);
      }
      setShowForm(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Contact) => {
    await api.contacts
      .remove(c.id)
      .then(load)
      .catch((e) => setError((e as Error).message));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={contacts}
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
              <Text style={styles.title}>Contacts</Text>
              <Text style={styles.muted}>{contacts.length} contacts</Text>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={openCreate}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.muted}>No contacts.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.muted}>
                {[item.company, item.email].filter(Boolean).join(" · ") || "—"}
              </Text>
              <Text style={styles.muted}>Updated {formatDate(item.updatedAt)}</Text>
            </View>
            <View style={styles.rowActions}>
              <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] }]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
              <TouchableOpacity onPress={() => openEdit(item)}>
                <Text style={styles.edit}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove(item)}>
                <Text style={styles.delete}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {editing ? "Edit contact" : "New contact"}
            </Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(t) => setForm({ ...form, name: t })}
              placeholder="Name *"
            />
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(t) => setForm({ ...form, email: t })}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(t) => setForm({ ...form, phone: t })}
              placeholder="Phone"
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              value={form.company}
              onChangeText={(t) => setForm({ ...form, company: t })}
              placeholder="Company"
            />
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(t) => setForm({ ...form, title: t })}
              placeholder="Title"
            />
            <View style={styles.statusRow}>
              {CONTACT_STATUSES.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setForm({ ...form, status: s })}
                  style={[
                    styles.statusOption,
                    form.status === s && styles.statusOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusOptionText,
                      form.status === s && { color: colors.primary, fontWeight: "600" },
                    ]}
                  >
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.input, styles.notes]}
              value={form.notes}
              onChangeText={(t) => setForm({ ...form, notes: t })}
              placeholder="Notes"
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.5 }]}
                onPress={save}
                disabled={saving || !form.name.trim()}
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
  row: { flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10, alignItems: "center", gap: 10 },
  rowBody: { flex: 1 },
  name: { fontSize: 16, fontWeight: "600", color: colors.text },
  rowActions: { alignItems: "flex-end", gap: 6 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 12, textTransform: "capitalize", color: colors.text },
  edit: { color: colors.primary, fontWeight: "600", fontSize: 14 },
  delete: { color: colors.danger, fontWeight: "600", fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 },
  modal: { backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 14 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 10 },
  notes: { minHeight: 70, textAlignVertical: "top" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  statusOption: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statusOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  statusOptionText: { fontSize: 13, color: colors.textMuted, textTransform: "capitalize" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  cancelButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  cancelText: { color: colors.textMuted, fontWeight: "600", fontSize: 15 },
  saveButton: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  saveText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});