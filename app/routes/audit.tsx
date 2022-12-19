import { Form, useActionData, useTransition } from "@remix-run/react";
import type { ActionArgs } from "@remix-run/server-runtime";
import axios from "axios";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { Button } from "~/components/Button";
import { TextArea } from "~/components/TextArea";
import { findPackageByName, updateOrCreatePackage } from "~/models/package.server";
import type { AuditEntry} from "~/utils";
import { cleanRepoUrl} from "~/utils";
import { compareSemver, npmInstallCmd } from "~/utils";
import { CopyIcon } from '@radix-ui/react-icons';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import { Select, SelectItem } from "~/components/Select";

interface AuditResult {
  projectName: string
  dep: AuditEntry[]
  dev: AuditEntry[]
}

export async function action({ request }: ActionArgs) {
  const body = await request.formData();
  const packageJson = JSON.parse(Object.fromEntries(body).packagejson as string) ?? {};
  
  const result: AuditResult = { dep: [], dev: [], projectName: packageJson.name ?? 'Your report' };

  const { dependencies, devDependencies } = packageJson;
  result.dep = await fetchPackageMetadata(dependencies ?? {});
  result.dev = await fetchPackageMetadata(devDependencies ?? {}, true);

  return result;
}

async function fetchPackageMetadata(deps: Record<string, string>, isDev: boolean = false, batchSize: number = 5) {
  const packages = Object.keys(deps);
  const result: AuditEntry[] = [];
  let batch = packages.slice(0, batchSize);
  let batchNum = 0;
  let promises: Promise<void>[] = [];

  while(batch.length) {
    // eslint-disable-next-line no-loop-func
    batch.forEach((k) => {
      const d: AuditEntry = { name: k, version: deps[k], isDev, outdated: 'ok' };
      result.push(d);
      promises.push(attachNpmData(d));
    });
  
    await Promise.all(promises);
    batchNum++;
    const offset = batchNum * batchSize;
    batch = packages.slice(offset, offset + batchSize);
    promises = [];
  }
  return result;
}

async function attachNpmData(mutatedDep: AuditEntry) {
  const dbResult = await findPackageByName(mutatedDep.name);
  const oneDayAgo = new Date();
  oneDayAgo.setDate(new Date().getDate() - 1);

  if (dbResult && dbResult.updatedAt > oneDayAgo) {
    mutatedDep.latestVersion = dbResult.latestVersion;
    mutatedDep.homepage = dbResult.homepage ?? undefined;
    mutatedDep.repo = dbResult.repo ?? undefined;
    mutatedDep.outdated = compareSemver(mutatedDep.version, mutatedDep.latestVersion);
  } else {
    try {
      const { data } = await axios.get(`https://registry.npmjs.org/${mutatedDep.name}`)
      const latestVersion = data['dist-tags'].latest;
      await updateOrCreatePackage({ 
        name: mutatedDep.name,
        latestVersion, 
        versions: Object.keys(data.versions).join(','),
        homepage: data.homepage,
        repo: data.repository?.url,
      });
      mutatedDep.latestVersion = latestVersion;
      mutatedDep.homepage = data.homepage;
      mutatedDep.repo = data.repository?.url;
    } catch (error) {
      console.error(error)
    }
  
    if (mutatedDep.latestVersion) {
      mutatedDep.outdated = compareSemver(mutatedDep.version, mutatedDep.latestVersion);
    }
  }
}

export default function Audit() {
  const result = useActionData<AuditResult>();
  const transition = useTransition();

  const loading = transition.state === 'submitting';

  return (
    <main className="relative h-screen w-screen p-6 flex flex-col max-h-screen max-w-screen overflow-hidden">
      <h1 className="text-lg font-semibold text-gray-800 pb-4">Audit NPM Dependencies {result?.projectName && `- ${result.projectName}`}</h1>
      { result ? <ResultTable result={result} /> : <PackageEntryForm loading={loading} /> }
    </main>
  );
}

