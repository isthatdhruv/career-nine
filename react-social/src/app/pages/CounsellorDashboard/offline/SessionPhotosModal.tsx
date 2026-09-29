import React from 'react'
import { Modal } from 'react-bootstrap'
import { OfflineStudentRow } from '../../Counselling/API/OfflineCounsellingAPI'
import SessionNotesPhotoUpload from '../../Counselling/shared/SessionNotesPhotoUpload'

interface SessionPhotosModalProps {
  row: OfflineStudentRow | null
  onClose: () => void
}

/**
 * Photos of a recorded session's counselling sheet. Editable only on my own record: the
 * server refuses upload/remove on another counsellor's, so theirs open read-only rather than
 * offering buttons that would fail.
 */
const SessionPhotosModal: React.FC<SessionPhotosModalProps> = ({ row, onClose }) => (
  <Modal show={!!row} onHide={onClose} fullscreen='sm-down' centered>
    <Modal.Header closeButton>
      <div>
        <Modal.Title style={{ fontSize: 17 }}>Photos of the counselling sheet</Modal.Title>
        {row && <div style={{ fontSize: 13, color: '#6B7A8D', marginTop: 2 }}>{row.name}</div>}
      </div>
    </Modal.Header>
    <Modal.Body>
      {row && row.doneAppointmentId != null && (
        <>
          {!row.doneByMe && (
            <div style={{ fontSize: 12, color: '#6B7A8D', marginBottom: 10 }}>
              Recorded by {row.doneByCounsellorName || 'another counsellor'} — only they can add or remove photos.
            </div>
          )}
          <SessionNotesPhotoUpload
            appointmentId={row.doneAppointmentId}
            readOnly={!row.doneByMe}
            buttonClassName='cp-action-btn cp-off-touch'
          />
        </>
      )}
    </Modal.Body>
  </Modal>
)

export default SessionPhotosModal
