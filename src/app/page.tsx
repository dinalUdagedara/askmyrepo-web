"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, GitFork, Loader2, Send, User } from "lucide-react";

import {
  ApiError,
  chatWithRepo,
  githubLineUrl,
  indexRepo,
  type Source,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

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

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

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
    <div className="flex flex-1 flex-col items-center px-4 py-8">
      <div className="flex w-full max-w-2xl flex-1 flex-col gap-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitFork className="size-5" />
            <h1 className="text-lg font-semibold">AskMyRepo</h1>
          </div>
          {repo && (
            <Button variant="ghost" size="sm" onClick={reset}>
              Index another repo
            </Button>
          )}
        </header>

        {!repo && (
          <div className="flex flex-1 items-center justify-center">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Chat with any GitHub repo</CardTitle>
                <CardDescription>
                  Paste a public repo URL and ask questions about the code, with
                  answers cited to the exact file and line.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleIndex} className="flex gap-2">
                  <Input
                    type="text"
                    required
                    value={repoUrlInput}
                    onChange={(e) => setRepoUrlInput(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                  />
                  <Button type="submit" disabled={indexing}>
                    {indexing ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      "Index"
                    )}
                  </Button>
                </form>
                {indexError && (
                  <p className="mt-2 text-sm text-destructive">{indexError}</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {repo && (
          <Card className="flex flex-1 flex-col overflow-hidden">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base">{repo.name}</CardTitle>
              <CardDescription>{repo.repoUrl}</CardDescription>
            </CardHeader>

            <ScrollArea className="flex-1 px-4">
              <div className="flex flex-col gap-4 py-4">
                {messages.map((message, i) => (
                  <div
                    key={i}
                    className={
                      message.role === "user"
                        ? "flex items-start justify-end gap-2"
                        : "flex items-start gap-2"
                    }
                  >
                    {message.role === "assistant" && (
                      <Avatar size="sm" className="mt-0.5">
                        <AvatarFallback>
                          <Bot className="size-3.5" />
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div
                      className={
                        message.role === "user"
                          ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                          : "max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm"
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
                        <>
                          <Separator className="my-2" />
                          <div className="flex flex-col gap-1">
                            {message.sources.map((source, j) => {
                              const url = githubLineUrl(
                                repo.repoUrl,
                                repo.commitSha,
                                source
                              );
                              const label = `${source.file_path}:${source.start_line}-${source.end_line}`;
                              return (
                                <a
                                  key={j}
                                  href={url ?? "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                                >
                                  [{j + 1}] {label}
                                </a>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    {message.role === "user" && (
                      <Avatar size="sm" className="mt-0.5">
                        <AvatarFallback>
                          <User className="size-3.5" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarFallback>
                        <Bot className="size-3.5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Thinking…
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <CardFooter className="flex-col items-stretch gap-2 border-t pt-4">
              {chatError && (
                <p className="text-sm text-destructive">{chatError}</p>
              )}
              <form onSubmit={handleAsk} className="flex gap-2">
                <Input
                  type="text"
                  required
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question about this repo…"
                />
                <Button type="submit" disabled={chatLoading} size="icon">
                  <Send />
                </Button>
              </form>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
