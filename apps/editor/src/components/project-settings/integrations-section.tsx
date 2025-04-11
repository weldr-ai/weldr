"use client";

import type { RouterOutputs } from "@weldr/api";
import { Badge } from "@weldr/ui/badge";
import { Button } from "@weldr/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@weldr/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@weldr/ui/dialog";
import { AirtableIcon } from "@weldr/ui/icons/airtable-icon";
import { AsanaIcon } from "@weldr/ui/icons/asana-icon";
import { CalComIcon } from "@weldr/ui/icons/cal-com-icon";
import { GithubIcon } from "@weldr/ui/icons/github-icon";
import { GoogleDriveIcon } from "@weldr/ui/icons/google-drive-icon";
import { GoogleSheetsIcon } from "@weldr/ui/icons/google-sheets-icon";
import { HubspotIcon } from "@weldr/ui/icons/hubspot-icon";
import { JiraIcon } from "@weldr/ui/icons/jira-icon";
import { LinearIcon } from "@weldr/ui/icons/linear-icon";
import { NotionIcon } from "@weldr/ui/icons/notion-icon";
import { PostgresIcon } from "@weldr/ui/icons/postgres-icon";
import { ResendIcon } from "@weldr/ui/icons/resend-icon";
import { S3Icon } from "@weldr/ui/icons/s3-icon";
import { SalesforceIcon } from "@weldr/ui/icons/salesforce-icon";
import { SendgridIcon } from "@weldr/ui/icons/sendgrid-icon";
import { SlackIcon } from "@weldr/ui/icons/slack-icon";
import { StripeIcon } from "@weldr/ui/icons/stripe-icon";
import { TwilioIcon } from "@weldr/ui/icons/twilio-icon";
import { ScrollArea } from "@weldr/ui/scroll-area";
import { useTheme } from "@weldr/ui/theme-provider";
import { AddIntegrationDialog } from "../add-integration-dialog";

const comingSoonIntegrations = [
  {
    id: "google-sheets",
    name: "Google Sheets",
    icon: GoogleSheetsIcon,
    description: "Integrate with Google Sheets to read and write data",
    category: "productivity",
  },
  {
    id: "stripe",
    name: "Stripe",
    icon: StripeIcon,
    description: "Process payments and manage subscriptions",
    category: "payment",
  },
  {
    id: "slack",
    name: "Slack",
    icon: SlackIcon,
    description: "Send notifications and interact with Slack channels",
    category: "communication",
  },
  {
    id: "twilio",
    name: "Twilio",
    icon: TwilioIcon,
    description: "Send SMS and make phone calls",
    category: "communication",
  },
  {
    id: "airtable",
    name: "Airtable",
    icon: AirtableIcon,
    description: "Connect to Airtable bases to manage structured data",
    category: "database",
  },
  {
    id: "notion",
    name: "Notion",
    icon: NotionIcon,
    description: "Integrate with Notion pages and databases",
    category: "productivity",
  },
  {
    id: "github",
    name: "GitHub",
    icon: GithubIcon,
    description: "Automate your GitHub workflows and repositories",
    category: "development",
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    icon: SendgridIcon,
    description: "Send transactional and marketing emails",
    category: "communication",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    icon: HubspotIcon,
    description: "Manage customer relationships and marketing campaigns",
    category: "crm",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    icon: SalesforceIcon,
    description: "Enterprise CRM and sales automation platform",
    category: "crm",
  },
  {
    id: "asana",
    name: "Asana",
    icon: AsanaIcon,
    description: "Project and task management integration",
    category: "productivity",
  },
  {
    id: "jira",
    name: "Jira",
    icon: JiraIcon,
    description: "Issue tracking and project management for software teams",
    category: "development",
  },
  {
    id: "cal.com",
    name: "Cal.com",
    icon: CalComIcon,
    description: "Calendar integration for scheduling and event management",
    category: "productivity",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    icon: GoogleDriveIcon,
    description: "File storage and collaboration platform",
    category: "productivity",
  },
  {
    id: "resend",
    name: "Resend",
    icon: ResendIcon,
    description: "Send transactional and marketing emails",
    category: "communication",
  },
  {
    id: "s3",
    name: "S3",
    icon: S3Icon,
    description: "File storage and collaboration platform",
    category: "productivity",
  },
  {
    id: "linear",
    name: "Linear",
    icon: LinearIcon,
    description: "Issue tracking and project management for software teams",
    category: "development",
  },
];

