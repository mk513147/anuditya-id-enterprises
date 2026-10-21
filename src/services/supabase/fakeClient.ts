/**
 * TEST HELPER: a recording stand-in for the Supabase client. Every query/RPC/storage call is recorded with its chained
 * filter operations, and the test decides the response. No network, no credentials.
 * (Not imported by application code.)
 */
import type { Client } from './shared'

export interface RecordedCall {
  kind: 'from' | 'rpc' | 'upload' | 'signedUrl' | 'signedUrls' | 'remove' | 'download'
  /** Table, function or bucket name. */
  target: string
  args?: unknown
  ops: { op: string; args: unknown[] }[]
}

export interface FakeResponse {
  data?: unknown
  error?: unknown
  count?: number | null
}

export type Responder = (call: RecordedCall) => FakeResponse | undefined

export function createFakeClient(responder: Responder = () => undefined) {
  const calls: RecordedCall[] = []
  const respond = (call: RecordedCall) => {
    const r = responder(call) ?? {}
    return { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null }
  }

  const builder = (call: RecordedCall): unknown =>
    new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') {
            return (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
              try {
                return Promise.resolve(respond(call)).then(onFulfilled, onRejected)
              } catch (e) {
                return Promise.reject(e).then(onFulfilled, onRejected)
              }
            }
          }
          return (...args: unknown[]) => {
            call.ops.push({ op: String(prop), args })
            return builder(call)
          }
        },
      },
    )

  const client = {
    from(table: string) {
      const call: RecordedCall = { kind: 'from', target: table, ops: [] }
      calls.push(call)
      return builder(call)
    },
    rpc(fn: string, args?: unknown) {
      const call: RecordedCall = { kind: 'rpc', target: fn, args, ops: [] }
      calls.push(call)
      return builder(call)
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, _file: unknown, options: unknown) {
            const call: RecordedCall = { kind: 'upload', target: bucket, args: { path, options }, ops: [] }
            calls.push(call)
            return respond(call)
          },
          async createSignedUrl(path: string, expiresIn: number, options?: unknown) {
            const call: RecordedCall = { kind: 'signedUrl', target: bucket, args: { path, expiresIn, options }, ops: [] }
            calls.push(call)
            return respond(call)
          },
          async createSignedUrls(paths: string[], expiresIn: number) {
            const call: RecordedCall = { kind: 'signedUrls', target: bucket, args: { paths, expiresIn }, ops: [] }
            calls.push(call)
            return respond(call)
          },
          async remove(paths: string[]) {
            const call: RecordedCall = { kind: 'remove', target: bucket, args: { paths }, ops: [] }
            calls.push(call)
            return respond(call)
          },
          async download(path: string) {
            const call: RecordedCall = { kind: 'download', target: bucket, args: { path }, ops: [] }
            calls.push(call)
            return respond(call)
          },
        }
      },
    },
  }

  return { client: client as unknown as Client, calls }
}
