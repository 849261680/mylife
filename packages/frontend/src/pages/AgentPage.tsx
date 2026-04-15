import AgentPanel from '../components/AgentPanel'

interface PageProps {
  darkMode: boolean
}

export default function AgentPage({ darkMode }: PageProps) {
  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <AgentPanel darkMode={darkMode} fillHeight />
    </div>
  )
}
