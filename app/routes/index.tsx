import { Link } from "@remix-run/react";
import clsx from "clsx";
import type { ReactNode } from "react";

export default function Index() {
  return (
    <main className="relative flex min-h-screen flex-col items-center bg-white p-10 text-gray-800">
      <h1 className="pb-4 text-2xl font-semibold">Audit NPM Dependencies</h1>

      <p className="w-full max-w-[800px] pb-4">
        Yep, the npm cli already has commands for <Code>npm outdated</Code> and{" "}
        <Code>npm audit</Code>. So why bother?
      </p>

      <p className="w-full max-w-[800px] pb-4">
        Well, <Code>npm audit</Code> is{" "}
        <a
          className="text-sky-600 underline"
          href="https://overreacted.io/npm-audit-broken-by-design/"
          target="_blank"
          rel="noreferrer"
        >
          debatably useless
        </a>
        .<Code>npm outdated</Code> is a useful tool (when it works) but I found
        myself repeating the same steps every time I update dependencies:
      </p>

      <ol className="w-full max-w-[800px] list-decimal pb-4 pl-10">
        <li>Run npm outdated to see what needs to be upgraded.</li>
        <li>
          Pick a package and search for its changelog to see what breaking
          changes I need to be aware of.
        </li>
        <li>
          Run <Code>npm install {"<PACKAGE_NAME>@<SOME_VERSION>"}</Code>.
          Usually including several interrelated dependencies in one go.
        </li>
        <li>Rinse. Repeat. Many, many times.</li>
      </ol>

      <p className="w-full max-w-[800px] pb-4">
        This is a simple utility to assit this repetitious proceedure. Just
        paste in any package.json file to generate a filterable report of all of
        your project's dependencies. No identifying information is stored about
        your JSON file. In fact, if you're feeling paranoid, simply provide a
        valid JSON object with fields for "dependencies" and/or
        "devDependencies". That's all that's needed.
      </p>

      <p className="w-full max-w-[800px] pb-4">
        The generated report highlights packages needing to be updated, provides
        quick links to the package's npm page, and builds update commands based
        on your selected packages.
      </p>

      <p className="font-bold">Sound useful for your workflow? </p>
      <Link
        className={clsx(
          "mt-4 rounded border border-solid",
          "border-green-500 bg-green-500 px-3 py-1 text-white",
          "hover:border-green-600 hover:bg-green-600"
        )}
        to="/audit"
      >
        Give it a try!
      </Link>
    </main>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-green-50 px-2 py-1 font-mono text-green-600">
      {children}
    </span>
  );
}
