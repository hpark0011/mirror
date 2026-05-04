"use client";

// Renders the slash menu list. Keys are forwarded into cmdk via a small
// inline helper so the menu's roving selection (↑/↓/Enter) works while the
// editor still owns the contenteditable focus. Test id `slash-command-menu`
// is the e2e hook.
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@feel-good/ui/primitives/command";
import type React from "react";
import { useImperativeHandle, useRef } from "react";
import type { SlashCommandItem } from "../extensions/slash-command";

interface SlashCommandSuggestionsProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  ref?: React.Ref<{
    onKeyDown: (props: { event: KeyboardEvent }) => boolean;
  }>;
}

function forwardKeyToCmdk(
  el: HTMLDivElement | null,
  event: KeyboardEvent,
): boolean {
  if (
    event.key === "ArrowUp" ||
    event.key === "ArrowDown" ||
    event.key === "Enter"
  ) {
    if (!el) return false;
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: event.key,
        code: event.code,
        bubbles: true,
      }),
    );
    return true;
  }
  return false;
}

export function SlashCommandSuggestions({
  items,
  command,
  ref,
}: SlashCommandSuggestionsProps) {
  const commandRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }: { event: KeyboardEvent }) {
      return forwardKeyToCmdk(commandRef.current, event);
    },
  }));

  const groups = new Map<string, SlashCommandItem[]>();
  for (const item of items) {
    const existing = groups.get(item.group);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.group, [item]);
    }
  }

  return (
    <Command
      ref={commandRef}
      shouldFilter={false}
      loop
      className="tiptap-slash-menu"
      aria-label="Slash commands"
      data-testid="slash-command-menu"
    >
      <CommandList>
        <CommandEmpty className="px-3.5 h-10 text-[13px] flex items-center text-muted-foreground">
          No results
        </CommandEmpty>
        {[...groups.entries()].map(([groupName, groupItems], index) => (
          <div key={groupName}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={groupName}>
              {groupItems.map((item) => (
                <CommandItem
                  key={item.title}
                  value={item.title}
                  onSelect={() => command(item)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="tiptap-slash-item"
                >
                  <span className="tiptap-slash-item-icon">
                    <item.icon />
                  </span>
                  <span className="tiptap-slash-item-title">{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </Command>
  );
}
