import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import api, { errorMessage } from "../services/api";
import { useSession } from "./session";

interface Message {
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  provider?: string | null;
  response_kind?: "care" | "scope" | "identity";
}
interface Chat {
  owner: string | null;
  text: string;
  context: boolean;
  messages: Message[];
  busy: boolean;
  error: string;
}
const emptyChat = (owner: string | null): Chat => ({
  owner,
  text: "",
  context: false,
  messages: [],
  busy: false,
  error: "",
});
type AssistantSession = Omit<Chat, "owner"> & {
  setText: (text: string) => void;
  setContext: (context: boolean) => void;
  send: (prompt?: string) => Promise<void>;
};
const Context = createContext<AssistantSession | null>(null);

export function AssistantSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useSession();
  const owner = user?.patient_id ?? null;
  const [state, setState] = useState<Chat>(() => emptyChat(owner));
  const request = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    request.current?.abort();
    request.current = null;
    setState(emptyChat(owner));
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [owner]);
  // A response from a previous account cannot enter the next account's chat.
  function update(patch: Partial<Chat>) {
    setState((previous) =>
      previous.owner === owner ? { ...previous, ...patch } : previous,
    );
  }
  const visible = state.owner === owner ? state : emptyChat(owner);
  async function send(prompt = visible.text) {
    if (!owner || !prompt.trim() || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const previous = visible.messages;
    const next: Message[] = [
      ...previous,
      { role: "user", content: prompt.trim() },
    ];
    update({ messages: next, text: "", busy: true, error: "" });
    try {
      const { data } = await api.post<{
        message: string;
        model?: string | null;
        provider?: string | null;
        response_kind?: "care" | "scope" | "identity";
      }>(
        "/ai/chat",
        {
          messages: next
            .slice(-40)
            .map(({ role, content }) => ({ role, content })),
          patient_context: visible.context,
        },
        { timeout: 60000, signal: controller.signal },
      );
      if (!controller.signal.aborted)
        update({
          messages: [
            ...next,
            {
              role: "assistant",
              content: data.message,
              model: data.model,
              provider: data.provider,
              response_kind: data.response_kind,
            },
          ],
        });
    } catch (error) {
      if (!controller.signal.aborted)
        update({
          error: errorMessage(error),
          messages: previous,
          text: prompt,
        });
    } finally {
      if (request.current === controller) {
        request.current = null;
        update({ busy: false });
      }
    }
  }
  return (
    <Context.Provider
      value={{
        ...visible,
        setText: (text) => update({ text }),
        setContext: (context) => update({ context }),
        send,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAssistantSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Assistant session provider missing");
  return value;
}
