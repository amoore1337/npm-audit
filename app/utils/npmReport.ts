import axios from "axios";
import { prisma } from "~/db.server";
import {
  findPackageByName,
  updateOrCreatePackage,
} from "~/models/package.server";
import { getSession } from "~/session.server";
import { type AuditEntry, type AuditResult } from "~/types";
import { compareSemver } from "./npm";

export async function fetchPackageMetadata(
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

export async function loadReportFromSession(
  request: Request
): Promise<AuditResult | null> {
  const session = await getSession(request);
  const report = session.get("auditReport");
  if (!report) {
    return null;
  }

  const packageIds = report.records
    .map((rec) => rec.packageId)
    .filter((id) => !!id) as string[];
  const packages = await prisma.package.findMany({
    where: { id: { in: packageIds } },
  });

  const result: AuditResult = {
    records: packages
      .map((pkg) => {
        const reportEntry = report.records.find((a) => a.packageId === pkg.id);
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
    projectName: report.name,
  };

  return result;
}
