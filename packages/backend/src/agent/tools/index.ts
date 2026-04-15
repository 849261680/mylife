import { buildDashboardContext, type AgentToolContext } from './common'
import { readTools } from './read-tools'
import { writeTools } from './write-tools'

const agentTools = [...readTools, ...writeTools]
const toolMap = new Map(agentTools.map((tool) => [tool.name, tool]))

export const openAiToolDefinitions = agentTools.map((tool) => ({
  type: 'function' as const,
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters,
  strict: true,
}))

export async function executeAgentTool(name: string, args: Record<string, unknown>, context: AgentToolContext) {
  const tool = toolMap.get(name)
  if (!tool) {
    throw new Error(`unknown tool: ${name}`)
  }
  return tool.execute(args, context)
}

export async function getDashboardContextForAgent() {
  return buildDashboardContext()
}
