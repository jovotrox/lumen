import { useSetAtom } from "jotai"
import React from "react"
import { globalStateMachineAtom } from "../global-state"
import { Button } from "./button"
import { Dialog } from "./dialog"
import { TextInput } from "./text-input"

/**
 * Dialog for signing in with a GitHub Personal Access Token (PAT).
 *
 * Why this exists: the OAuth Device Flow (used for the default "Sign in with
 * GitHub" button) appears to invalidate a user's previous access_tokens when
 * issuing a new one to the same OAuth app. This breaks multi-device sync —
 * signing in on a second device kills the first device's token.
 *
 * PATs don't have that problem: each PAT is independent. You can have many
 * active at once, across any number of devices. Creating a new one doesn't
 * invalidate existing ones.
 */
export function SignInWithTokenDialog({ trigger }: { trigger: React.ReactNode }) {
  const send = useSetAtom(globalStateMachineAtom)
  const [token, setToken] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)

  const reset = () => {
    setToken("")
    setError(null)
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = token.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    try {
      const user = await getUserFromToken(trimmed)
      // PATs don't have refresh tokens or expiry info — omit those fields.
      send({
        type: "SIGN_IN",
        githubUser: {
          token: trimmed,
          login: user.login,
          name: user.name,
          email: user.email,
        },
      })
      setOpen(false)
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Content title="Sign in with a token">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Use a Personal Access Token if you sync with multiple devices. Unlike OAuth, PATs aren't
            invalidated when another device signs in.
          </p>

          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-text-secondary">
            <li>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,gist,user:email&description=Lumen"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                Create a classic token on GitHub
              </a>{" "}
              with <code>repo</code>, <code>gist</code>, and <code>user:email</code> scopes.
            </li>
            <li>Choose an expiration (1 year or "No expiration" both work).</li>
            <li>Copy the token and paste it below.</li>
          </ol>

          <TextInput
            type="password"
            placeholder="ghp_… or github_pat_…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            invalid={error !== null}
          />

          {error ? <div className="text-sm text-text-danger">{error}</div> : null}

          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button type="button">Cancel</Button>
            </Dialog.Close>
            <Button variant="primary" type="submit" disabled={loading || !token.trim()}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog>
  )
}

async function getUserFromToken(token: string): Promise<{
  login: string
  name: string
  email: string
}> {
  const userResponse = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (userResponse.status === 401) {
    throw new Error("Invalid token — GitHub rejected it")
  }
  if (!userResponse.ok) {
    throw new Error(`GitHub API error: ${userResponse.status}`)
  }

  const { login, name } = (await userResponse.json()) as { login: string; name: string }

  const emailResponse = await fetch("https://api.github.com/user/emails", {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (emailResponse.status === 401) {
    throw new Error("Token is missing the user:email scope")
  }
  if (!emailResponse.ok) {
    throw new Error(`Could not fetch email (HTTP ${emailResponse.status})`)
  }

  const emails = (await emailResponse.json()) as Array<{
    email: string
    primary: boolean
    visibility: string | null
  }>
  const primary = emails.find((e) => e.primary) ?? emails[0]
  if (!primary) {
    throw new Error("No email found on GitHub account")
  }

  return { login, name, email: primary.email }
}
