import { useAtomValue } from "jotai"
import { SignInButton } from "./github-auth"
import { SignInWithTokenDialog } from "./sign-in-with-token-dialog"
import { isSignedOutAtom } from "../global-state"
import { cx } from "../utils/cx"

export function SignInBanner({ className }: { className?: string }) {
  const isSignedOut = useAtomValue(isSignedOutAtom)

  if (!isSignedOut) {
    return null
  }

  return (
    <div
      className={cx(
        "flex shrink-0 flex-col justify-between gap-4 p-4 pb-2 text-text sm:flex-row items-center sm:p-2 print:hidden",
        className,
      )}
    >
      <span className="px-2 text-text-secondary text-balance text-center sm:text-left">
        These are demo notes. Sign in to write your own.
      </span>
      <div className="flex flex-col items-center gap-1 sm:items-end">
        <SignInButton className="w-full sm:w-auto" />
        <SignInWithTokenDialog
          trigger={
            <button type="button" className="link text-sm text-text-secondary">
              or use a personal access token
            </button>
          }
        />
      </div>
    </div>
  )
}
