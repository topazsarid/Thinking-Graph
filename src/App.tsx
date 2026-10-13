import MovableDialogContent from "./MovableDialogContent";
import { requestExtraction } from "./requestExtraction";
import NotesPanel from "./NotesPanel";
import MobileNotes from "./MobileNotes";
import { DropdownMenu } from "radix-ui";

import { useEffect, useState, useRef } from "react";
import ExtractionReview, { ExtractionEvidence } from "./ExtractionReview";
import CreateMapIdea from "./CreateMapIdea";
import DrawingBoard from "./DrawingBoard";
import ResizablePanels from "./ResizablePanels";
import FlowerBirds from "./FlowerBirds";
import GrowingGarden from "./GrowingGarden";
import FireScreen from "./FireScreen";
import EffectStudio, {
  CustomEffect,
  loadSavedEffects,
  type EffectConfig,
} from "./EffectStudio";
import ConversationDrawer from "./ConversationDrawer";
import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  MessagesSquare,
} from "lucide-react";
import ThemePicker from "./ThemePicker";
import { Taxonomy } from "./Taxonomy";
import IdeaMap from "./IdeaMap";
import MessageReplies from "./MessageReplies";
import ModelQueue, { pokeQueue } from "./ModelQueue";
import ExplanationPanel from "./ExplanationPanel";
import AnswerPreference from "./AnswerPreference";
import ConnectionEditor, { ConnectionDetails } from "./ConnectionEditor";
import {
  Network,
  Plus,
  Send,
  Link2,
  MessageSquare,
  ArrowUpRight,
  Check,
  X,
  Sparkles,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
const empty: any = {
  users: [],
  conversations: [],
  messages: [],
  ideas: [],
  workspaces: [],
  workspace_ideas: [],
  message_ideas: [],
  connections: [],
  connection_participants: [],
  events: [],
};
// With no items, an open Select is an empty list that also locks page scrolling,
// so the picker is disabled and says how to create the first item instead.
function Picker({ value, onChange, items, label, emptyLabel }: any) {
  const empty = !items.length;
  return (
    <Select
      value={value || undefined}
      onValueChange={onChange}
      disabled={empty}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={empty ? emptyLabel || "אין עדיין פריטים" : label} />
      </SelectTrigger>
      <SelectContent>
        {items.map((x: any) => (
          <SelectItem key={x.id} value={x.id}>
            {x.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export default function App() {
  const [mobileView, setMobileView] = useState("menu");
  const [notesOpen, setNotesOpen] = useState(false),
    [newNote, setNewNote] = useState(false),
    [selectedNotes, setSelectedNotes] = useState<string[]>([]),
    [notesPreparing, setNotesPreparing] = useState(false),
    [deletedConnectionsOpen, setDeletedConnectionsOpen] = useState(false);
  const noteWork = useRef(false),
    noteSnapshot = useRef<{ key: string; id: string } | null>(null);
  const [customEffect, setCustomEffect] = useState<EffectConfig | null>(null);
  function applyEffect(config: EffectConfig) {
    setGarden(false);
    setGrowing(false);
    setFire(false);
    setCustomEffect(config);
  }
  const [fire, setFire] = useState(false);
  const [growing, setGrowing] = useState(false);
  const [garden, setGarden] = useState(() => {
    try {
      return localStorage.getItem("thinking-graph:garden") === "true";
    } catch {
      return false;
    }
  });
  function toggleGarden() {
    const next = !garden;
    setGarden(next);
    try {
      localStorage.setItem("thinking-graph:garden", String(next));
    } catch {}
  }
  const [themeColor, setThemeColor] = useState("#215b4b");
  // Top bar: effects/notes menus open these dialogs; the second bar can be hidden.
  const [studioOpen, setStudioOpen] = useState(false),
    [colorOpen, setColorOpen] = useState(false),
    [drawerOpen, setDrawerOpen] = useState(false),
    [savedEffects, setSavedEffects] = useState(loadSavedEffects);
  const [barHidden, setBarHidden] = useState(() => {
    try {
      return localStorage.getItem("thinking-graph:workspace-bar-hidden") === "true";
    } catch {
      return false;
    }
  });
  const [composerHidden, setComposerHidden] = useState(() => {
    try {
      return localStorage.getItem("thinking-graph:composer-hidden") === "true";
    } catch {
      return false;
    }
  });
  function toggleComposer(hidden: boolean) {
    setComposerHidden(hidden);
    try {
      localStorage.setItem("thinking-graph:composer-hidden", String(hidden));
    } catch {}
  }
  // Focus mode: the three windows fill the whole screen, without any bars. Esc leaves it.
  const [focusMode, setFocusMode] = useState(false);
  useEffect(() => {
    if (!focusMode) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]"))
        setFocusMode(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [focusMode]);
  function toggleBar() {
    const next = !barHidden;
    setBarHidden(next);
    try {
      localStorage.setItem("thinking-graph:workspace-bar-hidden", String(next));
    } catch {}
  }
  // Chat conversations, without the hidden ones that hold notes-extraction snapshots.
  function chatConversations() {
    const noteChats = new Set(
      (g.note_message_sources || []).map(
        (n: any) =>
          g.messages.find((m: any) => m.id === n.message_id)?.conversation_id,
      ),
    );
    return g.conversations.filter((c: any) => !noteChats.has(c.id));
  }
  async function newChat() {
    try {
      const r = await act({ action: "conversation", title: "שיחה חדשה" });
      setConv(r.id);
      setDrawerOpen(false);
    } catch {}
  }
  const [g, setG] = useState(empty),
    [conv, setConv] = useState(""),
    [ws, setWs] = useState(""),
    [draft, setDraft] = useState(""),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [modal, setModal] = useState(""),
    [name, setName] = useState(""),
    [ids, setIds] = useState<string[]>([]),
    [linkIdea, setLinkIdea] = useState(""),
    [source, setSource] = useState(""),
    [editTitle, setEditTitle] = useState(""),
    [editSummary, setEditSummary] = useState("");
  async function refresh() {
    const r = await fetch("/api/graph");
    const data: any = await r.json();
    if (!r.ok) {
      throw Error(data.error);
    }
    setG(data);
    setConv((c) => {
      if (c) return c;
      const noteChats = new Set(
        (data.note_message_sources || []).map(
          (n: any) =>
            data.messages.find((m: any) => m.id === n.message_id)
              ?.conversation_id,
        ),
      );
      return (
        data.conversations.find((x: any) => !noteChats.has(x.id))?.id || ""
      );
    });
    setWs((w) => w || data.workspaces[0]?.id || "");
    setLoaded(true);
    return data;
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  const [connectionIds, setConnectionIds] = useState<string[] | null>(null),
    [connectionId, setConnectionId] = useState("");
  const [mapPlacement, setMapPlacement] = useState<{
    id: string;
    workspaceId: string;
    point: { x: number; y: number };
  } | null>(null);
  // After approving an extraction, the map frames that run's ideas (nonce re-triggers for each approval).
  const [revealRun, setRevealRun] = useState<{
    runId?: string;
    ids?: string[];
    nonce: number;
  } | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false),
    [preferenceOpen, setPreferenceOpen] = useState(false);
  // The writing box height is adjustable (drag the grip); the message list takes the remaining space.
  const [composerHeight, setComposerHeight] = useState(() => {
    try {
      return (
        Number(localStorage.getItem("thinking-graph:composer-height")) || 90
      );
    } catch {
      return 90;
    }
  });
  function clampComposer(h: number) {
    return Math.round(Math.max(40, Math.min(window.innerHeight * 0.6, h)));
  }
  function saveComposerHeight(h: number) {
    const next = clampComposer(h);
    setComposerHeight(next);
    try {
      localStorage.setItem("thinking-graph:composer-height", String(next));
    } catch {}
  }
  function resizeComposer(e: any) {
    e.preventDefault();
    const grip = e.currentTarget as HTMLElement,
      startY = e.clientY,
      start = composerHeight;
    let last = start;
    grip.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      last = clampComposer(start + (startY - ev.clientY));
      setComposerHeight(last);
    };
    const up = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", up);
      saveComposerHeight(last);
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  }
  function revealIdeas(ids: string[], workspaceId: string) {
    if (!ids.length) return;
    if (workspaceId !== ws) {
      setWs(workspaceId);
      setSelected("");
    }
    setRevealRun((r) => ({ ids, nonce: (r?.nonce || 0) + 1 }));
    if (window.matchMedia("(max-width:650px)").matches) setMobileView("map");
  }
  function showApproved(runId: string) {
    setRevealRun((r) => ({ runId, nonce: (r?.nonce || 0) + 1 }));
    if (window.matchMedia("(max-width:650px)").matches) setMobileView("map");
  }
  function mapReveal() {
    if (!revealRun) return null;
    if (revealRun.ids) return { ids: revealRun.ids, nonce: revealRun.nonce };
    const run = (g.extraction_runs || []).find(
      (r: any) => r.id === revealRun.runId && r.status === "reviewed",
    );
    if (!run || run.workspace_id !== ws) return null;
    const review = JSON.parse(run.review);
    return {
      ids: review.items
        .filter((i: any) => i.kind === "idea")
        .map((i: any) => review.entities[i.key])
        .filter(Boolean),
      nonce: revealRun.nonce,
    };
  }
  const mapCreatePoint = useRef<{ x: number; y: number } | null>(null);
  const [newMapItem, setNewMapItem] = useState<"idea" | "question" | null>(
    null,
  );
  const [taxonomyOpen, setTaxonomyOpen] = useState(false);
  const [extractionRun, setExtractionRun] = useState(""),
    [extracting, setExtracting] = useState<string[]>([]);
  const extractionRequests = useRef<Record<string, string>>({});
  async function extract(messageId: string, workspaceId = ws) {
    if (extracting.includes(messageId) || !workspaceId) return;
    setExtracting((list) => [...list, messageId]);
    setError("");
    const key = messageId + workspaceId;
    extractionRequests.current[key] ??= crypto.randomUUID();
    // Opens the review when done, unless another review is already open (its button stays on the message).
    try {
      const request = requestExtraction({
        requestId: extractionRequests.current[key],
        messageId,
        workspaceId,
      });
      pokeQueue();
      const data = await request;
      delete extractionRequests.current[key];
      await refresh();
      setExtractionRun((current) => current || data.id);
    } catch (e) {
      if (e instanceof Error && e.name === "Cancelled")
        delete extractionRequests.current[key];
      else setError(e instanceof Error ? e.message : "לא ניתן להתחבר לשרת");
    } finally {
      setExtracting((list) => list.filter((id) => id !== messageId));
    }
  }
  async function extractNotes(noteIds: string[]) {
    if (noteWork.current || busy) return;
    const chosen = (g.notes || []).filter((n: any) => noteIds.includes(n.id));
    if (!chosen.length || chosen.length > 12) {
      setError("בחרי בין פתק אחד ל־12 פתקים.");
      setNotesOpen(false);
      return;
    }
    noteWork.current = true;
    setNotesPreparing(true);
    setError("");
    try {
      let workspaceId = ws;
      if (!workspaceId) {
        const r = await act({ action: "workspace", title: "מרחב החשיבה שלי" });
        workspaceId = r.id;
        setWs(workspaceId);
      }
      const key = JSON.stringify([
        workspaceId,
        chosen.map((n: any) => [n.id, n.updated_at]),
      ]);
      if (noteSnapshot.current?.key !== key) {
        const r = await act({
          action: "snapshot-notes",
          noteIds: chosen.map((n: any) => n.id),
          workspaceId,
        });
        noteSnapshot.current = { key, id: r.id };
      }
      setNotesOpen(false);
      await extract(noteSnapshot.current.id, workspaceId);
    } catch (e) {
      setNotesOpen(false);
      setError(e instanceof Error ? e.message : "החילוץ נכשל");
    } finally {
      noteWork.current = false;
      setNotesPreparing(false);
    }
  }
  const pending = useRef<{ key: string; id: string } | null>(null);
  const working = useRef(false);
  async function act(body: any) {
    if (working.current) throw Error("פעולה כבר מתבצעת");
    working.current = true;
    setBusy(true);
    setError("");
    const key = JSON.stringify(body);
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    try {
      const r = await fetch("/api/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, commandId: pending.current.id }),
      });
      const result = await r.json();
      if (!r.ok) {
        if (r.status < 500) pending.current = null;
        throw Error(result.error || "השמירה נכשלה");
      }
      pending.current = null;
      try {
        await refresh();
      } catch {
        setError("הפעולה נשמרה, אבל התצוגה לא התעדכנה. לחצי על ניסיון נוסף.");
      }
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "לא ניתן להתחבר לשרת המקומי");
      throw e;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  const sending = useRef(false);
  async function send(withExtraction = false) {
    if (!draft.trim() || busy || sending.current || !loaded) return;
    sending.current = true;
    const content = draft;
    try {
      let workspaceId = ws,
        conversationId = conv;
      if (!workspaceId) {
        const r = await act({ action: "workspace", title: "מרחב החשיבה שלי" });
        workspaceId = r.id;
        setWs(r.id);
      }
      if (!conversationId) {
        const r = await act({ action: "conversation", title: "חקירה ראשונה" });
        conversationId = r.id;
        setConv(r.id);
      }
      const message = await act({
        action: "message",
        content,
        conversationId,
        workspaceId,
        extractRules: false,
      });
      if (withExtraction) void extract(message.id, workspaceId);
      setDraft((current) => (current === content ? "" : current));
    } catch {
    } finally {
      sending.current = false;
    }
  }
  const active = g.ideas.find((i: any) => i.id === selected);
  const visible = g.ideas.filter(
    (i: any) =>
      i.status !== "rejected" &&
      g.workspace_ideas.some(
        (w: any) => w.workspace_id === ws && w.idea_id === i.id,
      ),
  );
  const positions = new Map(
    visible.map((i: any, n: number) => [
      i.id,
      { x: 160 + (n % 3) * 245, y: 100 + Math.floor(n / 3) * 190 },
    ]),
  );
  const edges = g.connections
    .filter((c: any) => !c.deleted_at)
    .map((c: any) => ({
      ...c,
      ps: g.connection_participants.filter(
        (p: any) => p.connection_id === c.id,
      ),
    }))
    .filter(
      (c: any) =>
        c.ps.length >= 2 && c.ps.every((p: any) => positions.has(p.idea_id)),
    );
  const messages = g.messages
    .filter((m: any) => m.conversation_id === conv)
    .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
  const sources = active
    ? g.message_ideas
        .filter((l: any) => l.idea_id === active.id)
        .map((l: any) => ({
          ...g.messages.find((m: any) => m.id === l.message_id),
          method: l.method,
        }))
    : [];
  function open(kind: string) {
    setModal(kind);
    setName("");
    setIds([]);
    setLinkIdea("");
  }
  function inspect(id: string) {
    setSelected(id);
    const i = g.ideas.find((x: any) => x.id === id);
    setEditTitle(i.title);
    setEditSummary(i.summary);
  }
  async function revise(status: string) {
    try {
      await act({
        action: "idea",
        id: active.id,
        title: editTitle,
        summary: editSummary,
        status,
      });
    } catch {}
  }

  return (
    <main
      dir="rtl"
      className={`workspace-page${garden || growing || fire || customEffect ? " garden-mode" : ""}${barHidden ? " bar-hidden" : ""}${focusMode ? " focus-mode" : ""}`}
    >
      <div className="board-effects" aria-hidden="true">
        {garden && <FlowerBirds color={themeColor} />}
        {growing && <GrowingGarden color={themeColor} />}
        {fire && <FireScreen />}
        {customEffect && <CustomEffect config={customEffect} />}
      </div>
      <header className="topbar">
        <div className="brand" dir="ltr">
          <span className="brand-icon">
            <Network size={22} />
          </span>
          Thinking Graph<span className="version">0.1</span>
        </div>
        <div className="row">
          <button
            className="secondary"
            data-drawer-toggle
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <MessagesSquare size={17} /> שיחות
          </button>
          <DropdownMenu.Root
            dir="rtl"
            onOpenChange={(o) => {
              if (o) setSavedEffects(loadSavedEffects());
            }}
          >
            <DropdownMenu.Trigger asChild>
              <button className="secondary">
                אפקטים <ChevronDown size={15} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="map-context-menu top-menu"
                collisionPadding={10}
              >
                <DropdownMenu.CheckboxItem
                  checked={garden}
                  onCheckedChange={() => toggleGarden()}
                >
                  <DropdownMenu.ItemIndicator>✓ </DropdownMenu.ItemIndicator>
                  גן ציפורים
                </DropdownMenu.CheckboxItem>
                <DropdownMenu.CheckboxItem
                  checked={growing}
                  onCheckedChange={() => setGrowing((v) => !v)}
                >
                  <DropdownMenu.ItemIndicator>✓ </DropdownMenu.ItemIndicator>
                  גן צומח
                </DropdownMenu.CheckboxItem>
                <DropdownMenu.CheckboxItem
                  checked={fire}
                  onCheckedChange={() => setFire((v) => !v)}
                >
                  <DropdownMenu.ItemIndicator>✓ </DropdownMenu.ItemIndicator>
                  מסך בוער
                </DropdownMenu.CheckboxItem>
                {savedEffects.length > 0 && (
                  <>
                    <DropdownMenu.Separator className="menu-separator" />
                    <DropdownMenu.Label className="menu-label">
                      האפקטים שלי
                    </DropdownMenu.Label>
                    {savedEffects.map((item) => (
                      <DropdownMenu.Item
                        key={item.id}
                        onSelect={() => applyEffect({ ...item.config })}
                      >
                        {item.name}
                      </DropdownMenu.Item>
                    ))}
                  </>
                )}
                {customEffect && (
                  <DropdownMenu.Item onSelect={() => setCustomEffect(null)}>
                    כיבוי האפקט שלי
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator className="menu-separator" />
                <DropdownMenu.Item onSelect={() => setStudioOpen(true)}>
                  יצירת אפקט…
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => setColorOpen(true)}>
                  שינוי צבע…
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <DropdownMenu.Root dir="rtl">
            <DropdownMenu.Trigger asChild>
              <button className="secondary" disabled={!loaded}>
                פתקים <ChevronDown size={15} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="map-context-menu top-menu"
                collisionPadding={10}
              >
                <DropdownMenu.Item
                  disabled={busy}
                  onSelect={() => {
                    setNewNote(true);
                    setNotesOpen(true);
                  }}
                >
                  יצירת פתק
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  disabled={busy || notesPreparing}
                  onSelect={() => {
                    if (selectedNotes.length) void extractNotes(selectedNotes);
                    else {
                      setNewNote(false);
                      setNotesOpen(true);
                    }
                  }}
                >
                  {notesPreparing
                    ? "מחלצת…"
                    : `חילוץ מפתקים${selectedNotes.length ? ` (${selectedNotes.length})` : ""}`}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => {
                    setNewNote(false);
                    setNotesOpen(true);
                  }}
                >
                  כל הפתקים ({(g.notes || []).length})
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <button
            className="icon-button"
            aria-label={barHidden ? "הצגת סרגל המרחבים" : "הסתרת סרגל המרחבים"}
            title={barHidden ? "הצגת סרגל המרחבים" : "הסתרת סרגל המרחבים"}
            aria-pressed={!barHidden}
            onClick={toggleBar}
          >
            {barHidden ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
          <button
            className="icon-button"
            aria-label="הלוחות על כל המסך"
            title="הלוחות על כל המסך (Esc ליציאה)"
            onClick={() => setFocusMode(true)}
          >
            <Maximize2 size={18} />
          </button>
        </div>
        <div className="status">
          {busy ? "שומרת…" : loaded ? "" : "מתחברים לגרף…"}
        </div>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}{" "}
          {
            <button
              onClick={() =>
                refresh()
                  .then(() => setError(""))
                  .catch((e) => setError(e.message))
              }
            >
              ניסיון נוסף
            </button>
          }
        </div>
      )}
      {!barHidden && (
        <div className="workspace-bar">
          <div className="row">
            <Layers size={19} />
            <Picker
              value={ws}
              onChange={(v: string) => {
                setWs(v);
                setSelected("");
              }}
              items={g.workspaces}
              label="בחרי מרחב"
              emptyLabel="אין עדיין מרחב · לחצי ＋"
            />
            <button
              className="icon-button"
              aria-label="מרחב חדש"
              onClick={() => open("workspace")}
            >
              <Plus size={18} />
            </button>
          </div>
          <button className="secondary" onClick={() => setTaxonomyOpen(true)}>
            עץ סוגי הקשרים
          </button>
        </div>
      )}
      <div className="mobile-navigation" dir="rtl">
        <strong>Thinking Graph</strong>
        <button
          className="secondary"
          data-drawer-toggle
          onClick={() => setDrawerOpen((v) => !v)}
        >
          שיחות
        </button>
        <select
          aria-label="מסך בנייד"
          value={mobileView}
          onChange={(e) => setMobileView(e.target.value)}
        >
          <option value="menu">תפריט</option>
          <option value="chat">שיחה</option>
          <option value="notes">פתקים</option>
          <option value="map">המפה שלי</option>
        </select>
      </div>
      {mobileView === "menu" && (
        <nav className="mobile-entry" aria-label="בחירת מסך">
          <h2>מרחב החשיבה שלך</h2>
          {[
            ["chat", "שיחה"],
            ["notes", "פתקים"],
            ["map", "המפה שלי"],
          ].map(([id, label]) => (
            <button
              key={id}
              className="secondary"
              onClick={() => setMobileView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      <div className="mobile-notes" hidden={mobileView !== "notes"}>
        <MobileNotes notes={g.notes || []} act={act} ready={loaded && !busy} />
      </div>
      {focusMode && (
        <button className="focus-exit" onClick={() => setFocusMode(false)}>
          <Minimize2 size={15} /> יציאה ממסך מלא
        </button>
      )}
      <ResizablePanels mobileView={mobileView} fill={focusMode}>
        <section className="chat">
          <div className="messages">
            {!messages.length && (
              <div className="chat-empty">
                <span className="small-icon">
                  <Sparkles size={23} />
                </span>
                <h2>
                  מחשבה אחת.
                  <br />
                  הרבה כיוונים.
                </h2>
                <p>
                  כתבי מחשבה, שאלה או הבחנה.
                  <br />
                  אפשר לשמור אותה ולבקש חילוץ, או להתחיל ישירות במפה.
                </p>
                <button
                  className="example"
                  onClick={() =>
                    setDraft(
                      "אני חושבת שיש קשר בין [[שדה]] לבין [[כוח]]. איך [[שדה]] משפיע על תנועה?",
                    )
                  }
                >
                  נסי: מה הקשר בין שדה לכוח? <ArrowUpRight size={16} />
                </button>
              </div>
            )}
            {messages.map((m: any) => (
              <article
                tabIndex={-1}
                id={"message-" + m.id}
                key={m.id}
                className="message"
              >
                <div className="message-meta">
                  {g.users.find((u: any) => u.id === m.created_by)?.name ||
                    "כותבת"}
                  <time>
                    {new Date(m.created_at).toLocaleTimeString("he-IL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p>{m.content}</p>
                <div className="chips">
                  {g.message_ideas
                    .filter((l: any) => l.message_id === m.id)
                    .map((l: any) => (
                      <button
                        key={l.idea_id}
                        onClick={() => inspect(l.idea_id)}
                      >
                        {g.ideas.find((i: any) => i.id === l.idea_id)?.title}
                      </button>
                    ))}
                </div>
                <button
                  className="text-button"
                  disabled={extracting.includes(m.id) || busy || !ws}
                  onClick={() => extract(m.id)}
                >
                  {extracting.includes(m.id)
                    ? "מחלצת עם המודל המקומי…"
                    : "חילוץ רעיונות, קשרים והקשר"}
                </button>
                {(g.extraction_runs || [])
                  .filter((r: any) => r.message_id === m.id)
                  .map((r: any) => (
                    <button
                      className="text-button"
                      key={r.id}
                      onClick={() => setExtractionRun(r.id)}
                    >
                      {r.status === "pending"
                        ? "בדיקת טיוטת חילוץ"
                        : "רעיונות והקשר שאושרו"}
                    </button>
                  ))}
                <button
                  className="text-button"
                  onClick={() => {
                    setSource(m.id);
                    open("link");
                  }}
                >
                  קישור לרעיון קיים <Link2 size={13} />
                </button>
                <MessageReplies
                  message={m}
                  graph={g}
                  workspaceId={ws}
                  onReveal={revealIdeas}
                  onRefresh={refresh}
                  onExternal={() => setExplanationOpen(true)}
                />
              </article>
            ))}
          </div>
          {composerHidden ? (
            <button
              className="composer-show"
              onClick={() => toggleComposer(false)}
            >
              <ChevronUp size={15} /> כתיבת הודעה
            </button>
          ) : (
            <>
              <div className="composer-bar">
              <div
                className="composer-grip"
                role="separator"
                aria-orientation="horizontal"
                aria-label="שינוי גובה תיבת הכתיבה (גררי, או חצים למעלה/למטה)"
                tabIndex={0}
                onPointerDown={resizeComposer}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                    saveComposerHeight(
                      composerHeight + (e.key === "ArrowUp" ? 20 : -20),
                    );
                  }
                }}
              >
                <span />
              </div>
                <button
                  className="composer-hide"
                  aria-label="הסתרת תיבת הכתיבה"
                  title="הסתרת תיבת הכתיבה"
                  onClick={() => toggleComposer(true)}
                >
                  <ChevronDown size={15} />
                </button>
              </div>
              <div className="composer">
                <label className="sr-only" htmlFor="draft">
                  המחשבה שלך
                </label>
                <textarea
                  id="draft"
                  style={{ height: composerHeight }}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="מה מעסיק אותך עכשיו?"
                  maxLength={12000}
                />
                <div>
                  <span className="chat-tools">
                    <button
                      className="text-button"
                      disabled={!conv}
                      onClick={() => setPreferenceOpen(true)}
                    >
                      העדפת תשובה
                      {g.conversations.find((c: any) => c.id === conv)
                        ?.answer_preference
                        ? " ✓"
                        : ""}
                    </button>
                    <button
                      className="text-button"
                      disabled={!conv}
                      onClick={() => setExplanationOpen(true)}
                    >
                      מרחב ההסבר
                    </button>
                  </span>
                  <span className="row">
                    <button
                      className="text-button"
                      disabled={busy || !draft.trim() || !loaded}
                      onClick={() => send(true)}
                    >
                      שמירה וחילוץ חכם
                    </button>
                    <button
                      aria-label="שליחת הודעה"
                      className="primary send"
                      disabled={busy || !draft.trim() || !loaded}
                      onClick={() => send()}
                    >
                      <Send size={17} />
                    </button>
                  </span>
                </div>
              </div>
            </>
          )}
        </section>
        <section className="map-section spatial-map">
          <div className="map-toolbar">
            <div>
              <span className="eyebrow">המפה שלי</span>
            </div>
            <div className="row">
              <DropdownMenu.Root dir="rtl">
                <DropdownMenu.Trigger asChild>
                  <button
                    className="secondary"
                    aria-label="הוספה למפה"
                    disabled={busy || !loaded}
                  >
                    ＋
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="map-context-menu"
                    collisionPadding={10}
                  >
                    <DropdownMenu.Item
                      onSelect={() => {
                        mapCreatePoint.current = null;
                        setNewMapItem("idea");
                      }}
                    >
                      רעיון חדש
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => {
                        mapCreatePoint.current = null;
                        setNewMapItem("question");
                      }}
                    >
                      שאלה חדשה
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      disabled={!ws}
                      onSelect={() => {
                        setSource("");
                        open("link");
                      }}
                    >
                      רעיון קיים
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      disabled={visible.length < 2}
                      onSelect={() => setConnectionIds([])}
                    >
                      קשר חדש
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => setDeletedConnectionsOpen(true)}
                    >
                      קשרים שנמחקו
                    </DropdownMenu.Item>
                    <DropdownMenu.Label className="map-context-label">
                      {visible.length} רעיונות · {edges.length} קשרים
                    </DropdownMenu.Label>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>
          <div className="map-scroll">
            <IdeaMap
              reveal={mapReveal()}
              onDelete={async (id) => {
                await act({
                  action: "connection-visibility",
                  id,
                  deleted: true,
                });
              }}
              onQuickCreate={async (title, point) => {
                let workspace = ws;
                if (!workspace) {
                  const r = await act({
                    action: "workspace",
                    title: "מרחב החשיבה שלי",
                  });
                  workspace = r.id;
                  setWs(workspace);
                }
                const r = await act({
                  action: "create-idea",
                  workspaceId: workspace,
                  title,
                  summary: "",
                  kind: "idea",
                });
                setMapPlacement({ id: r.id, workspaceId: workspace, point });
              }}
              onPlaced={() => setMapPlacement(null)}
              placement={mapPlacement}
              onCreate={(kind, point) => {
                mapCreatePoint.current = point;
                setNewMapItem(kind);
              }}
              key={ws}
              workspaceId={ws}
              ideas={visible}
              edges={edges}
              busy={busy || !loaded}
              onInspect={inspect}
              onConnect={async (ideaIds) => {
                await act({
                  action: "connection",
                  ideaIds,
                  label: "?",
                  description: "",
                });
              }}
              onConnection={setConnectionId}
            />
          </div>
        </section>
        <DrawingBoard
          key={ws || "unassigned"}
          workspaceId={ws}
          themeColor={themeColor}
        />
      </ResizablePanels>
      <ModelQueue />
      <ConversationDrawer
        open={drawerOpen}
        setOpen={setDrawerOpen}
        conversations={chatConversations()}
        messages={g.messages}
        current={conv}
        onSelect={(id) => {
          setConv(id);
          setMobileView((v) => (v === "menu" || v === "notes" ? "chat" : v));
        }}
        onNew={() => void newChat()}
        busy={busy || !loaded}
      />
      <EffectStudio
        open={studioOpen}
        onOpenChange={setStudioOpen}
        onApply={applyEffect}
      />
      <ThemePicker
        onColorChange={setThemeColor}
        open={colorOpen}
        onOpenChange={setColorOpen}
      />
      {explanationOpen && conv && (
        <ExplanationPanel
          graph={g}
          conversationId={conv}
          onClose={() => setExplanationOpen(false)}
        />
      )}
      {preferenceOpen && g.conversations.find((c: any) => c.id === conv) && (
        <AnswerPreference
          conversation={g.conversations.find((c: any) => c.id === conv)}
          act={act}
          busy={busy}
          onClose={() => setPreferenceOpen(false)}
        />
      )}
      {extractionRun &&
        (g.extraction_runs || []).find((r: any) => r.id === extractionRun) && (
          <ExtractionReview
            key={extractionRun}
            run={g.extraction_runs.find((r: any) => r.id === extractionRun)}
            graph={g}
            act={act}
            busy={busy}
            onApproved={showApproved}
            onClose={() => setExtractionRun("")}
          />
        )}
      {notesOpen && (
        <NotesPanel
          key={newNote ? "new" : "list"}
          startNew={newNote}
          notes={g.notes || []}
          selected={selectedNotes}
          onSelected={setSelectedNotes}
          act={act}
          extracting={notesPreparing}
          onExtract={extractNotes}
          onClose={() => setNotesOpen(false)}
        />
      )}
      {deletedConnectionsOpen && (
        <Dialog open onOpenChange={setDeletedConnectionsOpen}>
          <DialogContent dir="rtl" className="detail-dialog">
            <DialogTitle>קשרים שנמחקו</DialogTitle>
            <DialogDescription>
              אפשר לשחזר קשר עם אותם משתתפים, פירוט ומקורות.
            </DialogDescription>
            {!g.connections.some((c: any) => c.deleted_at) && (
              <p>אין קשרים שנמחקו.</p>
            )}
            {g.connections
              .filter((c: any) => c.deleted_at)
              .map((c: any) => (
                <div className="row" key={c.id}>
                  <span>
                    {c.label} ·{" "}
                    {g.connection_participants
                      .filter((p: any) => p.connection_id === c.id)
                      .map(
                        (p: any) =>
                          g.ideas.find((i: any) => i.id === p.idea_id)?.title,
                      )
                      .join(" / ")}
                  </span>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void act({
                        action: "connection-visibility",
                        id: c.id,
                        deleted: false,
                      }).catch(() => {})
                    }
                  >
                    שחזור
                  </button>
                </div>
              ))}
          </DialogContent>
        </Dialog>
      )}
      {newMapItem && (
        <CreateMapIdea
          kind={newMapItem}
          onCreated={(id, workspaceId) => {
            if (mapCreatePoint.current)
              setMapPlacement({
                id,
                workspaceId,
                point: mapCreatePoint.current,
              });
          }}
          workspaceId={ws}
          act={act}
          onWorkspace={setWs}
          onClose={() => setNewMapItem(null)}
        />
      )}
      {taxonomyOpen && (
        <Taxonomy
          graph={g}
          act={act}
          busy={busy}
          onClose={() => setTaxonomyOpen(false)}
        />
      )}
      {connectionIds !== null && (
        <ConnectionEditor
          graph={g}
          initialIds={connectionIds}
          visible={visible}
          act={act}
          busy={busy}
          onClose={() => setConnectionIds(null)}
        />
      )}
      {connectionId &&
        g.connections.find((c: any) => c.id === connectionId) && (
          <ConnectionDetails
            key={connectionId}
            act={act}
            connection={g.connections.find((c: any) => c.id === connectionId)}
            graph={g}
            onClose={() => setConnectionId("")}
          />
        )}
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected("");
        }}
      >
        <MovableDialogContent dir="rtl" className="detail-dialog">
          <DialogTitle>הרעיון והמקורות שלו</DialogTitle>
          <DialogDescription>
            שינוי הרעיון יתעדכן בכל המרחבים שמפנים אליו.
          </DialogDescription>
          {active && (
            <>
              <label>
                שם הרעיון
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={180}
                />
              </label>
              <label>
                תיאור
                <textarea
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  maxLength={4000}
                />
              </label>
              <div className="row">
                <button
                  disabled={busy}
                  className="primary"
                  onClick={() => revise("accepted")}
                >
                  <Check size={16} />{" "}
                  {active.status === "accepted"
                    ? "שמירת שינויים"
                    : "אישור ושמירה"}
                </button>
                <button
                  disabled={busy}
                  className="secondary"
                  onClick={() => revise("rejected")}
                >
                  <X size={15} /> דחייה
                </button>
              </div>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <p className="muted">
                נוצר על ידי{" "}
                {g.users.find((u: any) => u.id === active.created_by)?.name} ·{" "}
                {new Date(active.created_at).toLocaleString("he-IL")}
              </p>
              <ExtractionEvidence graph={g} entityId={active.id} />
              <h3>מקורות · {sources.length}</h3>
              {!sources.length &&
                g.events.some(
                  (e: any) =>
                    e.entity_id === active.id && e.action === "create-on-map",
                ) && (
                  <p className="muted">
                    נוצר ישירות במפה שלך. אין הודעת מקור; פעולת היצירה מתועדת
                    בהיסטוריה.
                  </p>
                )}
              {sources.map((m: any) => (
                <button
                  className="source-card"
                  key={m.id}
                  onClick={() => {
                    setConv(m.conversation_id);
                    setSelected("");
                    setTimeout(
                      () => document.getElementById("message-" + m.id)?.focus(),
                      100,
                    );
                  }}
                >
                  <small>
                    {
                      g.conversations.find(
                        (c: any) => c.id === m.conversation_id,
                      )?.title
                    }{" "}
                    ·{" "}
                    {m.method === "manual"
                      ? "קישור ידני"
                      : m.method === "exact-title"
                        ? "שם זהה"
                        : m.method === "reviewed-model"
                          ? "חילוץ שאושר"
                          : "חילוץ ראשוני"}
                  </small>
                  <p>{m.content}</p>
                  <span>
                    מעבר להודעה <ArrowUpRight size={14} />
                  </span>
                </button>
              ))}
              <details>
                <summary>היסטוריית השינויים</summary>
                {g.events
                  .filter((e: any) => e.entity_id === active.id)
                  .map((e: any) => (
                    <div className="history" key={e.id}>
                      <span>
                        {e.action} ·{" "}
                        {g.users.find((u: any) => u.id === e.created_by)?.name}
                      </span>
                      <time>
                        {new Date(e.created_at).toLocaleString("he-IL")}
                      </time>
                      <pre dir="ltr">
                        {JSON.stringify(
                          {
                            before: e.before ? JSON.parse(e.before) : null,
                            after: JSON.parse(e.after),
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  ))}
              </details>
            </>
          )}
        </MovableDialogContent>
      </Dialog>
      <Dialog
        open={!!modal}
        onOpenChange={(v) => {
          if (!v) setModal("");
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>
            {
              (
                {
                  workspace: "מרחב חדש",
                  conversation: "שיחה חדשה",
                  connection: "יצירת קשר",
                  link: "קישור רעיון קיים",
                } as any
              )[modal]
            }
          </DialogTitle>
          <DialogDescription>
            {modal === "connection"
              ? "בחרי שני רעיונות או יותר ותני לקשר שם."
              : modal === "link"
                ? "אותו רעיון יכול להופיע בכמה שיחות ומרחבים."
                : "שם שיעזור לך לחזור לכאן בהמשך."}
          </DialogDescription>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                let r;
                if (modal === "link") {
                  r = await act({
                    action: "link",
                    ideaId: linkIdea,
                    workspaceId: ws,
                    messageId: source || undefined,
                  });
                } else if (modal === "connection") {
                  r = await act({
                    action: "connection",
                    label: name,
                    ideaIds: ids,
                  });
                } else {
                  r = await act({ action: modal, title: name });
                  if (modal === "workspace") setWs(r.id);
                  else setConv(r.id);
                }
                setModal("");
              } catch {}
            }}
          >
            {modal === "link" ? (
              <Picker
                value={linkIdea}
                onChange={setLinkIdea}
                items={g.ideas.filter((i: any) => i.status !== "rejected")}
                label="בחירת רעיון"
              />
            ) : (
              <label>
                {modal === "connection" ? "שם הקשר" : "שם"}
                <input
                  autoFocus
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={180}
                  placeholder={
                    modal === "connection" ? "למשל: משפיע על, דומה ל…" : ""
                  }
                />
              </label>
            )}
            {modal === "connection" && (
              <div className="choices">
                {visible.map((i: any) => (
                  <label key={i.id}>
                    <Checkbox
                      checked={ids.includes(i.id)}
                      onCheckedChange={(v) =>
                        setIds(
                          v ? [...ids, i.id] : ids.filter((x) => x !== i.id),
                        )
                      }
                    />
                    {i.title}
                  </label>
                ))}
              </div>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button
              className="primary modal-save"
              disabled={
                busy ||
                (modal === "link" && !linkIdea) ||
                (modal === "connection" && ids.length < 2)
              }
            >
              שמירה
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
