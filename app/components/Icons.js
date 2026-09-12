// Lucide-style glyphs, 1.5-1.6px stroke on currentColor, drawn from the same
// paths the prototype uses. Four icons is not worth a dependency.
import Svg, { Path, Rect, Circle } from "react-native-svg";

const base = (size, stroke) => ({
  width: size, height: size, viewBox: "0 0 24 24",
  fill: "none", stroke, strokeLinecap: "round", strokeLinejoin: "round",
});

export const Mic = ({ size = 34, color, width = 1.6 }) => (
  <Svg {...base(size, color)} strokeWidth={width}>
    <Path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
    <Path d="M5 11v1a7 7 0 0 0 14 0v-1" />
    <Path d="M12 19v2" />
  </Svg>
);

export const Keyboard = ({ size = 19, color, width = 1.5 }) => (
  <Svg {...base(size, color)} strokeWidth={width}>
    <Rect x={2} y={6} width={20} height={12} rx={2} />
    <Path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
  </Svg>
);

export const Camera = ({ size = 22, color, width = 1.5 }) => (
  <Svg {...base(size, color)} strokeWidth={width}>
    <Path d="M3 8.5A2 2 0 0 1 5 6.5h1.6l1-1.8h4.8l1 1.8H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <Circle cx={12} cy={12.6} r={3.3} />
  </Svg>
);

export const Pin = ({ size = 14, color, width = 1.6 }) => (
  <Svg {...base(size, color)} strokeWidth={width}>
    <Path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
    <Circle cx={12} cy={10} r={2.4} />
  </Svg>
);
