import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { markdownMathRanges } from "@t3tools/shared/markdownMath";

/** Formula atoms retain their complete authored source for draft and clipboard round trips. */
export const ComposerMathExtension = Node.create({
  name: "composer-math",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      source: { default: "" },
      tex: { default: "" },
      display: { default: false },
      inTable: { default: false },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-composer-math]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-composer-math": "" })];
  },
  addInputRules() {
    return [
      nodeInputRule({
        type: this.type,
        find(text) {
          if (!/[)$\] \t]$/.test(text)) return null;
          if (text.trimStart().startsWith("|")) return null;
          const formula = markdownMathRanges(text).at(-1);
          if (!formula) return null;
          const tail = text.slice(formula.end);
          if (tail !== "" && !/^[ \t]$/.test(tail)) return null;
          // Waiting for the next character keeps a typed price range such as
          // $5-$10 from converting at its second dollar, before the 10 arrives.
          if (formula.source.startsWith("$") && !formula.source.startsWith("$$") && !tail)
            return null;
          return {
            index: formula.start,
            text: text.slice(formula.start),
            replaceWith: formula.source,
            data: { source: formula.source, tex: formula.tex, display: formula.display },
          };
        },
        getAttributes: (match) => match.data ?? {},
      }),
    ];
  },
});
