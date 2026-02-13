import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { API_URL } from '@/constants/config';
import AnimatedPressable from './AnimatedPressable';

interface Message {
  id: number;
  order_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  text: string;
  visibility?: string;
  created_at: string;
}

interface Props {
  orderId: number;
  role?: string; // 'consumer' | 'driver' | 'approver' — filters visible messages
}

export default function ChatView({ orderId, role }: Props) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const seenIds = useRef(new Set<number>());

  const userRole = role || user?.role || 'consumer';

  const loadMessages = useCallback(async () => {
    try {
      const roleParam = userRole === 'consumer' ? '?role=consumer' : userRole === 'driver' ? '?role=driver' : '';
      const res = await fetch(`${API_URL}/api/messages/${orderId}${roleParam}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
        seenIds.current = new Set(data.map((m: Message) => m.id));
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  }, [orderId, userRole]);

  useEffect(() => {
    loadMessages();
    socket?.emit('join-order', { orderId });

    const handleNewMessage = (msg: Message) => {
      if (msg.order_id !== orderId) return;
      if (seenIds.current.has(msg.id)) return;
      // Filter out staff messages for consumers
      if (userRole === 'consumer' && msg.visibility === 'staff') return;
      // Filter out customer messages for drivers (only show staff messages)
      if (userRole === 'driver' && msg.visibility !== 'staff') return;
      seenIds.current.add(msg.id);
      setMessages((prev) => [...prev, msg]);
    };

    socket?.on('chat:new-message', handleNewMessage);
    return () => { socket?.off('chat:new-message', handleNewMessage); };
  }, [orderId, socket, loadMessages, userRole]);

  const sendMessage = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    try {
      // Auto-set visibility based on sender role
      const visibility = (userRole === 'driver' || userRole === 'approver') ? 'staff' : 'all';
      const res = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, sender_id: user.id, text: text.trim(), visibility }),
      });
      const msg = await res.json();
      socket?.emit('chat:message', { ...msg, visibility });
      if (!seenIds.current.has(msg.id)) {
        seenIds.current.add(msg.id);
        setMessages((prev) => [...prev, msg]);
      }
      setText('');
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === user?.id;
    const isStaff = item.visibility === 'staff';
    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index * 30, 300)).duration(200)}>
        <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
            {!isMe && (
              <View style={styles.senderRow}>
                <Text style={styles.senderName}>{item.sender_name}</Text>
                {isStaff && (
                  <View style={styles.staffIndicator}>
                    <Ionicons name="lock-closed" size={9} color={Colors.textMuted} />
                    <Text style={styles.staffText}>Staff</Text>
                  </View>
                )}
              </View>
            )}
            {isMe && isStaff && (
              <View style={[styles.staffIndicator, { alignSelf: 'flex-end', marginBottom: 2 }]}>
                <Ionicons name="lock-closed" size={9} color="rgba(255,255,255,0.5)" />
                <Text style={[styles.staffText, { color: 'rgba(255,255,255,0.5)' }]}>Staff</Text>
              </View>
            )}
            <Text style={[styles.msgText, { color: isMe ? '#fff' : Colors.text }]}>{item.text}</Text>
            <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.6)' : Colors.textMuted }]}>
              {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.empty}>Noch keine Nachrichten</Text>
            <Text style={styles.emptyHint}>Starte die Konversation!</Text>
          </View>
        }
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Nachricht schreiben..."
          placeholderTextColor={Colors.textMuted}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <AnimatedPressable
          style={[styles.sendBtn, !text.trim() && { opacity: 0.3 }]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </AnimatedPressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, flexGrow: 1 },
  emptyContainer: {
    alignItems: 'center',
    marginTop: Spacing.xxl * 2,
    gap: Spacing.sm,
  },
  empty: {
    color: Colors.textMuted,
    textAlign: 'center',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.sm,
  },
  emptyHint: {
    color: Colors.textMuted,
    textAlign: 'center',
    fontSize: FontSize.sm,
  },
  msgRow: { marginBottom: Spacing.sm, flexDirection: 'row' },
  msgRowMe: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    padding: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  bubbleMe: {
    backgroundColor: Colors.gradientStart,
    borderBottomRightRadius: 4,
    ...Shadows.sm,
  },
  bubbleOther: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    ...Shadows.sm,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  senderName: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: FontWeight.semibold,
  },
  staffIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: `${Colors.textMuted}15`,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  staffText: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
  },
  msgText: { fontSize: FontSize.md, color: Colors.text, lineHeight: 21 },
  msgTime: {
    fontSize: FontSize.xs,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputRow: {
    flexDirection: 'row',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    ...Shadows.accent,
  },
});
