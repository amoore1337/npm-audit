import { Form, useActionData, useTransition } from "@remix-run/react";
import type { ActionArgs } from "@remix-run/server-runtime";
import axios from "axios";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "~/components/Button";
import { TextArea } from "~/components/TextArea";
import { findPackageByName, updateOrCreatePackage } from "~/models/package.server";
import type { AuditEntry} from "~/utils";
import { compareSemver, npmInstallCmd } from "~/utils";
import { CopyIcon, EyeClosedIcon, EyeOpenIcon } from '@radix-ui/react-icons';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import { Select, SelectItem } from "~/components/Select";
import { Toggle } from "~/components/Toggle";

interface AuditResult {
  projectName: string
  records: AuditEntry[]
}

export async function action({ request }: ActionArgs) {
  const body = await request.formData();
  const packageJson = JSON.parse(Object.fromEntries(body).packagejson as string) ?? {};
  
  const result: AuditResult = { records: [], projectName: packageJson.name ?? 'Your report' };

  const { dependencies, devDependencies } = packageJson;
  result.records = [ 
    ...await fetchPackageMetadata(dependencies ?? {}, false),
    ...await fetchPackageMetadata(devDependencies ?? {}, true),
  ];

  return result;
}

async function fetchPackageMetadata(deps: Record<string, string>, isDev: boolean = false, batchSize: number = 10) {
  const packages = Object.keys(deps);
  const result: AuditEntry[] = [];
  let batch = packages.slice(0, batchSize);
  let batchNum = 0;
  let promises: Promise<void>[] = [];

  while(batch.length) {
    // eslint-disable-next-line no-loop-func
    batch.forEach((k) => {
      const entry: AuditEntry = { name: k, version: deps[k], isDev, outdated: 'ok' };
      promises.push((async () => {
        const populated = await getNpmData(entry)
        result.push(populated);
      })());
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
    entry.versions = dbResult.versions.split(',');
    entry.npmPage = dbResult.npmPage ?? undefined;
    entry.outdated = compareSemver(entry.version, entry.latestVersion);
  } else {
    try {
      const { data } = await axios.get(`https://registry.npmjs.org/${entry.name}`, {
        headers: { Accept: 'application/vnd.npm.install-v1+json' }, // Abbreviated metadata. Some packages data is > 70MB!!!!!
      })
      const latestVersion = data['dist-tags'].latest;
      // Versions can be an extremely long list. Only grab a chunck of the most recent:
      const versions = Object.keys(data.versions).reverse().slice(0, 30);
      const npmPage = `https://www.npmjs.com/package/${entry.name}`;
      await updateOrCreatePackage({ 
        name: entry.name,
        latestVersion, 
        versions: versions.join(','),
        npmPage,
      });
      entry.latestVersion = latestVersion;
      entry.targetVersion = latestVersion;
      entry.versions = versions;
      entry.npmPage = npmPage;
    } catch (error) {
      console.error(error)
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

  const loading = transition.state === 'submitting';

  return (
    <main className="relative h-screen w-screen p-6 flex flex-col max-h-screen max-w-screen overflow-hidden">
      <h1 className="text-lg font-semibold text-gray-800 pb-4">Audit npm Dependencies {result?.projectName && `- ${result.projectName}`}</h1>
      { result ? <ResultTable result={result} /> : <PackageEntryForm loading={loading} /> }
    </main>
  );
}

function PackageEntryForm({ loading }: { loading: boolean }) {
  return (
    <Form method="post" className="flex-grow w-full relative flex flex-col">
      <TextArea 
        placeholder="Enter your package.json content. Only 'dependencies' and/or 'devDependencies' are required." 
        name="packagejson" 
        className="flex-grow font-mono bg-green-100 !border-green-500 placeholder:italic placeholder:text-green-600" 
      />
      <div className="flex item-center justify-end pt-4">
        <Button variant="primary">{loading ? 'Loading...' : 'Submit'}</Button>
      </div>
    </Form>
  )
}

type TypeFilter = 'all' | 'dep' | 'dev';
type OutdatedFilter = 'major' | 'minor' | 'patch' | 'outdated' | 'all';

function ResultTable({ result }: { result: AuditResult }) {
  const [selectedRecords, setSelectedRecords] = useState<Record<string, AuditEntry>>({});
  const [selectAll, setSelectAll] = useState(false);
  const [hiddenRecords, setHiddenRecords] = useState<Record<string, true>>({});
  const [showHidden, setShowHidden] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [outdatedFilter, setOutdatedFilter] = useState<OutdatedFilter>('all');

  // Meh, not the best scaling. But the ceiling of records is pretty low.
  const filterResults = useCallback((auditResult: AuditResult) => {
    const filterVals = { ...auditResult }

    if (!showHidden && Object.keys(hiddenRecords).length > 0) {
      filterVals.records = filterVals.records.filter(r => !hiddenRecords[r.name]);
    }

    if (typeFilter === 'dep') {
      filterVals.records = filterVals.records.filter(r => !r.isDev);
    } else if (typeFilter === 'dev') {
      filterVals.records = filterVals.records.filter(r => r.isDev);
    }

    if (outdatedFilter === 'major') {
      filterVals.records = filterVals.records.filter(r => r.outdated === 'major');
    } else if (outdatedFilter === 'minor') {
      filterVals.records = filterVals.records.filter(r => r.outdated === 'minor');
    } else if (outdatedFilter === 'patch') {
      filterVals.records = filterVals.records.filter(r => r.outdated === 'patch');
    } else if (outdatedFilter === 'outdated') {
      filterVals.records = filterVals.records.filter(r => r.outdated !== 'ok');
    }

    return filterVals;
  }, [typeFilter, outdatedFilter, showHidden, hiddenRecords]);

  const [{ records }, setRecords] = useState<AuditResult>(filterResults(result));

  useEffect(() => {
    if (showHidden && !Object.keys(hiddenRecords).length) {
      setShowHidden(false);
    }
  }, [hiddenRecords, showHidden]);

  useEffect(() => {
    setRecords(filterResults(result));
  }, [result, filterResults])

  const allRecords = useMemo(() => {
    const all: Record<string, AuditEntry> = {};
    for (const r of records) {
      all[r.name] = r;
    }
    return all;
  }, [records]);

  const installCmd = useMemo(() => {
    const selectedEntries = Object.values(selectedRecords);
    if (selectedEntries.length) {
      return npmInstallCmd(selectedEntries);
    } else {
      return '';
    }
  }, [selectedRecords]);

  const handleSelect = (entry: AuditEntry) => {
    setSelectAll(false);
    if (selectedRecords[entry.name]) {
      setSelectedRecords((s) => {
        const remaining = {...s};
        delete remaining[entry.name]
        return remaining;
      });
    } else {
      setSelectedRecords((s) => {
        return { ...s, [entry.name]: entry };
      });
    }
  }

  const handleToggleHidden = (entry: AuditEntry) => {
    if (hiddenRecords[entry.name]) {
      setHiddenRecords(h => {
        delete h[entry.name];
        return { ...h };
      });
    } else {
      setHiddenRecords(h => {
        h[entry.name] = true;
        return { ...h };
      });
    }
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRecords({});
      setSelectAll(false);
    } else {
      setSelectedRecords(allRecords);
      setSelectAll(true);
    }
  }

  const handleTypeFilter = (type: string) => {
    setTypeFilter(type as TypeFilter);
  };
  
  const handleOutdatedFilter = (type: string) => {
    setOutdatedFilter(type as OutdatedFilter);
  };

  // Bleh...
  const handleUpdateTargetVersion = (entry: AuditEntry, targetVersion: string) => {
    const record = allRecords[entry.name];
    if (!record) { return; }
    record.targetVersion = targetVersion;
    setRecords(r => ({ ...r, [record.name]: record }));
  };

  return <>
    <div className="mb-4 flex items-center justify-between h-[40px] flex-shrink-0">
      <div className="flex items-center">
        <Select value={typeFilter} onValueChange={handleTypeFilter} placeholder="Filter by type" className="mr-2">
          <SelectItem value="all">All packages</SelectItem>
          <SelectItem value="dep">Dependencies</SelectItem>
          <SelectItem value="dev">Dev Dependencies</SelectItem>
        </Select>
        <Select value={outdatedFilter} onValueChange={handleOutdatedFilter} placeholder="Outdated by...">
          <SelectItem value="all">All Versions</SelectItem>
          <SelectItem value="major">Major Version Updates</SelectItem>
          <SelectItem value="minor">Minor Version Updates</SelectItem>
          <SelectItem value="patch">Patch Version Updates</SelectItem>
          <SelectItem value="outdated">Only Outdated</SelectItem>
        </Select>
        <div className="font-bold ml-4">
          Showing <span className="text-sky-600">{records.length}</span> / {result.records.length} packages
        </div>
        {!!Object.keys(hiddenRecords).length && (
          <Toggle className="ml-4 flex items-center" pressed={showHidden} onPressedChange={(pressed) => setShowHidden(pressed)}>
            {showHidden ? <EyeClosedIcon className="mr-2 mt-[2px]" /> : <EyeOpenIcon className="mr-2 mt-[2px]" />} Hidden
          </Toggle>
        )}
      </div>
      {!!installCmd && <UpgradeCommand command={installCmd} />}
    </div>
    <div className="border border-solid border-green-500 rounded flex-grow relative overflow-y-auto">
      <table className="w-full">
        <thead className="sticky bg-green-500 top-0 text-white">
          <tr className="">
            <th className="px-4 py-2 text-left w-[50px]"><input type="checkbox" checked={selectAll} onChange={handleSelectAll} /></th>
            <th className="px-4 py-2 text-left">Package Name</th>
            <th className="px-4 py-2 text-left">Current Version</th>
            <th className="px-4 py-2 text-left">Latest Version</th>
            <th className="px-4 py-2 text-left">Target Version</th>
            <th className="px-4 py-2 text-left">npm Page</th>
            <th className="px-4 py-2 text-left w-[140px]">Show / Hide</th>
          </tr>
        </thead>
        <tbody>
          {records.map((p, i) => (
            <Row 
              key={`${p.name}_${i}`} 
              selectedRecords={selectedRecords} 
              onSelect={handleSelect}
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
}

interface RowProps {
  entry: AuditEntry
  selectedRecords: Record<string, AuditEntry>
  onSelect: (entry: AuditEntry) => void
  hiddenRecords: Record<string, true>
  onHide: (entry: AuditEntry) => void
  onTargetVersionChange: (entry: AuditEntry, targetVersion: string) => void
  isDev?: boolean
}

function Row({ entry, selectedRecords, onSelect, hiddenRecords, onHide, onTargetVersionChange, isDev }: RowProps) {
  const selected = selectedRecords[entry.name] ? true : false;

  return (
    <tr className={clsx(
      'border-b border-solid border-green-500 last:border-b-0',
      { 'bg-sky-100': selected, 'odd:bg-green-100': !selected }
    )}>
      <td className="px-4 py-2 border-r border-solid border-green-500">
        <input type="checkbox" checked={selected} onChange={() => onSelect(entry)} />
      </td>
      <td className="px-4 py-2 border-r border-solid border-green-500">{entry.name} {isDev && <DevChip />}</td>
      <td 
        className={clsx('px-4 py-2 border-r border-solid border-green-500', { 
          'text-red-600 font-semibold': entry.outdated === 'major',
          'text-orange-500 font-semibold': entry.outdated === 'minor',
          'text-sky-600 font-semibold': entry.outdated === 'patch',
          'text-green-500 font-semibold': entry.outdated === 'ok',
        })}
      >
        {entry.version}
      </td>
      <td className="px-4 py-2 border-r border-solid border-green-500">{entry.latestVersion ?? 'Not Found'}</td>
      <td className="px-4 py-2 border-r border-solid border-green-500">
        {entry.versions?.length && entry.latestVersion ? (
          <VersionSelect
            versions={entry.versions} 
            targetVersion={entry.targetVersion ?? entry.latestVersion} 
            onVersionChange={(version) => onTargetVersionChange(entry, version)} 
          />
        ) : 'Not Found'}
      </td>
      <td className="px-4 py-2 border-r border-solid border-green-500">
        {entry.npmPage ? <a target="_blank" rel="noreferrer" href={entry.npmPage} className="text-sky-600 underline">npm</a> : 'Not Found'}
      </td>
      <td className="px-4 py-2">
        <div className="w-[35px]">
          <Button variant="secondary" className="text-sm" onClick={() => onHide(entry)}>
            {hiddenRecords[entry.name] ? 'show' : 'hide'}
          </Button>
        </div>
      </td>
    </tr>
  )
}

function DevChip() {
  return (
    <span 
      className="font-semibold text-sky-600 border border-solid border-sky-600 bg-sky-100 italic px-2 py-1 rounded-xl ml-1 inline-block"
      style={{ fontSize: 10 }}
    >
      DEV
    </span>
  )
}

interface SelectVersionProps { 
  versions: string[]
  targetVersion: string
  onVersionChange: (version: string) => void
}

function VersionSelect({ versions, targetVersion, onVersionChange }: SelectVersionProps) {
  return (
    <Select value={targetVersion} onValueChange={onVersionChange} placeholder="Target Version">
      {versions.map(version => (
        <SelectItem key={version} value={version}>{version}</SelectItem>
      ))}
    </Select>
  )
}

function UpgradeCommand({ command }: { command: string }) {
  return (
    <div className="bg-slate-800 rounded-full px-4 py-1 flex items-center">
      <span className="font-bold text-lime-500 font-mono text-lg">{'>'}</span>
      <span className="text-white pl-1 font-sm max-w-[600px] overflow-x-auto whitespace-nowrap">{command}</span>
      <CopyToClipboard text={command}>
        <button className="p-1 rounded-full hover:bg-white ml-2 text-white hover:text-slate-800"><CopyIcon className="text-inherit" /></button>
      </CopyToClipboard>
    </div>
  );
}
