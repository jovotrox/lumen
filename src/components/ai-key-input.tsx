import { useAtom } from "jotai"
import type { PrimitiveAtom } from "jotai"
import { TextInput } from "./text-input"
import { FormControl } from "./form-control"

export function AIKeyInput({
  label,
  atom: keyAtom,
  placeholder,
}: {
  label: string
  atom: PrimitiveAtom<string>
  placeholder: string
}) {
  const [value, setValue] = useAtom(keyAtom)

  return (
    <FormControl htmlFor={label.toLowerCase().replace(/\s+/g, "-")} label={label}>
      <TextInput
        id={label.toLowerCase().replace(/\s+/g, "-")}
        name={label.toLowerCase().replace(/\s+/g, "-")}
        type="password"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
      />
    </FormControl>
  )
}
