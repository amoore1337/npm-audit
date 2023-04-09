import { DownloadIcon, ResetIcon } from "@radix-ui/react-icons";
import { Form, Link } from "@remix-run/react";
import clsx from "clsx";
import React from "react";
import { Button, Select, SelectItem, Toggle } from "~/components/base";
import { type AuditEntry, type AuditResult } from "~/types";
import { npmInstallCmd } from "~/utils";
import { TableRow } from "./TableRow";
import { UpgradeCommand } from "./UpgradeCommand";

type TypeFilter = "all" | "dep" | "dev";
type OutdatedFilter = "major" | "minor" | "patch" | "outdated" | "all";

export const resetReport = "resetReport";
export const exportCsvFormAction = "export";

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
          (r) => !hiddenRecords[r.packageName]
        );
      }

      if (typeFilter === "dep") {
        filterVals.records = filterVals.records.filter(
          (r) => !r.instance.isDev
        );
      } else if (typeFilter === "dev") {
        filterVals.records = filterVals.records.filter((r) => r.instance.isDev);
      }

      if (outdatedFilter === "major") {
        filterVals.records = filterVals.records.filter(
          (r) => r.instance.outdated === "major"
        );
      } else if (outdatedFilter === "minor") {
        filterVals.records = filterVals.records.filter(
          (r) => r.instance.outdated === "minor"
        );
      } else if (outdatedFilter === "patch") {
        filterVals.records = filterVals.records.filter(
          (r) => r.instance.outdated === "patch"
        );
      } else if (outdatedFilter === "outdated") {
        filterVals.records = filterVals.records.filter(
          (r) => r.instance.outdated !== "ok"
        );
      }

      return filterVals;
    },
    [typeFilter, outdatedFilter, showHidden, hiddenRecords]
  );

  const [{ records: visibleRecords }, setRecords] = React.useState<AuditResult>(
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

  const visibleRecordsMap = React.useMemo(() => {
    const all: Record<string, AuditEntry> = {};
    for (const r of visibleRecords) {
      all[r.packageName] = r;
    }
    return all;
  }, [visibleRecords]);

  const outdatedRecordCount = React.useMemo(
    () => visibleRecords.filter((r) => r.instance.outdated !== "ok").length,
    [visibleRecords]
  );
  const outdatedPercent = outdatedRecordCount / visibleRecords.length;

  const installCmd = React.useMemo(() => {
    const selectedEntries = Object.keys(selectedRecords)
      .map((r) => visibleRecordsMap[r])
      .filter((r) => !!r);
    if (selectedEntries.length) {
      return npmInstallCmd(selectedEntries);
    } else {
      return "";
    }
  }, [selectedRecords, visibleRecordsMap]);

  const handleToggleSelect = (entry: AuditEntry) => {
    setSelectAll(false);
    if (selectedRecords[entry.packageName]) {
      setSelectedRecords((s) => {
        delete s[entry.packageName];
        return { ...s };
      });
    } else {
      setSelectedRecords((s) => {
        return { ...s, [entry.packageName]: true };
      });
    }
  };

  const handleToggleHidden = (entry: AuditEntry) => {
    if (hiddenRecords[entry.packageName]) {
      setHiddenRecords((h) => {
        delete h[entry.packageName];
        return { ...h };
      });
    } else {
      // Remove selected records when hiding
      if (selectedRecords[entry.packageName]) {
        setSelectedRecords((s) => {
          delete s[entry.packageName];
          return { ...s };
        });
      }
      setHiddenRecords((h) => {
        h[entry.packageName] = true;
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
      visibleRecords.forEach((r) => (all[r.packageName] = true));
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
    const record = visibleRecordsMap[entry.packageName];
    if (!record) {
      return;
    }
    record.instance.targetVersion = targetVersion;
    setRecords((result) => {
      const existingIndex = result.records.findIndex(
        (r) => r.packageName === record.packageName
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
          <Form method="post">
            <Button
              name="_action"
              value={resetReport}
              type="submit"
              variant="secondary"
              className="ml-4 flex items-center"
            >
              Clear Report <ResetIcon className="ml-2" />
            </Button>
          </Form>
          <Link
            to="/auditExport"
            reloadDocument
            className={clsx(
              "ml-4 flex items-center rounded border border-solid border-sky-600",
              "bg-sky-100 px-3 py-1 text-sky-600 hover:bg-sky-200"
            )}
          >
            Export to CSV <DownloadIcon className="ml-2" />
          </Link>
          <div className="ml-4 font-bold">
            Showing{" "}
            <span className="text-sky-600">{visibleRecords.length}</span> /{" "}
            {result.records.length} packages
            {outdatedFilter === "all" && (
              <span className="ml-1">
                (
                <span
                  className={clsx({
                    "text-green-500": outdatedPercent === 0,
                    "text-sky-600":
                      outdatedPercent > 0 && outdatedPercent <= 0.2,
                    "text-orange-500":
                      outdatedPercent > 0.2 && outdatedPercent <= 0.4,
                    "text-red-600": outdatedPercent > 0.4,
                  })}
                >
                  {outdatedRecordCount} outdated
                </span>
                )
              </span>
            )}
          </div>
          {!!Object.keys(hiddenRecords).length && (
            <Toggle
              className="ml-4 flex items-center"
              pressed={showHidden}
              onPressedChange={(pressed) => setShowHidden(pressed)}
            >
              {showHidden ? "Remove Hidden" : "Display Hidden"}
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
            {visibleRecords.map((p, i) => (
              <TableRow
                key={`${p.packageName}_${i}`}
                selectedRecords={selectedRecords}
                onSelect={handleToggleSelect}
                hiddenRecords={hiddenRecords}
                onHide={handleToggleHidden}
                onTargetVersionChange={handleUpdateTargetVersion}
                entry={p}
                isDev={p.instance.isDev}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
