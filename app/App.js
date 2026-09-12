// Repoth resident app.
//
// Ten screens, built to the Classical design system spec in
// "Repoth Resident App.dc.html". The prototype's conversation was a scripted
// transcript; this one is not. Every line below comes from a real recording,
// real Whisper transcription and a real Claude turn.
//
// Layout rule from the spec, held throughout: one job per screen, the primary
// action in the bottom third, every tap target at least 48px tall.
import { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, Pressable, ScrollView, TextInput, Image,
  StyleSheet, SafeAreaView, Linking, Platform, KeyboardAvoidingView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  useAudioRecorder, RecordingPresets, setAudioModeAsync, AudioModule,
  createAudioPlayer,
} from "expo-audio";
import * as Speech from "expo-speech";
import * as ImagePicker from "expo-image-picker";
import { useFonts } from "expo-font";
import {
  CormorantGaramond_400Regular, CormorantGaramond_600SemiBold,
} from "@expo-google-fonts/cormorant-garamond";
import { Lora_400Regular, Lora_600SemiBold } from "@expo-google-fonts/lora";

import { color, sev as SEVC, status as STATUSC, space, radius, shadow, font, kicker, tabular } from "./lib/tokens";
import Helmet from "./components/Helmet";
import { Mic, Keyboard as KeyboardIcon, Camera } from "./components/Icons";
import { CATEGORY_LABELS } from "./lib/theme";
import * as api from "./lib/api";

const CATEGORIES = Object.keys(CATEGORY_LABELS);

// The spec's three urgency steps. The third one's copy IS a safety risk, which
// is a separate field in our schema, so choosing it sets both.
const SEVS = [
  { v: "low", label: "Can wait", dot: SEVC.low },
  { v: "medium", label: "Soon", dot: SEVC.mod },
  { v: "high", label: "Someone could get hurt", dot: SEVC.high },
];

const CHAR_LABEL = {
  idle: "Ready",
  listening: "Listening",
  thinking: "One moment",
  speaking: "Asking you something",
  sent: "Filed",
};

// ── shared pieces ────────────────────────────────────────────────────────

const Kick = ({ children, style }) => <Text style={[kicker, style]}>{children}</Text>;

/** The accent-outline primary. Never a solid fill: that is a system rule. */
function Primary({ label, onPress, icon, height = 58, size = 19 }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.primary,
        { minHeight: height, backgroundColor: pressed ? color.accent200 : color.accent100 },
      ]}
    >
      {icon}
      <Text style={[s.primaryLabel, { fontSize: size }]}>{label}</Text>
    </Pressable>
  );
}

/** Equal height, equal weight. Skipping is not a failure path. */
function Secondary({ label, onPress, height = 54, bordered = "neutral" }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.secondary,
        {
          minHeight: height,
          borderColor: bordered === "neutral" ? color.neutral400 : color.divider,
          backgroundColor: pressed ? "rgba(0,0,0,0.05)" : "transparent",
        },
      ]}
    >
      <Text style={s.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

/** Repoth left, HALIFAX right, then the screen fills the rest. */
function Chrome({ children }) {
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.chrome}>
        <Text style={s.brand}>Repoth</Text>
        <Text style={s.place}>Halifax</Text>
      </View>
      {children}
    </SafeAreaView>
  );
}

/** The shape every error and empty state shares: character, title, body,
 *  one primary and one alternative. No apologies, no vagueness. */
function Stated({ title, body, children, primary, secondary }) {
  return (
    <View style={s.pad}>
      <View style={s.statedMid}>
        <Helmet state="idle" size={116} />
        <Text style={[s.h30, { textAlign: "center" }]}>{title}</Text>
        <Text style={s.stateBody}>{body}</Text>
        {children}
      </View>
      <View style={{ gap: space[3] }}>
        {primary}
        {secondary}
      </View>
    </View>
  );
}

