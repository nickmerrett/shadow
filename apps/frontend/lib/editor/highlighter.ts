import { loader } from "@monaco-editor/react";
import { shikiToMonaco } from "@shikijs/monaco";
import {
  createHighlighter,
  createJavaScriptRegexEngine,
  ThemeInput,
  type Highlighter,
} from "shiki";
import theme from "./theme.json";

export const LANGUAGES = [
  { id: "typescript" },
  { id: "javascript" },
  { id: "tsx" },
  { id: "jsx" },
  { id: "json" },
  { id: "markdown" },
  { id: "css" },
  { id: "html" },
];

export const jsEngine = createJavaScriptRegexEngine({ forgiving: true });

let highlighterPromise: Promise<Highlighter> | null = null;
let monacoPatched = false;

export async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [theme as unknown as ThemeInput],
      langs: LANGUAGES.map((lang) => lang.id),
      engine: jsEngine,
    });
  }
  return highlighterPromise;
}

export async function patchMonacoWithShiki() {
  if (monacoPatched) return;

  try {
    const monaco = await loader.init();

    LANGUAGES.forEach((lang) => {
      if (
        !monaco.languages
          .getLanguages()
          .find((l: { id: string }) => l.id === lang.id)
      ) {
        monaco.languages.register(lang);
      }
    });

    const highlighter = await getHighlighter();
    shikiToMonaco(highlighter, monaco);
    monacoPatched = true;
  } catch (error) {
    console.error("Failed to initialize Shiki with Monaco:", error);
  }
}
