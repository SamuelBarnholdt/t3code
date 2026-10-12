import { markdownMathRanges } from "@t3tools/shared/markdownMath";
import type { MarkdownNode } from "react-native-nitro-markdown/headless";

/** Shield complete formulas before the native parser escapes TeX or splits table pipes. */
export function parseNativeMarkdownMath(source: string, parse: (source: string) => MarkdownNode) {
  const formulas = markdownMathRanges(source);
  if (formulas.length === 0) return parse(source);
  let prefix = "t3-math:";
  while (source.includes(prefix)) prefix += ":";
  let separator = "\ue000";
  while (source.includes(separator)) separator += "\ue000";
  const fence = "`".repeat(
    Math.max(1, ...[...source.matchAll(/`+/g)].map(([run]) => run.length + 1)),
  );
  const groups: Array<{ start: number; end: number; formulas: typeof formulas }> = [];
  for (const formula of formulas) {
    const previous = groups.at(-1);
    if (previous?.end === formula.start) {
      previous.formulas.push(formula);
      previous.end = formula.end;
    } else groups.push({ start: formula.start, end: formula.end, formulas: [formula] });
  }
  const byMarker = new Map(groups.map((group, index) => [`${prefix}${index}`, group]));
  let protectedSource = "";
  let offset = 0;
  for (const [marker, group] of byMarker) {
    protectedSource += source.slice(offset, group.start);
    if (protectedSource.endsWith("`")) protectedSource += separator;
    protectedSource += `${fence}${marker}${fence}`;
    if (source[group.end] === "`") protectedSource += separator;
    offset = group.end;
  }
  protectedSource += source.slice(offset);
  const restore = (node: MarkdownNode): MarkdownNode[] => {
    if (node.type === "code_inline") {
      const marker = node.content ?? node.children?.map((child) => child.content ?? "").join("");
      const group = marker ? byMarker.get(marker) : undefined;
      if (group)
        return group.formulas.map(
          (formula) =>
            ({
              ...node,
              type: formula.display ? "math_block" : "math_inline",
              content: formula.tex,
              mathSource: formula.source,
              children: [],
            }) satisfies MarkdownNode & { mathSource: string },
        );
    }
    return [
      {
        ...node,
        ...(node.content ? { content: node.content.replaceAll(separator, "") } : {}),
        ...(node.children ? { children: node.children.flatMap(restore) } : {}),
      },
    ];
  };
  return restore(parse(protectedSource))[0]!;
}
