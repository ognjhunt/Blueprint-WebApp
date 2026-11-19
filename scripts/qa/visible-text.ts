/**
 * The text a reader can see in a source file: string literals, template text and JSX text, for the copy guards
 * (`client/tests/publicClaims.guard.test.ts`, `client/tests/money/no-price-copy.guard.test.ts`).
 *
 * Comments, imports, type names, identifiers, log and error messages, and single-token codes (ids, class names, keys)
 * are left out. A `.txt` file is read line by line; an `.html` file is read through its text and its attribute values.
 */
import ts from "typescript";

const ENTITIES: Record<string, string> = { apos: "'", quot: "\"", amp: "&", nbsp: " ", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", rarr: "→", mdash: "—", ndash: "–" };
const decode = (text: string) => text.replace(/&(\w+);/g, (whole, name: string) => ENTITIES[name] ?? whole);

/** One-token strings with code punctuation, or all lower case: ids, class names, keys, enum values. */
const looksLikeCode = (text: string) => !/\s/.test(text) && (/[-_./:#@=]/.test(text) || text === text.toLowerCase());
/** JSX attributes a reader never sees: class names, ids, links, wiring. */
const HIDDEN_ATTRIBUTES = /^(className|class|id|key|href|src|rel|target|htmlFor|type|name|role|style|method|action|aria-labelledby|aria-describedby|aria-controls|data-[\w-]+)$/;
/** Calls whose strings are for logs and errors, never for a reader. */
const NOT_FOR_READERS = /^(logger|console)\.|(^|\.)(warn|error|info|debug|trace)$|Error$/;

export function visibleTextOf(file: string, source: string): string[] {
  if (file.endsWith(".txt")) return source.split(/\n+/).filter(line => line.trim());
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const texts: string[] = [];
  const push = (text: string) => {
    const clean = decode(text.replace(/\s+/g, " ").trim());
    if (clean && !looksLikeCode(clean)) texts.push(clean);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isLiteralTypeNode(node) || ts.isTypeNode(node)) return;
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && NOT_FOR_READERS.test(node.expression.getText(sourceFile))) return;
    if (ts.isJsxAttribute(node) && HIDDEN_ATTRIBUTES.test(node.name.getText(sourceFile))) return;
    if (ts.isJsxText(node)) push(node.getText(sourceFile));
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // A property key is a name, not a sentence.
      const parent = node.parent;
      // A regular expression's replacement template (`[/your video/g, "the site's $1"]`) is code, not a sentence.
      const replacement = parent && ts.isArrayLiteralExpression(parent) && parent.elements.length === 2
        && ts.isRegularExpressionLiteral(parent.elements[0]) && parent.elements[1] === node;
      if (!replacement && !(parent && (ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) && parent.name === node)) push(node.text);
    } else if (ts.isTemplateExpression(node)) {
      push([node.head.text, ...node.templateSpans.map(span => span.literal.text)].join(" … "));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return texts;
}
