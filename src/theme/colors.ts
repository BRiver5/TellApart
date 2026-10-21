// Палитра приложения. Это единственный файл, где должны жить цветовые значения —
// компоненты и экраны берут цвета только отсюда, магические hex-коды в JSX запрещены.
//
// Tell Apart: "красная ручка" #B92744 (tools/palette-search.js, сектор 348°,
// дистанция 15.6) на тетрадной бумаге, сине-чёрные чернила текста; путаницы —
// маркер-выделитель, исходы ответа — свои тона.

export const light = {
  background: "#F9F7F3",
  backgroundAlt: "#EFECE5",
  surface: "#FFFFFF",
  surfaceAlt: "#F4F2EC",
  border: "#E4E0D6",
  ink: "#1E2233",
  inkMuted: "#5E6274",
  inkFaint: "#A0A2AE",
  onAccent: "#FFFFFF",
  accent: "#B92744",
  accentSoft: "#F6DFE3",
  accentDeep: "#8A1A31",
  // Путаница — маркер-выделитель.
  marker: "#F2D35B",
  markerSoft: "#FBF1C4",
  mixup: "#6A4BB0",
  mixupSoft: "#E8E1F5",
  // Исходы ответа.
  right: "#2E7D5B",
  rightSoft: "#DDEFE5",
  close: "#B07214",
  closeSoft: "#F7E9CF",
  danger: "#B92744",
  success: "#2E7D5B",
  // Предупреждение/второе свайп-действие (SwipeRow, бейдж Segmented) — тёмный
  // янтарь, белый текст на нём ≥ 4.5:1.
  signal: "#9A5A0E",
  // statusDimmed = background × 0.55 + ink × 0.45.
  scrim: "rgba(30,34,51,0.45)",
  statusDimmed: "#9B9AA0",
  deck: ["#B92744", "#2B4C9B", "#2E7D5B", "#B07214", "#6A4BB0", "#1F7A86", "#8A5A3C", "#B14E8A"],
};

export const dark = {
  background: "#121318",
  backgroundAlt: "#181A21",
  surface: "#1E2029",
  surfaceAlt: "#262833",
  border: "#30333F",
  ink: "#EEEFF4",
  inkMuted: "#A7AABA",
  inkFaint: "#6D7080",
  onAccent: "#FFFFFF",
  accent: "#E0546E",
  accentSoft: "#3A1C24",
  accentDeep: "#F4A3B2",
  marker: "#E8C547",
  markerSoft: "#3A3318",
  mixup: "#A88BE6",
  mixupSoft: "#2C2440",
  right: "#5CC08F",
  rightSoft: "#183428",
  close: "#E0A040",
  closeSoft: "#3A2C16",
  danger: "#E0546E",
  success: "#5CC08F",
  signal: "#E0A040",
  scrim: "rgba(0,0,0,0.6)",
  statusDimmed: "#08090B",
  deck: ["#E0546E", "#6B8BDB", "#5CC08F", "#E0A040", "#A88BE6", "#4FB3C2", "#C08A64", "#DC7FB4"],
};

export type Palette = typeof light;
