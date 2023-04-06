import { EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import React from "react";
import { Select, SelectItem, Toggle } from "~/components/base";
import { npmInstallCmd, type AuditEntry, type AuditResult } from "~/utils";
import { TableRow } from "./TableRow";
import { UpgradeCommand } from "./UpgradeCommand";

type TypeFilter = "all" | "dep" | "dev";
type OutdatedFilter = "major" | "minor" | "patch" | "outdated" | "all";

export function ResultTable({ result }: { result: AuditResult }) {
  const [selectedRecords, setSelectedRecords] = React.useState<
    Record<string, true>
  >({});
  const [selectAll, setSelectAll] = React.useState(false);
  const [hiddenRecords, setHiddenRecords] = React.useState<
    Record<string, true>
  >({});
  const [showHidden, setShowHidden] = React.useState(false);
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [outdatedFilter, setOutdatedFilter] =
    React.useState<OutdatedFilter>("all");

  // Meh, not the best scaling. But the ceiling of records may be low enough.
  const filterResults = React.useCallback(
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

  const [{ records }, setRecords] = React.useState<AuditResult>(
    filterResults(result)
  );

  React.useEffect(() => {
    if (showHidden && !Object.keys(hiddenRecords).length) {
      setShowHidden(false);
    }
  }, [hiddenRecords, showHidden]);

  React.useEffect(() => {
    setRecords(filterResults(result));
  }, [result, filterResults]);

  const activeRecords = React.useMemo(() => {
    const all: Record<string, AuditEntry> = {};
    for (const r of records) {
      all[r.name] = r;
    }
    return all;
  }, [records]);

  const installCmd = React.useMemo(() => {
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
              <TableRow
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