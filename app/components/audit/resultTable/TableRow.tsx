import { ExternalLinkIcon } from "@radix-ui/react-icons";
import clsx from "clsx";
import React from "react";
import { Button, Select, SelectItem } from "~/components/base";
import { type AuditEntry } from "~/types";

interface RowProps {
  entry: AuditEntry;
  selectedRecords: Record<string, true>;
  onSelect: (entry: AuditEntry) => void;
  hiddenRecords: Record<string, true>;
  onHide: (entry: AuditEntry) => void;
  onTargetVersionChange: (entry: AuditEntry, targetVersion: string) => void;
  isDev?: boolean;
}

export function TableRow({
  entry,
  selectedRecords,
  onSelect,
  hiddenRecords,
  onHide,
  onTargetVersionChange,
  isDev,
}: RowProps) {
  const selected: boolean = selectedRecords[entry.packageName] ?? false;
  const hidden: boolean = hiddenRecords[entry.packageName] ?? false;

  const availableVersions = React.useMemo(() => {
    const versions = entry.package?.versions.split(",") ?? [];
    const hasLatest = versions?.find((v) => v === entry.package?.latestVersion);
    if (hasLatest) {
      return versions;
    }
    return [
      entry.package?.latestVersion ?? entry.instance.version,
      ...(versions ?? []),
    ];
  }, [
    entry.package?.versions,
    entry.package?.latestVersion,
    entry.instance.version,
  ]);

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
        {entry.packageName} {isDev && <DevChip />}
      </td>
      <td
        className={clsx("border-r border-solid border-green-500 px-4 py-2", {
          "font-semibold text-red-600": entry.instance.outdated === "major",
          "font-semibold text-orange-500": entry.instance.outdated === "minor",
          "font-semibold text-sky-600": entry.instance.outdated === "patch",
          "font-semibold text-green-500": entry.instance.outdated === "ok",
        })}
      >
        {entry.instance.version}
      </td>
      <td className="border-r border-solid border-green-500 px-4 py-2">
        {entry.package?.latestVersion ?? "Not Found"}
      </td>
      <td className="border-r border-solid border-green-500 px-4 py-2">
        {availableVersions.length && entry.package?.latestVersion ? (
          <VersionSelect
            versions={availableVersions}
            targetVersion={
              entry.instance.targetVersion ?? entry.package.latestVersion
            }
            onVersionChange={(version) => onTargetVersionChange(entry, version)}
          />
        ) : (
          "Not Found"
        )}
      </td>
      <td className="border-r border-solid border-green-500 px-4 py-2">
        {entry.package?.npmPage ? (
          <a
            target="_blank"
            rel="noreferrer"
            href={entry.package.npmPage}
            className="flex items-end text-sky-600 underline hover:text-sky-700"
          >
            npm <ExternalLinkIcon className="ml-1" width={16} />
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
