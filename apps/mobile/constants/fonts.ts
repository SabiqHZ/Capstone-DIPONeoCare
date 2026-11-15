export const Fonts = {
  poppinsRegular: "Poppins_400Regular",
  poppinsMedium: "Poppins_500Medium",
  poppinsSemiBold: "Poppins_600SemiBold",
  poppinsBold: "Poppins_700Bold",
  poppinsExtraBold: "Poppins_800ExtraBold",
  // Existing keys remain compatible while resolving to the single font family.
  nunitoRegular: "Poppins_400Regular",
  nunitoSemiBold: "Poppins_600SemiBold",
  nunitoBold: "Poppins_700Bold",
  nunitoExtraBold: "Poppins_800ExtraBold",
  interRegular: "Poppins_400Regular",
  interMedium: "Poppins_500Medium",
  interSemiBold: "Poppins_600SemiBold",
} as const;

// Shared typography uses Poppins throughout the interface.
export const Typography = {
  display: { fontFamily: Fonts.nunitoExtraBold, fontSize: 24 },
  h1: { fontFamily: Fonts.nunitoBold, fontSize: 24 },
  h2: { fontFamily: Fonts.nunitoBold, fontSize: 20 },
  h3: { fontFamily: Fonts.nunitoSemiBold, fontSize: 16 },
  body: { fontFamily: Fonts.interRegular, fontSize: 12 },
  bodyStrong: { fontFamily: Fonts.interSemiBold, fontSize: 14 },
  caption: { fontFamily: Fonts.interRegular, fontSize: 12 },
  captionStrong: { fontFamily: Fonts.interSemiBold, fontSize: 12 },
} as const;
