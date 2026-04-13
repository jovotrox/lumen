import { Link } from "@tanstack/react-router"
import React from "react"
import { cx } from "../utils/cx"

type TagLinkProps = {
  name: string
  className?: string
}

export function TagLink({ name, className }: TagLinkProps) {
  const parts = name.split("/")
  return (
    <span className={cx("text-text-secondary", className)}>
      #
      {parts.map((part, i) => {
        const splat = parts.slice(0, i + 1).join("/")
        return (
          <React.Fragment key={i}>
            {i > 0 && <span>/</span>}
            <Link
              className="link"
              to="/tags/$"
              params={{ _splat: splat }}
              search={{ query: undefined, view: "grid" }}
            >
              {part}
            </Link>
          </React.Fragment>
        )
      })}
    </span>
  )
}
