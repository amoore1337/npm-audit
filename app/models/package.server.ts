import type { Package } from "@prisma/client";

import { prisma } from "~/db.server";

export function createNpmPackage(npmPackage: Omit<Package, 'id' | 'createdAt' | 'updatedAt'>) {
  return prisma.package.create({ data: npmPackage });
}

export function findPackages(packageNames: string[]) {
  return prisma.package.findMany({ where: { name: { in: packageNames } } });
}

export function findPackageByName(packageName: string) {
  return prisma.package.findUnique({ where: { name: packageName } });
}

export async function updateOrCreatePackage(npmPackage: Omit<Package, 'id' | 'createdAt' | 'updatedAt'>) {
  const existing = await findPackageByName(npmPackage.name);
  if (existing) {
    const { name, ...updateValues } = npmPackage;
    return prisma.package.update({
      where: { name },
      data: updateValues,
    });
  } else {
    return createNpmPackage(npmPackage);
  }
}
