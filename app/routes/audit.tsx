import { useLoaderData, useNavigation } from "@remix-run/react";
import {
  json,
  type ActionArgs,
  type LoaderArgs,
} from "@remix-run/server-runtime";
import { PackageEntryForm, packageEntryFormAction } from "~/components/audit";
import {
  exportCsvFormAction,
  resetReport,
  ResultTable,
} from "~/components/audit/resultTable";
import { prisma } from "~/db.server";
import {
  getSession,
  removeFromSession,
  updateSession,
  type UserSessionData,
} from "~/session.server";
import { type AuditEntry, type AuditResult } from "~/types";
import { compareSemver, fetchPackageMetadata } from "~/utils";

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

    const report: UserSessionData["auditReport"] = {
      name: packageJson.name ?? "Your Report",
      records: result.records.map((e) => ({
        packageId: e.package?.id,
        version: e.instance.version,
        isDev: e.instance.isDev,
      })),
    };
    const cookie = await updateSession(request, "auditReport", report);

    return json(null, { headers: { "Set-Cookie": cookie } });
  } else if (_action === exportCsvFormAction) {
    // TODO wire up
  } else if (_action === resetReport) {
    const cookie = await removeFromSession(request, "auditReport");
    return json(null, { headers: { "Set-Cookie": cookie } });
  }

  return null;
}

export async function loader({ request }: LoaderArgs) {
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
