import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeRow } from "@/components/codes/code-row";
import { AppShell } from "@/components/shell/app-shell";
import { makeCode } from "../helpers";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("responsive interface", () => {
  it("renders a collapsible desktop sidebar and a mobile navigation bar", () => {
    render(
      <AppShell email="dispatcher@example.com" syncLabel="Synced" offline={false} onLock={() => undefined}>
        <p>Directory</p>
      </AppShell>,
    );
    expect(screen.getByTestId("mobile-nav").className).toContain("md:hidden");
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Clients" })).toHaveLength(2);
  });

  it("masks a code until reveal and keeps copy as a large touch target", () => {
    const code = makeCode(crypto.randomUUID(), crypto.randomUUID(), "Front gate");
    const onCopy = vi.fn();
    const onReveal = vi.fn();
    const view = render(
      <CodeRow
        code={code}
        locationName="Loading bay"
        revealedValue={null}
        onReveal={onReveal}
        onHide={() => undefined}
        onCopy={onCopy}
        onEdit={() => undefined}
        onArchive={() => undefined}
        onDelete={() => undefined}
      />,
    );
    expect(view.container.textContent).not.toContain("cipher");
    expect(screen.getByLabelText("Hidden code").textContent).toBe("••••••••");
    expect(screen.getByRole("button", { name: "Copy" }).className).toContain("min-h-11");
    screen.getByRole("button", { name: "Reveal" }).click();
    expect(onReveal).toHaveBeenCalledOnce();
    view.rerender(
      <CodeRow
        code={code}
        locationName="Loading bay"
        revealedValue="0012"
        onReveal={onReveal}
        onHide={() => undefined}
        onCopy={onCopy}
        onEdit={() => undefined}
        onArchive={() => undefined}
        onDelete={() => undefined}
      />,
    );
    expect(screen.getByText("0012").className).toContain("secret-text");
    screen.getByRole("button", { name: "Copy" }).click();
    expect(onCopy).toHaveBeenCalledOnce();
  });
});
