interface TimerCountdownItemProps {
  value: number;
  label: string;
}

export function TimerCountdownItem({value, label}: TimerCountdownItemProps) {
  return (
    <div className="countdown-item">
      <span className="countdown-value">{value}</span>
      <span className="countdown-label">{label}</span>
    </div>
  )
}
