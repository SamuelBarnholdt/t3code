// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  nativeMathRunHtml,
  nativeMathSvg,
  nativeMathTableHtml,
} from "../../modules/t3-markdown-text/src/nativeMathHtml";
import { NATIVE_MATH_DOCUMENT } from "../../modules/t3-markdown-text/src/nativeMathDocument";
import type { NativeMarkdownTextStyle } from "../../modules/t3-markdown-text/src/SelectableMarkdownText.types";

const style: NativeMarkdownTextStyle = {
  color: "#ddd",
  strongColor: "#fff",
  mutedColor: "#aaa",
  linkColor: "#abc",
  inlineCodeColor: "#eee",
  codeColor: "#eee",
  codeBackgroundColor: "#333",
  codeBlockBackgroundColor: "#222",
  fileTextColor: "#abc",
  skillTextColor: "#abc",
  quoteMarkerColor: "#aaa",
  dividerColor: "#aaa",
  fontSize: 15,
  lineHeight: 22,
  fontFamily: "system-ui",
  headingFontFamily: "system-ui",
  boldFontFamily: "system-ui",
};

const disposeListeners: Array<() => void> = [];
afterEach(() => {
  disposeListeners.splice(0).forEach((dispose) => dispose());
});

function documentRuntime(runs: string[]) {
  document.documentElement.innerHTML =
    NATIVE_MATH_DOCUMENT.slice(
      NATIVE_MATH_DOCUMENT.indexOf("<head>"),
      NATIVE_MATH_DOCUMENT.indexOf("<script>"),
    ) + "</body>";
  const messages: Array<{ type: string; text?: string; revision?: number }> = [];
  Object.defineProperty(window, "ReactNativeWebView", {
    configurable: true,
    value: { postMessage: (text: string) => messages.push(JSON.parse(text)) },
  });
  const script = NATIVE_MATH_DOCUMENT.slice(
    NATIVE_MATH_DOCUMENT.indexOf("<script>") + 8,
    NATIVE_MATH_DOCUMENT.indexOf("</script>"),
  );
  const addEventListener = document.addEventListener.bind(document);
  const listenerSpy = vi
    .spyOn(document, "addEventListener")
    .mockImplementation((type, listener, options) => {
      addEventListener(type, listener, options);
      disposeListeners.push(() => document.removeEventListener(type, listener, options));
    });
  new Function("window", "document", "ResizeObserver", script)(
    window,
    document,
    class {
      observe() {}
    },
  );
  listenerSpy.mockRestore();
  const runtime = window as unknown as {
    updateMath(update: {
      runs: string[];
      revision: number;
      color: string;
      fontSize: number;
      lineHeight: number;
    }): void;
  };
  const update = (next: string[], revision: number) =>
    runtime.updateMath({ runs: next, revision, color: "#ddd", fontSize: 15, lineHeight: 22 });
  update(runs, 1);
  return { messages, update };
}

describe("offline native math rendering and selection", () => {
  it("renders and copies a whole table with formulas and stable cell boundaries", () => {
    const html = nativeMathTableHtml(
      [
        [[{ text: "Name", bold: true }], [{ text: "Formula", bold: true }]],
        [[{ text: "Norm" }], [{ text: "$|x|$", mathSource: "$|x|$", mathTex: "|x|" }]],
      ],
      style,
    );
    const { messages } = documentRuntime([html]);
    expect([...document.querySelectorAll("tr")].map((row) => row.children.length)).toEqual([2, 2]);
    expect(document.querySelectorAll("svg")).toHaveLength(1);
    const range = document.createRange();
    range.selectNodeContents(document.querySelector("table")!);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("copy", { cancelable: true }));
    expect(messages.at(-1)?.text).toBe("Name\tFormula\nNorm\t\\(|x|\\)");
  });
  it("renders SVG with accessible MathML and retains source for unsupported TeX", () => {
    const svg = nativeMathSvg("\\(\\frac{1}{2}\\)")!;
    expect(svg).toContain("<svg");
    expect(svg).toContain("<math");
    expect(svg).not.toContain("<script");
    expect(nativeMathSvg("\\(\\notACommand{x}\\)")).toBeNull();
    expect(nativeMathSvg("\\(\\href{https://example.com}{x}\\)")).toBeNull();
  });

  it("preserves completed formula nodes and source disclosures during streaming", () => {
    const html = nativeMathRunHtml(
      { text: "$$x_i$$", mathSource: "$$x_i$$", mathTex: "x_i", mathDisplay: true },
      style,
    );
    const { update } = documentRuntime([html, "<span>first</span>"]);
    const svg = document.querySelector("svg");
    document.querySelector<HTMLButtonElement>("[data-toggle]")!.click();
    expect(document.querySelector<HTMLElement>(".source")!.hidden).toBe(false);
    update([html, "<span>first and second</span>"], 2);
    expect(document.querySelector("svg")).toBe(svg);
    expect(document.querySelector<HTMLElement>(".source")!.hidden).toBe(false);
  });

  it("copies whole TeX from partial glyph selections, without controls or duplicate MathML", () => {
    const source = "\\[\nx_i^2\n\\]";
    const html = nativeMathRunHtml(
      { text: source, mathSource: source, mathTex: "x_i^2", mathDisplay: true },
      style,
    );
    const { messages } = documentRuntime(["<span>Area </span>", html, "<span> grows</span>"]);
    const glyph = document.querySelector("mjx-assistive-mml mi")!.firstChild!;
    const range = document.createRange();
    range.setStart(glyph, 0);
    range.setEnd(glyph, 1);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("copy", { cancelable: true }));
    expect(messages.at(-1)).toMatchObject({ type: "copy", text: source, revision: 1 });
    const all = document.createRange();
    all.selectNodeContents(document.getElementById("content")!);
    selection.removeAllRanges();
    selection.addRange(all);
    document.querySelector<HTMLButtonElement>("[data-toggle]")!.click();
    document.dispatchEvent(new Event("copy", { cancelable: true }));
    expect(messages.at(-1)?.text).toBe(`Area ${source} grows`);
  });

  it("preserves context references beside math and escapes non-math text", () => {
    const source = "![Screenshot](t3-context://v1/image/screenshot)";
    const html = nativeMathRunHtml({ text: "Screenshot", sourceText: source }, style);
    const formula = nativeMathRunHtml({ text: "$x$", mathSource: "$x$", mathTex: "x" }, style);
    const { messages } = documentRuntime([html, "<span> </span>", formula]);
    const range = document.createRange();
    range.selectNodeContents(document.getElementById("content")!);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("copy", { cancelable: true }));
    expect(messages.at(-1)?.text).toBe(`${source} \\(x\\)`);
    expect(nativeMathRunHtml({ text: "<script>bad</script>" }, style)).toContain("&lt;script&gt;");
  });
});
