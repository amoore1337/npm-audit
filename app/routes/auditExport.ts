import { type LoaderArgs } from "@remix-run/server-runtime";
import { Readable } from "stream";
import { type AuditResult } from "~/types";
import { loadReportFromSession } from "~/utils";

export async function loader({ request }: LoaderArgs) {
  const report = await loadReportFromSession(request);
  if (report) {
    const readableReport = Readable.from(reportIterable(report));
    const headers = new Headers({
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${report.projectName}_audit.csv"`,
    });
    const res = new Response(readableReport as any, { status: 200, headers });
    return res;
  }
}

async function* reportIterable(report: AuditResult) {
  yield "Package Name,Version,Latest Version,Outdated,NPM Link\n";
  for (const record of report.records) {
    yield [
      record.packageName,
      record.instance.version,
      record.package?.latestVersion ?? "Not Found",
      record.instance.outdated,
      record.package?.npmPage,
    ]
      .join(",")
      .concat("\n");
  }
}
