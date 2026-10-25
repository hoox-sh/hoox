/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */
/**
 * In-house dialog system for Hoox TUI.
 *
 * Intentionally does **not** depend on `@opentui-ui/dialog`, which nests a
 * second `@opentui/core` and crashes global installs with:
 *   OPENTUI_FORCE_WCWIDTH already registered with different configuration
 *
 * Provides DialogProvider + useDialog + showConfirm / showChoice / showLoading
 * with the same call shapes views already use.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useKeyboard } from "@opentui/react";
import { Colors } from "@hoox-sh/hoox-shared";
import { setOpenDialogCount } from "./dialog-state";

// ── Types ──────────────────────────────────────────────────────────────────

/** Options for confirm dialogs (Yes/No, Confirm/Cancel) */
export interface ConfirmDialogOptions {
  /** Dialog title (bold, accent-colored) */
  title: string;
  /** Explanatory message below the title */
  message: string;
  /** Label for the affirmative button (default: "Confirm") */
  confirmLabel?: string;
  /** Label for the dismiss button (default: "Cancel") */
  cancelLabel?: string;
  /** Whether clicking outside the dialog dismisses it (default: true) */
  closeOnClickOutside?: boolean;
}

/** A single choice item in a choice dialog */
export interface ChoiceOption<K extends string = string> {
  key: K;
  label: string;
  description?: string;
}

/** Options for choice dialogs */
export interface ChoiceDialogOptions<K extends string = string> {
  /** Dialog title */
  title: string;
  /** Array of selectable options */
  choices: ChoiceOption<K>[];
  /** Value returned when dialog is dismissed via ESC/backdrop (default: undefined) */
  fallback?: K;
  /** Whether clicking outside dismisses (default: true) */
  closeOnClickOutside?: boolean;
}

/** Dialog manager interface used by views + showConfirm helpers */
export interface DialogHandle {
  /**
   * Low-level confirm used by some tests. Prefer {@link showConfirm}.
   * When `content` is provided, it is ignored — title/message form is used.
   */
  confirm(options: {
    content?: (ctx: {
      resolve: (value: boolean) => void;
      dismiss: () => void;
    }) => unknown;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    closeOnClickOutside?: boolean;
  }): Promise<boolean>;
  choice<K extends string>(options: {
    content?: (ctx: {
      resolve: (value: K) => void;
      dismiss: () => void;
      dialogId: string | number;
    }) => unknown;
    title?: string;
    choices?: ChoiceOption<K>[];
    fallback?: K;
    closeOnClickOutside?: boolean;
  }): Promise<K | undefined>;
  show(options: {
    content?: () => unknown;
    message?: string;
    id?: string | number;
  }): string | number;
  close(id?: string | number): void;
  /** High-level helpers (also used directly by showConfirm) */
  confirmSimple(options: ConfirmDialogOptions): Promise<boolean>;
  choiceSimple<K extends string>(
    options: ChoiceDialogOptions<K>
  ): Promise<K | undefined>;
}

// ── Internal stack model ───────────────────────────────────────────────────

type StackEntry =
  | {
      kind: "confirm";
      id: number;
      title: string;
      message: string;
      confirmLabel: string;
      cancelLabel: string;
      closeOnClickOutside: boolean;
      resolve: (value: boolean) => void;
    }
  | {
      kind: "choice";
      id: number;
      title: string;
      choices: ChoiceOption[];
      fallback?: string;
      closeOnClickOutside: boolean;
      resolve: (value: string | undefined) => void;
    }
  | {
      kind: "loading";
      id: number;
      message: string;
    };

let nextId = 1;

const DialogCtx = createContext<DialogHandle | null>(null);

// ── Overlay UI ─────────────────────────────────────────────────────────────

function ConfirmOverlay({
  entry,
  onResolve,
}: {
  entry: Extract<StackEntry, { kind: "confirm" }>;
  onResolve: (value: boolean) => void;
}) {
  useKeyboard((key) => {
    const name = String(key.name ?? "").toLowerCase();
    if (name === "return" || name === "enter" || name === "y") {
      onResolve(true);
      return;
    }
    if (name === "escape" || name === "n") {
      onResolve(false);
    }
  });

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      backgroundColor={Colors.backdrop}
      onMouseUp={entry.closeOnClickOutside ? () => onResolve(false) : undefined}
    >
      <box
        flexDirection="column"
        gap={1}
        padding={2}
        border={true}
        borderStyle="double"
        borderColor={Colors.accent}
        backgroundColor={Colors.card}
        minWidth={44}
        onMouseUp={(e: { stopPropagation?: () => void }) => {
          e?.stopPropagation?.();
        }}
      >
        <text fg={Colors.accent} bold>
          {entry.title}
        </text>
        <text fg={Colors.foreground}>{entry.message}</text>
        <box flexDirection="row" gap={2} paddingTop={1}>
          <text
            fg={Colors.accent}
            bg={Colors.card}
            bold
            onMouseUp={() => onResolve(true)}
          >
            {`  [Y/Enter] ${entry.confirmLabel}  `}
          </text>
          <text fg={Colors.muted} onMouseUp={() => onResolve(false)}>
            {`  [N/Esc] ${entry.cancelLabel}  `}
          </text>
        </box>
      </box>
    </box>
  );
}

