import React, { useCallback, useEffect, useState } from 'react'
import { getPendingRatingsForStudent, PendingRatingAppointment } from '../../API/RatingAPI'
import SessionRatingModal from './SessionRatingModal'

interface Props {
  studentId: number
}

const PendingRatingPrompt: React.FC<Props> = ({ studentId }) => {
  const [queue, setQueue] = useState<PendingRatingAppointment[]>([])

  const fetchPending = useCallback(() => {
    if (!studentId) return
    getPendingRatingsForStudent(studentId)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : []
        setQueue(list)
      })
      .catch(() => {
        // Silent fail — don't block the page if this endpoint errors
      })
  }, [studentId])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  const handleSubmitted = () => {
    setQueue((prev) => prev.slice(1))
  }

  if (queue.length === 0) return null
  const current = queue[0]
  if (!current || !current.id) return null

  return (
    <SessionRatingModal
      key={current.id}
      appointment={current}
      onSubmitted={handleSubmitted}
    />
  )
}

export default PendingRatingPrompt
