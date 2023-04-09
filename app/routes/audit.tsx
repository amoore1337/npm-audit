import { useLoaderData, useNavigation } from "@remix-run/react";
import {
  json,
  type ActionArgs,
  type LoaderArgs,
} from "@remix-run/server-runtime";
import { PackageEntryForm, packageEntryFormAction } from "~/components/audit";
import { resetReport, ResultTable } from "~/components/audit/resultTable";
import {
  removeFromSession,
  updateSession,
  type UserSessionData,
} from "~/session.server";
import { type AuditResult } from "~/types";
import { fetchPackageMetadata, loadReportFromSession } from "~/utils";

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
  } else if (_action === resetReport) {
    const cookie = await removeFromSession(request, "auditReport");
    return json(null, { headers: { "Set-Cookie": cookie } });
  }

  return null;
}

export async function loader({ request }: LoaderArgs) {
  return await loadReportFromSession(request);
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
