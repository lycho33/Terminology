export type ApiIssue = {
  code: string;
  field: string | null;
  message: string;
};

export type ApiError = Error & { status: number; issues: ApiIssue[] };

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof Error &&
  "status" in error &&
  typeof error.status === "number" &&
  "issues" in error &&
  Array.isArray(error.issues);

const isIssue = (value: unknown): value is ApiIssue =>
  typeof value === "object" &&
  value !== null &&
  "code" in value &&
  typeof value.code === "string" &&
  "field" in value &&
  (value.field === null || typeof value.field === "string") &&
  "message" in value &&
  typeof value.message === "string";

export const readApiError = async (
  response: Response,
  fallback: string,
): Promise<ApiError> => {
  let message = fallback;
  let issues: ApiIssue[] = [];
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      if ("detail" in body && typeof body.detail === "string")
        message = body.detail;
      if ("errors" in body && Array.isArray(body.errors))
        issues = body.errors.filter(isIssue);
    }
  } catch {
    // Keep a readable fallback for non-JSON responses.
  }
  return Object.assign(new Error(message), {
    name: "ApiError",
    status: response.status,
    issues,
  });
};

export const fieldMessages = (issues: ApiIssue[], field: string): string[] =>
  issues.filter((issue) => issue.field === field).map((issue) => issue.message);

export const formMessages = (
  issues: ApiIssue[],
  fallback: string | null,
): string[] => {
  const messages = issues
    .filter(
      (issue) =>
        issue.field === null ||
        !["name", "definition", "diagram"].includes(issue.field),
    )
    .map((issue) => issue.message);
  return issues.length === 0 && fallback ? [fallback] : messages;
};
