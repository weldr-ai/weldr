import { EndpointView } from "~/components/endpoint-view";
import { api } from "~/lib/trpc/server";

interface EndpointPageProps {
  params: {
    endpointId: string;
  };
}

export default async function EndpointPage({ params }: EndpointPageProps) {
  const { endpointId } = await params;

  const endpoint = await api.endpoints.byId({
    id: endpointId,
  });

  return <EndpointView initialData={endpoint} />;
}
