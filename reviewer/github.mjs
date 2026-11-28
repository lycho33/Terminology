import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const repository = "lycho33/Terminology";
const run = promisify(execFile);
const endpoint = "repos/" + repository;
const listFields = ({ number, title, draft, html_url, head, base }) => ({
  number, title, draft, url: html_url, head: head.sha, base: base.sha,
});

export async function githubCommand(args, { input, cwd, timeout = 45_000 } = {}) {
  const options = { cwd, timeout, maxBuffer: 24 * 1024 * 1024 };
  if (input === undefined) {
    const result = await run("gh", args, options);
    return result.stdout;
  }
  return new Promise((resolve, reject) => {
    const child = execFile("gh", args, options, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
    child.stdin.on("error", reject);
    child.stdin.end(input);
  });
}

export function createGitHub(command = githubCommand) {
  const json = async (args) => JSON.parse(await command(["api", ...args]));
  const pages = async (url) => (await json([url, "--paginate", "--slurp"])).flat();
  const read = (number) => json([endpoint + "/pulls/" + number]);

  return {
    async list() {
      const pulls = await pages(endpoint + "/pulls?state=open&per_page=100");
      return pulls.filter((pull) => pull.state === "open").map(listFields);
    },

    async details(number) {
      const pull = await read(number);
      if (pull.state !== "open") throw new Error("This pull request is closed.");
      const query = [
        "query($number: Int!) { repository(owner: \"lycho33\", name: \"Terminology\") {",
        "pullRequest(number: $number) { closingIssuesReferences(first: 10) {",
        "nodes { title body url } } } } }",
      ].join(" ");
      let issueLookupFailed = false;
      const [files, issues] = await Promise.all([
        pages(endpoint + "/pulls/" + number + "/files?per_page=100"),
        json(["graphql", "-f", "query=" + query, "-F", "number=" + number])
          .then((result) => result.data.repository.pullRequest.closingIssuesReferences.nodes)
          .catch(() => {
            issueLookupFailed = true;
            return [];
          }),
      ]);
      const explicitIssueNumbers = [...new Set(
        Array.from((pull.body ?? "").matchAll(/https:\/\/github\.com\/lycho33\/Terminology\/issues\/(\d+)\b/gi),
          (match) => match[1]),
      )];
      const knownIssueUrls = new Set(issues.map((issue) => issue.url));
      const explicitIssues = await Promise.all(explicitIssueNumbers
        .filter((id) => !knownIssueUrls.has("https://github.com/" + repository + "/issues/" + id))
        .map((id) => json([endpoint + "/issues/" + id]).catch(() => {
          issueLookupFailed = true;
          return null;
        })));
      for (const issue of explicitIssues) {
        if (issue && !issue.pull_request) issues.push({ title: issue.title, body: issue.body, url: issue.html_url });
      }
      const latest = await read(number);
      if (latest.state !== "open" || latest.head.sha !== pull.head.sha || latest.base.sha !== pull.base.sha) {
        throw new Error("The pull request changed while the review was loading. Open it again.");
      }
      return {
        ...listFields(pull),
        intent: issues.length
          ? { sources: issues, kind: "Linked GitHub issue" }
          : {
              sources: [{ title: pull.title, body: pull.body || "", url: pull.html_url }],
              kind: issueLookupFailed ? "PR description · issue lookup unavailable" : "PR description",
            },
        files,
        fileListIncomplete: files.length < pull.changed_files,
      };
    },

    async source(head, path) {
      const file = path.split("/").map(encodeURIComponent).join("/");
      const contents = await json([endpoint + "/contents/" + file, "-f", "ref=" + head, "--method", "GET"]);
      if (contents.type !== "file" || contents.encoding !== "base64") {
        throw new Error("GitHub did not return a text file for this revision.");
      }
      return Buffer.from(contents.content, "base64").toString("utf8");
    },

    async send(number, { head, base, body }) {
      const pull = await read(number);
      if (pull.state !== "open" || pull.head.sha !== head || pull.base.sha !== base) {
        const error = new Error("The pull request changed. Open the current revision before sharing notes.");
        error.statusCode = 409;
        throw error;
      }
      const path = endpoint + "/pulls/" + number + "/reviews";
      const result = await command(["api", path, "--method", "POST", "--input", "-"], {
        input: JSON.stringify({ body, commit_id: head, event: "COMMENT" }),
      });
      const review = JSON.parse(result);
      return { id: review.id, url: review.html_url };
    },
  };
}
