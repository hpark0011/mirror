import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Helper to create a deferred promise for controlling mutation timing
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const mockRemoveMutation = vi.fn();
const mockWithOptimisticUpdate = vi.fn();
const mockRouter = { replace: vi.fn() };
const mockShowToast = vi.fn();
const mockBuildChatAwareHref = vi.fn((href: string) => href);

// Mock convex/react
vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    const s = String(ref);
    if (s.includes("remove")) {
      // Return a mock mutation that has the .withOptimisticUpdate method
      const mutation = mockRemoveMutation;
      mutation.withOptimisticUpdate = mockWithOptimisticUpdate;
      return mutation;
    }
    return vi.fn();
  },
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

// Mock toast
vi.mock("@feel-good/ui/components/toast", () => ({
  showToast: mockShowToast,
}));

// Mock useChatSearchParams
vi.mock("@/hooks/use-chat-search-params", () => ({
  useChatSearchParams: () => ({
    buildChatAwareHref: mockBuildChatAwareHref,
  }),
}));

// Mock the convex API
vi.mock("@feel-good/convex/convex/_generated/api", () => ({
  api: {
    posts: {
      mutations: {
        remove: "posts.mutations.remove",
      },
      queries: {
        getByUsername: "posts.queries.getByUsername",
      },
    },
  },
}));

// Mock getContentHref
vi.mock("@/features/content", () => ({
  getContentHref: (username: string, type: string) =>
    `/@${username}/${type}`,
}));

const { useDeletePost } = await import("../hooks/use-delete-post");

