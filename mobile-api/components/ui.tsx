import React, { ComponentProps, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "./session";

import { C } from "../constants/theme";
export { C } from "../constants/theme";
export { CareCharacter as Companion } from "./care-character";
type Icon = ComponentProps<typeof Ionicons>["name"];
export const go = (path: string) => router.push(path as Href);
export function T({
  children,
  variant = "body",
  color,
  style,
  ...props
}: {
  children?: React.ReactNode;
  variant?: "display" | "h1" | "h2" | "h3" | "body" | "small" | "label";
  color?: string;
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const variants = {
    display: {
      fontSize: 34,
      lineHeight: 42,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: -1.5,
    },
    h1: {
      fontSize: 28,
      lineHeight: 36,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: -1,
    },
    h2: {
      fontSize: 21,
      lineHeight: 28,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: -0.6,
    },
    h3: { fontSize: 16, lineHeight: 24, fontFamily: "Inter_600SemiBold" },
    body: { fontSize: 14, lineHeight: 23, fontFamily: "Inter_400Regular" },
    small: { fontSize: 12, lineHeight: 19, fontFamily: "Inter_400Regular" },
    label: {
      fontSize: 11,
      lineHeight: 18,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 1.2,
    },
  };
  return (
    <Text
      {...props}
      style={[
        { color: C.text },
        variants[variant],
        color ? { color } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Brand({
  light = false,
  compact = false,
}: {
  light?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View
        accessibilityLabel="Adheronix mark"
        style={{
          width: 34,
          height: 36,
          borderRadius: 12,
          backgroundColor: light ? "#FFFFFF14" : C.ink,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 8,
            height: 23,
            borderRadius: 5,
            backgroundColor: C.accent,
            transform: [{ rotate: "27deg" }],
            position: "absolute",
            left: 11,
            top: 7,
          }}
        />
        <View
          style={{
            width: 8,
            height: 17,
            borderRadius: 5,
            backgroundColor: "#B9EEE1",
            transform: [{ rotate: "-27deg" }],
            position: "absolute",
            left: 19,
            top: 12,
          }}
        />
      </View>
      {!compact && (
        <T
          variant="h2"
          color={light ? C.white : C.ink}
          style={{ fontSize: 22, letterSpacing: -1 }}
        >
          adheronix<Text style={{ color: C.accent }}>.</Text>
        </T>
      )}
    </View>
  );
}
export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  small = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: Icon;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
}) {
  const color =
    variant === "primary" ? C.white : variant === "danger" ? C.red : C.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: small ? 44 : 48,
          paddingHorizontal: small ? 14 : 19,
          borderRadius: 14,
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor:
            variant === "primary"
              ? C.primary
              : variant === "secondary"
                ? C.mint
                : variant === "danger"
                  ? C.redBg
                  : "transparent",
          opacity: disabled || loading ? 0.6 : pressed ? 0.75 : 1,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: C.line,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : icon ? (
        <Ionicons name={icon} size={17} color={color} />
      ) : null}
      <T
        variant="small"
        color={color}
        style={{ fontFamily: "Inter_600SemiBold", fontSize: 13 }}
      >
        {label}
      </T>
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  badge = 0,
}: {
  name: Icon;
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 13,
        backgroundColor: pressed ? C.mint : C.white,
        borderWidth: 0,
        borderColor: C.line,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <Ionicons name={name} size={20} color={C.ink} />
      {badge > 0 && (
        <View
          style={{
            position: "absolute",
            top: 7,
            right: 8,
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: C.primary,
          }}
        />
      )}
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 22,
          padding: 20,
          gap: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[{ flexDirection: "row", alignItems: "center", gap: 12 }, style]}
    >
      {children}
    </View>
  );
}
export function Chip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "amber";
}) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 7,
        alignSelf: "flex-start",
        backgroundColor:
          tone === "green" ? C.mint : tone === "amber" ? C.amberBg : C.bg,
      }}
    >
      <T
        variant="small"
        color={
          tone === "green" ? C.primary : tone === "amber" ? C.amber : C.muted
        }
        style={{ fontFamily: "Inter_500Medium", fontSize: 11 }}
      >
        {label}
      </T>
    </View>
  );
}
export function Field({
  label,
  hint,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <T
        variant="small"
        color={focused ? C.primary : C.ink}
        style={{ fontFamily: "Inter_600SemiBold" }}
      >
        {label}
      </T>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor="#617888"
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          {
            borderWidth: focused ? 2 : 1,
            borderColor: focused ? C.primary : C.fieldBorder,
            borderRadius: 14,
            paddingHorizontal: 15,
            paddingVertical: 14,
            minHeight: 50,
            fontSize: 14,
            fontFamily: "Inter_400Regular",
            color: C.ink,
            backgroundColor: "#FBFDFE",
          },
          props.style,
        ]}
      />
      {hint && (
        <T variant="small" color={C.muted}>
          {hint}
        </T>
      )}
    </View>
  );
}
export function Notice({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      style={{
        padding: 14,
        borderRadius: 12,
        backgroundColor: error ? C.redBg : C.pale,
      }}
    >
      <T variant="small" color={error ? C.red : C.muted}>
        {message}
      </T>
    </View>
  );
}
export function Empty({
  icon = "leaf-outline",
  title,
  body,
  action,
}: {
  icon?: Icon;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: 36,
        paddingHorizontal: 20,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 18,
          backgroundColor: C.mint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={25} color={C.primary} />
      </View>
      <T variant="h3" style={{ textAlign: "center" }}>
        {title}
      </T>
      <T color={C.muted} style={{ textAlign: "center", maxWidth: 360 }}>
        {body}
      </T>
      {action}
    </View>
  );
}
export function Loading() {
  return (
    <View style={{ padding: 50, alignItems: "center", gap: 14 }}>
      <ActivityIndicator color={C.primary} />
      <T variant="small" color={C.muted}>
        Bringing your care space together…
      </T>
    </View>
  );
}
export function PageTitle({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <Row
      style={{
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        marginBottom: 24,
        gap: 16,
      }}
    >
      <View style={{ gap: 7, flex: 1, minWidth: 200 }}>
        {eyebrow && (
          <T variant="label" color={C.primary}>
            {eyebrow}
          </T>
        )}
        <T variant="h1">{title}</T>
        {body && <T color={C.muted}>{body}</T>}
      </View>
      {action}
    </Row>
  );
}
export function Screen({
  children,
  back = false,
  scroll = true,
  header,
  topPadding,
}: {
  children: React.ReactNode;
  back?: boolean;
  scroll?: boolean;
  header?: React.ReactNode;
  topPadding?: number;
}) {
  const wide = useWindowDimensions().width >= 960;
  const { user, unread } = useSession();
  const content = (
    <View
      style={{
        width: "100%",
        maxWidth: 1160,
        alignSelf: "center",
        paddingHorizontal: wide ? 36 : 20,
        paddingTop: topPadding ?? (wide ? 30 : 22),
        paddingBottom: scroll ? 28 : 8,
        flex: scroll ? undefined : 1,
      }}
    >
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <View
        style={{
          height: 64,
          borderBottomWidth: 1,
          borderBottomColor: C.line,
          backgroundColor: C.white,
          paddingHorizontal: wide ? 32 : 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {header ?? (
          <>
            <Row style={{ gap: 8 }}>
              {back && (
                <IconButton
                  name="arrow-back"
                  label="Go back"
                  onPress={() =>
                    router.canGoBack() ? router.back() : go("/home")
                  }
                />
              )}
              {wide ? (
                <View>
                  <T variant="small" color={C.muted}>
                    YOUR CARE SPACE
                  </T>
                  <T variant="small" style={{ fontFamily: "Inter_500Medium" }}>
                    {new Date().toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </T>
                </View>
              ) : (
                <Brand compact={back} />
              )}
            </Row>
            <Row style={{ gap: 5 }}>
              <IconButton
                name="notifications-outline"
                label="Notifications"
                badge={unread}
                onPress={() => go("/notifications")}
              />
              <Pressable
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Your profile"
                onPress={() => go("/support")}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: C.mint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <T
                  variant="small"
                  color={C.primary}
                  style={{ fontFamily: "Inter_600SemiBold" }}
                >
                  {user?.full_names
                    ?.split(" ")
                    .map((v) => v[0])
                    .slice(0, 2)
                    .join("") || "You"}
                </T>
              </Pressable>
            </Row>
          </>
        )}
      </View>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
export function ConfirmDialog({
  visible,
  title,
  body,
  onCancel,
  onConfirm,
  busy = false,
}: {
  visible: boolean;
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#15374E77",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Card style={{ width: "100%", maxWidth: 420, gap: 18 }}>
          <T variant="h2">{title}</T>
          <T color={C.muted}>{body}</T>
          <Row style={{ justifyContent: "flex-end" }}>
            <Button label="Keep it" onPress={onCancel} variant="ghost" />
            <Button
              label="Remove record"
              onPress={onConfirm}
              loading={busy}
              variant="danger"
            />
          </Row>
        </Card>
      </View>
    </Modal>
  );
}
export const sectionStyle = StyleSheet.create({
  columns: {
    flexDirection: "row",
    gap: 22,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  stack: { gap: 20 },
  divider: { height: 1, backgroundColor: C.line },
});
