import { useSetAtom } from "jotai"
import React from "react"
import { globalStateMachineAtom } from "../global-state"
import { logDebug } from "../utils/debug-log"
import { electronFetch } from "../utils/electron"
import { openExternal } from "../utils/tauri"
import { Button, ButtonProps } from "./button"
import { CopyButton } from "./copy-button"
import { GitHubIcon16, LoadingIcon16 } from "./icons"

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID

interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

interface TokenResponse {
  access_token?: string
  /** Present when the OAuth app has "Expire user authorization tokens" enabled. */
  refresh_token?: string
  /** Seconds until `access_token` expires, when the OAuth app uses expiring tokens. */
  expires_in?: number
  /** Seconds until `refresh_token` expires (typically ~6 months). */
  refresh_token_expires_in?: number
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

type AuthState =
  | { status: "idle" }
  | { status: "requesting_code" }
  | { status: "waiting_for_user"; userCode: string; verificationUri: string; expiresAt: Date }
  | { status: "polling" }
  | { status: "error"; message: string }

export function ElectronSignInButton(props: ButtonProps) {
  const send = useSetAtom(globalStateMachineAtom)
  const [state, setState] = React.useState<AuthState>({ status: "idle" })
  const pollingRef = React.useRef<number | null>(null)

  const cleanup = React.useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  React.useEffect(() => {
    return cleanup
  }, [cleanup])

  const startDeviceFlow = async () => {
    setState({ status: "requesting_code" })

    try {
      // Request device code using Electron's IPC fetch (no CORS restrictions)
      const response = await electronFetch("https://github.com/login/device/code", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          scope: "repo,gist,user:email",
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to request device code: ${errorText}`)
      }

      const data = (await response.json()) as DeviceCodeResponse

      setState({
        status: "waiting_for_user",
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      })

      // Open GitHub verification page in system browser
      await openExternal(data.verification_uri)

      // Start polling for token
      startPolling(data.device_code, data.interval)
    } catch (error) {
      console.error("Device flow error:", error)
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const startPolling = (deviceCode: string, interval: number) => {
    setState((prev) =>
      prev.status === "waiting_for_user" ? { ...prev, status: "waiting_for_user" } : prev,
    )

    // Poll at the interval specified by GitHub (usually 5 seconds)
    pollingRef.current = window.setInterval(async () => {
      try {
        const response = await electronFetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            device_code: deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          }),
        })

        const data = (await response.json()) as TokenResponse

        if (data.access_token) {
          cleanup()

          // Log which fields GitHub returned (without the token values) so we
          // can confirm whether this OAuth app issues expiring tokens + refresh
          // tokens. If `hasRefreshToken` is false, the refresh flow is a no-op
          // and users will need to manually sign in again every time the token
          // dies — the OAuth app needs "Expire user authorization tokens"
          // enabled to emit refresh tokens.
          logDebug("github-auth:device-flow:success", {
            hasAccessToken: !!data.access_token,
            hasRefreshToken: !!data.refresh_token,
            expiresIn: data.expires_in,
            refreshTokenExpiresIn: data.refresh_token_expires_in,
            tokenType: data.token_type,
            scope: data.scope,
          })

          // Get user info
          const user = await getUser(data.access_token)
          send({
            type: "SIGN_IN",
            githubUser: {
              token: data.access_token,
              refreshToken: data.refresh_token,
              expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
              login: user.login,
              name: user.name,
              email: user.email,
            },
          })

          setState({ status: "idle" })
        } else if (data.error === "authorization_pending") {
          // User hasn't authorized yet, continue polling
        } else if (data.error === "slow_down") {
          // Need to slow down polling
          cleanup()
          startPolling(deviceCode, interval + 5)
        } else if (data.error === "expired_token") {
          cleanup()
          setState({ status: "error", message: "Authorization expired. Please try again." })
        } else if (data.error === "access_denied") {
          cleanup()
          setState({ status: "error", message: "Access denied by user." })
        } else if (data.error) {
          cleanup()
          setState({ status: "error", message: data.error_description || data.error })
        }
      } catch (error) {
        // Network error, continue polling
        console.error("Polling error:", error)
      }
    }, interval * 1000)
  }

  const cancel = () => {
    cleanup()
    setState({ status: "idle" })
  }

  // Show code dialog when waiting for user
  if (state.status === "waiting_for_user") {
    return (
      <div className="flex flex-col gap-3">
        <div className="card-1 flex flex-col gap-3 p-4">
          <p className="text-sm text-text-secondary">Enter this code on GitHub to sign in:</p>
          <div className="flex items-center justify-center gap-2 rounded bg-bg-secondary py-3 px-4">
            <code className="font-mono text-2xl font-bold tracking-widest">{state.userCode}</code>
            <CopyButton text={state.userCode} />
          </div>
          <p className="text-xs text-text-tertiary">
            A browser window should have opened. If not,{" "}
            <button className="link" onClick={() => openExternal(state.verificationUri)}>
              click here
            </button>
            .
          </p>
        </div>
        <Button variant="secondary" onClick={cancel}>
          Cancel
        </Button>
      </div>
    )
  }

  // Show error state
  if (state.status === "error") {
    return (
      <div className="flex flex-col gap-3">
        <div className="card-1 p-4 text-text-danger">
          <p className="text-sm">{state.message}</p>
        </div>
        <Button variant="primary" onClick={() => setState({ status: "idle" })}>
          Try again
        </Button>
      </div>
    )
  }

  // Show loading state
  const isLoading = state.status === "requesting_code" || state.status === "polling"

  return (
    <Button
      variant="primary"
      {...props}
      disabled={isLoading || props.disabled}
      onClick={startDeviceFlow}
    >
      {isLoading ? <LoadingIcon16 /> : <GitHubIcon16 />}
      {isLoading ? "Connecting..." : "Sign in with GitHub"}
    </Button>
  )
}

async function getUser(token: string) {
  const userResponse = await electronFetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (userResponse.status === 401) {
    throw new Error("Invalid token")
  }

  if (!userResponse.ok) {
    throw new Error("Unknown error")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { login, name } = (await userResponse.json()) as any

  const emailResponse = await electronFetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (emailResponse.status === 401) {
    throw new Error("Invalid token")
  }

  if (!emailResponse.ok) {
    throw new Error("Error getting user's emails")
  }

  const emails = (await emailResponse.json()) as Array<{ email: string; primary: boolean }>
  const primaryEmail = emails.find((email) => email.primary)

  if (!primaryEmail) {
    throw new Error("No primary email found")
  }

  return { login, name, email: primaryEmail.email }
}