describe("useDeletePost", () => {
  beforeEach(() => {
    mockRemoveMutation.mockReset();
    mockWithOptimisticUpdate.mockReset();
    mockRouter.replace.mockReset();
    mockShowToast.mockReset();
    mockBuildChatAwareHref.mockReset();
    mockBuildChatAwareHref.mockImplementation((href: string) => href);

    // Set up the default behavior: withOptimisticUpdate returns the mutation itself
    mockWithOptimisticUpdate.mockImplementation((_callback: unknown) => {
      return mockRemoveMutation;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("double-submit guard (isSubmittingRef)", () => {
    it("rejects the second handleConfirm call while the first is in-flight", async () => {
      const { promise, resolve } = deferred<void>();

      // First call will hang on this deferred promise
      mockRemoveMutation.mockReturnValue(promise);
      mockBuildChatAwareHref.mockImplementation((href: string) => href);

      const { result } = renderHook(() =>
        useDeletePost({
          postId: "post_1" as never,
          username: "testuser",
        }),
      );

      let firstCallSettled = false;

      // Kick off first handleConfirm (will hang)
      await act(async () => {
        result.current.handleConfirm().then(() => {
          firstCallSettled = true;
        });
        // Yield to let the first call reach the awaiting state
        await Promise.resolve();
      });

      // Verify first call is in-flight
      expect(result.current.isPending).toBe(true);
      expect(mockRemoveMutation).toHaveBeenCalledTimes(1);

      // router.replace fires synchronously before await removePosts (approach 3)
      expect(mockRouter.replace).toHaveBeenCalledTimes(1);
      expect(mockRouter.replace).toHaveBeenCalledWith("/@testuser/posts");

      // Try second handleConfirm synchronously — should be rejected by guard
      await act(async () => {
        result.current.handleConfirm();
      });

      // Verify removePosts was NOT called a second time (double-submit rejected)
      expect(mockRemoveMutation).toHaveBeenCalledTimes(1);

      // Now resolve the first call
      await act(async () => {
        resolve();
      });

      // Verify first call succeeded and toast was shown
      expect(firstCallSettled).toBe(true);
      expect(mockShowToast).toHaveBeenCalledWith({
        type: "success",
        title: "Post deleted",
      });
      expect(result.current.isPending).toBe(false);
    });
  });

  describe("escape-block during pending (handleOpenChange guard)", () => {
    it("keeps dialog open when escape/outside-click tries to close while pending", async () => {
      const { promise } = deferred<void>();

      mockRemoveMutation.mockReturnValue(promise);

      const { result } = renderHook(() =>
        useDeletePost({
          postId: "post_2" as never,
          username: "testuser",
        }),
      );

      // Open dialog first
      await act(async () => {
        result.current.handleOpenChange(true);
      });

      expect(result.current.dialogOpen).toBe(true);

      // Kick off handleConfirm (will hang)
      await act(async () => {
        result.current.handleConfirm();
        await Promise.resolve();
      });

      // Now try to close via escape/outside-click while pending
      await act(async () => {
        result.current.handleOpenChange(false);
      });

      // Dialog should stay open because isSubmittingRef.current is true
      expect(result.current.dialogOpen).toBe(true);
      expect(result.current.isPending).toBe(true);

      // The guard at line 82 prevents setDialogOpen(false) from being called
    });

    it("allows dialog to close after the mutation settles", async () => {
      const { promise, resolve } = deferred<void>();

      mockRemoveMutation.mockReturnValue(promise);

      const { result } = renderHook(() =>
        useDeletePost({
          postId: "post_3" as never,
          username: "testuser",
        }),
      );

      // Open and start deletion
      await act(async () => {
        result.current.handleOpenChange(true);
      });

      await act(async () => {
        result.current.handleConfirm();
        await Promise.resolve();
      });

      expect(result.current.dialogOpen).toBe(true);

      // Resolve the mutation
      await act(async () => {
        resolve();
      });

      // After success, the finally block resets isSubmittingRef and
      // the finally block's setIsPending(false) runs
      expect(result.current.isPending).toBe(false);

      // Now handleOpenChange(false) should work
      await act(async () => {
        result.current.handleOpenChange(false);
      });

      expect(result.current.dialogOpen).toBe(false);
    });
  });

  describe("error-keeps-dialog-open path (catch arm)", () => {
    it("shows error toast and keeps dialog open when mutation rejects with Error", async () => {
      const { promise, reject } = deferred<void>();

      mockRemoveMutation.mockReturnValue(promise);
      mockBuildChatAwareHref.mockImplementation((href: string) => href);

      const { result } = renderHook(() =>
        useDeletePost({
          postId: "post_4" as never,
          username: "testuser",
        }),
      );

      // Open dialog
      await act(async () => {
        result.current.handleOpenChange(true);
      });

      // Start deletion
      await act(async () => {
        result.current.handleConfirm();
        await Promise.resolve();
      });

      expect(result.current.isPending).toBe(true);

      // Approach 3: router.replace fires before the await, so it was already
      // called even though the mutation is still in-flight.
      expect(mockRouter.replace).toHaveBeenCalledWith("/@testuser/posts");

      // Reject the mutation with an Error
      await act(async () => {
        reject(new Error("Server says no"));
      });

      // Verify dialog stays open (the dialog component may already be unmounted
      // on the real page since we navigated away, but the hook state is still
      // tracked here).
      expect(result.current.dialogOpen).toBe(true);
      // Verify isPending is reset
      expect(result.current.isPending).toBe(false);
      // Verify error toast was shown — surfaces on the posts list page
      expect(mockShowToast).toHaveBeenCalledWith({
        type: "error",
        title: "Server says no",
      });
    });

    it("shows fallback error message when rejection is not an Error instance", async () => {
      const { promise, reject } = deferred<void>();

      mockRemoveMutation.mockReturnValue(promise);
      mockBuildChatAwareHref.mockImplementation((href: string) => href);

      const { result } = renderHook(() =>
        useDeletePost({
          postId: "post_5" as never,
          username: "testuser",
        }),
      );

      // Open and start deletion
      await act(async () => {
        result.current.handleOpenChange(true);
        result.current.handleConfirm();
        await Promise.resolve();
      });

      // Approach 3: router.replace fires before the await
      expect(mockRouter.replace).toHaveBeenCalledWith("/@testuser/posts");

      // Reject with a string instead of Error
      await act(async () => {
        reject("Something broke");
      });

      // Verify dialog stays open and isPending is reset
      expect(result.current.dialogOpen).toBe(true);
      expect(result.current.isPending).toBe(false);
      // Verify fallback toast message (from getMutationErrorMessage)
      expect(mockShowToast).toHaveBeenCalledWith({
        type: "error",
        title: "Something went wrong. Please try again.",
      });
    });
  });

  describe("success path (negative control)", () => {
    it("navigates immediately then closes dialog and shows toast on successful deletion", async () => {
      const { promise, resolve } = deferred<void>();

      mockRemoveMutation.mockReturnValue(promise);
      mockBuildChatAwareHref.mockImplementation((href: string) => href);

      const { result } = renderHook(() =>
        useDeletePost({
          postId: "post_6" as never,
          username: "testuser",
        }),
      );

      await act(async () => {
        result.current.handleOpenChange(true);
        result.current.handleConfirm();
        await Promise.resolve();
      });

      expect(result.current.isPending).toBe(true);

      // Approach 3 (FG_168): router.replace fires synchronously before
      // await removePosts — navigation happens before the mutation resolves,
      // preventing the post-detail blank-flash.
      expect(mockRouter.replace).toHaveBeenCalledWith("/@testuser/posts");
      // Toast has NOT fired yet — mutation still in-flight
      expect(mockShowToast).not.toHaveBeenCalled();

      // Resolve the mutation successfully
      await act(async () => {
        resolve();
      });

      // Verify success toast fires AFTER mutation resolves
      expect(mockShowToast).toHaveBeenCalledWith({
        type: "success",
        title: "Post deleted",
      });

      // Verify dialog is closed
      expect(result.current.dialogOpen).toBe(false);

      // Verify navigation was called exactly once (already asserted above)
      expect(mockRouter.replace).toHaveBeenCalledTimes(1);

      // Verify isPending is reset
      expect(result.current.isPending).toBe(false);
    });
  });

  describe("handleCancel guard", () => {
    it("ignores handleCancel when submission is in-flight", async () => {
      const { promise } = deferred<void>();

      mockRemoveMutation.mockReturnValue(promise);

      const { result } = renderHook(() =>
        useDeletePost({
          postId: "post_7" as never,
          username: "testuser",
        }),
      );

      await act(async () => {
        result.current.handleOpenChange(true);
        result.current.handleConfirm();
        await Promise.resolve();
      });

      expect(result.current.dialogOpen).toBe(true);
      expect(result.current.isPending).toBe(true);

      // Try to cancel while pending
      await act(async () => {
        result.current.handleCancel();
      });

      // Dialog should still be open because of the guard at line 77
      expect(result.current.dialogOpen).toBe(true);
    });

    it("closes dialog when handleCancel is called while not pending", async () => {
      const { result } = renderHook(() =>
        useDeletePost({
          postId: "post_8" as never,
          username: "testuser",
        }),
      );

      await act(async () => {
        result.current.handleOpenChange(true);
      });

      expect(result.current.dialogOpen).toBe(true);

      // Cancel without starting a mutation
      await act(async () => {
        result.current.handleCancel();
      });

      expect(result.current.dialogOpen).toBe(false);
    });
  });
});


// Late-bound (list-page) mode

describe("useDeletePost — late-bound mode (no postId)", () => {
  beforeEach(() => {
    mockRemoveMutation.mockReset();
    mockWithOptimisticUpdate.mockReset();
    mockRouter.replace.mockReset();
    mockShowToast.mockReset();
    mockBuildChatAwareHref.mockReset();
    mockBuildChatAwareHref.mockImplementation((href: string) => href);

    mockWithOptimisticUpdate.mockImplementation((_callback: unknown) => {
      return mockRemoveMutation;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes requestDelete and does NOT navigate on success", async () => {
    const { promise, resolve } = deferred<void>();
    mockRemoveMutation.mockReturnValue(promise);

    const { result } = renderHook(() =>
      useDeletePost({ username: "listuser" }),
    );

    // Verify requestDelete is exposed in list mode
    expect("requestDelete" in result.current).toBe(true);

    // Open dialog via requestDelete
    const fakePost = { _id: "post_list_1" } as never;
    await act(async () => {
      (result.current as { requestDelete: (p: unknown) => void }).requestDelete(
        fakePost,
      );
    });

    expect(result.current.dialogOpen).toBe(true);

    // Confirm deletion
    await act(async () => {
      result.current.handleConfirm();
      await Promise.resolve();
    });

    expect(result.current.isPending).toBe(true);

    // FG_168 invariant: router.replace must NOT fire in list mode
    expect(mockRouter.replace).not.toHaveBeenCalled();

    // Resolve mutation
    await act(async () => {
      resolve();
    });

    expect(mockShowToast).toHaveBeenCalledWith({
      type: "success",
      title: "Post deleted",
    });
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.isPending).toBe(false);
    // Still no navigation
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("handleConfirm is a no-op when requestDelete has not been called", async () => {
    mockRemoveMutation.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useDeletePost({ username: "listuser" }),
    );

    // No requestDelete call -> targetPostRef is null -> handleConfirm should bail
    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockRemoveMutation).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it("double-submit guard works the same as eager mode", async () => {
    const { promise } = deferred<void>();
    mockRemoveMutation.mockReturnValue(promise);

    const { result } = renderHook(() =>
      useDeletePost({ username: "listuser" }),
    );

    const fakePost = { _id: "post_list_2" } as never;
    await act(async () => {
      (result.current as { requestDelete: (p: unknown) => void }).requestDelete(
        fakePost,
      );
    });

    await act(async () => {
      result.current.handleConfirm();
      await Promise.resolve();
    });

    expect(result.current.isPending).toBe(true);

    // Second confirm while in-flight
    await act(async () => {
      result.current.handleConfirm();
    });

    // Mutation should only have been called once
    expect(mockRemoveMutation).toHaveBeenCalledTimes(1);
  });
});
