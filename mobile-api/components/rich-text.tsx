import { Linking, Text, View } from "react-native";
import { C, T } from "./ui";
import { markdownBlocks } from "../services/markdown";

function inline(text: string, depth = 0): React.ReactNode {
  if (depth > 4) return text;
  const pattern =
    /(\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*([^*\n]+)\*)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    nodes.push(text.slice(last, match.index));
    if (match[2] || match[3])
      nodes.push(
        <Text
          key={match.index}
          style={{ fontFamily: "Inter_600SemiBold", color: C.ink }}
        >
          {inline(match[2] || match[3], depth + 1)}
        </Text>,
      );
    else if (match[4])
      nodes.push(
        <Text
          key={match.index}
          style={{ fontFamily: "monospace", backgroundColor: C.pale }}
        >
          {match[4]}
        </Text>,
      );
    else if (match[5]) {
      const url = match[6];
      nodes.push(
        <Text
          key={match.index}
          accessibilityRole="link"
          style={{ color: C.primary, textDecorationLine: "underline" }}
          onPress={() => void Linking.openURL(url)}
        >
          {match[5]}
        </Text>,
      );
    } else
      nodes.push(
        <Text key={match.index} style={{ fontStyle: "italic" }}>
          {match[7]}
        </Text>,
      );
    last = pattern.lastIndex;
  }
  nodes.push(text.slice(last));
  return nodes;
}

export function RichText({ content }: { content: string }) {
  return (
    <View style={{ gap: 7 }}>
      {markdownBlocks(content).map((block, index) => {
        if (!block.text) return <View key={index} style={{ height: 2 }} />;
        if (block.kind === "list")
          return (
            <View
              key={index}
              style={{ flexDirection: "row", gap: 8, paddingLeft: 3 }}
            >
              <T
                style={{
                  minWidth: 18,
                  color: C.primary,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {block.marker}
              </T>
              <T selectable style={{ flex: 1 }}>
                {inline(block.text)}
              </T>
            </View>
          );
        if (block.kind === "heading")
          return (
            <T
              key={index}
              selectable
              variant={block.level === 1 ? "h2" : "h3"}
              style={{ marginTop: 8 }}
            >
              {inline(block.text)}
            </T>
          );
        if (block.kind === "code")
          return (
            <View
              key={index}
              style={{ padding: 12, borderRadius: 10, backgroundColor: C.pale }}
            >
              <Text
                selectable
                style={{
                  fontFamily: "monospace",
                  color: C.text,
                  fontSize: 12,
                  lineHeight: 20,
                }}
              >
                {block.text}
              </Text>
            </View>
          );
        return (
          <T key={index} selectable>
            {inline(block.text)}
          </T>
        );
      })}
    </View>
  );
}
