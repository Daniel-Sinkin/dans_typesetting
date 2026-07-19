// Small dependency-free syntax lexer used by listing preview and editor overlays.
import type { CodeListingLanguage } from "../model/document";

export type CodeTokenKind =
  | "plain"
  | "keyword"
  | "type"
  | "number"
  | "string"
  | "comment"
  | "preprocessor";

export interface CodeToken {
  readonly kind: CodeTokenKind;
  readonly text: string;
}

const cppKeywords = new Set([
  "alignas", "alignof", "and", "asm", "auto", "break", "case", "catch", "class",
  "concept", "const", "consteval", "constexpr", "constinit", "continue", "co_await",
  "co_return", "co_yield", "decltype", "default", "delete", "do", "else", "enum",
  "explicit", "export", "extern", "for", "friend", "goto", "if", "inline", "namespace",
  "new", "noexcept", "not", "operator", "or", "private", "protected", "public",
  "requires", "return", "sizeof", "static", "struct", "switch", "template", "this",
  "throw", "try", "typedef", "typeid", "typename", "union", "using", "virtual",
  "volatile", "while", "xor",
]);

const cppTypes = new Set([
  "bool", "char", "char8_t", "char16_t", "char32_t", "double", "float", "int", "long",
  "short", "signed", "unsigned", "void", "wchar_t", "size_t", "string", "string_view",
]);

const juliaKeywords = new Set([
  "baremodule", "begin", "break", "catch", "const", "continue", "do", "else", "elseif",
  "end", "export", "finally", "for", "function", "global", "if", "import", "let", "local",
  "macro", "module", "quote", "return", "struct", "try", "using", "while", "where",
]);

const juliaTypes = new Set([
  "Any", "Bool", "Char", "Complex", "Float16", "Float32", "Float64", "Int", "Int8",
  "Int16", "Int32", "Int64", "Integer", "Nothing", "Real", "String", "UInt", "UInt8",
  "UInt16", "UInt32", "UInt64",
]);

const cppPattern = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|^[ \t]*#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[fFuUlL]*\b|\b[A-Za-z_]\w*\b/gmu;
const juliaPattern = /#=[\s\S]*?=#|#[^\n]*|"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:\d+(?:\.\d*)?|\.\d+)(?:[eEfF][+-]?\d+)?\b|\b[A-Za-z_]\w*[!?]?\b/gmu;

function classifyToken(language: CodeListingLanguage, text: string): CodeTokenKind {
  if (language === "cpp") {
    if (text.startsWith("//") || text.startsWith("/*")) return "comment";
    if (/^[ \t]*#/u.test(text)) return "preprocessor";
    if (text.startsWith('"') || text.startsWith("'")) return "string";
    if (/^(?:\d|\.\d)/u.test(text)) return "number";
    if (cppKeywords.has(text)) return "keyword";
    if (cppTypes.has(text)) return "type";
    return "plain";
  }

  if (text.startsWith("#")) return "comment";
  if (text.startsWith('"') || text.startsWith("'")) return "string";
  if (/^(?:\d|\.\d)/u.test(text)) return "number";
  if (juliaKeywords.has(text)) return "keyword";
  if (juliaTypes.has(text)) return "type";
  return "plain";
}

export function highlightCode(
  language: CodeListingLanguage,
  code: string,
): readonly CodeToken[] {
  const pattern = language === "cpp" ? cppPattern : juliaPattern;
  pattern.lastIndex = 0;
  const tokens: CodeToken[] = [];
  let cursor = 0;
  for (const match of code.matchAll(pattern)) {
    const index = match.index;
    const text = match[0];
    if (index > cursor) {
      tokens.push(Object.freeze({ kind: "plain", text: code.slice(cursor, index) }));
    }
    tokens.push(Object.freeze({ kind: classifyToken(language, text), text }));
    cursor = index + text.length;
  }
  if (cursor < code.length) {
    tokens.push(Object.freeze({ kind: "plain", text: code.slice(cursor) }));
  }
  return Object.freeze(tokens);
}
