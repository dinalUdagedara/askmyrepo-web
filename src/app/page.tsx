"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ApiError,
  chatWithRepo,
  githubLineUrl,
  indexRepo,
  type Source,
} from "@/lib/api";

interface IndexedRepo {
  repoId: string;
  repoUrl: string;
  name: string;
  commitSha: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export default function Home() {
  const [repoUrlInput, setRepoUrlInput] = useState("");
  const [indexing, setIndexing] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [repo, setRepo] = useState<IndexedRepo | null>(null);

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  async function handleIndex(e: React.FormEvent) {
    e.preventDefault();
    setIndexError(null);
    setIndexing(true);
    try {
      const result = await indexRepo(repoUrlInput);
      setRepo({
        repoId: result.repo_id,
        repoUrl: repoUrlInput,
        name: result.name,
        commitSha: result.commit_sha,
      });
      setMessages([]);
    } catch (err) {
      setIndexError(err instanceof ApiError ? err.message : "Failed to index repo");
    } finally {
      setIndexing(false);
    }
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!repo || !question.trim()) return;

    const askedQuestion = question;
    setMessages((prev) => [...prev, { role: "user", content: askedQuestion }]);
    setQuestion("");
    setChatError(null);
    setChatLoading(true);

    try {
      const result = await chatWithRepo(repo.repoId, askedQuestion);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.answer, sources: result.sources },
      ]);
    } catch (err) {
      setChatError(err instanceof ApiError ? err.message : "Failed to get an answer");
    } finally {
      setChatLoading(false);
    }
  }

  function reset() {
    setRepo(null);
    setMessages([]);
    setRepoUrlInput("");
    setIndexError(null);
  }

  return (
    <div className="flex flex-col flex-1 max-w-3xl w-full mx-auto p-6 gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">RAG-Over-Codebase</h1>
        {repo && (
          <button
            onClick={reset}
            className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            Index another repo
          </button>
        )}
      </header>

      {!repo && (
        <form onSubmit={handleIndex} className="flex flex-col gap-3 mt-12">
          <label className="text-sm text-neutral-500">
            Paste a GitHub repo URL to chat with it
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={repoUrlInput}
              onChange={(e) => setRepoUrlInput(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
            <button
              type="submit"
              disabled={indexing}
              className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {indexing ? "Indexing…" : "Index"}
            </button>
          </div>
          {indexError && <p className="text-sm text-red-500">{indexError}</p>}
        </form>
      )}

      {repo && (
        <>
          <p className="text-sm text-neutral-500">
            Chatting with <span className="font-medium">{repo.name}</span>
          </p>

          <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
            {messages.map((message, i) => (
              <div
                key={i}
                className={
                  message.role === "user"
                    ? "self-end max-w-[80%] rounded-lg bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900 px-4 py-2 text-sm"
                    : "self-start max-w-[80%] rounded-lg bg-neutral-100 dark:bg-neutral-800 px-4 py-2 text-sm"
                }
              >
                {message.role === "assistant" ? (
                  <div className="markdown-content">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  message.content
                )}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1 border-t border-neutral-300 dark:border-neutral-700 pt-2">
                    {message.sources.map((source, j) => {
                      const url = githubLineUrl(repo.repoUrl, repo.commitSha, source);
                      const label = `${source.file_path}:${source.start_line}-${source.end_line}`;
                      return (
                        <a
                          key={j}
                          href={url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          [{j + 1}] {label}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="self-start text-sm text-neutral-500">Thinking…</div>
            )}
          </div>

          {chatError && <p className="text-sm text-red-500">{chatError}</p>}

          <form onSubmit={handleAsk} className="flex gap-2">
            <input
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about this repo…"
              className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
            <button
              type="submit"
              disabled={chatLoading}
              className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Ask
            </button>
          </form>
        </>
      )}
    </div>
  );
}
