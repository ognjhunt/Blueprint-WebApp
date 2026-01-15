import { renderToString } from "react-dom/server";
import { Helmet } from "react-helmet";
import { memoryLocation } from "wouter/memory-location";
import { AppShell } from "./AppShell";
import { AppRoutesServer } from "./AppRoutesServer";

export function render(url: string) {
  const location = memoryLocation({ path: url, static: true });

  const html = renderToString(
    <AppShell locationHook={location.hook}>
      <AppRoutesServer />
    </AppShell>,
  );

  const helmet = Helmet.renderStatic();
  const head = [
    helmet.title.toString(),
    helmet.meta.toString(),
    helmet.link.toString(),
    helmet.script.toString(),
    helmet.noscript.toString(),
  ]
    .filter(Boolean)
    .join("\n");

  return { html, head };
}
