import { createFileRoute } from "@tanstack/react-router";
import { PublicReportPage } from "@/modules/public-reports/PublicReportPage";
export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report suspicious activity — TNP" },
      {
        name: "description",
        content:
          "Report suspicious rental activity without an account and securely track your case.",
      },
    ],
  }),
  component: PublicReportPage,
});
