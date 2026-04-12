import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import FeedbackWidget from './FeedbackWidget';

export default function FeedbackButton() {
  const { t } = useTranslation('feedback');
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={[styles.fab, { backgroundColor: colors.accent }]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('fab_label')}
      >
        <Text style={[styles.fabText, { color: colors.textOnAccent }]}>?</Text>
      </Pressable>

      <FeedbackWidget visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  fabText: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
});
