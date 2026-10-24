import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Hand, Send, UserRound, Wrench, ArrowLeft } from "lucide-react";
import { api, type ConversationDetail, type ConversationSummary, type Message } from "../lib/api";
import { useAuth } from "../lib/auth";
import { CHANNEL_LABEL, dateTime, displayName, timeAgo } from "../lib/format";
import { Empty, ErrorBox, Loading, PageHeader, TierBadge } from "../components/ui";

function Bubble({ m }: { m: Message }) {
  const mine = m.role !== "user";
  const who = m.role === "user" ? "Customer" : m.role === "assistant" ? "AI assistant" : "Team";
  const Icon = m.role === "user" ? UserRound : m.role === "assistant" ? Bot : Hand;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        <div className={`muted mb-1 flex items-center gap-1 text-[11px] ${mine ? "justify-end" : ""}`}>
          <Icon size={12} aria-hidden /> {who} · {dateTime(m.createdAt)}
        </div>
        <div
          className="whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm"
          style={
            m.role === "user"
              ? { background: "var(--surface-2)" }
              : m.role === "assistant"
                ? { background: "var(--accent)", color: "var(--accent-ink)" }
                : { background: "var(--surface-1)", border: "1px solid var(--accent)" }
          }
        >
          {m.content}
        </div>
        {/* What the AI understood and did on this turn, for transparency. */}
        {(m.meta?.intent || m.toolCalls.length > 0) && (
          <div className="mt-1 flex flex-wrap justify-end gap-1">
            {m.meta?.intent && (
              <span className="muted rounded-full px-2 py-0.5 text-[11px]" style={{ background: "var(--surface-2)" }}>
                intent: {m.meta.intent}
              </span>
            )}
            {m.toolCalls.map((t, i) => (
              <span key={i} className="muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: "var(--surface-2)" }}>
                <Wrench size={10} aria-hidden /> {t.tool} ({t.status})
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Thread({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const convo = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => api<ConversationDetail>(`/conversations/${id}`),
    refetchInterval: 5000, // pick up new customer messages
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["conversation", id] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  };
  const toggleAi = useMutation({
    mutationFn: (enabled: boolean) => api(`/conversations/${id}/ai`, { method: "POST", json: { enabled } }),
    onSuccess: refresh,
  });
  const reply = useMutation({
    mutationFn: (content: string) => api(`/conversations/${id}/messages`, { method: "POST", json: { content } }),
    onSuccess: () => {
      setText("");
      refresh();
    },
  });

  const count = convo.data?.messages.length ?? 0;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [count]);

  if (convo.isLoading) return <Loading />;
  if (convo.error || !convo.data) return <ErrorBox error={convo.error} />;
  const c = convo.data;
  const lead = c.contact.leads[0];
  const editable = can("ADMIN", "AGENT");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) reply.mutate(text.trim());
  }

  return (
    <div className="card flex h-[calc(100vh-170px)] min-h-[480px] flex-col p-0">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <button className="btn btn-ghost px-2 lg:hidden" onClick={onBack} aria-label="Back to list">
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{displayName(c.contact)}</div>
          <div className="muted truncate text-xs">
            {c.contact.email || "no email"} · {CHANNEL_LABEL[c.channel] ?? c.channel}
          </div>
        </div>
        {lead && <TierBadge tier={lead.tier} score={lead.score} />}
        {editable &&
          (c.aiEnabled ? (
            <button className="btn btn-ghost" disabled={toggleAi.isPending} onClick={() => toggleAi.mutate(false)}>
              <Hand size={15} aria-hidden /> Take over
            </button>
          ) : (
            <button className="btn btn-ghost" disabled={toggleAi.isPending} onClick={() => toggleAi.mutate(true)}>
              <Bot size={15} aria-hidden /> Hand back to AI
            </button>
          ))}
      </div>

      {!c.aiEnabled && (
        <div className="border-b px-4 py-2 text-xs text-amber-800 dark:text-amber-300" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <Hand size={12} className="mr-1 inline" aria-hidden /> The AI is paused. A team member is handling this chat.
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {c.messages.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
        <div ref={bottom} />
      </div>

      {editable && (
        <form className="flex gap-2 border-t p-3" style={{ borderColor: "var(--border)" }} onSubmit={submit}>
          <input
            className="input"
            placeholder={c.aiEnabled ? "Reply as a team member (this pauses the AI)…" : "Reply to the customer…"}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn btn-primary" disabled={!text.trim() || reply.isPending}>
            <Send size={15} aria-hidden /> Send
          </button>
        </form>
      )}
      {reply.error && <div className="px-3 pb-3"><ErrorBox error={reply.error} /></div>}
    </div>
  );
}

export function Inbox() {
  const [params, setParams] = useSearchParams();
  const selected = params.get("c");
  const handedOff = params.get("handedOff") === "true";
  const list = useQuery({
    queryKey: ["conversations", handedOff],
    queryFn: () => api<ConversationSummary[]>(`/conversations${handedOff ? "?handedOff=true" : ""}`),
    refetchInterval: 10_000,
  });

  const select = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("c", id);
    else next.delete("c");
    setParams(next, { replace: true });
  };
  const toggleFilter = () => {
    const next = new URLSearchParams(params);
    if (handedOff) next.delete("handedOff");
    else next.set("handedOff", "true");
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle="Every conversation across channels. Take over whenever the AI needs help."
        actions={
          <button className="btn btn-ghost" onClick={toggleFilter} aria-pressed={handedOff}>
            <Hand size={15} aria-hidden /> {handedOff ? "Showing: needs a human" : "Show only: needs a human"}
          </button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className={selected ? "hidden lg:block" : ""}>
          {list.isLoading && <Loading />}
          {list.error && <ErrorBox error={list.error} />}
          {list.data?.length === 0 && <Empty title="No conversations" hint="Chats from the website widget appear here." />}
          <div className="space-y-2">
            {list.data?.map((c) => (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                className="card block w-full text-left transition hover:shadow-sm"
                style={selected === c.id ? { borderColor: "var(--accent)" } : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{displayName(c.contact)}</span>
                  <span className="muted shrink-0 text-xs">{timeAgo(c.lastMessageAt)}</span>
                </div>
                <p className="secondary mt-1 line-clamp-2 text-sm">{c.lastMessage?.content ?? "—"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {c.lead && <TierBadge tier={c.lead.tier} />}
                  <span className="muted text-xs">{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                  {!c.aiEnabled && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                      <Hand size={12} aria-hidden /> Needs human
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className={selected ? "" : "hidden lg:block"}>
          {selected ? <Thread id={selected} onBack={() => select(null)} /> : <Empty title="Select a conversation" />}
        </div>
      </div>
    </>
  );
}
