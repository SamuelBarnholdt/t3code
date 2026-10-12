import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Linking, useWindowDimensions } from "react-native";
import { setStringAsync } from "expo-clipboard";
import { WebView } from "react-native-webview";
import { requireNativeModule } from "expo";
import {
  decodeComposerContextFragment,
  encodeComposerContextFragment,
} from "@t3tools/shared/composerContextClipboard";
import type { NativeMarkdownTextRun } from "./nativeMarkdownText";
import type {
  MarkdownFileContextMenu,
  NativeMarkdownTextStyle,
} from "./SelectableMarkdownText.types";
import { loadNativeMathIcons, nativeMathIconKey } from "./nativeMathAssets";
import { NATIVE_MATH_DOCUMENT } from "./nativeMathDocument";
import type { NativeMathTableRows } from "./nativeMathHtml";

const documentSource = { html: NATIVE_MATH_DOCUMENT };
let rendererPromise: Promise<typeof import("./nativeMathHtml")> | undefined;
function loadRenderer() {
  return (rendererPromise ??= import("./nativeMathHtml").catch((error) => {
    rendererPromise = undefined;
    throw error;
  }));
}

/** One view per math-containing text chunk preserves inline layout and selection on both OSes. */
export const NativeMathText = memo(function NativeMathText(props: {
  readonly runs: ReadonlyArray<NativeMarkdownTextRun>;
  readonly fallback: ReactNode;
  readonly textStyle: NativeMarkdownTextStyle;
  readonly onLinkPress?: (href: string) => void;
  readonly fileContextMenu?: (href: string) => MarkdownFileContextMenu | undefined;
  readonly onFileContextMenuAction?: (href: string, actionId: string) => void;
  readonly contextClipboardFragment?: string;
  readonly table?: NativeMathTableRows;
}) {
  const webView = useRef<WebView<object>>(null);
  const ready = useRef(false);
  const [height, setHeight] = useState(props.textStyle.lineHeight);
  const [failed, setFailed] = useState(false);
  const [renderer, setRenderer] = useState<typeof import("./nativeMathHtml")>();
  const [icons, setIcons] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    void loadNativeMathIcons(props.runs).then((loaded) => {
      if (active)
        setIcons((current) =>
          Object.keys(current).length === Object.keys(loaded).length &&
          Object.entries(loaded).every(([key, value]) => current[key] === value)
            ? current
            : loaded,
        );
    });
    return () => {
      active = false;
    };
  }, [props.runs]);
  const { fontScale } = useWindowDimensions();
  useEffect(() => {
    let active = true;
    void loadRenderer().then(
      (module) => {
        if (active) setRenderer(module);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  const fileContextMenu = props.fileContextMenu;
  const update = useMemo(() => {
    if (!renderer) return null;
    const style = {
      ...props.textStyle,
      fontSize: props.textStyle.fontSize * fontScale,
      lineHeight: props.textStyle.lineHeight * fontScale,
      headingFontSizes: props.textStyle.headingFontSizes?.map((size) => size * fontScale),
    };
    const prefixedLinks = new Set<string>();
    const renderRun = (run: NativeMarkdownTextRun) => {
      const showExternalIcon = !run.href || !prefixedLinks.has(run.href);
      if (run.externalHost && run.href) prefixedLinks.add(run.href);
      return renderer.nativeMathRunHtml(
        run,
        style,
        run.fileIcon && run.href ? fileContextMenu?.(run.href) : undefined,
        icons[nativeMathIconKey(run) ?? ""],
        showExternalIcon,
      );
    };
    return {
      runs: props.table
        ? [renderer.nativeMathTableHtml(props.table, style, renderRun)]
        : props.runs.map(renderRun),
      color: style.color,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
    };
  }, [renderer, props.runs, props.table, props.textStyle, fileContextMenu, fontScale, icons]);
  const revision = useRef(0);
  const latest = useRef(update);
  useEffect(() => {
    latest.current = update;
    if (ready.current && update) {
      revision.current += 1;
      webView.current?.injectJavaScript(
        `window.updateMath(${JSON.stringify({ ...update, revision: revision.current })});true;`,
      );
    }
  }, [update]);

  if (failed || !renderer) return props.fallback;
  return (
    <WebView<object>
      ref={webView}
      source={documentSource}
      originWhitelist={["*"]}
      onShouldStartLoadWithRequest={(request) => request.url === "about:blank"}
      scrollEnabled
      nestedScrollEnabled
      bounces={false}
      showsVerticalScrollIndicator={false}
      dataDetectorTypes="none"
      allowFileAccess={false}
      setSupportMultipleWindows={false}
      style={{ height, backgroundColor: "transparent", flex: 0 }}
      onError={() => setFailed(true)}
      onContentProcessDidTerminate={() => setFailed(true)}
      onRenderProcessGone={() => setFailed(true)}
      onMessage={(event) => {
        let message: unknown;
        try {
          message = JSON.parse(event.nativeEvent.data);
        } catch {
          return;
        }
        if (!message || typeof message !== "object" || !("type" in message)) return;
        if (message.type === "ready") {
          ready.current = true;
          if (latest.current) {
            revision.current += 1;
            webView.current?.injectJavaScript(
              `window.updateMath(${JSON.stringify({ ...latest.current, revision: revision.current })});true;`,
            );
          }
          return;
        }
        // Layout measurements expire after an update; clicks still represent
        // the formula or link the user selected while that update was in flight.
        if (
          message.type === "height" &&
          "revision" in message &&
          message.revision === revision.current &&
          "height" in message &&
          typeof message.height === "number" &&
          Number.isFinite(message.height) &&
          message.height > 0
        )
          setHeight(message.height);
        if (message.type === "copy" && "text" in message && typeof message.text === "string") {
          const text = message.text;
          const fragment = decodeComposerContextFragment(props.contextClipboardFragment ?? "");
          const records = fragment?.records.filter((record) => text.includes(record.contextId));
          const encoded =
            fragment && records?.length
              ? encodeComposerContextFragment({ ...fragment, records })
              : null;
          const copy = encoded
            ? Promise.resolve().then(() =>
                requireNativeModule<{
                  writeContextClipboard: (text: string, fragment: string) => Promise<void>;
                }>("T3ComposerEditor").writeContextClipboard(text, encoded),
              )
            : setStringAsync(text);
          void copy.then(
            () => {
              webView.current?.injectJavaScript(
                `window.mathCopyResult(${JSON.stringify(text)});true;`,
              );
            },
            () => Alert.alert("Could not copy text"),
          );
        }
        if (
          message.type === "file-action" &&
          "href" in message &&
          typeof message.href === "string" &&
          "action" in message &&
          typeof message.action === "string"
        ) {
          const href = message.href;
          const actionId = message.action;
          if (
            props.runs.some((run) => run.fileIcon && run.href === href) &&
            props
              .fileContextMenu?.(href)
              ?.actions.some((action) => action.id === actionId && !action.disabled)
          )
            props.onFileContextMenuAction?.(href, actionId);
        }
        if (message.type === "link" && "href" in message && typeof message.href === "string") {
          if (props.onLinkPress) props.onLinkPress(message.href);
          else void Linking.openURL(message.href);
        }
      }}
    />
  );
});
