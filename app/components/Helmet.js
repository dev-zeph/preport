// The works helmet. Carries system state so the resident never has to read a
// status string. Geometry is verbatim from the design handoff: canvas
// 0 0 128 104, drawn at 86-150px.
//
// Every state differs in SHAPE or COLOUR, not only in motion, so it still reads
// with animation off. That is the accessibility contract, not a nicety: under
// reduce-motion we freeze at rest and the silhouette still tells you the state.
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, AccessibilityInfo } from "react-native";
import Svg, { Ellipse, Path, Circle, G } from "react-native-svg";

import { color, status } from "../lib/tokens";

const AG = Animated.createAnimatedComponent(G);
const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);

// SVG attributes are not layout props, so these cannot ride the native driver.
// The graphic is small and there are at most five animated nodes on screen.
const NATIVE = false;

/** A 0 -> 1 value that loops forever, optionally after a stagger. */
function useLoop(on, duration, delay = 0, easing = Easing.inOut(Easing.ease)) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) {
      v.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: NATIVE }),
      ])
    );
    anim.start();
    return () => {
      anim.stop();
      v.setValue(0);
    };
  }, [on, duration, delay]);
  return v;
}

/** A 0 -> 1 value that runs once. Used for the sent state's settle and check. */
function useOnce(on, duration, delay = 0, easing = Easing.out(Easing.ease)) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) {
      v.setValue(0);
      return;
    }
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: NATIVE }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [on, duration, delay]);
  return v;
}

