import React from 'react'
import { Modal } from 'react-bootstrap'

interface BulkMapConfirmModalProps {
  show: boolean
  count: number
  /** How many of them are mapped to another counsellor and will be taken over. */
  takeoverCount: number
  /** "Name (n), Name (n)" of the counsellors they are taken from. */
  takeoverSummary: string
  busy: boolean
  progress: string
  onCancel: () => void
  onConfirm: () => void
}

/** "Map N students to you?" — spells out the take-overs before any student changes hands. */
const BulkMapConfirmModal: React.FC<BulkMapConfirmModalProps> = ({
  show,
  count,
  takeoverCount,
  takeoverSummary,
  busy,
  progress,
  onCancel,
  onConfirm,
}) => (
  <Modal
    show={show}
    onHide={() => !busy && onCancel()}
    fullscreen='sm-down'
    centered
    backdrop={busy ? 'static' : true}
    keyboard={!busy}
  >
    <Modal.Header closeButton={!busy}>
      <Modal.Title style={{ fontSize: 17 }}>
        Map {count} student{count === 1 ? '' : 's'} to you?
      </Modal.Title>
    </Modal.Header>
    <Modal.Body style={{ fontSize: 14, color: '#1A1F2E' }}>
      {takeoverCount > 0 ? (
        <>
          <p style={{ marginBottom: 8 }}>
            <strong>{takeoverCount}</strong> of them {takeoverCount === 1 ? 'is' : 'are'} currently with other
            counsellors and will be taken over:
          </p>
          <p style={{ color: '#92400E', marginBottom: 0 }}>{takeoverSummary}</p>
        </>
      ) : (
        <p style={{ marginBottom: 0 }}>None of them is with another counsellor.</p>
      )}
      {progress && <div style={{ marginTop: 12, fontSize: 12, color: '#6B7A8D' }}>{progress}</div>}
    </Modal.Body>
    <Modal.Footer>
      <button type='button' className='cp-action-btn cp-off-touch' onClick={onCancel} disabled={busy}>
        Cancel
      </button>
      <button
        type='button'
        className='cp-action-btn cp-action-btn-primary cp-off-touch'
        onClick={onConfirm}
        disabled={busy || count === 0}
      >
        {busy ? 'Mapping...' : `Map ${count} to me`}
      </button>
    </Modal.Footer>
  </Modal>
)

export default BulkMapConfirmModal
