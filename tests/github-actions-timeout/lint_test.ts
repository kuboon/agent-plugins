// Tests for plugins/github-actions-timeout/skills/github-actions-timeout/scripts/lint.ts.
// They live outside plugins/ on purpose: `claude plugin install` ships the whole
// plugin directory and `apm install` ships the whole skill directory, so a test
// file anywhere under plugins/<name>/ would be distributed to every user.
import { assertEquals, assertThrows } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
  lintWorkflow,
  NotAWorkflowError,
} from "../../plugins/github-actions-timeout/skills/github-actions-timeout/scripts/lint.ts";

const LINT = fromFileUrl(
  new URL(
    "../../plugins/github-actions-timeout/skills/github-actions-timeout/scripts/lint.ts",
    import.meta.url,
  ),
);

const messages = (yaml: string) =>
  lintWorkflow(yaml).problems.map((p) => `${p.path}: ${p.message}`);

Deno.test("a job with a timeout passes", () => {
  assertEquals(
    messages(`
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - run: deno test
`),
    [],
  );
});

Deno.test("a runs-on job without a timeout is reported", () => {
  assertEquals(
    messages(`
jobs:
  test:
    runs-on: ubuntu-latest
    steps: [{ run: deno test }]
`),
    ["jobs.test: missing timeout-minutes (the default is 360)"],
  );
});

Deno.test("an empty timeout-minutes counts as missing", () => {
  assertEquals(
    messages(`
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes:
`),
    ["jobs.test: missing timeout-minutes (the default is 360)"],
  );
});

Deno.test("an expression is accepted, quoted or not", () => {
  for (const value of ["${{ inputs.timeout }}", "'${{ inputs.timeout }}'"]) {
    assertEquals(
      messages(`
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: ${value}
`),
      [],
      value,
    );
  }
});

Deno.test("values that are not positive whole minutes are reported", () => {
  const cases: [string, string][] = [
    ["0", "timeout-minutes must be a positive whole number of minutes, got 0"],
    ["-5", "timeout-minutes must be a positive whole number of minutes, got -5"],
    ["7.5", "timeout-minutes must be a positive whole number of minutes, got 7.5"],
    ["'10'", 'timeout-minutes is the string "10"; remove the quotes'],
    [
      "ten",
      'timeout-minutes must be a positive whole number or a ${{ }} expression, got "ten"',
    ],
    [
      "true",
      "timeout-minutes must be a positive whole number or a ${{ }} expression, got true",
    ],
  ];
  for (const [value, expected] of cases) {
    assertEquals(
      messages(`
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: ${value}
`),
      [`jobs.test: ${expected}`],
      value,
    );
  }
});

Deno.test("a job calling a reusable workflow must not set a timeout", () => {
  assertEquals(
    messages(`
jobs:
  pages:
    uses: owner/repo/.github/workflows/build.yml@v1
    timeout-minutes: 10
`),
    [
      "jobs.pages: timeout-minutes is not allowed on a job that calls a reusable workflow; set it on the jobs inside the called workflow",
    ],
  );
});

Deno.test("a job calling a reusable workflow needs no timeout", () => {
  assertEquals(
    messages(`
jobs:
  pages:
    uses: owner/repo/.github/workflows/build.yml@v1
`),
    [],
  );
});

Deno.test("a step timeout is checked, including the 360-minute cap", () => {
  assertEquals(
    messages(`
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - run: ./wait.sh
        timeout-minutes: 2
      - run: ./slow.sh
        timeout-minutes: 400
      - run: ./odd.sh
        timeout-minutes: 1.5
`),
    [
      "jobs.test.steps[1]: timeout-minutes cannot exceed 360 on a step, got 400",
      "jobs.test.steps[2]: timeout-minutes must be a positive whole number of minutes, got 1.5",
    ],
  );
});

Deno.test("a step timeout does not stand in for the job's", () => {
  assertEquals(
    messages(`
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: ./wait.sh
        timeout-minutes: 2
`),
    ["jobs.test: missing timeout-minutes (the default is 360)"],
  );
});

