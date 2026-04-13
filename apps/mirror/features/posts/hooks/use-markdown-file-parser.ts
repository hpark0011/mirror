"use client";

import { useCallback, useRef, useState } from "react";
import { type JSONContent } from "@feel-good/features/editor/types";
import {
  validateFile,
  parseMdFrontmatter,
  type ParsedMarkdown,
} from "../lib/parse-md-frontmatter";
import { markdownToJsonContent } from "../lib/markdown-to-json-content";

export type ParsedMarkdownFile = {
  metadata: ParsedMarkdown;
  jsonContent: JSONContent;
};

export type UseMarkdownFileParserReturn = {
  parse: (file: File) => void;
  result: ParsedMarkdownFile | null;
  error: string | null;
  isParsing: boolean;
  reset: () => void;
};

export function useMarkdownFileParser(): UseMarkdownFileParserReturn {
  const [result, setResult] = useState<ParsedMarkdownFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const parseCallIdRef = useRef(0);

  const reset = useCallback(() => {
    parseCallIdRef.current++;
    setResult(null);
    setError(null);
    setIsParsing(false);
  }, []);

  const parse = useCallback((file: File) => {
    const callId = ++parseCallIdRef.current;

    // Reset previous state
    setResult(null);
    setError(null);

    // Validate file (extension + size)
    const fileError = validateFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }

    setIsParsing(true);

    const reader = new FileReader();

    reader.onload = () => {
      if (parseCallIdRef.current !== callId) return;
      try {
        const fileContent = reader.result;
        if (typeof fileContent !== "string") {
          setError("Unexpected file read result");
          setIsParsing(false);
          return;
        }
        const parsed = parseMdFrontmatter(fileContent, file.name);

        if (!parsed.success) {
          setError(parsed.error.message);
          setIsParsing(false);
          return;
        }

        const jsonContent = markdownToJsonContent(parsed.data.body);

        setResult({
          metadata: parsed.data,
          jsonContent,
        });
        setError(null);
      } catch (e) {
        setResult(null);
        setError(
          e instanceof Error ? e.message : "Failed to parse markdown file",
        );
      } finally {
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      if (parseCallIdRef.current !== callId) return;
      setError("Failed to read file");
      setIsParsing(false);
    };

    reader.readAsText(file);
  }, []);

  return { parse, result, error, isParsing, reset };
}
