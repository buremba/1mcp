# Thread Storage

This directory contains the thread storage abstraction layer that allows the application to persist thread metadata using different backends.

## Architecture

The storage layer uses the **Strategy Pattern** with dependency injection:

- `thread-storage.interface.ts` - Defines the `IThreadStorage` interface
- `local-storage.ts` - localStorage implementation
- `remote-storage.ts` - Remote API implementation
- The hook `useThreadStorage` accepts any `IThreadStorage` implementation

## Usage

### Using localStorage (default)

```tsx
import { LocalStorageThreadStorage } from "./storage";
import { useThreadStorage } from "./hooks/use-thread-storage";

function App() {
  const storage = useMemo(() => new LocalStorageThreadStorage(), []);
  const threadStorage = useThreadStorage(storage);
  // ...
}
```

### Using Remote API

```tsx
import { RemoteThreadStorage } from "./storage";
import { useThreadStorage } from "./hooks/use-thread-storage";

function App() {
  const storage = useMemo(
    () => new RemoteThreadStorage({
      baseUrl: "https://api.example.com",
      apiKey: "your-api-key",
    }),
    []
  );
  const threadStorage = useThreadStorage(storage);
  // ...
}
```

## API Contract

All storage implementations must implement the `IThreadStorage` interface:

```typescript
interface IThreadStorage {
  loadThreads(): Promise<Thread[]>;
  saveThreads(threads: Thread[]): Promise<void>;
  getCurrentThreadId(): Promise<string | null>;
  saveCurrentThreadId(threadId: string | null): Promise<void>;
}
```

## Remote API Endpoints

The `RemoteThreadStorage` implementation expects the following API endpoints:

- `GET /threads` - Load all threads
- `PUT /threads` - Save all threads (body: `Thread[]`)
- `GET /threads/current` - Get current thread ID (returns: `{ threadId: string | null }`)
- `PUT /threads/current` - Save current thread ID (body: `{ threadId: string | null }`)

All endpoints should return appropriate HTTP status codes:
- `200` - Success
- `404` - Not found (for `GET /threads/current` when no thread is selected)
- `4xx/5xx` - Error cases

## Creating Custom Storage

You can create your own storage implementation by implementing the `IThreadStorage` interface:

```typescript
import type { Thread, IThreadStorage } from "./thread-storage.interface";

export class CustomThreadStorage implements IThreadStorage {
  async loadThreads(): Promise<Thread[]> {
    // Your implementation
  }

  async saveThreads(threads: Thread[]): Promise<void> {
    // Your implementation
  }

  async getCurrentThreadId(): Promise<string | null> {
    // Your implementation
  }

  async saveCurrentThreadId(threadId: string | null): Promise<void> {
    // Your implementation
  }
}
```
