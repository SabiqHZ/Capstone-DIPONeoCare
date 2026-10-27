export const Fonts = {
  // Nunito — header & judul
  nunitoRegular: 'Nunito_400Regular',
  nunitoSemiBold: 'Nunito_600SemiBold',
  nunitoBold: 'Nunito_700Bold',
  nunitoExtraBold: 'Nunito_800ExtraBold',

  // Inter — deskripsi & subfont
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
} as const;

// Shared hierarchy: Nunito for headings, Inter for readable UI copy.
export const Typography = {
  display: { fontFamily: Fonts.nunitoExtraBold, fontSize: 28 },
  h1: { fontFamily: Fonts.nunitoBold, fontSize: 24 },
  h2: { fontFamily: Fonts.nunitoBold, fontSize: 20 },
  h3: { fontFamily: Fonts.nunitoSemiBold, fontSize: 16 },
  body: { fontFamily: Fonts.interRegular, fontSize: 14 },
  bodyStrong: { fontFamily: Fonts.interSemiBold, fontSize: 14 },
  caption: { fontFamily: Fonts.interRegular, fontSize: 12 },
  captionStrong: { fontFamily: Fonts.interSemiBold, fontSize: 12 },
} as const;
