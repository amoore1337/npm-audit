import { useMatches } from "@remix-run/react";
import { useMemo } from "react";

const DEFAULT_REDIRECT = "/";

/**
 * This should be used any time the redirect path is user-provided
 * (Like the query string on our login/signup pages). This avoids
 * open-redirect vulnerabilities.
 * @param {string} to The redirect destination
 * @param {string} defaultRedirect The redirect to use if the to is unsafe.
 */
export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  defaultRedirect: string = DEFAULT_REDIRECT
) {
  if (!to || typeof to !== "string") {
    return defaultRedirect;
  }

  if (!to.startsWith("/") || to.startsWith("//")) {
    return defaultRedirect;
  }

  return to;
}

/**
 * This base hook is used in other hooks to quickly search for specific data
 * across all loader data using useMatches.
 * @param {string} id The route id
 * @returns {JSON|undefined} The router data or undefined if not found
 */
export function useMatchesData(
  id: string
): Record<string, unknown> | undefined {
  const matchingRoutes = useMatches();
  const route = useMemo(
    () => matchingRoutes.find((route) => route.id === id),
    [matchingRoutes, id]
  );
  return route?.data;
}

export function parseSemver(semver: string) {
  let version = semver
  const isLeadingAnchor = isNaN(parseInt(semver.charAt(0)));
  if (isLeadingAnchor) {
    version = version.slice(1);
  }
  const parts = version.split('.');
  return parts.map(p => parseInt(p));
}

export function compareSemver(startSemver: string, endSemver: string) {
  const [sMajor, sMinor, sPatch] = parseSemver(startSemver)
  const [eMajor, eMinor, ePatch] = parseSemver(endSemver)

  if (eMajor > sMajor) {
    return 'major';
  } else if (eMinor > sMinor) {
    return 'minor'
  } else if (ePatch > sPatch) {
    return 'patch'
  }

  return 'ok'
}

export interface AuditEntry {
  name: string
  version: string
  isDev: boolean
  outdated: 'major' | 'minor' | 'patch' | 'ok'
  latestVersion?: string
  targetVersion?: string
  versions?: string[]
  npmPage?: string
}

// TODO: IDK what the parsing rules around this should actually be
export function cleanRepoUrl(repo: string) {
  let url: string = repo;

  if (['git+', 'git:'].includes(url.slice(0, 4))) {
    url = repo.slice(4);
  }
  
  if (['ssh:'].includes(url.slice(0, 4))) {
    url = repo.slice(4);
  }

  if (['.git'].includes(url.slice(-4))) {
    url = url.slice(0, -4);
  }

  return url;
}

export function npmInstallCmd(deps: AuditEntry[]) {
  let depString: string = '';
  let devString: string = '';
  deps.forEach((d) => {
    const isLatest = d.latestVersion === d.targetVersion;
    const version = isLatest ? 'latest' : d.targetVersion ?? 'latest';
    if (d.isDev) {
      devString += `${d.name}@${version} `;
    } else {
      depString += `${d.name}@${version} `;
    }
  });

  let command = '';
  if (depString) {
    command = `npm i ${depString.trim()}`;
  }

  if (devString) {
    if (command) {
      command += ' && '
    }
    command += `npm i -D ${devString.trim()}`;
  }

  return command;
}
