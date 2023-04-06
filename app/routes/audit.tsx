import { useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  json,
  type ActionArgs,
  type LoaderArgs,
} from "@remix-run/server-runtime";
import axios from "axios";
import {
  exportCsvFormAction,
  PackageEntryForm,
  packageEntryFormAction,
  ResultTable,
} from "~/components/audit";
import {
  findPackageByName,
  updateOrCreatePackage,
} from "~/models/package.server";
import { getSession, sessionStorage } from "~/session.server";
import type { AuditEntry, AuditResult } from "~/utils";
import { compareSemver } from "~/utils";

export async function action({ request }: ActionArgs) {
  const body = await request.formData();
  const { _action, ...values } = Object.fromEntries(body);

  if (_action === packageEntryFormAction) {
    const packageJson = JSON.parse(values.packagejson as string) ?? {};

    const result: AuditResult = {
      records: [],
      projectName: packageJson.name ?? "Your report",
    };

    const { dependencies, devDependencies } = packageJson;
    result.records = [
      ...(await fetchPackageMetadata(dependencies ?? {}, false)),
      ...(await fetchPackageMetadata(devDependencies ?? {}, true)),
    ];
    const session = await getSession(request);
    session.set("auditReport", [{ packageId: "id", currentVersion: "1" }]);
    const cookie = await sessionStorage.commitSession(session);
    return json(result, { headers: { "Set-Cookie": cookie } });
  } else if (_action === exportCsvFormAction) {
    // TODO wire up
  }

  return null;
}

export async function loader({ request }: LoaderArgs) {
  const session = await getSession(request);
  const result = session.get("auditReport");

  return result ?? null;
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
  const data = useLoaderData<typeof loader>();

  console.log("GOT: ", data);
  const navigation = useNavigation();

  const loading = navigation.state === "submitting";

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
