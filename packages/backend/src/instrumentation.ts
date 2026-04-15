import { NodeSDK } from '@opentelemetry/sdk-node'
import { LangfuseSpanProcessor } from '@langfuse/otel'

let sdk: NodeSDK | null = null

export function startLangfuseInstrumentation() {
  const enabled = Boolean(process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY)
  if (!enabled || sdk) {
    return sdk
  }

  sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor()],
  })

  sdk.start()
  return sdk
}

export async function shutdownLangfuseInstrumentation() {
  if (!sdk) return
  const current = sdk
  sdk = null
  await current.shutdown()
}
