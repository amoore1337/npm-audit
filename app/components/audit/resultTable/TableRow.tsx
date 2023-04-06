import clsx from "clsx";
import CopyToClipboard from "react-copy-to-clipboard";
import { Button, Select, SelectItem } from "~/components/base";
import { type AuditEntry } from "~/utils";

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
