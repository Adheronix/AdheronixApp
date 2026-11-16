import { useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  C,
  Companion,
  Notice,
  PageTitle,
  Row,
  Screen,
  T,
} from "../../components/ui";
import { RichText } from "../../components/rich-text";
import { useAssistantSession } from "../../components/assistant-session";
export default function Assistant() {
  const { text, setText, messages, busy, error, context, setContext, send } =
    useAssistantSession();
  const list = useRef<ScrollView>(null);
  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <PageTitle
          title="A little more clarity."
          body="Your everyday care companion."
        />
        <View
          style={{ flex: 1, maxWidth: 820, width: "100%", alignSelf: "center" }}
        >
          <ScrollView
            ref={list}
            onContentSizeChange={() => {
              if (messages.length)
                list.current?.scrollToEnd({ animated: false });
            }}
            contentContainerStyle={{
              flexGrow: 1,
              paddingVertical: 12,
              gap: 20,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {!messages.length ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 8,
                }}
              >
                <Companion kind="assistant" size={112} />
                <T variant="h2" style={{ textAlign: "center" }}>
                  What would make today a little clearer?
                </T>
                <T
                  color={C.muted}
                  style={{ textAlign: "center", maxWidth: 420 }}
                >
                  Ask about organizing your routine, preparing for a visit, or
                  understanding the information on your prescription.
                </T>
                <View
                  style={{
                    gap: 9,
                    width: "100%",
                    maxWidth: 470,
                    marginTop: 10,
                  }}
                >
                  {[
                    "Help me build a consistent medication routine",
                    "What should I bring to my next appointment?",
                    "Help me understand my medication record",
                  ].map((prompt) => (
                    <Button
                      key={prompt}
                      variant="secondary"
                      label={prompt}
                      onPress={() => void send(prompt)}
                    />
                  ))}
                </View>
              </View>
            ) : (
              messages.map((m, i) => (
                <View
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: m.role === "assistant" ? "100%" : "90%",
                    padding: 19,
                    borderRadius: 17,
                    backgroundColor: m.role === "user" ? C.ink : C.white,
                    borderWidth: m.role === "user" ? 0 : 1,
                    borderColor: C.line,
                    gap: 8,
                  }}
                >
                  {m.role === "assistant" && (
                    <Row style={{ gap: 6 }}>
                      <Ionicons
                        name="sparkles-outline"
                        size={13}
                        color={C.primary}
                      />
                      <T variant="small" color={C.primary}>
                        ADHERONIX
                      </T>
                    </Row>
                  )}
                  {m.role === "assistant" ? (
                    <RichText content={m.content} />
                  ) : (
                    <T selectable color={C.white}>
                      {m.content}
                    </T>
                  )}
                </View>
              ))
            )}
            {busy && <T color={C.muted}>Your assistant is thinking…</T>}
            {error && <Notice message={error} error />}
          </ScrollView>
          <View
            style={{
              paddingTop: 15,
              borderTopWidth: 1,
              borderTopColor: C.line,
              gap: 12,
            }}
          >
            <Row
              style={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <View style={{ flex: 1, gap: 2, paddingRight: 12 }}>
                <T variant="small" style={{ fontFamily: "Inter_500Medium" }}>
                  Include my medication context
                </T>
                <T variant="small" color={C.muted}>
                  When on, shares your medication and dose history with the AI
                  service.
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
            <Row
              style={{
                backgroundColor: C.white,
                borderWidth: 1,
                borderColor: C.line,
                borderRadius: 15,
                padding: 8,
                paddingLeft: 16,
                alignItems: "center",
              }}
            >
              <TextInput
                accessibilityLabel="Message your assistant"
                value={text}
                onChangeText={setText}
                placeholder="Ask a question about your routine…"
                placeholderTextColor={C.muted}
                style={{
                  flex: 1,
                  minHeight: 42,
                  maxHeight: 120,
                  color: C.ink,
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                }}
                multiline
                editable={!busy}
              />
              <Button
                label="Send"
                icon="arrow-up"
                loading={busy}
                disabled={!text.trim()}
                onPress={() => void send()}
              />
            </Row>
            <T variant="small" color={C.muted} style={{ textAlign: "center" }}>
              For everyday guidance, not diagnosis. Seek medical help for urgent
              symptoms.
            </T>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