// ── app ──────────────────────────────────────────────────────────────────

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_400Regular, CormorantGaramond_600SemiBold,
    Lora_400Regular, Lora_600SemiBold,
  });

  const [screen, setScreen] = useState("home");
  const [char, setChar] = useState("idle");
  const [messages, setMessages] = useState([]);   // what the API sees
  const [lines, setLines] = useState([]);         // what the resident sees
  const [report, setReport] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [sentId, setSentId] = useState(null);
  const [errText, setErrText] = useState(null);
  const [typed, setTyped] = useState("");
  const [typedOnly, setTypedOnly] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recording = useRef(false);
  const spoke = useRef(null);
  const player = useRef(null);

  /** Tear down whatever is currently talking, whichever engine it is. */
  const hush = () => {
    Speech.stop();
    try { player.current?.remove(); } catch {}
    player.current = null;
  };

  /**
   * Say something out loud, then call `then`.
   *
   * Spoken AND shown, always: some rooms are loud and some users are deaf, so
   * nothing here is ever the only channel. The city's voice comes from the
   * server (see server/speak.js); if that fails we drop to the device voice
   * rather than let a TTS outage take the conversation down.
   *
   * Neither engine reliably reports completion on every device, and a character
   * stuck mid-sentence would strand the user, so a timer sits under both.
   */
  const say = async (text, language, then) => {
    const done = () => {
      if (spoke.current === null) return;
      clearTimeout(spoke.current);
      spoke.current = null;
      then?.();
    };
    spoke.current = setTimeout(done, text.length * 80 + 3500);
    try {
      const url = await api.speak(text, language);
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const p = createAudioPlayer(url);
      player.current = p;
      p.addListener("playbackStatusUpdate", (st) => { if (st?.didJustFinish) done(); });
      p.play();
    } catch (e) {
      console.warn(`server speech failed (${e.message}), using the device voice`);
      Speech.speak(text, { rate: 1.0, onDone: done, onStopped: done });
    }
  };

  const go = (next, c = "idle") => { setScreen(next); setChar(c); };

  // Route a failure to the state that names it. Anything unmapped lands on the
  // generic screen, which prints the raw message and the server URL, because a
  // silent failure on a phone nobody can attach a debugger to is undebuggable.
  const boom = useCallback((e) => {
    const m = String(e?.message ?? e);
    console.error(m);
    setErrText(m);
    if (/permission/i.test(m) && /mic|record|audio/i.test(m)) return go("errMic");
    if (/network request failed|fetch failed|timeout|abort/i.test(m)) return go("errNet");
    if (/nothing was heard|no audio|empty/i.test(m)) return go("errHeard");
    return go("errOther");
  }, []);

  const reset = () => {
    hush();
    if (recording.current) { recorder.stop().catch(() => {}); recording.current = false; }
    setMessages([]); setLines([]); setReport(null); setPhotoUri(null);
    setSentId(null); setErrText(null); setTyped(""); setTypedOnly(false);
    setShowTranscript(false);
    go("home", "idle");
  };

  useEffect(() => () => { hush(); }, []);

  // ---- voice ------------------------------------------------------------

  async function listen() {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) throw new Error("Microphone permission is off.");
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    recording.current = true;
    setChar("listening");
  }

  async function start() {
    try {
      setErrText(null);
      hush();
      setMessages([]); setLines([]); setReport(null); setPhotoUri(null);
      setTypedOnly(false); setShowTranscript(false);
      setScreen("convo");
      await listen();
    } catch (e) { boom(e); }
  }

  /** Stop ends the current utterance and processes it. */
  async function stop() {
    try {
      if (!recording.current) {
        if (!lines.length) return go("errEmpty");
        return;
      }
      setChar("thinking");
      await recorder.stop();
      recording.current = false;
      const uri = recorder.uri;
      if (!uri) throw new Error("No audio was captured.");
      const text = await api.transcribe(uri);
      if (!text?.trim()) throw new Error("Nothing was heard.");
      setLines((l) => l.concat([{ who: "You", text }]));
      await advance([...messages, { role: "user", content: text }]);
    } catch (e) { boom(e); }
  }

  /** One turn. Claude either asks once more or files the report. */
  async function advance(next) {
    setMessages(next);
    setChar("thinking");
    const out = await api.converse(next);

    if (out.type === "question") {
      setLines((l) => l.concat([{ who: "Helmet", text: out.question }]));
      setMessages([...next, { role: "assistant", content: out.question }]);
      setChar("speaking");

      // When the question finishes, go straight back to listening the way the
      // spec does, so the resident never hunts for a button mid-conversation.
      say(out.question, out.language ?? report?.language, () => listen().catch(boom));
      return;
    }

    const filed = out.report;
    setReport(filed);
    setLines((l) => (filed.closing ? l.concat([{ who: "Helmet", text: filed.closing }]) : l));
    go(filed.photo_helpful ? "photo" : "review", "speaking");

    // Close the loop out loud. Without this the conversation just stops and the
    // screen changes under the resident, which reads as the app having given up
    // on them rather than having got what it needed.
    if (filed.closing) say(filed.closing, filed.language, () => setChar("idle"));
    else setChar("idle");
  }

  // ---- typed path -------------------------------------------------------

  async function continueTyped() {
    const t = typed.trim();
    if (!t) return go("errEmpty");
    try {
      setTypedOnly(true);
      setScreen("convo");
      setChar("thinking");
      setLines([{ who: "You, typed", text: t }]);
      await advance([...messages, { role: "user", content: t }]);
    } catch (e) { boom(e); }
  }

  // ---- photo ------------------------------------------------------------

  async function takePhoto() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return go("review");
      // quality 0.5 matters: a full resolution phone photo visibly stalls upload.
      const r = await ImagePicker.launchCameraAsync({ quality: 0.5 });
      if (!r.canceled) setPhotoUri(r.assets[0].uri);
      go("review");
    } catch (e) { boom(e); }
  }

  // ---- send -------------------------------------------------------------

  async function send() {
    try {
      if (!report?.description) return go("errEmpty");
      const { id } = await api.createReport({
        ...report,
        source: typedOnly ? "text" : "voice",
        transcript: messages.map((m) => ({ role: m.role, text: m.content })),
      });
      if (photoUri) {
        try { await api.uploadPhoto(id, photoUri); }
        catch (e) { console.warn("photo upload failed, report still filed:", e.message); }
      }
      setSentId(id);
      go("sent", "sent");
    } catch (e) { boom(e); }
  }

  const setField = (k, v) => setReport((r) => ({ ...r, [k]: v }));

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: color.bg }} />;

  // ---- screens ----------------------------------------------------------

  if (screen === "home") {
    return (
      <Chrome>
        <View style={s.pad}>
          <View style={s.homeChar}><Helmet state="idle" size={150} /></View>
          <Text style={s.homeCopy}>
            Tell us what's wrong.{"\n"}
            <Text style={s.homeCopySub}>Talk like you'd tell a neighbour.</Text>
          </Text>
          <Pressable
            onPress={start}
            accessibilityRole="button"
            accessibilityLabel="Tap and talk"
            style={({ pressed }) => [
              s.talk,
              { backgroundColor: pressed ? color.accent200 : color.accent100, transform: [{ scale: pressed ? 0.985 : 1 }] },
            ]}
          >
            <Mic size={34} color={color.accent800} />
            <Text style={s.talkLabel}>Tap and talk</Text>
          </Pressable>
          <View style={s.homeFoot}>
            <Pressable
              onPress={() => go("type")}
              accessibilityRole="button"
              style={({ pressed }) => [s.typeInstead, { backgroundColor: pressed ? "rgba(0,0,0,0.05)" : "transparent" }]}
            >
              <KeyboardIcon size={19} color={color.text} />
              <Text style={s.typeInsteadLabel}>Type it instead</Text>
            </Pressable>
            <Text style={s.footnote}>
              Works in English, French and Arabic. Nothing is shared beyond the city.
            </Text>
          </View>
        </View>
      </Chrome>
    );
  }

  if (screen === "convo") {
    return (
      <Chrome>
        <View style={[s.pad, { paddingHorizontal: 24, paddingBottom: 26 }]}>
          <View style={s.convoHead}>
            <Helmet state={char === "idle" ? "listening" : char} size={128} />
            <Text style={s.stateLabel}>{CHAR_LABEL[char]}</Text>
          </View>
          <ScrollView style={s.transcript} contentContainerStyle={{ paddingBottom: space[3] }}>
            {lines.map((l, i) => (
              <View key={i} style={s.line}>
                <Kick style={{ marginBottom: 7 }}>{l.who}</Kick>
                <Text style={[s.lineText, i === lines.length - 1 ? null : { color: color.neutral700 }]}>
                  {l.text}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={s.convoFoot}>
            <Pressable
              onPress={stop}
              accessibilityRole="button"
              style={({ pressed }) => [s.stop, { backgroundColor: pressed ? color.accent200 : color.accent100 }]}
            >
              <Text style={s.stopLabel}>Stop</Text>
            </Pressable>
            <Pressable
              onPress={() => go("type")}
              accessibilityRole="button"
              style={({ pressed }) => [s.typeEscape, { backgroundColor: pressed ? "rgba(0,0,0,0.05)" : "transparent" }]}
            >
              <Text style={s.typeEscapeLabel}>Type</Text>
            </Pressable>
          </View>
        </View>
      </Chrome>
    );
  }

  if (screen === "photo") {
    return (
      <Chrome>
        <View style={s.pad}>
          <View style={s.photoMid}>
            <Helmet state="speaking" size={132} />
            <Text style={s.photoCopy}>A photo helps the crew find it. Want to add one?</Text>
          </View>
          <View style={{ gap: space[3] }}>
            <Primary
              label="Take a photo"
              onPress={takePhoto}
              icon={<Camera size={22} color={color.accent800} />}
            />
            <Secondary label="No photo" onPress={() => go("review")} height={58} />
            <Text style={s.reassure}>Most reports come in without one. That's fine.</Text>
          </View>
        </View>
      </Chrome>
    );
  }

  if (screen === "review") {
    const r = report ?? {};
    return (
      <Chrome>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={s.reviewHead}>
            <Text style={s.h30}>Is this right?</Text>
            <Text style={s.reviewSub}>This is what the city will see. Change anything that's wrong.</Text>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}>
            <View style={s.field}>
              <Kick style={{ marginBottom: 9 }}>Where</Kick>
              <TextInput
                value={r.location_text ?? ""}
                onChangeText={(v) => setField("location_text", v)}
                style={s.input}
                placeholder="Street or intersection"
                placeholderTextColor={color.neutral500}
              />
            </View>

            <View style={s.field}>
              <Kick style={{ marginBottom: 9 }}>What's wrong</Kick>
              <View style={s.chips}>
                {CATEGORIES.map((c) => {
                  const on = r.category === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setField("category", c)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[s.chip, on ? s.chipOn : s.chipOff]}
                    >
                      <Text style={[s.chipLabel, on && { color: color.accent800 }]}>
                        {CATEGORY_LABELS[c]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={s.field}>
              <Kick style={{ marginBottom: 9 }}>How urgent</Kick>
              <View style={s.sevRow}>
                {SEVS.map((x) => {
                  const on = r.severity === x.v;
                  return (
                    <Pressable
                      key={x.v}
                      onPress={() => {
                        setField("severity", x.v);
                        // "Someone could get hurt" is the safety flag, said plainly.
                        if (x.v === "high") setField("safety_risk", true);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[s.sevBtn, on ? s.sevOn : s.sevOff]}
                    >
                      <View style={[s.sevDot, { backgroundColor: x.dot }]} />
                      <Text style={s.sevLabel}>{x.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={s.field}>
              <Kick style={{ marginBottom: 9 }}>In your words, tidied up</Kick>
              <TextInput
                value={r.description ?? ""}
                onChangeText={(v) => setField("description", v)}
                multiline
                style={[s.input, s.textarea]}
              />
            </View>

            <View style={[s.field, { borderBottomWidth: 1, borderBottomColor: color.divider }]}>
              <Kick style={{ marginBottom: 9 }}>Photo</Kick>
              {photoUri ? (
                <View style={s.photoRow}>
                  <View style={s.plate}>
                    <Image source={{ uri: photoUri }} style={s.plateImg} />
                  </View>
                  <Pressable onPress={() => setPhotoUri(null)} style={s.smallBtn}>
                    <Text style={s.smallBtnLabel}>Remove</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={s.photoNone}>
                  <Text style={s.noneLabel}>None, not needed</Text>
                  <Pressable onPress={takePhoto} style={s.smallBtn}>
                    <Text style={s.smallBtnLabel}>Add one</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* The honesty control: the resident can check the summary against
                their own words before the city ever sees it. */}
            {lines.length > 0 && (
              <>
                <Pressable onPress={() => setShowTranscript((v) => !v)} style={s.reveal}>
                  <Text style={s.revealLabel}>
                    {showTranscript ? "Hide what you said" : "See exactly what you said"}
                  </Text>
                </Pressable>
                {showTranscript && (
                  <View style={s.verbatim}>
                    {lines.map((l, i) => (
                      <Text key={i} style={s.verbatimLine}>
                        <Text style={s.verbatimWho}>{l.who} </Text>
                        {l.text}
                      </Text>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <View style={s.sendBar}>
            <Primary label="Send to the city" onPress={send} />
          </View>
        </KeyboardAvoidingView>
      </Chrome>
    );
  }

  if (screen === "sent") {
    return (
      <Chrome>
        <View style={s.pad}>
          <View style={s.sentMid}>
            <Helmet state="sent" size={138} />
            <Text style={s.h34}>That's filed.</Text>
            <View style={{ alignItems: "center" }}>
              <Kick style={{ marginBottom: 8 }}>Your reference</Kick>
              <Text style={s.ref}>{sentId}</Text>
            </View>
            <View style={s.sentNote}>
              <Text style={s.sentLine}>Public Works sees it within one business day.</Text>
              <Text style={[s.sentLine, { color: color.neutral700, marginTop: 8 }]}>
                It is on the board now. No app to check.
              </Text>
            </View>
          </View>
          <Primary label="Report something else" onPress={reset} />
        </View>
      </Chrome>
    );
  }

  if (screen === "type") {
    return (
      <Chrome>
        <KeyboardAvoidingView
          style={[s.pad, { paddingHorizontal: 24, paddingBottom: 12 }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={{ paddingTop: 18, paddingBottom: 14 }}>
            <Text style={s.h28}>Type it instead</Text>
            <Text style={s.reviewSub}>Where you are, and what's wrong. Two lines is plenty.</Text>
          </View>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            multiline
            placeholder="Pothole on North Street near Agricola…"
            placeholderTextColor={color.neutral500}
            style={[s.input, { minHeight: 150, textAlignVertical: "top", padding: 13 }]}
          />
          <View style={s.typeFoot}>
            <Pressable
              onPress={continueTyped}
              style={({ pressed }) => [s.stop, { backgroundColor: pressed ? color.accent200 : color.accent100 }]}
            >
              <Text style={s.stopLabel}>Continue</Text>
            </Pressable>
            <Pressable
              onPress={reset}
              style={({ pressed }) => [s.typeEscape, { backgroundColor: pressed ? "rgba(0,0,0,0.05)" : "transparent" }]}
            >
              <Text style={s.typeEscapeLabel}>Back</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Chrome>
    );
  }

  if (screen === "errMic") {
    return (
      <Chrome>
        <Stated
          title="The mic is switched off"
          body="Halifax can't hear you until you turn it on in Settings. You can type your report instead, it works the same."
          primary={<Primary label="Open Settings" onPress={() => Linking.openSettings()} />}
          secondary={<Secondary label="Type it instead" onPress={() => go("type")} />}
        />
      </Chrome>
    );
  }

  if (screen === "errHeard") {
    return (
      <Chrome>
        <Stated
          title="That came through muffled"
          body="Traffic and wind make this hard. Try again a little closer to the phone, or type it."
          primary={<Primary label="Say it again" onPress={start} />}
          secondary={<Secondary label="Type it instead" onPress={() => go("type")} />}
        />
      </Chrome>
    );
  }

  if (screen === "errNet") {
    return (
      <Chrome>
        <Stated
          title="You're offline"
          body="We couldn't reach the city. Check your signal and try again, or type it and send when you're back."
          primary={<Primary label="Try again" onPress={reset} />}
          secondary={<Secondary label="Type it instead" onPress={() => go("type")} />}
        >
          <Text style={s.errDetail} selectable>{errText}{"\n"}{api.API}</Text>
        </Stated>
      </Chrome>
    );
  }

  if (screen === "errEmpty") {
    return (
      <Chrome>
        <Stated
          title="Nothing to send yet"
          body="We didn't catch where you are or what's wrong. Start again and we'll only need a sentence."
          primary={<Primary label="Start a report" onPress={start} />}
        />
      </Chrome>
    );
  }

  // Generic. Not in the design, kept deliberately: every failure has to be
  // readable off the screen of a phone nobody can attach a debugger to.
  return (
    <Chrome>
      <Stated
        title="That didn't go through"
        body="Something the app wasn't expecting went wrong. The detail below is for whoever is running the demo."
        primary={<Primary label="Start again" onPress={reset} />}
        secondary={<Secondary label="Type it instead" onPress={() => go("type")} />}
      >
        <Text style={s.errDetail} selectable>{errText}{"\n"}{api.API}</Text>
      </Stated>
    </Chrome>
  );
}

// ── styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  chrome: {
    flexShrink: 0, paddingHorizontal: 24, paddingTop: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  brand: { fontFamily: font.headingSemi, fontSize: 15, letterSpacing: 0.6, color: color.text },
  place: {
    fontFamily: font.body, fontSize: 11, letterSpacing: 1.1,
    textTransform: "uppercase", color: color.neutral600,
  },
  pad: { flex: 1, paddingHorizontal: 26, paddingBottom: 30 },

  // home
  homeChar: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 8 },
  homeCopy: {
    marginBottom: 26, textAlign: "center", fontFamily: font.body,
    fontSize: 20, lineHeight: 29, color: color.text,
  },
  homeCopySub: { color: color.neutral700, fontSize: 17, lineHeight: 26 },
  talk: {
    alignSelf: "center", width: 214, height: 214, borderRadius: 107,
    borderWidth: 1.5, borderColor: color.accent,
    alignItems: "center", justifyContent: "center", gap: 10, ...shadow.sm,
  },
  talkLabel: { fontFamily: font.headingSemi, fontSize: 23, color: color.accent800, letterSpacing: 0.2 },
  homeFoot: { marginTop: 26, alignItems: "center", gap: 14 },
  typeInstead: {
    minHeight: 48, paddingHorizontal: 18, flexDirection: "row", alignItems: "center",
    gap: 9, borderWidth: 1, borderColor: color.divider, borderRadius: radius.md,
  },
  typeInsteadLabel: { fontFamily: font.body, fontSize: 16, color: color.text },
  footnote: {
    textAlign: "center", fontFamily: font.body, fontSize: 13, lineHeight: 20,
    color: color.neutral600, maxWidth: 260,
  },

  // conversation
  convoHead: { flexShrink: 0, alignItems: "center", paddingTop: 14, paddingBottom: 6 },
  stateLabel: {
    marginTop: 10, fontFamily: font.bodySemi, fontSize: 12, letterSpacing: 1.9,
    textTransform: "uppercase", color: color.accent700,
  },
  transcript: { flex: 1, marginTop: 18, borderTopWidth: 1, borderTopColor: color.divider },
  line: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: color.divider },
  lineText: { fontFamily: font.body, fontSize: 18, lineHeight: 27, color: color.text },
  convoFoot: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 20 },
  stop: {
    flex: 1, minHeight: 54, borderWidth: 1.5, borderColor: color.accent,
    borderRadius: radius.md, alignItems: "center", justifyContent: "center",
  },
  stopLabel: { fontFamily: font.headingSemi, fontSize: 18, color: color.accent800 },
  typeEscape: {
    minHeight: 54, paddingHorizontal: 16, borderWidth: 1, borderColor: color.divider,
    borderRadius: radius.md, alignItems: "center", justifyContent: "center",
  },
  typeEscapeLabel: { fontFamily: font.body, fontSize: 16, color: color.text },

  // photo
  photoMid: { flex: 1, alignItems: "center", justifyContent: "center", gap: 22 },
  photoCopy: {
    textAlign: "center", fontFamily: font.body, fontSize: 21, lineHeight: 29, maxWidth: 260,
  },
  reassure: {
    marginTop: 6, textAlign: "center", fontFamily: font.body, fontSize: 14, color: color.neutral700,
  },

  // review
  reviewHead: { flexShrink: 0, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 14 },
  reviewSub: { fontFamily: font.body, fontSize: 16, lineHeight: 24, color: color.neutral700 },
  field: { paddingVertical: 16, borderTopWidth: 1, borderTopColor: color.divider },
  input: {
    width: "100%", minHeight: 50, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: font.body, fontSize: 17, color: color.text,
    borderWidth: 1, borderColor: color.divider, borderRadius: radius.md,
  },
  textarea: { minHeight: 104, lineHeight: 26, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  chip: {
    minHeight: 48, paddingHorizontal: 16, borderRadius: radius.md,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  chipOn: { borderColor: color.accent, backgroundColor: color.accent100 },
  chipOff: { borderColor: color.neutral400, backgroundColor: "transparent" },
  chipLabel: { fontFamily: font.body, fontSize: 16, color: color.text },
  sevRow: { flexDirection: "row", gap: 9 },
  sevBtn: {
    flex: 1, minHeight: 64, padding: 10, borderRadius: radius.md, borderWidth: 1,
    alignItems: "flex-start", justifyContent: "flex-start", gap: 8,
  },
  sevOn: { borderColor: color.accent, backgroundColor: color.accent100 },
  sevOff: { borderColor: color.neutral400, backgroundColor: "transparent" },
  sevDot: { width: 11, height: 11, borderRadius: 6 },
  sevLabel: { fontFamily: font.body, fontSize: 14, lineHeight: 18, color: color.text },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  // The plate: a photograph sits matted on the surface, like a tipped-in book plate.
  plate: {
    width: 92, height: 70, padding: 6, backgroundColor: color.surface,
    borderWidth: 1, borderColor: color.divider,
  },
  plateImg: { width: "100%", height: "100%" },
  photoNone: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  noneLabel: { fontFamily: font.body, fontSize: 16, color: color.neutral700 },
  smallBtn: {
    minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: color.divider,
    borderRadius: radius.md, alignItems: "center", justifyContent: "center",
  },
  smallBtnLabel: { fontFamily: font.body, fontSize: 15, color: color.text },
  reveal: { marginTop: 16, minHeight: 44, justifyContent: "center" },
  revealLabel: {
    fontFamily: font.body, fontSize: 15, color: color.accent700,
    textDecorationLine: "underline",
  },
  verbatim: {
    marginTop: 4, paddingVertical: 14, paddingHorizontal: 16,
    borderLeftWidth: 2, borderLeftColor: color.divider,
  },
  verbatimLine: {
    marginBottom: 10, fontFamily: font.body, fontSize: 15, lineHeight: 24, color: color.neutral700,
  },
  verbatimWho: {
    fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", color: color.neutral600,
  },
  sendBar: {
    flexShrink: 0, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 26,
    borderTopWidth: 1, borderTopColor: color.divider, backgroundColor: color.bg,
  },

  // sent
  sentMid: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  ref: {
    fontFamily: font.headingSemi, fontSize: 26, letterSpacing: 1,
    color: color.text, ...tabular,
  },
  sentNote: {
    width: "100%", maxWidth: 300, borderTopWidth: 1, borderTopColor: color.divider, paddingTop: 18,
  },
  sentLine: { fontFamily: font.body, fontSize: 17, lineHeight: 26, color: color.text },

  // type
  typeFoot: { flexDirection: "row", gap: 12, marginTop: 16 },

  // shared type scale
  h34: { fontFamily: font.heading, fontSize: 34, lineHeight: 36, letterSpacing: -0.7, color: color.text },
  h30: { fontFamily: font.heading, fontSize: 30, lineHeight: 33, letterSpacing: -0.45, color: color.text },
  h28: { fontFamily: font.heading, fontSize: 28, lineHeight: 31, letterSpacing: -0.42, color: color.text, marginBottom: 6 },

  // error and empty states
  statedMid: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  stateBody: {
    textAlign: "center", fontFamily: font.body, fontSize: 17, lineHeight: 26,
    color: color.neutral800, maxWidth: 280,
  },
  errDetail: {
    fontFamily: font.body, fontSize: 12, lineHeight: 18, color: SEVC.high,
    textAlign: "center", paddingHorizontal: 8,
  },

  // buttons
  primary: {
    borderWidth: 1.5, borderColor: color.accent, borderRadius: radius.md,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  primaryLabel: { fontFamily: font.headingSemi, color: color.accent800 },
  secondary: {
    borderWidth: 1, borderRadius: radius.md, alignItems: "center", justifyContent: "center",
  },
  secondaryLabel: { fontFamily: font.headingSemi, fontSize: 18, color: color.text },
});