function ChoiceOverlay({
  entry,
  onResolve,
}: {
  entry: Extract<StackEntry, { kind: "choice" }>;
  onResolve: (value: string | undefined) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useKeyboard((key) => {
    const name = String(key.name ?? "").toLowerCase();
    if (name === "down" || name === "j") {
      setSelectedIndex((prev) =>
        prev < entry.choices.length - 1 ? prev + 1 : 0
      );
      return;
    }
    if (name === "up" || name === "k") {
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : entry.choices.length - 1
      );
      return;
    }
    if (name === "return" || name === "enter") {
      const choice = entry.choices[selectedIndex];
      if (choice) onResolve(choice.key);
      return;
    }
    if (name === "escape") {
      onResolve(entry.fallback);
    }
  });

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      backgroundColor={Colors.backdrop}
      onMouseUp={
        entry.closeOnClickOutside ? () => onResolve(entry.fallback) : undefined
      }
    >
      <box
        flexDirection="column"
        gap={1}
        padding={2}
        border={true}
        borderStyle="double"
        borderColor={Colors.accent}
        backgroundColor={Colors.card}
        minWidth={48}
      >
        <text fg={Colors.accent} bold>
          {entry.title}
        </text>
        <text dim fg={Colors.muted}>
          Use ↑↓ to navigate, Enter to select, Esc to cancel
        </text>
        <box flexDirection="column" gap={0} paddingTop={1}>
          {entry.choices.map((choice, idx) => (
            <box
              key={choice.key}
              flexDirection="row"
              gap={2}
              paddingLeft={1}
              paddingRight={1}
            >
              <text fg={idx === selectedIndex ? Colors.accent : Colors.muted}>
                {idx === selectedIndex ? "▶" : " "}
              </text>
              <text
                fg={idx === selectedIndex ? Colors.foreground : Colors.muted}
                bg={idx === selectedIndex ? Colors.card : undefined}
                onMouseUp={() => onResolve(choice.key)}
              >
                {choice.label}
              </text>
              {choice.description ? (
                <text dim fg={Colors.muted}>
                  — {choice.description}
                </text>
              ) : null}
            </box>
          ))}
        </box>
        <box flexDirection="row" justifyContent="flex-end" paddingTop={1}>
          <text fg={Colors.muted} onMouseUp={() => onResolve(entry.fallback)}>
            {"  Cancel  "}
          </text>
        </box>
      </box>
    </box>
  );
}

function LoadingOverlay({ message }: { message: string }) {
  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      backgroundColor={Colors.backdrop}
    >
      <box
        flexDirection="column"
        padding={2}
        gap={1}
        border={true}
        borderStyle="single"
        borderColor={Colors.border}
        backgroundColor={Colors.card}
        justifyContent="center"
        alignItems="center"
      >
        <text fg={Colors.accent}>{message}</text>
        <text dim fg={Colors.muted}>
          Please wait...
        </text>
      </box>
    </box>
  );
}

// ── Provider ───────────────────────────────────────────────────────────────

export interface DialogProviderProps {
  children: ReactNode;
  /** Accepted for API compat with old @opentui-ui/dialog provider; unused. */
  size?: string;
  backdropColor?: string;
  backdropOpacity?: number;
}

