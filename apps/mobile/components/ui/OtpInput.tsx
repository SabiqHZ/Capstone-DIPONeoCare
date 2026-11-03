import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';

const CODE_LENGTH = 8;

interface OtpInputProps {
  onComplete: (code: string) => void;
  disabled?: boolean;
  error?: boolean;
  accentColor?: string;
}

export function OtpInput({
  onComplete,
  disabled = false,
  error = false,
  accentColor = '#1D9E75',
}: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleChange = useCallback(
    (text: string, index: number) => {
      // Handle paste seluruh kode
      if (text.length > 1) {
        const cleaned = text
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .slice(0, CODE_LENGTH);
        const next = Array(CODE_LENGTH).fill('');
        cleaned.split('').forEach((c, i) => { next[i] = c; });
        setValues(next);
        const focusAt = Math.min(cleaned.length, CODE_LENGTH - 1);
        inputs.current[focusAt]?.focus();
        if (cleaned.length === CODE_LENGTH) onComplete(cleaned);
        return;
      }

      const char = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const next = [...values];
      next[index] = char;
      setValues(next);

      if (char && index < CODE_LENGTH - 1) {
        inputs.current[index + 1]?.focus();
      }
      if (next.every((v) => v !== '')) {
        onComplete(next.join(''));
      }
    },
    [values, onComplete]
  );

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
      if (e.nativeEvent.key === 'Backspace' && !values[index] && index > 0) {
        inputs.current[index - 1]?.focus();
        const next = [...values];
        next[index - 1] = '';
        setValues(next);
      }
    },
    [values]
  );

  return (
    <View style={styles.row}>
      {Array(CODE_LENGTH)
        .fill(0)
        .map((_, i) => (
          <React.Fragment key={i}>
            {i === 4 && <View style={styles.divider} />}
            <TextInput
              ref={(r) => { inputs.current[i] = r; }}
              style={[
                styles.box,
                {
                  borderColor:
                    error ? '#E24B4A' : values[i] || focusedIndex === i
                      ? accentColor
                      : '#D3D1C7',
                },
                values[i] ? styles.boxFilled : null,
                error ? styles.boxError : null,
                disabled ? styles.boxDisabled : null,
              ]}
              value={values[i]}
              onChangeText={(t) => handleChange(t, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              onFocus={() => setFocusedIndex(i)}
              onBlur={() =>
                setFocusedIndex((current) => (current === i ? null : current))
              }
              maxLength={CODE_LENGTH}
              autoCapitalize="characters"
              autoCorrect={false}
              selectTextOnFocus
              editable={!disabled}
              autoFocus={i === 0}
              underlineColorAndroid="transparent"
              accessibilityLabel={`Karakter ${i + 1} dari ${CODE_LENGTH}`}
              keyboardType="default"
            />
          </React.Fragment>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
  },
  box: {
    flex: 1,
    minWidth: 0,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D3D1C7',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: '#2C2C2A',
    backgroundColor: '#FFFFFF',
  },
  boxFilled: {
    borderColor: '#1D9E75',
    backgroundColor: '#E8F8F3',
    color: '#085041',
  },
  boxError: {
    borderColor: '#E24B4A',
    backgroundColor: '#FCEBEB',
  },
  boxDisabled: {
    opacity: 0.5,
  },
  divider: {
    width: 8,
    height: 2,
    backgroundColor: '#D1D5DB',
    borderRadius: 1,
    marginHorizontal: 2,
  },
});