export function IntegrationsSection({
  integrations,
  integrationTemplates,
  environmentVariables,
}: {
  integrations: RouterOutputs["projects"]["byId"]["integrations"];
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
}) {
  const { resolvedTheme } = useTheme();

  const groupedIntegrations = integrations.reduce<
    Record<string, RouterOutputs["projects"]["byId"]["integrations"]>
  >(
    (acc, integration) => {
      if (integration.integrationTemplate.type) {
        acc[integration.integrationTemplate.type] = [
          ...(acc[integration.integrationTemplate.type] || []),
          integration,
        ];
      }
      return acc;
    },
    {} as Record<string, RouterOutputs["projects"]["byId"]["integrations"]>,
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>Manage your workspace integrations</CardDescription>
      </CardHeader>
      <CardContent className="h-full">
        <ScrollArea className="h-[calc(100%-72px)]">
          <div className="grid size-full grid-cols-3 gap-4 pb-4">
            {integrationTemplates?.map((integrationTemplate) => (
              <Dialog key={integrationTemplate.id}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex size-80 w-full flex-col items-start justify-between gap-4 p-6"
                  >
                    <div className="flex flex-col items-start gap-4">
                      <div className="flex flex-col items-start gap-4">
                        {integrationTemplate.key === "postgresql" ? (
                          <PostgresIcon className="size-10" />
                        ) : null}
                        <span className="font-semibold text-lg">
                          {integrationTemplate.name}
                        </span>
                      </div>
                      <span className="text-wrap text-start text-muted-foreground">
                        {integrationTemplate.description}
                      </span>
                    </div>
                    <Badge variant="outline" className="rounded-full px-3 py-2">
                      {integrationTemplate.name}
                    </Badge>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader className="space-y-4">
                    <DialogTitle className="flex flex-col items-start gap-4">
                      {integrationTemplate.key === "postgresql" ? (
                        <PostgresIcon className="size-10" />
                      ) : null}
                      {integrationTemplate.name}
                    </DialogTitle>
                    <DialogDescription>
                      {integrationTemplate.description}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 overflow-y-auto">
                    <div className="flex flex-col gap-4">
                      {groupedIntegrations[integrationTemplate.type]?.map(
                        (integration) => (
                          <AddIntegrationDialog
                            key={integration.id}
                            integrationTemplate={integrationTemplate}
                            integration={integration}
                            environmentVariables={environmentVariables}
                          />
                        ),
                      )}
                      <AddIntegrationDialog
                        integrationTemplate={integrationTemplate}
                        environmentVariables={environmentVariables}
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ))}
            {comingSoonIntegrations.map((integration) => (
              <Button
                key={integration.id}
                disabled
                variant="outline"
                className="flex size-80 w-full flex-col items-start justify-between gap-4 p-6"
              >
                <div className="flex flex-col items-start gap-4">
                  <div className="flex flex-col items-start gap-4">
                    {integration.icon
                      ? integration.icon({
                          className: "size-10",
                          theme: resolvedTheme === "dark" ? "dark" : "light",
                        })
                      : null}
                    <span className="flex items-center font-semibold text-lg">
                      {integration.name}
                      <span className="ml-2 text-muted-foreground text-xs">
                        (Coming Soon)
                      </span>
                    </span>
                  </div>
                  <span className="text-wrap text-start text-muted-foreground">
                    {integration.description}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-2">
                    {integration.category.toUpperCase()}
                  </Badge>
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
