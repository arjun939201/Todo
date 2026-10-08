"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Todo = {
  id: number;
  title: string;
  completed: boolean;
};

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadTodos = useCallback(async () => {
    if (!API_URL) {
      setError("NEXT_PUBLIC_API_URL is not configured.");
      setLoading(false);
      return;
    }

    try {
      setError("");
      const response = await fetch(`${API_URL}/todos`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to load todos.");
      }

      setTodos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect to the API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTodos();
  }, [loadTodos]);

  async function addTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();

    if (!trimmed) {
      setError("Please enter a todo.");
      return;
    }

    if (!API_URL) {
      setError("NEXT_PUBLIC_API_URL is not configured.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(`${API_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to add todo.");
      }

      setTodos((current) => [data, ...current]);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add todo.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTodo(todo: Todo) {
    if (!API_URL) {
      setError("NEXT_PUBLIC_API_URL is not configured.");
      return;
    }

    try {
      setError("");
      const response = await fetch(`${API_URL}/todos/${todo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !todo.completed }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to update todo.");
      }

      setTodos((current) =>
        current.map((item) => (item.id === data.id ? data : item)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update todo.");
    }
  }

  async function deleteTodo(id: number) {
    if (!API_URL) {
      setError("NEXT_PUBLIC_API_URL is not configured.");
      return;
    }

    try {
      setError("");
      const response = await fetch(`${API_URL}/todos/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to delete todo.");
      }

      setTodos((current) => current.filter((todo) => todo.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete todo.");
    }
  }

  const completedCount = todos.filter((todo) => todo.completed).length;

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Simple Todo
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Get things done.
          </h1>
          <p className="mt-3 text-slate-600">
            A clean Todo app powered by Next.js, FastAPI and PostgreSQL.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <form onSubmit={addTodo} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              placeholder="What needs to be done?"
              aria-label="Todo title"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Adding..." : "Add todo"}
            </button>
          </form>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-b border-slate-200 pb-3 text-sm text-slate-500">
            <span>{todos.length} total</span>
            <span>{completedCount} completed</span>
          </div>

          <div className="mt-2">
            {loading ? (
              <div className="space-y-3 py-4" aria-live="polite">
                <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ) : todos.length === 0 ? (
              <div className="py-12 text-center">
                <p className="font-medium text-slate-700">No todos yet.</p>
                <p className="mt-1 text-sm text-slate-500">
                  Add your first task above.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {todos.map((todo) => (
                  <li key={todo.id} className="flex items-center gap-3 py-4">
                    <button
                      type="button"
                      onClick={() => void toggleTodo(todo)}
                      aria-label={
                        todo.completed
                          ? `Uncomplete ${todo.title}`
                          : `Complete ${todo.title}`
                      }
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        todo.completed
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300 hover:border-indigo-500"
                      }`}
                    >
                      {todo.completed && "✓"}
                    </button>

                    <span
                      className={`min-w-0 flex-1 break-words text-sm sm:text-base ${
                        todo.completed
                          ? "text-slate-400 line-through"
                          : "text-slate-800"
                      }`}
                    >
                      {todo.title}
                    </span>

                    <button
                      type="button"
                      onClick={() => void deleteTodo(todo.id)}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Delete ${todo.title}`}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <footer className="mt-6 text-center text-xs text-slate-400">
          Your todos are persisted in PostgreSQL.
        </footer>
      </div>
    </main>
  );
}
