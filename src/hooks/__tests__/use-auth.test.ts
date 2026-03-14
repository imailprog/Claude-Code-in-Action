import { test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

beforeEach(() => {
  vi.clearAllMocks();
});

// --- signIn ---

test("signIn returns success and navigates when credentials are valid", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([
    { id: "p1", name: "Project", createdAt: new Date(), updatedAt: new Date() },
  ]);

  const { result } = renderHook(() => useAuth());

  let returnValue: any;
  await act(async () => {
    returnValue = await result.current.signIn("user@test.com", "password123");
  });

  expect(signInAction).toHaveBeenCalledWith("user@test.com", "password123");
  expect(returnValue).toEqual({ success: true });
  expect(mockPush).toHaveBeenCalledWith("/p1");
});

test("signIn returns error and does not navigate on failure", async () => {
  vi.mocked(signInAction).mockResolvedValue({
    success: false,
    error: "Invalid credentials",
  });

  const { result } = renderHook(() => useAuth());

  let returnValue: any;
  await act(async () => {
    returnValue = await result.current.signIn("user@test.com", "wrong");
  });

  expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
  expect(mockPush).not.toHaveBeenCalled();
});

test("signIn sets isLoading during the call and resets after", async () => {
  let resolveSignIn: (v: any) => void;
  vi.mocked(signInAction).mockImplementation(
    () => new Promise((resolve) => { resolveSignIn = resolve; })
  );

  const { result } = renderHook(() => useAuth());

  expect(result.current.isLoading).toBe(false);

  let promise: Promise<any>;
  act(() => {
    promise = result.current.signIn("a@b.com", "pass1234");
  });

  expect(result.current.isLoading).toBe(true);

  await act(async () => {
    resolveSignIn!({ success: false, error: "fail" });
    await promise!;
  });

  expect(result.current.isLoading).toBe(false);
});

test("signIn resets isLoading even when signInAction throws", async () => {
  vi.mocked(signInAction).mockRejectedValue(new Error("Network error"));

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await expect(result.current.signIn("a@b.com", "pass")).rejects.toThrow(
      "Network error"
    );
  });

  expect(result.current.isLoading).toBe(false);
});

// --- signUp ---

test("signUp returns success and navigates when registration succeeds", async () => {
  vi.mocked(signUpAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([
    { id: "p2", name: "Project", createdAt: new Date(), updatedAt: new Date() },
  ]);

  const { result } = renderHook(() => useAuth());

  let returnValue: any;
  await act(async () => {
    returnValue = await result.current.signUp("new@test.com", "password123");
  });

  expect(signUpAction).toHaveBeenCalledWith("new@test.com", "password123");
  expect(returnValue).toEqual({ success: true });
  expect(mockPush).toHaveBeenCalledWith("/p2");
});

test("signUp returns error and does not navigate on failure", async () => {
  vi.mocked(signUpAction).mockResolvedValue({
    success: false,
    error: "Email already registered",
  });

  const { result } = renderHook(() => useAuth());

  let returnValue: any;
  await act(async () => {
    returnValue = await result.current.signUp("dup@test.com", "password123");
  });

  expect(returnValue).toEqual({
    success: false,
    error: "Email already registered",
  });
  expect(mockPush).not.toHaveBeenCalled();
});

test("signUp resets isLoading even when signUpAction throws", async () => {
  vi.mocked(signUpAction).mockRejectedValue(new Error("Server error"));

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await expect(result.current.signUp("a@b.com", "pass")).rejects.toThrow(
      "Server error"
    );
  });

  expect(result.current.isLoading).toBe(false);
});

// --- Post sign-in: anonymous work migration ---

test("migrates anonymous work into a new project after sign in", async () => {
  const anonMessages = [{ role: "user", content: "hello" }];
  const anonData = { "/App.jsx": { type: "file", content: "<div/>" } };

  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue({
    messages: anonMessages,
    fileSystemData: anonData,
  });
  vi.mocked(createProject).mockResolvedValue({
    id: "migrated-1",
    name: "Migrated",
    userId: "u1",
    messages: "[]",
    data: "{}",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@test.com", "pass1234");
  });

  expect(createProject).toHaveBeenCalledWith({
    name: expect.stringContaining("Design from"),
    messages: anonMessages,
    data: anonData,
  });
  expect(clearAnonWork).toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/migrated-1");
  expect(getProjects).not.toHaveBeenCalled();
});

test("skips anon migration when messages array is empty", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue({
    messages: [],
    fileSystemData: {},
  });
  vi.mocked(getProjects).mockResolvedValue([
    { id: "p1", name: "Existing", createdAt: new Date(), updatedAt: new Date() },
  ]);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@test.com", "pass1234");
  });

  expect(clearAnonWork).not.toHaveBeenCalled();
  expect(getProjects).toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/p1");
});

test("skips anon migration when getAnonWorkData returns null", async () => {
  vi.mocked(signUpAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([
    { id: "p3", name: "Existing", createdAt: new Date(), updatedAt: new Date() },
  ]);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signUp("user@test.com", "pass1234");
  });

  expect(clearAnonWork).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/p3");
});

// --- Post sign-in: project routing ---

test("navigates to most recent project when no anon work exists", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([
    { id: "recent", name: "Recent", createdAt: new Date(), updatedAt: new Date() },
    { id: "older", name: "Older", createdAt: new Date(), updatedAt: new Date() },
  ]);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@test.com", "pass1234");
  });

  expect(mockPush).toHaveBeenCalledWith("/recent");
  expect(createProject).not.toHaveBeenCalled();
});

test("creates a new project when user has no existing projects", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([]);
  vi.mocked(createProject).mockResolvedValue({
    id: "new-1",
    name: "New Design",
    userId: "u1",
    messages: "[]",
    data: "{}",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@test.com", "pass1234");
  });

  expect(createProject).toHaveBeenCalledWith({
    name: expect.stringMatching(/^New Design #\d+$/),
    messages: [],
    data: {},
  });
  expect(mockPush).toHaveBeenCalledWith("/new-1");
});
