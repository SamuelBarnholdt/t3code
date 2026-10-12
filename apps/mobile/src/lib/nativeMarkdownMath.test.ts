import { describe, expect, it } from "vite-plus/test";
import type { MarkdownNode } from "react-native-nitro-markdown/headless";
import { parseMarkdownWithMath } from "@t3tools/shared/markdownMath";

import { parseNativeMarkdownMath } from "../../modules/t3-markdown-text/src/nativeMarkdownMath";
import {
  nativeMarkdownDocumentChunks,
  nativeMarkdownDocumentRuns,
} from "../../modules/t3-markdown-text/src/nativeMarkdownText";

type MdastNode =
  | ReturnType<typeof parseMarkdownWithMath>
  | ReturnType<typeof parseMarkdownWithMath>["children"][number];
// GFM exercises the same pipe and code-span boundaries the native parser receives.
function parse(source: string): MarkdownNode {
  const convert = (node: MdastNode): MarkdownNode => {
    if (node.type === "inlineCode") return { type: "code_inline", content: node.value };
    if (node.type === "text") return { type: "text", content: node.value };
    const type =
      node.type === "root"
        ? "document"
        : node.type === "tableRow"
          ? "table_row"
          : node.type === "tableCell"
            ? "table_cell"
            : node.type === "table"
              ? "table"
              : "paragraph";
    return { type, children: "children" in node ? node.children.map(convert) : [] };
  };
  return convert(parseMarkdownWithMath(source));
}

describe("native formula parsing", () => {
  it.each(["$|x|$", "\\(\\|x\\|\\)", "$$|x|$$", "\\[|x|\\]"])(
    "keeps table cells intact and retains authored source: %s",
    (formula) => {
      const source = `| Name | Formula |\n| --- | --- |\n| Norm | ${formula} |`;
      const doc = parseNativeMarkdownMath(source, parse);
      const table = doc.children![0]!;
      expect(table.type).toBe("table");
      expect(table.children?.map((row) => row.children?.length)).toEqual([2, 2]);
      const runs = nativeMarkdownDocumentRuns(table.children![1]!.children![1]!);
      expect(runs).toMatchObject([
        {
          text: formula,
          sourceText: formula,
          mathSource: formula,
          mathTex: "|x|",
          mathDisplay: formula.startsWith("$$") || formula.startsWith("\\["),
        },
      ]);
    },
  );

  it("keeps prose, adjacent formulas and authored source in one inline paragraph", () => {
    const doc = parseNativeMarkdownMath("before \\(x_i\\)\\(y_i\\) after", parse);
    const runs = nativeMarkdownDocumentRuns(doc);
    expect(runs.filter((run) => run.mathSource).map((run) => run.mathTex)).toEqual(["x_i", "y_i"]);
    expect(runs.map((run) => run.text).join("")).toBe("before \\(x_i\\)\\(y_i\\) after");
  });

  it("protects multiline math and explicit math fences before block parsing", () => {
    for (const source of ["\\[\nx = 1\ny = 2\n\\]", "```math\nx_i^2\n```", "> $$\n> x^2\n> $$"]) {
      const runs = nativeMarkdownDocumentRuns(parseNativeMarkdownMath(source, parse));
      expect(runs.filter((run) => run.mathSource)).toHaveLength(1);
      expect(runs.find((run) => run.mathSource)?.mathDisplay).toBe(true);
    }
  });

  it("avoids marker collisions and preserves ordinary code and prices", () => {
    const source = "`t3-math:0` then $x$ and $5-$10";
    const runs = nativeMarkdownDocumentRuns(parseNativeMarkdownMath(source, parse));
    expect(runs.filter((run) => run.mathSource).map((run) => run.mathSource)).toEqual(["$x$"]);
    expect(runs.some((run) => run.code && run.text === "t3-math:0")).toBe(true);
    expect(runs.map((run) => run.text).join("")).toContain("$5-$10");
  });

  it("keeps list containers for hanging indentation around inline formulas", () => {
    const doc: MarkdownNode = {
      type: "document",
      children: [
        {
          type: "list",
          children: [
            {
              type: "list_item",
              children: [{ type: "paragraph", children: [{ type: "math_inline", content: "x" }] }],
            },
          ],
        },
      ],
    };
    expect(nativeMarkdownDocumentChunks(doc)[0]?.kind).toBe("rich");
  });
});
