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
