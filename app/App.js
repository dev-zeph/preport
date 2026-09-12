import { useState, useRef, useEffect } from "react";
import {
  View, Text, Pressable, ScrollView, TextInput, Image,
  ActivityIndicator, StyleSheet, SafeAreaView, Animated, Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  useAudioRecorder, RecordingPresets, setAudioModeAsync, AudioModule,
} from "expo-audio";
import * as Speech from "expo-speech";
import * as ImagePicker from "expo-image-picker";

import { C, CATEGORY_LABELS } from "./lib/theme";
import * as api from "./lib/api";

const CATEGORIES = Object.keys(CATEGORY_LABELS);
const SEVERITIES = ["low", "medium", "high"];

export default function App() {
  const [phase, setPhase] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState(null);
  const [report, setReport] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [sentId, setSentId] = useState(null);
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (phase !== "recording") return pulse.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  // Errors are shown on screen, never swallowed. A silent failure on stage is
  // undebuggable; a visible one can be read off the phone.
  const boom = (e) => {
    console.error(e);
    setError(String(e.message ?? e));
    setPhase("error");
  };

  const reset = () => {
    Speech.stop();
    setMessages([]); setQuestion(null); setReport(null);
    setPhotoUri(null); setSentId(null); setError(null);
    setDraft(""); setTyping(false); setPhase("idle");
  };

  async function startRecording() {
    try {
      setError(null);
      Speech.stop();
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        return boom(new Error(
          "Microphone permission denied. Enable it in Settings, or use Type instead."
        ));
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase("recording");
    } catch (e) { boom(e); }
  }

  async function stopAndSend() {
    try {
      setPhase("transcribing");
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("No audio was captured. Try again, or use Type instead.");
      const text = await api.transcribe(uri);
      if (!text?.trim()) {
        throw new Error("Nothing was heard. Speak a little closer, or use Type instead.");
      }
      await advance([...messages, { role: "user", content: text }]);
    } catch (e) { boom(e); }
  }

  async function sendTyped() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setTyping(false);
    try {
      await advance([...messages, { role: "user", content: text }]);
    } catch (e) { boom(e); }
  }

  /** One turn of the loop. Claude either asks once more or files the report. */
  async function advance(next) {
    setMessages(next);
    setPhase("thinking");
    const out = await api.converse(next);

    if (out.type === "question") {
      setQuestion(out.question);
      setMessages([...next, { role: "assistant", content: out.question }]);
      setPhase("question");
      // Spoken and shown. Some rooms are loud, and some users are deaf.
      Speech.speak(out.question, { rate: 0.98 });
      return;
    }
    setReport(out.report);
    setPhase(out.report.photo_helpful ? "photo" : "review");
  }

  async function takePhoto() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera permission denied", "You can still send the report without a photo.");
        return setPhase("review");
      }
      // quality 0.5 matters: a full resolution phone photo stalls the upload.
      const r = await ImagePicker.launchCameraAsync({ quality: 0.5 });
      if (!r.canceled) setPhotoUri(r.assets[0].uri);
      setPhase("review");
    } catch (e) { boom(e); }
  }

  async function send() {
    try {
      setPhase("sending");
      const { id } = await api.createReport({
        ...report,
        source: messages.some((m) => m.role === "user") && !typing ? "voice" : "text",
        transcript: messages.map((m) => ({ role: m.role, text: m.content })),
      });
      if (photoUri) {
        try { await api.uploadPhoto(id, photoUri); }
        catch (e) { console.warn("photo upload failed, report still filed:", e.message); }
      }
      setSentId(id);
      setPhase("sent");
    } catch (e) { boom(e); }
  }

  const setField = (k, v) => setReport((r) => ({ ...r, [k]: v }));

  // ---- screens ---------------------------------------------------------
  if (phase === "sent") {
    return (
      <Shell>
        <View style={s.center}>
          <Text style={s.bigGlyph}>✓</Text>
          <Text style={s.h1}>Report sent</Text>
          <Text style={s.ref}>{sentId}</Text>
          <Text style={s.body}>
            It is on the Public Works board now. Crews triage by severity and location.
          </Text>
          <Primary label="Report another" onPress={reset} />
        </View>
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell>
        <View style={s.center}>
          <Text style={[s.bigGlyph, { color: C.danger }]}>!</Text>
          <Text style={s.h1}>Something broke</Text>
          <Text style={[s.body, { color: C.danger }]} selectable>{error}</Text>
          <Text style={[s.body, { fontSize: 12 }]}>Server: {api.API}</Text>
          <Primary label="Try again" onPress={reset} />
          <Pressable onPress={() => { setError(null); setTyping(true); setPhase("idle"); }}>
            <Text style={s.link}>Type instead</Text>
          </Pressable>
        </View>
      </Shell>
    );
  }

  if (phase === "photo") {
    return (
      <Shell>
        <View style={s.center}>
          <Text style={s.h1}>A photo would help</Text>
          <Text style={s.body}>
            Crews size the job from the picture. It is optional.
          </Text>
          <Primary label="Take photo" onPress={takePhoto} />
          <Secondary label="Skip" onPress={() => setPhase("review")} />
        </View>
      </Shell>
    );
  }

  if (phase === "review" || phase === "sending") {
    return (
      <Shell>
        <ScrollView contentContainerStyle={s.pad}>
          <Text style={s.h1}>Check this over</Text>
          <Text style={s.body}>Edit anything that is wrong, then send.</Text>

          {photoUri && <Image source={{ uri: photoUri }} style={s.photo} />}

          <Field label="Where">
            <TextInput
              style={s.input} value={report.location_text} multiline
              onChangeText={(v) => setField("location_text", v)}
              placeholderTextColor={C.dim}
            />
          </Field>

          <Field label="What">
            <View style={s.chips}>
              {CATEGORIES.map((c) => (
                <Chip key={c} on={report.category === c} label={CATEGORY_LABELS[c]}
                      onPress={() => setField("category", c)} />
              ))}
            </View>
          </Field>

          <Field label="Severity">
            <View style={s.chips}>
              {SEVERITIES.map((v) => (
                <Chip key={v} on={report.severity === v} label={v}
                      onPress={() => setField("severity", v)} />
              ))}
            </View>
          </Field>

          <Field label="Detail">
            <TextInput
              style={[s.input, { minHeight: 88 }]} value={report.description} multiline
              onChangeText={(v) => setField("description", v)}
            />
          </Field>

          <Pressable style={s.riskRow} onPress={() => setField("safety_risk", !report.safety_risk)}>
            <View style={[s.box, report.safety_risk && s.boxOn]}>
              {report.safety_risk && <Text style={s.boxTick}>✓</Text>}
            </View>
            <Text style={s.body}>Someone could get hurt</Text>
          </Pressable>

          {phase === "sending"
            ? <View style={s.sending}><ActivityIndicator color={C.accent} /><Text style={s.body}>Sending</Text></View>
            : <Primary label="Send report" onPress={send} />}
          <Secondary label="Start over" onPress={reset} />
        </ScrollView>
      </Shell>
    );
  }

  // idle / recording / transcribing / thinking / question
  const label = {
    idle: "Tap and tell us what is wrong",
    recording: "Listening. Tap to stop.",
    transcribing: "Writing that down",
    thinking: "Working it out",
    question: question,
  }[phase];

  const busy = phase === "transcribing" || phase === "thinking";

  return (
    <Shell>
      <View style={s.center}>
        <Text style={s.brand}>Repoth</Text>
        <Text style={s.sub}>Halifax Regional Municipality</Text>

        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Pressable
            onPress={
              phase === "idle" || phase === "question" ? startRecording
              : phase === "recording" ? stopAndSend
              : undefined
            }
            style={[
              s.orb,
              phase === "recording" && { backgroundColor: C.danger, borderColor: C.danger },
              busy && { opacity: 0.55 },
            ]}
          >
            {busy
              ? <ActivityIndicator size="large" color={C.text} />
              : <Text style={s.orbGlyph}>{phase === "recording" ? "■" : "◉"}</Text>}
          </Pressable>
        </Animated.View>

        <Text style={[s.prompt, phase === "question" && { color: C.warn }]}>{label}</Text>

        {messages.length > 0 && (
          <ScrollView style={s.log} contentContainerStyle={{ gap: 8 }}>
            {messages.map((m, i) => (
              <Text key={i} style={m.role === "user" ? s.you : s.them}>
                {m.role === "user" ? "You: " : "Repoth: "}{m.content}
              </Text>
            ))}
          </ScrollView>
        )}

        {typing ? (
          <View style={s.typeRow}>
            <TextInput
              style={[s.input, { flex: 1 }]} value={draft} onChangeText={setDraft}
              placeholder="Describe the problem" placeholderTextColor={C.dim}
              multiline autoFocus onSubmitEditing={sendTyped}
            />
            <Pressable style={s.send} onPress={sendTyped}><Text style={s.sendText}>Send</Text></Pressable>
          </View>
        ) : (
          !busy && (
            <Pressable onPress={() => setTyping(true)}>
              <Text style={s.link}>Type instead</Text>
            </Pressable>
          )
        )}
      </View>
    </Shell>
  );
}

