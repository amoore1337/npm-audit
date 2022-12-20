import { Form, useActionData, useTransition } from "@remix-run/react";
import type { ActionArgs } from "@remix-run/server-runtime";
import axios from "axios";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "~/components/Button";
import { TextArea } from "~/components/TextArea";
import {
  findPackageByName,
  updateOrCreatePackage,
} from "~/models/package.server";
import type { AuditEntry } from "~/utils";
import { compareSemver, npmInstallCmd } from "~/utils";
import { CopyIcon, EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { Select, SelectItem } from "~/components/Select";
import { Toggle } from "~/components/Toggle";

interface AuditResult {
  projectName: string;
  records: AuditEntry[];
}

export async function action({ request }: ActionArgs) {
  const body = await request.formData();
  const packageJson =
    JSON.parse(Object.fromEntries(body).packagejson as string) ?? {};

  const result: AuditResult = {
    records: [],
    projectName: packageJson.name ?? "Your report",
  };

  const { dependencies, devDependencies } = packageJson;
  result.records = [
    ...(await fetchPackageMetadata(dependencies ?? {}, false)),
    ...(await fetchPackageMetadata(devDependencies ?? {}, true)),
  ];

  return result;
}

async function fetchPackageMetadata(
  deps: Record<string, string>,
  isDev: boolean = false,
  batchSize: number = 10
) {
  const packages = Object.keys(deps);
  const result: AuditEntry[] = [];
  let batch = packages.slice(0, batchSize);
  let batchNum = 0;
  let promises: Promise<void>[] = [];

  while (batch.length) {
    // eslint-disable-next-line no-loop-func
    batch.forEach((k) => {
      const entry: AuditEntry = {
        name: k,
        version: deps[k],
        isDev,
        outdated: "ok",
      };
      promises.push(
        (async () => {
          const populated = await getNpmData(entry);
          result.push(populated);
        })()
      );
    });

    await Promise.all(promises);
    batchNum++;
    const offset = batchNum * batchSize;
    batch = packages.slice(offset, offset + batchSize);
    promises = [];
  }
  return result;
}

async function getNpmData(dep: AuditEntry): Promise<AuditEntry> {
  const entry = { ...dep };
  const dbResult = await findPackageByName(entry.name);
  const oneDayAgo = new Date();
  oneDayAgo.setDate(new Date().getDate() - 1);

  if (dbResult && dbResult.updatedAt > oneDayAgo) {
    entry.latestVersion = dbResult.latestVersion;
    entry.targetVersion = dbResult.latestVersion;
    entry.versions = dbResult.versions.split(",");
    entry.npmPage = dbResult.npmPage ?? undefined;
    entry.outdated = compareSemver(entry.version, entry.latestVersion);
  } else {
    try {
      const { data } = await axios.get(
        `https://registry.npmjs.org/${entry.name}`,
        {
          headers: { Accept: "application/vnd.npm.install-v1+json" }, // Abbreviated metadata. Some packages data is > 70MB!!!!!
        }
      );
      const latestVersion = data["dist-tags"].latest;
      // Versions can be an extremely long list. Only grab a chunck of the most recent:
      const versions = Object.keys(data.versions).reverse().slice(0, 30);
      const npmPage = `https://www.npmjs.com/package/${entry.name}`;
      await updateOrCreatePackage({
        name: entry.name,
        latestVersion,
        versions: versions.join(","),
        npmPage,
      });
      entry.latestVersion = latestVersion;
      entry.targetVersion = latestVersion;
      entry.versions = versions;
      entry.npmPage = npmPage;
    } catch (error) {
      console.error(error);
    }

    if (entry.latestVersion) {
      entry.outdated = compareSemver(entry.version, entry.latestVersion);
    }
  }
  return entry;
}

export default function Audit() {
  const result = useActionData<AuditResult>();
  const transition = useTransition();

  const loading = transition.state === "submitting";

  return (
    <main className="max-w-screen relative flex h-screen max-h-screen w-screen flex-col overflow-hidden p-6">
      <h1 className="pb-4 text-lg font-semibold text-gray-800">
        Audit npm Dependencies{" "}
        {result?.projectName && `- ${result.projectName}`}
      </h1>
      {result ? (
        <ResultTable result={result} />
      ) : (
        <PackageEntryForm loading={loading} />
      )}
    </main>
  );
}

function PackageEntryForm({ loading }: { loading: boolean }) {
  return (
    <Form method="post" className="relative flex w-full flex-grow flex-col">
      <TextArea
        placeholder="Enter your package.json content. Only 'dependencies' and/or 'devDependencies' are required."
        name="packagejson"
        className="flex-grow !border-green-500 bg-green-100 font-mono placeholder:italic placeholder:text-green-600"
      />
      <div className="item-center flex justify-end pt-4">
        <Button variant="primary">{loading ? "Loading..." : "Submit"}</Button>
      </div>
    </Form>
  );
}

type TypeFilter = "all" | "dep" | "dev";
type OutdatedFilter = "major" | "minor" | "patch" | "outdated" | "all";

function ResultTable({ result }: { result: AuditResult }) {
  const [selectedRecords, setSelectedRecords] = useState<Record<string, true>>(
    {}
  );
  const [selectAll, setSelectAll] = useState(false);
  const [hiddenRecords, setHiddenRecords] = useState<Record<string, true>>({});
  const [showHidden, setShowHidden] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [outdatedFilter, setOutdatedFilter] = useState<OutdatedFilter>("all");

  // Meh, not the best scaling. But the ceiling of records is pretty low.
  const filterResults = useCallback(
    (auditResult: AuditResult) => {
      const filterVals = { ...auditResult };

      if (!showHidden && Object.keys(hiddenRecords).length > 0) {
        filterVals.records = filterVals.records.filter(
          (r) => !hiddenRecords[r.name]
        );
      }

      if (typeFilter === "dep") {
        filterVals.records = filterVals.records.filter((r) => !r.isDev);
      } else if (typeFilter === "dev") {
        filterVals.records = filterVals.records.filter((r) => r.isDev);
      }

      if (outdatedFilter === "major") {
        filterVals.records = filterVals.records.filter(
          (r) => r.outdated === "major"
        );
      } else if (outdatedFilter === "minor") {
        filterVals.records = filterVals.records.filter(
          (r) => r.outdated === "minor"
        );
      } else if (outdatedFilter === "patch") {
        filterVals.records = filterVals.records.filter(
          (r) => r.outdated === "patch"
        );
      } else if (outdatedFilter === "outdated") {
        filterVals.records = filterVals.records.filter(
          (r) => r.outdated !== "ok"
        );
      }

      return filterVals;
    },
    [typeFilter, outdatedFilter, showHidden, hiddenRecords]
  );

  const [{ records }, setRecords] = useState<AuditResult>(
    filterResults(result)
  );

  useEffect(() => {
    if (showHidden && !Object.keys(hiddenRecords).length) {
      setShowHidden(false);
    }
  }, [hiddenRecords, showHidden]);

  useEffect(() => {
    setRecords(filterResults(result));
  }, [result, filterResults]);

  const activeRecords = useMemo(() => {
    const all: Record<string, AuditEntry> = {};
    for (const r of records) {
      all[r.name] = r;
    }
    return all;
  }, [records]);

  const installCmd = useMemo(() => {
    const selectedEntries = Object.keys(selectedRecords)
      .map((r) => activeRecords[r])
      .filter((r) => !!r);
    if (selectedEntries.length) {
      return npmInstallCmd(selectedEntries);
    } else {
      return "";
    }
  }, [selectedRecords, activeRecords]);

  const handleToggleSelect = (entry: AuditEntry) => {
    setSelectAll(false);
    if (selectedRecords[entry.name]) {
      setSelectedRecords((s) => {
        delete s[entry.name];
        return { ...s };
      });
    } else {
      setSelectedRecords((s) => {
        return { ...s, [entry.name]: true };
      });
    }
  };

  const handleToggleHidden = (entry: AuditEntry) => {
    if (hiddenRecords[entry.name]) {
      setHiddenRecords((h) => {
        delete h[entry.name];
        return { ...h };
      });
    } else {
      // Remove selected records when hiding
      if (selectedRecords[entry.name]) {
        setSelectedRecords((s) => {
          delete s[entry.name];
          return { ...s };
        });
      }
      setHiddenRecords((h) => {
        h[entry.name] = true;
        return { ...h };
      });
    }
    setSelectAll(false);
  };

  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedRecords({});
      setSelectAll(false);
    } else {
      const all: Record<string, true> = {};
      records.forEach((r) => (all[r.name] = true));
      setSelectedRecords(all);
      setSelectAll(true);
    }
  };

  const handleTypeFilter = (type: string) => {
    setTypeFilter(type as TypeFilter);
  };

  const handleOutdatedFilter = (type: string) => {
    setOutdatedFilter(type as OutdatedFilter);
  };

  const handleUpdateTargetVersion = (
    entry: AuditEntry,
    targetVersion: string
  ) => {
    const record = activeRecords[entry.name];
    if (!record) {
      return;
    }
    record.targetVersion = targetVersion;
    setRecords((result) => {
      const existingIndex = result.records.findIndex(
        (r) => r.name === record.name
      );
      if (existingIndex > -1) {
        result.records[existingIndex] = record;
      }
      return { ...result, records: [...result.records] };
    });
  };

  return (
    <>
      <div className="mb-4 flex h-[40px] flex-shrink-0 items-center justify-between">
        <div className="flex items-center">
          <Select
            value={typeFilter}
            onValueChange={handleTypeFilter}
            placeholder="Filter by type"
            className="mr-2"
          >
            <SelectItem value="all">All packages</SelectItem>
            <SelectItem value="dep">Dependencies</SelectItem>
            <SelectItem value="dev">Dev Dependencies</SelectItem>
          </Select>
          <Select
            value={outdatedFilter}
            onValueChange={handleOutdatedFilter}
            placeholder="Outdated by..."
          >
            <SelectItem value="all">All Versions</SelectItem>
            <SelectItem value="major">Major Version Updates</SelectItem>
            <SelectItem value="minor">Minor Version Updates</SelectItem>
            <SelectItem value="patch">Patch Version Updates</SelectItem>
            <SelectItem value="outdated">Only Outdated</SelectItem>
          </Select>
          <div className="ml-4 font-bold">
            Showing <span className="text-sky-600">{records.length}</span> /{" "}
            {result.records.length} packages
          </div>
          {!!Object.keys(hiddenRecords).length && (
            <Toggle
              className="ml-4 flex items-center"
              pressed={showHidden}
              onPressedChange={(pressed) => setShowHidden(pressed)}
            >
              {showHidden ? (
                <EyeClosedIcon className="mr-2 mt-[2px]" />
              ) : (
                <EyeOpenIcon className="mr-2 mt-[2px]" />
              )}{" "}
              Hidden
            </Toggle>
          )}
        </div>
        {!!installCmd && <UpgradeCommand command={installCmd} />}
      </div>
      <div className="relative flex-grow overflow-y-auto rounded border border-solid border-green-500">
        <table className="w-full">
          <thead className="sticky top-0 bg-green-500 text-white">
            <tr className="">
              <th className="w-[50px] px-4 py-2 text-left">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleToggleSelectAll}
                />
              </th>
              <th className="px-4 py-2 text-left">Package Name</th>
              <th className="px-4 py-2 text-left">Current Version</th>
              <th className="px-4 py-2 text-left">Latest Version</th>
              <th className="px-4 py-2 text-left">Target Version</th>
              <th className="px-4 py-2 text-left">npm Page</th>
              <th className="w-[140px] px-4 py-2 text-left">Show / Hide</th>
            </tr>
          </thead>
          <tbody>
            {records.map((p, i) => (
              <Row
                key={`${p.name}_${i}`}
                selectedRecords={selectedRecords}
                onSelect={handleToggleSelect}
                hiddenRecords={hiddenRecords}
                onHide={handleToggleHidden}
                onTargetVersionChange={handleUpdateTargetVersion}
                entry={p}
                isDev={p.isDev}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

interface RowProps {
  entry: AuditEntry;
  selectedRecords: Record<string, true>;
  onSelect: (entry: AuditEntry) => void;
  hiddenRecords: Record<string, true>;
  onHide: (entry: AuditEntry) => void;
  onTargetVersionChange: (entry: AuditEntry, targetVersion: string) => void;
  isDev?: boolean;
}

function Row({
  entry,
  selectedRecords,
  onSelect,
  hiddenRecords,
  onHide,
  onTargetVersionChange,
  isDev,
}: RowProps) {
  const selected: boolean = selectedRecords[entry.name] ?? false;
  const hidden: boolean = hiddenRecords[entry.name] ?? false;

  return (
    <tr
      className={clsx(
        "border-b border-solid border-green-500 last:border-b-0",
        { "bg-sky-100": selected, "odd:bg-green-100": !selected }
      )}
    >
      <td className="border-r border-solid border-green-500 px-4 py-2">
        <input
          type="checkbox"
          disabled={hidden}
          checked={selected}
          onChange={() => onSelect(entry)}
        />
      </td>
      <td className="border-r border-solid border-green-500 px-4 py-2">
        {entry.name} {isDev && <DevChip />}
      </td>
      <td
        className={clsx("border-r border-solid border-green-500 px-4 py-2", {
          "font-semibold text-red-600": entry.outdated === "major",
          "font-semibold text-orange-500": entry.outdated === "minor",
          "font-semibold text-sky-600": entry.outdated === "patch",
          "font-semibold text-green-500": entry.outdated === "ok",
        })}
      >
        {entry.version}
      </td>
      <td className="border-r border-solid border-green-500 px-4 py-2">
        {entry.latestVersion ?? "Not Found"}
      </td>
      <td className="border-r border-solid border-green-500 px-4 py-2">
        {entry.versions?.length && entry.latestVersion ? (
          <VersionSelect
            versions={entry.versions}
            targetVersion={entry.targetVersion ?? entry.latestVersion}
            onVersionChange={(version) => onTargetVersionChange(entry, version)}
          />
        ) : (
          "Not Found"
        )}
      </td>
      <td className="border-r border-solid border-green-500 px-4 py-2">
        {entry.npmPage ? (
          <a
            target="_blank"
            rel="noreferrer"
            href={entry.npmPage}
            className="text-sky-600 underline"
          >
            npm
          </a>
        ) : (
          "Not Found"
        )}
      </td>
      <td className="px-4 py-2">
        <div className="w-[35px]">
          <Button
            variant="secondary"
            className="text-sm"
            onClick={() => onHide(entry)}
          >
            {hidden ? "show" : "hide"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function DevChip() {
  return (
    <span
      className="ml-1 inline-block rounded-xl border border-solid border-sky-600 bg-sky-100 px-2 py-1 font-semibold italic text-sky-600"
      style={{ fontSize: 10 }}
    >
      DEV
    </span>
  );
}

interface SelectVersionProps {
  versions: string[];
  targetVersion: string;
  onVersionChange: (version: string) => void;
}

function VersionSelect({
  versions,
  targetVersion,
  onVersionChange,
}: SelectVersionProps) {
  return (
    <Select
      value={targetVersion}
      onValueChange={onVersionChange}
      placeholder="Target Version"
    >
      {versions.map((version) => (
        <SelectItem key={version} value={version}>
          {version}
        </SelectItem>
      ))}
    </Select>
  );
}

function UpgradeCommand({ command }: { command: string }) {
  return (
    <div className="flex items-center rounded-full bg-slate-800 px-4 py-1">
      <span className="font-mono text-lg font-bold text-lime-500">{">"}</span>
      <span className="font-sm max-w-[600px] overflow-x-auto whitespace-nowrap pl-1 text-white">
        {command}
      </span>
      <CopyToClipboard text={command}>
        <button className="ml-2 rounded-full p-1 text-white hover:bg-white hover:text-slate-800">
          <CopyIcon className="text-inherit" />
        </button>
      </CopyToClipboard>
    </div>
  );
}
