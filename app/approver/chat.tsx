import React from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Colors } from '@/constants/theme';
import ChatView from '@/components/ChatView';

export default function ApproverChatScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: `Chat — Order #${orderId}`, headerStyle: { backgroundColor: Colors.surface }, headerTintColor: Colors.text }} />
      <ChatView orderId={Number(orderId)} />
    </>
  );
}