export default function Helmet({ state = "idle", size = 150 }) {
  // Respect the system switch, and keep watching it: someone can flip it while
  // the app is open, and this character is the only state indicator we have.
  const [still, setStill] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setStill(v));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setStill);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  const on = (s) => state === s && !still;

  // ---- group motion, one per state -------------------------------------
  const bob = useLoop(on("idle"), 6000);
  const lean = useLoop(on("listening"), 2300);
  const rock = useLoop(on("thinking"), 2400);
  const nod = useLoop(on("speaking"), 950);
  const settle = useOnce(state === "sent" && !still, 700, 0, Easing.bezier(0.2, 0.8, 0.25, 1));

  // ---- the one line that does all the emoting ---------------------------
  const mouthSlow = useLoop(on("listening"), 1100);
  const mouthFast = useLoop(on("speaking"), 620);
  const scan = useLoop(on("thinking"), 1500);
  const draw = useOnce(state === "sent" && !still, 550, 180);

  // The check is the only mark drawn by animating an attribute to its final
  // value, so a frozen animation would leave it invisible rather than merely
  // static. Every other state degrades to its reduce-motion pose, which still
  // reads. This flag guarantees the check lands whatever the driver does.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (state !== "sent") { setDrawn(false); return; }
    const t = setTimeout(() => setDrawn(true), still ? 0 : 760);
    return () => clearTimeout(t);
  }, [state, still]);

  // ---- the extras -------------------------------------------------------
  const ring0 = useLoop(on("listening"), 1900, 0, Easing.out(Easing.ease));
  const ring1 = useLoop(on("listening"), 1900, 550, Easing.out(Easing.ease));
  const dot0 = useLoop(on("thinking"), 1250, 0);
  const dot1 = useLoop(on("thinking"), 1250, 160);
  const dot2 = useLoop(on("thinking"), 1250, 320);
  const arc0 = useLoop(on("speaking"), 1100, 0, Easing.out(Easing.ease));
  const arc1 = useLoop(on("speaking"), 1100, 280, Easing.out(Easing.ease));

  const ink = color.accent700;
  const mark = color.accent600;

  // Group transform. Origin 60,80 for everything except where noted.
  const group = { originX: 60, originY: 80 };
  if (state === "idle") {
    group.translateY = bob.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -2.5, 0] });
  } else if (state === "listening") {
    group.rotation = -4.5;
    group.translateY = lean.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -1.5, 0] });
  } else if (state === "thinking") {
    group.rotation = rock.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-5, 5, -5] });
  } else if (state === "speaking") {
    group.translateY = nod.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -3, 0] });
    group.rotation = nod.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.5, 0] });
  } else if (state === "sent") {
    group.translateY = settle.interpolate({ inputRange: [0, 0.6, 1], outputRange: [-7, 1, 0] });
    group.scale = settle.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.95, 1.01, 1] });
  }
  if (still && state === "listening") group.rotation = -4.5;

  return (
    <Svg width={size} height={size * (104 / 128)} viewBox="0 0 128 104"
         accessibilityRole="image" accessibilityLabel={`Helmet, ${state}`}>

      {/* Listening rings sit BEHIND the helmet and outside the body group, so
          the lean does not drag them along. */}
      {state === "listening" && [ring0, ring1].map((v, i) => (
        <ACircle
          key={`ring${i}`} cx={60} cy={72} r={46 + i * 9}
          fill="none" stroke={color.accent400} strokeWidth={1.6}
          originX={60} originY={72}
          scale={still ? 1 : v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] })}
          opacity={still ? 0.3 - i * 0.12 : v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] })}
        />
      ))}

      <AG {...group}>
        <Ellipse cx={60} cy={76} rx={52} ry={9.5} fill={color.accent300} stroke={ink} strokeWidth={2.4} />
        <Path d="M16 76 A44 44 0 0 1 104 76 Z" fill={color.accent200} stroke={ink} strokeWidth={2.4} strokeLinejoin="round" />
        <Path d="M60 32 V74" stroke={ink} strokeWidth={2.2} strokeLinecap="round" opacity={0.85} />
        <Path d="M34 70 A30 40 0 0 1 41 44" stroke={ink} strokeWidth={1.6} fill="none" opacity={0.45} />
        <Path d="M86 70 A30 40 0 0 0 79 44" stroke={ink} strokeWidth={1.6} fill="none" opacity={0.45} />

        {state === "idle" && (
          <Path d="M47 60 H73" stroke={mark} strokeWidth={3.4} strokeLinecap="round" />
        )}
        {state === "listening" && (
          <APath
            d="M44 60 Q51 52 58 60 T72 60" fill="none" stroke={mark} strokeWidth={3.4} strokeLinecap="round"
            originX={58} originY={60}
            scaleY={still ? 1 : mouthSlow.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 1.3, 0.45] })}
          />
        )}
        {state === "thinking" && (
          <APath
            d="M52 60 H68" stroke={mark} strokeWidth={3.4} strokeLinecap="round"
            translateX={still ? 0 : scan.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-10, 10, -10] })}
          />
        )}
        {state === "speaking" && (
          <APath
            d="M46 56 Q60 68 74 56" fill="none" stroke={mark} strokeWidth={3.4} strokeLinecap="round"
            originX={60} originY={56}
            scaleY={still ? 1 : mouthFast.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 1.3, 0.45] })}
          />
        )}
        {state === "sent" && (
          <APath
            d="M47 59 L55 67 L74 48" fill="none" stroke={status.res} strokeWidth={4}
            strokeLinecap="round" strokeLinejoin="round" strokeDasharray={44}
            strokeDashoffset={still || drawn ? 0 : draw.interpolate({ inputRange: [0, 1], outputRange: [44, 0] })}
          />
        )}
      </AG>

      {state === "thinking" && [dot0, dot1, dot2].map((v, i) => (
        <ACircle
          key={`dot${i}`} cx={48 + i * 12} cy={96} r={3.6} fill={mark}
          translateY={still ? 0 : v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, -3.5, 0] })}
          opacity={still ? 0.35 + i * 0.25 : v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.18, 1, 0.18] })}
        />
      ))}

      {state === "speaking" && [arc0, arc1].map((v, i) => (
        <APath
          key={`arc${i}`}
          d={i ? "M112 52 Q120 62 112 72" : "M104 56 Q110 62 104 68"}
          fill="none" stroke={mark} strokeWidth={2.2} strokeLinecap="round"
          translateX={still ? 0 : v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 3.2, 8] })}
          opacity={still ? 0.7 - i * 0.3 : v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.9, 0] })}
        />
      ))}

      {state === "sent" && (
        <Path d="M26 94 H94" stroke={status.res} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
      )}
    </Svg>
  );
}