// The cases below are where a hand-written parser goes wrong; a real YAML
// parser gets them for free.

Deno.test("flow-style jobs are read like block-style ones", () => {
  assertEquals(
    messages(`jobs: { a: { runs-on: x, timeout-minutes: 5 }, b: { runs-on: x } }`),
    ["jobs.b: missing timeout-minutes (the default is 360)"],
  );
});

Deno.test("anchors and aliases are resolved", () => {
  assertEquals(
    messages(`
x-job: &job
  runs-on: ubuntu-latest
  timeout-minutes: 10
jobs:
  a: *job
  b:
    runs-on: ubuntu-latest
`),
    ["jobs.b: missing timeout-minutes (the default is 360)"],
  );
});

Deno.test("comments and a '#' inside a string are not confused", () => {
  assertEquals(
    messages(`
jobs:
  test: # the only job
    runs-on: ubuntu-latest   # timeout-minutes: 10  <- only a comment
    steps:
      - run: 'echo "# timeout-minutes: 10"'
`),
    ["jobs.test: missing timeout-minutes (the default is 360)"],
  );
});

Deno.test("an odd job id is quoted in the path", () => {
  assertEquals(messages(`jobs: { "build test": { runs-on: x } }`), [
    'jobs["build test"]: missing timeout-minutes (the default is 360)',
  ]);
});

Deno.test("YAML that is not a workflow is an error, not a pass", () => {
  for (const text of ["", "name: x", "jobs: [a, b]", "- a"]) {
    assertThrows(() => lintWorkflow(text), NotAWorkflowError, undefined, text);
  }
});

// End to end: run the script the way the skill tells an agent to.

async function run(args: string[], stdin?: string) {
  const child = new Deno.Command(Deno.execPath(), {
    args: ["run", "--no-lock", ...args],
    stdin: stdin === undefined ? "null" : "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  if (stdin !== undefined) {
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(stdin));
    await writer.close();
  }
  const { code, stdout, stderr } = await child.output();
  const decode = (b: Uint8Array) => new TextDecoder().decode(b).trim();
  return { code, stdout: decode(stdout), stderr: decode(stderr) };
}

Deno.test("CLI: stdin needs no permissions and exits 0 when clean", async () => {
  const r = await run(
    [LINT],
    "jobs:\n  a:\n    runs-on: x\n    timeout-minutes: 10\n",
  );
  assertEquals([r.code, r.stdout, r.stderr], [0, "ok: 1 job in 1 file", ""]);
});

Deno.test("CLI: problems exit 1", async () => {
  const r = await run([LINT], "jobs:\n  a:\n    runs-on: x\n");
  assertEquals(r.code, 1);
  assertEquals(r.stdout.split("\n"), [
    "<stdin>: jobs.a: missing timeout-minutes (the default is 360)",
    "1 problem in 1 file",
  ]);
});

Deno.test("CLI: unparsable or non-workflow input exits 2", async () => {
  for (const input of ["jobs: [\n", "name: x\n"]) {
    const r = await run([LINT], input);
    assertEquals(r.code, 2, input);
  }
});

Deno.test("CLI: files need --allow-read and are checked together", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(`${dir}/ok.yml`, "jobs: { a: { runs-on: x, timeout-minutes: 5 } }\n");
    await Deno.writeTextFile(`${dir}/bad.yml`, "jobs: { b: { runs-on: x } }\n");

    const denied = await run([LINT, `${dir}/ok.yml`]);
    assertEquals(denied.code, 2);

    const r = await run([`--allow-read=${dir}`, LINT, `${dir}/ok.yml`, `${dir}/bad.yml`]);
    assertEquals(r.code, 1);
    assertEquals(r.stdout.split("\n"), [
      `${dir}/bad.yml: jobs.b: missing timeout-minutes (the default is 360)`,
      "1 problem in 2 files",
    ]);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
