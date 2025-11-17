import "@testing-library/jest-dom";

class ResizeObserverMock {
  observe() {
    // no-op for tests
  }
  unobserve() {
    // no-op
  }
  disconnect() {
    // no-op
  }
}

if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  // @ts-expect-error - assign mock for jsdom
  window.ResizeObserver = ResizeObserverMock;
}

if (typeof globalThis !== "undefined" && !("ResizeObserver" in globalThis)) {
  // @ts-expect-error - assign mock
  globalThis.ResizeObserver = ResizeObserverMock;
}
