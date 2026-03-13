export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
}

export const PALETTES: ColorPalette[] = [
  {
    id: "vhs",
    name: "VHS",
    colors: [
      "#ff4c2e", // red
      "#fe792e", // orange
      "#fdd42c", // yellow
      "#bad015", // lime
      "#64b53c", // green
      "#89d6e8", // blue
      "#3f5d93", // indigo
      "#ff63a8", // violet
      "#151f21", // black
      "#5b3314", // brown
      "#f2f1dd", // beige
      "#feffef", // white
    ],
  },
  {
    id: "50s",
    name: "50s",
    colors: [
      "#FF6F61", // coral
      "#00BFAE", // turquoise
      "#FFD600", // sunshine yellow
      "#A8D8B9", // mint
      "#FFB74D", // tangerine
      "#6D9DC5", // powder blue
      "#007B5F", // deep teal
      "#FF3D00", // vermillion
      "#263238", // charcoal
      "#A0522D", // sienna
      "#D7CCC8", // warm beige
      "#FAF0E6", // linen
    ],
  },
  {
    id: "60s",
    name: "60s",
    colors: [
      "#f13c93", // hot pink
      "#ca1044", // pop red
      "#e86c34", // electric orange
      "#f8ee2c", // acid yellow
      "#b83b94", // magenta
      "#295b9d", // royal blue
      "#23b5d7", // mod aqua
      "#07ae6e", // kelly green
      "#584876", // purple
      "#e9c94f", // golden
      "#2e1917", // dark sienna
      "#35a293", // teal
    ],
  },
  {
    id: "70s",
    name: "70s",
    colors: [
      "#E97451", // burnt sienna
      "#568203", // avocado
      "#D4A017", // harvest gold
      "#B7410E", // rust
      "#CC5500", // burnt orange
      "#808000", // olive
      "#E1AD01", // mustard
      "#E2725B", // terracotta
      "#5C3317", // chocolate
      "#C2B280", // tan
      "#556B2F", // dark olive
      "#FAF0E6", // cream
    ],
  },
  {
    id: "80s",
    name: "80s",
    colors: [
      "#FF6EC7", // hot pink
      "#00f5ff", // electric cyan
      "#7b2cff", // electric purple
      "#ffe600", // neon yellow
      "#ff2e88", // neon rose
      "#2de2e6", // miami teal
      "#ff7a00", // sunset orange
      "#3cff7f", // neon green
      "#0b0b0f", // void black
      "#1b1f3a", // dark navy
      "#f7b2d9", // pastel pink
      "#c0c0c7", // chrome
    ],
  },
  {
    id: "90s",
    name: "90s",
    colors: [
      "#00e5ff", // bright teal
      "#ff2bd6", // hot fuchsia
      "#49297e", // deep purple
      "#39ff14", // electric green
      "#fa7b52", // coral
      "#2f80ed", // web blue
      "#fdfb76", // neon yellow
      "#ff00ff", // fuchsia
      "#3b3f46", // flannel gray
      "#6b705c", // olive khaki
      "#c0c0c7", // chrome silver
      "#f2f4f3", // off-white
    ],
  },
];

export function getPalette(id: string): ColorPalette {
  return PALETTES.find((p) => p.id === id) || PALETTES[0]!;
}

export function getDefaultPalette(): ColorPalette {
  return PALETTES[0]!;
}