function PackageEntryForm({ loading }: { loading: boolean }) {
  return (
    <Form method="post" className="flex-grow w-full relative flex flex-col">
      <TextArea name="packagejson" className="flex-grow font-mono bg-green-100 !border-green-500" />
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
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [outdatedFilter, setOutdatedFilter] = useState<OutdatedFilter>('all');

  const { dep, dev } = useMemo(() => {
    const filterVals = { ...result }
   
    if (typeFilter === 'dep') {
      filterVals.dev = [];
    } else if (typeFilter === 'dev') {
      filterVals.dep = [];
    }

    if (outdatedFilter === 'major') {
      filterVals.dep = filterVals.dep.filter(p => p.outdated === 'major');
      filterVals.dev = filterVals.dev.filter(p => p.outdated === 'major');
    } else if (outdatedFilter === 'minor') {
      filterVals.dep = filterVals.dep.filter(p => p.outdated === 'minor');
      filterVals.dev = filterVals.dev.filter(p => p.outdated === 'minor');
    } else if (outdatedFilter === 'patch') {
      filterVals.dep = filterVals.dep.filter(p => p.outdated === 'patch');
      filterVals.dev = filterVals.dev.filter(p => p.outdated === 'patch');
    } else if (outdatedFilter === 'outdated') {
      filterVals.dep = filterVals.dep.filter(p => p.outdated !== 'ok');
      filterVals.dev = filterVals.dev.filter(p => p.outdated !== 'ok');
    }

    return filterVals;
  }, [result, typeFilter, outdatedFilter]);

  const allRecords = useMemo(() => {
    const records: Record<string, AuditEntry> = {};
    for (const r of [...dep, ...dev]) {
      records[r.name] = r;
    }
    return records;
  }, [dev, dep]);

  const handleSelect = (entry: AuditEntry) => {
    setSelectAll(false);
    if (selectedRecords[entry.name]) {
      setSelectedRecords((s) => {
        const remaining = {...s};
        delete remaining[entry.name]
        return remaining;
      })
    } else {
      setSelectedRecords((s) => {
        return { ...s, [entry.name]: entry };
      })
    }
  }

  const installCmd = useMemo(() => {
    const selectedEntries = Object.values(selectedRecords);
    if (selectedEntries.length) {
      return npmInstallCmd(selectedEntries);
    } else {
      return '';
    }
  }, [selectedRecords]);

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
          Showing <span className="text-sky-600">{dep.length + dev.length}</span> / {result.dep.length + result.dev.length} packages
        </div>
      </div>
      {!!installCmd && <UpgradeCommand command={installCmd} />}
    </div>
    <div className="border border-solid border-green-500 rounded flex-grow relative overflow-y-auto">
      <table className="w-full">
        <thead className="sticky bg-green-500 top-0 text-white">
          <tr className="">
            <th className="px-4 py-2 text-left"><input type="checkbox" checked={selectAll} onChange={handleSelectAll} /></th>
            <th className="px-4 py-2 text-left">Package Name</th>
            <th className="px-4 py-2 text-left">Current Version</th>
            <th className="px-4 py-2 text-left">Latest Version</th>
            <th className="px-4 py-2 text-left">Homepage</th>
            <th className="px-4 py-2 text-left">Repository</th>
          </tr>
        </thead>
        <tbody>
          {dep.map((p, i) => <Row key={`${p.name}_${i}`} selectedRecords={selectedRecords} onSelect={handleSelect} entry={p} />)}
          {dev.map((p, i) => <Row key={`${p.name}_${i}`} selectedRecords={selectedRecords} onSelect={handleSelect} entry={p} isDev />)}
        </tbody>
      </table>
    </div>
  </>
}

interface RowProps {
  entry: AuditEntry, 
  selectedRecords: Record<string, AuditEntry>, 
  onSelect: (entry: AuditEntry) => void, 
  isDev?: boolean
}

function Row({ entry, selectedRecords, onSelect, isDev }: RowProps) {
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
        {entry.homepage ? <a target="_blank" rel="noreferrer" href={entry.homepage} className="text-sky-600 underline">homepage</a> : 'Not Found'}
      </td>
      <td className="px-4 py-2">
        {entry.repo ? <a target="_blank" rel="noreferrer" href={cleanRepoUrl(entry.repo)} className="text-sky-600 underline">repo</a> : 'Not Found'}
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
