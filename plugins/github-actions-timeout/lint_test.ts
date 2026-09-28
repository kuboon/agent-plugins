import { assertEquals } from "jsr:@std/assert@1.0.15";

import { collectWorkflowFiles, lintWorkflowText, main } from "./lint.ts";

Deno.test("accepts runs-on jobs with timeout-minutes", () => {
  const diagnostics = lintWorkflowText(
    `name: CI
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - run: deno test
`,
    "/repo/.github/workflows/ci.yml",
  );

  assertEquals(diagnostics, []);
});

Deno.test("reports runs-on jobs without timeout-minutes", () => {
  const diagnostics = lintWorkflowText(
    `jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: deno test
`,
    "/repo/.github/workflows/ci.yml",
  );

  assertEquals(diagnostics, [
    {
      filePath: "/repo/.github/workflows/ci.yml",
      jobName: "test",
      message: "runs-on job is missing timeout-minutes",
    },
  ]);
});

Deno.test("reports non-integer timeout-minutes values", () => {
  const diagnostics = lintWorkflowText(
    `jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: ten
    steps:
      - run: deno test
`,
    "/repo/.github/workflows/ci.yml",
  );

  assertEquals(diagnostics, [
    {
      filePath: "/repo/.github/workflows/ci.yml",
      jobName: "test",
      message: "timeout-minutes must be a positive integer",
    },
  ]);
});

Deno.test("reports timeout-minutes on reusable-workflow caller jobs", () => {
  const diagnostics = lintWorkflowText(
    `jobs:
  pages:
    uses: owner/repo/.github/workflows/build.yml@main
    timeout-minutes: 10
`,
    "/repo/.github/workflows/pages.yml",
  );

  assertEquals(diagnostics, [
    {
      filePath: "/repo/.github/workflows/pages.yml",
      jobName: "pages",
      message: "reusable-workflow caller jobs cannot define timeout-minutes",
    },
  ]);
});

Deno.test("collectWorkflowFiles defaults to .github/workflows", async () => {
  const root = await Deno.makeTempDir();
  await Deno.mkdir(`${root}/.github/workflows`, { recursive: true });
  await Deno.writeTextFile(`${root}/.github/workflows/ci.yml`, "jobs: {}\n");
  await Deno.writeTextFile(`${root}/.github/workflows/notes.txt`, "ignore\n");

  const previousCwd = Deno.cwd();
  Deno.chdir(root);

  try {
    const files = await collectWorkflowFiles([]);
    assertEquals(files, [".github/workflows/ci.yml"]);
  } finally {
    Deno.chdir(previousCwd);
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("main returns 1 when diagnostics are found", async () => {
  const root = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${root}/ci.yml`,
    `jobs:\n  test:\n    runs-on: ubuntu-latest\n`,
  );

  const stderr: string[] = [];
  const restore = console.error;
  console.error = (...args: unknown[]) => {
    stderr.push(args.join(" "));
  };

  try {
    const exitCode = await main([`${root}/ci.yml`]);
    assertEquals(exitCode, 1);
    assertEquals(stderr, [
      `${root}/ci.yml: jobs.test: runs-on job is missing timeout-minutes`,
    ]);
  } finally {
    console.error = restore;
    await Deno.remove(root, { recursive: true });
  }
});
