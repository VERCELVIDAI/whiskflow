import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("responsive and accessibility contracts", () => {
  it("declares a responsive viewport and theme colors", () => {
    const layout = source("app/layout.tsx");
    expect(layout).toContain('width: "device-width"');
    expect(layout).toContain('initialScale: 1');
    expect(layout).toContain("themeColor");
  });

  it("provides desktop, tablet and mobile navigation shells", () => {
    const shell = source("components/app-shell.tsx");
    expect(shell).toContain("lg:hidden");
    expect(shell).toContain("lg:flex");
    expect(shell).toContain('aria-label="Mobile"');
    expect(shell).toContain('aria-label="Primary"');
    expect(shell).toContain("Dialog");
    expect(shell).toContain("fixed inset-x-0 bottom-0");
  });

  it("keeps the three-region studio structure and empty inspector", () => {
    const createStudio = source("components/create/create-studio.tsx");
    const inspector = source("components/studio/inspector-empty.tsx");
    expect(createStudio).toContain("InspectorEmpty");
    expect(createStudio).toMatch(/grid-cols|xl:grid|lg:grid/);
    expect(inspector).toContain("Nothing selected");
  });

  it("exposes autosave states and a debounced scene save", () => {
    const workspace = source("components/projects/project-workspace.tsx");
    expect(workspace).toContain("AutosaveIndicator");
    expect(workspace).toContain("850");
    expect(workspace).toMatch(/setSaveState\("saving"\)/);
    expect(workspace).toMatch(/setSaveState\("saved"\)/);
    expect(workspace).toMatch(/setSaveState\("error"\)/);
  });

  it("respects reduced motion and keeps keyboard focus visible", () => {
    const css = source("app/globals.css");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: 0.001ms !important");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("outline");
  });
});