export function DialogProvider({ children }: DialogProviderProps) {
  const [stack, setStack] = useState<StackEntry[]>([]);

  useEffect(() => {
    setOpenDialogCount(stack.length);
    return () => setOpenDialogCount(0);
  }, [stack.length]);

  const popId = useCallback((id: number) => {
    setStack((s) => s.filter((e) => e.id !== id));
  }, []);

  const handle = useMemo<DialogHandle>(() => {
    const confirmSimple = (options: ConfirmDialogOptions) =>
      new Promise<boolean>((resolve) => {
        const id = nextId++;
        setStack((s) => [
          ...s,
          {
            kind: "confirm",
            id,
            title: options.title,
            message: options.message,
            confirmLabel: options.confirmLabel ?? "Confirm",
            cancelLabel: options.cancelLabel ?? "Cancel",
            closeOnClickOutside: options.closeOnClickOutside ?? true,
            resolve: (value) => {
              popId(id);
              resolve(value);
            },
          },
        ]);
      });

    const choiceSimple = <K extends string>(options: ChoiceDialogOptions<K>) =>
      new Promise<K | undefined>((resolve) => {
        const id = nextId++;
        setStack((s) => [
          ...s,
          {
            kind: "choice",
            id,
            title: options.title,
            choices: options.choices as ChoiceOption[],
            fallback: options.fallback,
            closeOnClickOutside: options.closeOnClickOutside ?? true,
            resolve: (value) => {
              popId(id);
              resolve(value as K | undefined);
            },
          },
        ]);
      });

    return {
      confirmSimple,
      choiceSimple,
      confirm: (options) => {
        // Tests pass title/message via custom shapes; content() is ignored.
        const title =
          options.title ??
          (typeof options.content === "function" ? "Confirm" : "Confirm");
        const message = options.message ?? "Continue?";
        return confirmSimple({
          title,
          message,
          confirmLabel: options.confirmLabel,
          cancelLabel: options.cancelLabel,
          closeOnClickOutside: options.closeOnClickOutside,
        });
      },
      choice: <K extends string>(options: {
        title?: string;
        choices?: ChoiceOption<K>[];
        fallback?: K;
        closeOnClickOutside?: boolean;
      }) => {
        return choiceSimple<K>({
          title: options.title ?? "Select",
          choices: options.choices ?? [],
          fallback: options.fallback,
          closeOnClickOutside: options.closeOnClickOutside,
        });
      },
      show: (options) => {
        const id = nextId++;
        setStack((s) => [
          ...s,
          {
            kind: "loading",
            id,
            message: options.message ?? "Loading…",
          },
        ]);
        return id;
      },
      close: (id?) => {
        if (id == null) {
          setStack([]);
          return;
        }
        popId(Number(id));
      },
    };
  }, [popId]);

  const top = stack[stack.length - 1] ?? null;

  // Mark shell overlay open when a dialog is showing so view keys are gated.
  // We piggy-back on ui-store modal only for keyboard gate — dialogs render here.
  // Views use isShellOverlayOpen() which checks commandPalette + modal.
  // Dialogs also use useKeyboard at higher priority than views when mounted last.

  return (
    <DialogCtx.Provider value={handle}>
      {children}
      {top?.kind === "confirm" ? (
        <ConfirmOverlay
          entry={top}
          onResolve={(v) => {
            top.resolve(v);
          }}
        />
      ) : null}
      {top?.kind === "choice" ? (
        <ChoiceOverlay
          entry={top}
          onResolve={(v) => {
            top.resolve(v);
          }}
        />
      ) : null}
      {top?.kind === "loading" ? (
        <LoadingOverlay message={top.message} />
      ) : null}
    </DialogCtx.Provider>
  );
}

export function useDialog(): DialogHandle {
  const ctx = useContext(DialogCtx);
  if (!ctx) {
    throw new Error("useDialog must be used within <DialogProvider>");
  }
  return ctx;
}

// ── Public helpers (stable call sites) ─────────────────────────────────────

/**
 * Show a confirmation dialog styled with Hoox colors.
 * Returns `true` if confirmed, `false` if canceled or dismissed.
 */
export async function showConfirm(
  dialog: DialogHandle,
  options: ConfirmDialogOptions
): Promise<boolean> {
  if (typeof dialog.confirmSimple === "function") {
    return dialog.confirmSimple(options);
  }
  // Fallback for test doubles that only implement confirm()
  return dialog.confirm({
    title: options.title,
    message: options.message,
    confirmLabel: options.confirmLabel,
    cancelLabel: options.cancelLabel,
    closeOnClickOutside: options.closeOnClickOutside,
  });
}

/**
 * Show a multiple-choice dialog styled with Hoox colors.
 * Returns the selected choice key, or `fallback` if dismissed.
 */
export async function showChoice<K extends string>(
  dialog: DialogHandle,
  options: ChoiceDialogOptions<K>
): Promise<K | undefined> {
  if (typeof dialog.choiceSimple === "function") {
    return dialog.choiceSimple(options);
  }
  return dialog.choice<K>({
    title: options.title,
    choices: options.choices,
    fallback: options.fallback,
    closeOnClickOutside: options.closeOnClickOutside,
  });
}

/**
 * Show a non-interactive loading dialog.
 * Returns a `close` function to dismiss when work completes.
 */
export function showLoading(dialog: DialogHandle, message: string): () => void {
  const id = dialog.show({ message });
  return () => dialog.close(id);
}
