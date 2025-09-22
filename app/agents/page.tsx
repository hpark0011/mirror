import { AgentsHeader } from "@/components/agents/agents-header";
import { BodyContainer } from "@/components/layout/layout-ui";

export default function AgentsPage() {
  return (
    <>
      <AgentsHeader />
      <BodyContainer>
        <div className='px-5'>Agents</div>
      </BodyContainer>
    </>
  );
}
