// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vite-plus/test";

import { ComposerMathExtension } from "./composer-math";
import { serializeEditorDoc } from "./composer-rich-text-doc";

function type(source: string) {
  const editor = new Editor({ extensions: [StarterKit, ComposerMathExtension], content: "" });
  for (const character of source) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp("handleTextInput", (handler) =>
      handler(editor.view, from, to, character, () => editor.state.tr.insertText(character)),
    );
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(character));
  }
  return editor;
}

describe("typing composer math", () => {
  it.each(["Area $x_i$ ", "Area \\(x_i\\)", "Area $$x_i$$"])(
    "typesets a completed formula without changing the draft: %s",
    (source) => {
      const editor = type(source);
      try {
        expect(serializeEditorDoc(editor.state.doc).value).toBe(source);
        expect(
          editor.state.doc.firstChild?.content.content.some(
            (node) => node.type.name === "composer-math",
          ),
        ).toBe(true);
        expect(editor.state.selection.eq(TextSelection.atEnd(editor.state.doc))).toBe(true);
      } finally {
        editor.destroy();
      }
    },
  );

  it.each(["Cost $5-$10", "Cost $5 and $10", "$x_i", "| Norm | $|x|$ |"])(
    "retains literal or table text for its enclosing parser: %s",
    (source) => {
      const editor = type(source);
      try {
        expect(serializeEditorDoc(editor.state.doc).value).toBe(source);
        expect(
          editor.state.doc.firstChild?.content.content.some(
            (node) => node.type.name === "composer-math",
          ),
        ).toBe(false);
      } finally {
        editor.destroy();
      }
    },
  );
});
