import { useEffect, useState } from "react"
import { TimerCountdownItem } from "./TimerCountdownItem"

{/* TODO: hardcoded until we get information from the contract */}
const nextDraw = new Date('2026-02-20')

function getTimeUntilNextDraw(date: Date) {
  const now = new Date()
  const timeUntilNextDraw = date.getTime() - now.getTime()
  const days = Math.floor(timeUntilNextDraw / (1000 * 60 * 60 * 24))
  const hours = Math.floor((timeUntilNextDraw % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((timeUntilNextDraw % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((timeUntilNextDraw % (1000 * 60)) / 1000)
  return { days, hours, minutes, seconds }
}

export function TimerToNextDraw() {
  const [time, setTime] = useState(getTimeUntilNextDraw(nextDraw))

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeUntilNextDraw(nextDraw))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

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
