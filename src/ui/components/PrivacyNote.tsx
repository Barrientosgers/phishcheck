interface Props {
  text: string
}

export function PrivacyNote({ text }: Props) {
  return (
    <p className="privacy-note">
      <span aria-hidden="true">🔒</span> {text}
    </p>
  )
}
