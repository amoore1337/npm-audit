import { type Package } from "@prisma/client";

interface SerializedPackage extends Omit<Package, "createdAt" | "updatedAt"> {
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AuditEntry {
  packageName: string;
  package: SerializedPackage | null;
  instance: {
    isDev: boolean;
    outdated: "major" | "minor" | "patch" | "ok";
    version: string;
    targetVersion: string;
  };
}

export interface AuditResult {
  projectName: string;
  records: AuditEntry[];
}
