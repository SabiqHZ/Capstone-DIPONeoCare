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
}

export function OtpInput({
  onComplete,
  disabled = false,
  error = false,
}: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(CODE_LENGTH).fill(''));
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
                values[i] ? styles.boxFilled : null,
                error ? styles.boxError : null,
                disabled ? styles.boxDisabled : null,
              ]}
              value={values[i]}
              onChangeText={(t) => handleChange(t, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              maxLength={CODE_LENGTH}
              autoCapitalize="characters"
              autoCorrect={false}
              selectTextOnFocus
              editable={!disabled}
              autoFocus={i === 0}
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
  },
  box: {
    width: 30,
    height: 45,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D3D1C7',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: '#2C2C2A',
    backgroundColor: '#F9FAFB',
  },
  boxFilled: {
    borderColor: '#1D9E75',
    backgroundColor: '#E1F5EE',
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
    width: 10,
    height: 2,
    backgroundColor: '#D1D5DB',
    borderRadius: 1,
    marginHorizontal: 2,
  },
});