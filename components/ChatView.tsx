import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
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
  created_at: string;
}

interface Props {
  orderId: number;
}

export default function ChatView({ orderId }: Props) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const seenIds = useRef(new Set<number>());

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/messages/${orderId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
        seenIds.current = new Set(data.map((m: Message) => m.id));
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  }, [orderId]);

  useEffect(() => {
    loadMessages();
    socket?.emit('join-order', { orderId });

    const handleNewMessage = (msg: Message) => {
      if (msg.order_id !== orderId) return;
      if (seenIds.current.has(msg.id)) return;
      seenIds.current.add(msg.id);
      setMessages((prev) => [...prev, msg]);
    };

    socket?.on('chat:new-message', handleNewMessage);
    return () => { socket?.off('chat:new-message', handleNewMessage); };
  }, [orderId, socket, loadMessages]);

  const sendMessage = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, sender_id: user.id, text: text.trim() }),
      });
      const msg = await res.json();
      socket?.emit('chat:message', msg);
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
    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index * 30, 300)).duration(200)}>
        <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
            {!isMe && <Text style={styles.senderName}>{item.sender_name}</Text>}
            <Text style={[styles.msgText, { color: isMe ? '#fff' : Colors.text }]}>{item.text}</Text>
            <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.7)' : Colors.textMuted }]}>
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
          <Text style={styles.empty}>No messages yet. Start the conversation!</Text>
        }
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor={Colors.textMuted}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <AnimatedPressable style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]} onPress={sendMessage} disabled={!text.trim() || sending}>
          <Ionicons name="send" size={20} color="#fff" />
        </AnimatedPressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, flexGrow: 1 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
  msgRow: { marginBottom: Spacing.sm, flexDirection: 'row' },
  msgRowMe: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '75%',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  bubbleMe: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
    ...Shadows.md,
  },
  bubbleOther: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    ...Shadows.md,
  },
  senderName: {
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    fontWeight: '600',
    marginBottom: 2,
  },
  msgText: { fontSize: FontSize.md, color: Colors.text },
  msgTime: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputRow: {
    flexDirection: 'row',
    padding: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
});
