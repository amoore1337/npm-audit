import { useLoaderData, useNavigation } from "@remix-run/react";
import {
  json,
  type ActionArgs,
  type LoaderArgs,
} from "@remix-run/server-runtime";
import axios from "axios";
import { PackageEntryForm, packageEntryFormAction } from "~/components/audit";
import {
  exportCsvFormAction,
  ResultTable,
} from "~/components/audit/resultTable";
import { prisma } from "~/db.server";
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
    const sessionData = result.records.map((e) => ({
      packageId: e.package?.id,
      version: e.instance.version,
      isDev: e.instance.isDev,
    }));
    session.set("auditReport", sessionData);
    const cookie = await sessionStorage.commitSession(session);

    return json(result, { headers: { "Set-Cookie": cookie } });
  } else if (_action === exportCsvFormAction) {
    // TODO wire up
  }

  return null;
}

export async function loader({ request }: LoaderArgs) {
  const session = await getSession(request);
  const report = session.get("auditReport");
  if (!report) {
    return null;
  }

  const packageIds = report
    .map((rec) => rec.packageId)
    .filter((id) => !!id) as string[];
  const packages = await prisma.package.findMany({
    where: { id: { in: packageIds } },
  });

  const result: AuditResult = {
    records: packages
      .map((pkg) => {
        const reportEntry = report.find((a) => a.packageId === pkg.id);
        return {
          packageName: pkg.name,
          package: pkg,
          instance: {
            isDev: reportEntry?.isDev ?? false,
            outdated: reportEntry?.version
              ? compareSemver(reportEntry.version, pkg.latestVersion)
              : "ok",
            version: reportEntry?.version ?? "Unknown",
            targetVersion: pkg.latestVersion,
          },
        };
      })
      .sort((a, b) => {
        if (!a.instance.isDev && b.instance.isDev) {
          return -1;
        } else if (a.instance.isDev && !b.instance.isDev) {
          return 1;
        } else {
          return a.packageName < b.packageName ? -1 : 1;
        }
      }) as AuditEntry[],
    projectName: "Your report",
  };

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
      promises.push(
        (async () => {
          const populated = await getNpmData(k, deps[k], isDev);
          if (populated) {
            result.push(populated);
          }
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

async function getNpmData(
  depName: string,
  depVersion: string,
  isDev: boolean
): Promise<AuditEntry | null> {
  const dbPkg = await findPackageByName(depName);
  const oneDayAgo = new Date();
  oneDayAgo.setDate(new Date().getDate() - 1);

  const depInstance: AuditEntry["instance"] = {
    isDev,
    outdated: "ok",
    version: depVersion,
    targetVersion: depVersion,
  };

  if (dbPkg && dbPkg.updatedAt > oneDayAgo) {
    return {
      packageName: depName,
      package: dbPkg,
      instance: {
        ...depInstance,
        outdated: compareSemver(depVersion, dbPkg.latestVersion),
        targetVersion: dbPkg.latestVersion,
      },
    };
  } else {
    try {
      const { data } = await axios.get(
        `https://registry.npmjs.org/${depName}`,
        {
          headers: { Accept: "application/vnd.npm.install-v1+json" }, // Abbreviated metadata. Some packages data is > 70MB!!!!!
        }
      );
      const latestVersion = data["dist-tags"].latest;
      // Versions can be an extremely long list. Only grab a chunck of the most recent:
      const versions = Object.keys(data.versions).reverse().slice(0, 30);
      const npmPage = `https://www.npmjs.com/package/${depName}`;
      const result = await updateOrCreatePackage({
        name: depName,
        latestVersion,
        versions: versions.join(","),
        npmPage,
      });

      return {
        packageName: depName,
        package: result,
        instance: {
          ...depInstance,
          outdated: compareSemver(depVersion, result.latestVersion),
          targetVersion: result.latestVersion,
        },
      };
    } catch (error) {
      console.error(error);
    }
  }

  return {
    packageName: depName,
    package: null,
    instance: depInstance,
  };
}

export default function Audit() {
  const result = useLoaderData<typeof loader>();
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
