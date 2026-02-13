import { Platform, Alert as RNAlert } from 'react-native';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS === 'web') {
    if (!buttons || buttons.length <= 1) {
      window.alert(message ? `${title}\n\n${message}` : title);
      const btn = buttons?.[0];
      btn?.onPress?.();
    } else if (buttons.length === 2) {
      const cancelBtn = buttons.find((b) => b.style === 'cancel');
      const actionBtn = buttons.find((b) => b.style !== 'cancel') || buttons[1];
      const result = window.confirm(message ? `${title}\n\n${message}` : title);
      if (result) {
        actionBtn?.onPress?.();
      } else {
        cancelBtn?.onPress?.();
      }
    } else {
      // Multiple buttons - show confirm for first action
      const msg = buttons.map((b, i) => `${i + 1}. ${b.text}`).join('\n');
      const choice = window.prompt(`${title}\n${message || ''}\n\n${msg}\n\nEnter number:`);
      const idx = choice ? parseInt(choice, 10) - 1 : -1;
      if (idx >= 0 && idx < buttons.length) {
        buttons[idx]?.onPress?.();
      }
    }
  } else {
    RNAlert.alert(title, message, buttons);
  }
}

export function showActionSheet(title: string, options: { text: string; onPress: () => void }[], cancelText = 'Cancel') {
  if (Platform.OS === 'web') {
    const msg = options.map((o, i) => `${i + 1}. ${o.text}`).join('\n');
    const choice = window.prompt(`${title}\n\n${msg}\n\nEnter number (or cancel):`);
    const idx = choice ? parseInt(choice, 10) - 1 : -1;
    if (idx >= 0 && idx < options.length) {
      options[idx]?.onPress();
    }
  } else {
    RNAlert.alert(title, 'Select an option', [
      ...options.map((o) => ({ text: o.text, onPress: o.onPress })),
      { text: cancelText, style: 'cancel' as const },
    ]);
  }
}