// ---- small pieces ------------------------------------------------------
const Shell = ({ children }) => (
  <SafeAreaView style={s.shell}><StatusBar style="light" />{children}</SafeAreaView>
);
const Primary = ({ label, onPress }) => (
  <Pressable style={s.primary} onPress={onPress}><Text style={s.primaryText}>{label}</Text></Pressable>
);
const Secondary = ({ label, onPress }) => (
  <Pressable style={s.secondary} onPress={onPress}><Text style={s.secondaryText}>{label}</Text></Pressable>
);
const Field = ({ label, children }) => (
  <View style={{ marginTop: 18 }}><Text style={s.fieldLabel}>{label}</Text>{children}</View>
);
const Chip = ({ on, label, onPress }) => (
  <Pressable style={[s.chip, on && s.chipOn]} onPress={onPress}>
    <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
  </Pressable>
);

const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  pad: { padding: 24, paddingBottom: 60 },
  brand: { color: C.text, fontSize: 30, fontWeight: "700", letterSpacing: -0.5 },
  sub: { color: C.dim, fontSize: 13, marginTop: -8, marginBottom: 18 },
  orb: {
    width: 168, height: 168, borderRadius: 84, backgroundColor: C.card,
    borderWidth: 2, borderColor: C.accent, alignItems: "center", justifyContent: "center",
  },
  orbGlyph: { color: C.text, fontSize: 52 },
  prompt: { color: C.text, fontSize: 19, textAlign: "center", marginTop: 18, lineHeight: 26 },
  log: { maxHeight: 150, alignSelf: "stretch", marginTop: 6 },
  you: { color: C.text, fontSize: 14 },
  them: { color: C.dim, fontSize: 14, fontStyle: "italic" },
  link: { color: C.accent, fontSize: 15, padding: 12, textDecorationLine: "underline" },
  h1: { color: C.text, fontSize: 25, fontWeight: "700" },
  body: { color: C.dim, fontSize: 15, textAlign: "center", lineHeight: 22 },
  ref: { color: C.accent, fontFamily: "Courier", fontSize: 14 },
  bigGlyph: { color: C.good, fontSize: 60, fontWeight: "700" },
  primary: {
    backgroundColor: C.accent, paddingVertical: 16, paddingHorizontal: 34,
    borderRadius: 14, marginTop: 18, alignSelf: "stretch",
  },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "600", textAlign: "center" },
  secondary: { paddingVertical: 14, marginTop: 4 },
  secondaryText: { color: C.dim, fontSize: 15, textAlign: "center" },
  fieldLabel: { color: C.dim, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  input: {
    backgroundColor: C.card, color: C.text, borderRadius: 12, padding: 14,
    fontSize: 16, borderWidth: 1, borderColor: C.line,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 9, paddingHorizontal: 13, borderRadius: 999,
    borderWidth: 1, borderColor: C.line, backgroundColor: C.card,
  },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.dim, fontSize: 14 },
  chipTextOn: { color: "#fff", fontWeight: "600" },
  photo: { width: "100%", height: 210, borderRadius: 12, marginTop: 16 },
  riskRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20 },
  box: {
    width: 26, height: 26, borderRadius: 7, borderWidth: 1,
    borderColor: C.line, backgroundColor: C.card, alignItems: "center", justifyContent: "center",
  },
  boxOn: { backgroundColor: C.warn, borderColor: C.warn },
  boxTick: { color: "#000", fontWeight: "700" },
  sending: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", marginTop: 24 },
  typeRow: { flexDirection: "row", gap: 8, alignSelf: "stretch", alignItems: "flex-end", marginTop: 10 },
  send: { backgroundColor: C.accent, paddingVertical: 15, paddingHorizontal: 18, borderRadius: 12 },
  sendText: { color: "#fff", fontWeight: "600" },
});
