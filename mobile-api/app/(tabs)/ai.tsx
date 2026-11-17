import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  C,
  Companion,
  IconButton,
  Notice,
  Row,
  Screen,
  T,
} from "../../components/ui";
import { RichText } from "../../components/rich-text";
import { useAssistantSession } from "../../components/assistant-session";

const prompts = [
  {
    icon: "time-outline" as const,
    title: "Build a routine",
    body: "Find a rhythm for your day",
    prompt: "Help me build a consistent medication routine",
  },
  {
    icon: "chatbox-ellipses-outline" as const,
    title: "Get ready for a visit",
    body: "Make the most of your next appointment",
    prompt: "What should I bring to my next appointment?",
  },
  {
    icon: "document-text-outline" as const,
    title: "Understand my record",
    body: "Make sense of the details",
    prompt: "Help me understand my medication record",
  },
];

export default function Assistant() {
  const { text, setText, messages, busy, error, context, setContext, send } =
    useAssistantSession();
  const [settings, setSettings] = useState(false);
  const list = useRef<ScrollView>(null);
  const follow = useRef(true);
  const insets = useSafeAreaInsets();
  function sendPrompt(prompt?: string) {
    follow.current = true;
    void send(prompt);
  }
  return (
    <Screen
      scroll={false}
      topPadding={10}
      header={
        <Row style={{ width: "100%", justifyContent: "space-between" }}>
          <Row style={{ gap: 7 }}>
            <Companion
              kind="assistant"
              size={44}
              active={messages.length > 0}
            />
            <View style={{ gap: 1 }}>
              <T variant="h3" style={{ fontSize: 15 }}>
                Adheronix assistant
              </T>
              <T variant="small" color={C.muted} style={{ fontSize: 10.5 }}>
                {busy
                  ? "Putting your answer together…"
                  : "A little clarity, whenever you need it"}
              </T>
            </View>
          </Row>
          <IconButton
            name="options-outline"
            label="Assistant privacy and guidance"
            onPress={() => setSettings(true)}
          />
        </Row>
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={{ flex: 1, maxWidth: 820, width: "100%", alignSelf: "center" }}
        >
          <ScrollView
            ref={list}
            onScroll={({ nativeEvent: e }) => {
              follow.current =
                e.contentSize.height -
                  e.layoutMeasurement.height -
                  e.contentOffset.y <
                90;
            }}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              if (messages.length && follow.current)
                list.current?.scrollToEnd({ animated: false });
            }}
            contentContainerStyle={{
              flexGrow: 1,
              paddingVertical: 12,
              gap: 18,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!messages.length ? (
              <View
                style={{
                  alignItems: "center",
                  paddingTop: 6,
                  paddingBottom: 14,
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 170,
                    height: 154,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      position: "absolute",
                      width: 138,
                      height: 138,
                      borderRadius: 70,
                      backgroundColor: "#E9F2FC",
                      top: 8,
                    }}
                  />
                  <Companion kind="assistant" size={156} />
                </View>
                <T
                  variant="h1"
                  style={{ textAlign: "center", fontSize: 26, lineHeight: 33 }}
                >
                  Let’s make today{"\n"}a little easier.
                </T>
                <T
                  color={C.muted}
                  style={{
                    textAlign: "center",
                    maxWidth: 300,
                    fontSize: 13,
                    lineHeight: 21,
                  }}
                >
                  A question, a small plan, or a little reassurance. Where would
                  you like to start?
                </T>
                <View
                  style={{
                    width: "100%",
                    maxWidth: 440,
                    gap: 9,
                    marginTop: 12,
                  }}
                >
                  {prompts.map((item) => (
                    <Pressable
                      key={item.title}
                      accessibilityRole="button"
                      accessibilityLabel={item.title}
                      onPress={() => sendPrompt(item.prompt)}
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? C.pale : C.white,
                        borderWidth: 1,
                        borderColor: C.line,
                        borderRadius: 17,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      })}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 11,
                          backgroundColor: C.mint,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={C.primary}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 1 }}>
                        <T
                          variant="small"
                          style={{
                            fontFamily: "Inter_600SemiBold",
                            fontSize: 13,
                          }}
                        >
                          {item.title}
                        </T>
                        <T
                          variant="small"
                          color={C.muted}
                          style={{ fontSize: 10.5, lineHeight: 16 }}
                        >
                          {item.body}
                        </T>
                      </View>
                      <Ionicons
                        name="arrow-forward"
                        color={C.muted}
                        size={16}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              messages.map((message, index) =>
                message.role === "user" ? (
                  <View
                    key={index}
                    style={{
                      alignSelf: "flex-end",
                      maxWidth: "88%",
                      backgroundColor: C.ink,
                      borderRadius: 21,
                      borderBottomRightRadius: 6,
                      paddingHorizontal: 17,
                      paddingVertical: 14,
                    }}
                  >
                    <T selectable color={C.white}>
                      {message.content}
                    </T>
                  </View>
                ) : (
                  <View key={index} style={{ gap: 8, alignSelf: "stretch" }}>
                    <Row style={{ gap: 6, paddingLeft: 3 }}>
                      <Ionicons name="sparkles" size={13} color={C.primary} />
                      <T
                        variant="small"
                        color={C.primary}
                        style={{
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 11,
                        }}
                      >
                        Adheronix
                      </T>
                    </Row>
                    <View
                      style={{
                        padding: 18,
                        backgroundColor: C.white,
                        borderRadius: 21,
                        borderTopLeftRadius: 6,
                        borderWidth: 1,
                        borderColor: C.line,
                      }}
                    >
                      <RichText content={message.content} />
                    </View>
                  </View>
                ),
              )
            )}
            {busy && (
              <Row style={{ gap: 10, padding: 12 }}>
                <Companion kind="assistant" size={46} />
                <ActivityIndicator size="small" color={C.primary} />
                <T variant="small" color={C.muted}>
                  A little thought, a clearer answer…
                </T>
              </Row>
            )}
            {error && <Notice message={error} error />}
          </ScrollView>
          <View style={{ paddingTop: 9, gap: 8 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Medication context settings"
                onPress={() => setSettings(true)}
                hitSlop={8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingVertical: 4,
                }}
              >
                <Ionicons
                  name={context ? "shield-checkmark" : "shield-outline"}
                  size={13}
                  color={context ? C.success : C.muted}
                />
                <T
                  variant="small"
                  color={context ? C.success : C.muted}
                  style={{ fontSize: 10.5, fontFamily: "Inter_500Medium" }}
                >
                  Care context {context ? "on" : "off"}
                </T>
                <Ionicons name="chevron-down" size={12} color={C.muted} />
              </Pressable>
              <T variant="small" color={C.muted} style={{ fontSize: 10 }}>
                Your choice. Every conversation.
              </T>
            </Row>
            <Row
              style={{
                backgroundColor: C.white,
                borderWidth: 1,
                borderColor: "#C4D8E4",
                borderRadius: 25,
                padding: 7,
                paddingLeft: 16,
                gap: 9,
              }}
            >
              <TextInput
                accessibilityLabel="Message your assistant"
                value={text}
                onChangeText={setText}
                placeholder="What’s on your mind?"
                placeholderTextColor={C.muted}
                style={{
                  flex: 1,
                  minHeight: 42,
                  maxHeight: 110,
                  paddingVertical: 10,
                  color: C.ink,
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  lineHeight: 21,
                }}
                multiline
                editable={!busy}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: !text.trim() || busy, busy }}
                disabled={!text.trim() || busy}
                onPress={() => sendPrompt()}
                style={({ pressed }) => ({
                  width: 42,
                  height: 42,
                  borderRadius: 22,
                  backgroundColor: !text.trim() || busy ? "#DAE7ED" : C.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={C.primary} />
                ) : (
                  <Ionicons
                    name="arrow-up"
                    size={21}
                    color={!text.trim() ? "#6B8797" : C.white}
                  />
                )}
              </Pressable>
            </Row>
            <T
              variant="small"
              color={C.muted}
              style={{ textAlign: "center", fontSize: 10, lineHeight: 15 }}
            >
              General guidance. Follow your clinician’s plan.
            </T>
          </View>
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={settings}
        transparent
        animationType="fade"
        onRequestClose={() => setSettings(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#15374E66",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close assistant settings"
            style={{ flex: 1 }}
            onPress={() => setSettings(false)}
          />
          <View
            accessibilityViewIsModal
            style={{
              width: "100%",
              maxWidth: 540,
              alignSelf: "center",
              backgroundColor: C.white,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 24,
              paddingBottom: Math.max(24, insets.bottom + 16),
              gap: 18,
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 36,
                height: 4,
                borderRadius: 3,
                backgroundColor: C.line,
                marginTop: -10,
              }}
            />
            <Row style={{ justifyContent: "space-between" }}>
              <T variant="h2">A little support, your way.</T>
              <IconButton
                name="close"
                label="Close assistant settings"
                onPress={() => setSettings(false)}
              />
            </Row>
            <T color={C.muted}>
              Your assistant can help organize a routine and prepare questions
              for a visit. It does not diagnose or change treatment. For urgent
              symptoms, seek medical help.
            </T>
            <View style={{ height: 1, backgroundColor: C.line }} />
            <Row
              style={{
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, gap: 6, paddingRight: 18 }}>
                <T variant="h3">Include my medication context</T>
                <T variant="small" color={C.muted}>
                  When on, your medication and recent dose history are shared
                  with the AI service for this conversation. Keep it off for
                  general questions.
                </T>
              </View>
              <Switch
                accessibilityLabel="Include my medication context"
                value={context}
                onValueChange={setContext}
                trackColor={{ false: C.line, true: C.accent }}
                thumbColor={C.white}
              />
            </Row>
            <Button label="Done" onPress={() => setSettings(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
