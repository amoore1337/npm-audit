import axios from "axios";
import {
  findPackageByName,
  updateOrCreatePackage,
} from "~/models/package.server";
import { type AuditEntry } from "~/types";

export function parseSemver(semver: string) {
  let version = semver;
  const isLeadingAnchor = isNaN(parseInt(semver.charAt(0)));
  if (isLeadingAnchor) {
    version = version.slice(1);
  }
  const parts = version.split(".");
  return parts.map((p) => parseInt(p));
}

export function compareSemver(startSemver: string, endSemver: string) {
  const [sMajor, sMinor, sPatch] = parseSemver(startSemver);
  const [eMajor, eMinor, ePatch] = parseSemver(endSemver);

  if (eMajor > sMajor) {
    return "major";
  } else if (eMinor > sMinor) {
    return "minor";
  } else if (ePatch > sPatch) {
    return "patch";
  }

  return "ok";
}

// TODO: IDK what the parsing rules around this should actually be
export function cleanRepoUrl(repo: string) {
  let url: string = repo;

  if (["git+", "git:"].includes(url.slice(0, 4))) {
    url = repo.slice(4);
  }

  if (["ssh:"].includes(url.slice(0, 4))) {
    url = repo.slice(4);
  }

  if ([".git"].includes(url.slice(-4))) {
    url = url.slice(0, -4);
  }

  return url;
}

export function npmInstallCmd(deps: AuditEntry[]) {
  let depString: string = "";
  let devString: string = "";
  deps.forEach((d) => {
    const isLatest = d.package?.latestVersion === d.instance.targetVersion;
    const version = isLatest ? "latest" : d.instance.targetVersion;
    if (d.instance.isDev) {
      devString += `${d.packageName}@${version} `;
    } else {
      depString += `${d.packageName}@${version} `;
    }
  });

  let command = "";
  if (depString) {
    command = `npm i ${depString.trim()}`;
  }

  if (devString) {
    if (command) {
      command += " && ";
    }
    command += `npm i -D ${devString.trim()}`;
  }

  return command;
}

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
