// UT-14: Save button disabled while mutation pending (FR-13)
// UT-15: Form submits { tonePreset, personaPrompt, topicsToAvoid } (FR-11)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import {
  ToolbarSlotProvider,
  ToolbarSlotTarget,
} from "@/components/workspace-toolbar-slot";

// Mock convex/react before importing the component
const mockUseQuery = vi.fn(() => null);
let mutationResolve: (() => void) | null = null;
const mockMutationFn = vi.fn(
  () =>
    new Promise<null>((resolve) => {
      mutationResolve = () => resolve(null);
    }),
);
const mockUseMutation = vi.fn(() => mockMutationFn);

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
}));

// Import component after mock is set up
const { CloneSettingsPanel } = await import(
  "@/features/clone-settings/components/clone-settings-panel"
);

function renderWithToolbarSlot(ui: React.ReactElement) {
  return render(
    <ToolbarSlotProvider>
      <ToolbarSlotTarget />
      {ui}
    </ToolbarSlotProvider>,
  );
}

describe("CloneSettingsPanel", () => {
  beforeEach(() => {
    mockMutationFn.mockReset();
    mutationResolve = null;
    // Default: mutation resolves immediately
    mockMutationFn.mockImplementation(() => Promise.resolve(null));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders save button enabled when not submitting", () => {
    renderWithToolbarSlot(<CloneSettingsPanel />);
    const saveButton = screen.getByRole("button", { name: /save/i });
    expect(saveButton).toBeDefined();
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);
  });

  it("save button is disabled while mutation is pending (FR-13)", async () => {
    // Make mutation hang
    mockMutationFn.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          mutationResolve = () => resolve(null);
        }),
    );

    renderWithToolbarSlot(<CloneSettingsPanel />);

    const saveButton = screen.getByRole("button", { name: /save/i });
    await userEvent.click(saveButton);

    // During pending, button should be disabled
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /saving/i });
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    // Resolve the mutation
    mutationResolve?.();
  });

  it("submits { tonePreset, personaPrompt, topicsToAvoid } on save (FR-11)", async () => {
    mockMutationFn.mockImplementation(() => Promise.resolve(null));
    renderWithToolbarSlot(<CloneSettingsPanel />);

    const saveButton = screen.getByRole("button", { name: /save/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutationFn).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockMutationFn.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(callArgs).toHaveProperty("tonePreset");
    expect(callArgs).toHaveProperty("personaPrompt");
    expect(callArgs).toHaveProperty("topicsToAvoid");
  });
});
