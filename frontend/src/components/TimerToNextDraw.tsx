import { useEffect, useState } from "react"
import { TimerCountdownItem } from "./TimerCountdownItem"

interface TimerToNextDrawProps {
  targetTimestamp?: number;
  offsetSeconds?: number;
}

function getTimeUntilTimestamp(timestamp: number, offsetSeconds: number) {
  const now = Math.floor(Date.now() / 1000) + offsetSeconds
  const timeUntilDraw = timestamp - now

  if (timeUntilDraw <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  }

  const days = Math.floor(timeUntilDraw / (60 * 60 * 24))
  const hours = Math.floor((timeUntilDraw % (60 * 60 * 24)) / (60 * 60))
  const minutes = Math.floor((timeUntilDraw % (60 * 60)) / 60)
  const seconds = timeUntilDraw % 60

  return { days, hours, minutes, seconds }
}

export function TimerToNextDraw({ targetTimestamp, offsetSeconds = 0 }: TimerToNextDrawProps) {
  const [time, setTime] = useState(() =>
    targetTimestamp ? getTimeUntilTimestamp(targetTimestamp, offsetSeconds) : { days: 0, hours: 0, minutes: 0, seconds: 0 }
  )

  useEffect(() => {
    if (!targetTimestamp) return;

    const interval = setInterval(() => {
      setTime(getTimeUntilTimestamp(targetTimestamp, offsetSeconds))
    }, 1000)

    return () => clearInterval(interval)
  }, [targetTimestamp, offsetSeconds])

  return (
    <section className="timer-section">
      <div className="timer-header">
        <h2 className="timer-title">Next draw starts in:</h2>
      </div>

      <div className="countdown">
        <TimerCountdownItem value={time.days} label="DAYS" />
        <TimerCountdownItem value={time.hours} label="HOURS" />
        <TimerCountdownItem value={time.minutes} label="MINS" />
        <TimerCountdownItem value={time.seconds} label="SECS" />
      </div>
    </section>
  )
}
