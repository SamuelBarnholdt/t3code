import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useId, useMemo, useState } from "react";
import { markdownMathRanges } from "@t3tools/shared/markdownMath";

import { MarkdownMath } from "./MarkdownMath";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { Textarea } from "../ui/textarea";

/** Draws the draft's formula with the message renderer; editing retains its delimiters. */
export function ComposerMathNodeView({ node, editor, updateAttributes, getPos }: NodeViewProps) {
  const source = typeof node.attrs.source === "string" ? node.attrs.source : "";
  const tex = typeof node.attrs.tex === "string" ? node.attrs.tex : "";
  const display = node.attrs.display === true;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(source);
  const inputId = useId();
  const prefix = node.attrs.inTable === true ? "| Formula |\n| --- |\n| " : "";
  const parsed = useMemo(
    () => (open ? markdownMathRanges(prefix ? `${prefix}${draft} |` : draft) : []),
    [draft, open, prefix],
  );
  const formula =
    parsed.length === 1 &&
    parsed[0]?.start === prefix.length &&
    parsed[0].end === prefix.length + draft.length
      ? parsed[0]
      : null;
  return (
    <NodeViewWrapper
      as="span"
      className={
        display ? "block min-w-0 max-w-full" : "inline-block min-w-0 max-w-full align-middle"
      }
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) setDraft(source);
          setOpen(next);
        }}
      >
        <PopoverTrigger
          render={<button type="button" className="block max-w-full text-left text-inherit" />}
          disabled={!editor.isEditable}
          aria-label="Edit formula"
          contentEditable={false}
        >
          <MarkdownMath tex={tex} display={display} focusable={false} />
        </PopoverTrigger>
        <PopoverPopup width="lg" onKeyDown={(event) => event.stopPropagation()}>
          <div className="flex flex-col gap-3">
            <label htmlFor={inputId} className="text-sm font-medium">
              LaTeX formula
            </label>
            <Textarea
              id={inputId}
              aria-label="LaTeX formula source"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={display ? 5 : 2}
              autoFocus
            />
            {formula ? (
              <MarkdownMath tex={formula.tex} display={formula.display} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Include one complete formula and its delimiters.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button size="xs" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="xs"
                disabled={!formula}
                onClick={() => {
                  if (!formula) return;
                  updateAttributes({
                    source: formula.source,
                    tex: formula.tex,
                    display: formula.display,
                  });
                  setOpen(false);
                  const position = getPos();
                  if (typeof position === "number") editor.commands.focus(position + node.nodeSize);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </PopoverPopup>
      </Popover>
    </NodeViewWrapper>
  );
}
