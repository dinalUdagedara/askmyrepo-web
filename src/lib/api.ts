const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {}

export interface IndexResponse {
  repo_id: string;
  name: string;
  commit_sha: string;
  status: string;
  num_files: number;
  num_chunks: number;
}

export interface Source {
  file_path: string;
  start_line: number;
  end_line: number;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new ApiError(payload?.detail ?? `Request to ${path} failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export function indexRepo(repoUrl: string): Promise<IndexResponse> {
  return postJson<IndexResponse>("/index", { repo_url: repoUrl });
}

export function chatWithRepo(repoId: string, question: string): Promise<ChatResponse> {
  return postJson<ChatResponse>("/chat", { repo_id: repoId, question });
}

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const match = url
    .trim()
    .match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export function githubLineUrl(
  repoUrl: string,
  commitSha: string,
  source: Source
): string | null {
  const parsed = parseGithubUrl(repoUrl);
  if (!parsed) return null;
  const lineFragment =
    source.start_line === source.end_line
      ? `L${source.start_line}`
      : `L${source.start_line}-L${source.end_line}`;
  return `https://github.com/${parsed.owner}/${parsed.repo}/blob/${commitSha}/${source.file_path}#${lineFragment}`;
}
