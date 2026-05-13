import React from 'react';

export type ExistingStudentInfo = {
    displayName?: string | null;
    maskedEmail?: string | null;
    maskedPhone?: string | null;
    userId?: string | null;
    schoolName?: string | null;
    studentClass?: number | null;
};

export type DuplicateEmailPayload = {
    status?: string;
    message?: string;
    existingStudent?: ExistingStudentInfo;
};

interface Props {
    open: boolean;
    payload: DuplicateEmailPayload | null;
    onUseRegisteredDob: () => void;
    onChangeIdentity: () => void;
    onClose: () => void;
}

const DuplicateEmailDialog: React.FC<Props> = ({
    open,
    payload,
    onUseRegisteredDob,
    onChangeIdentity,
    onClose,
}) => {
    if (!open || !payload) return null;
    const s = payload.existingStudent ?? {};

    return (
        <div style={st.backdrop} onClick={onClose}>
            <div style={st.card} onClick={(e) => e.stopPropagation()}>
                <button type="button" aria-label="Close" style={st.closeBtn} onClick={onClose}>
                    ×
                </button>

                <div style={st.iconWrap}>
                    <span style={st.icon}>!</span>
                </div>

                <h2 style={st.title}>This email is already in use</h2>
                <p style={st.subtitle}>
                    {payload.message ??
                        'We found an existing Career-9 account linked to this email. If it\'s yours, retry with the registered date of birth — otherwise use a different email or phone.'}
                </p>

                <div style={st.detailsBox}>
                    <h3 style={st.detailsHeading}>Account on file</h3>
                    <DetailRow label="Name" value={s.displayName} />
                    <DetailRow label="School" value={s.schoolName} />
                    <DetailRow label="Class" value={s.studentClass != null ? String(s.studentClass) : null} />
                    <DetailRow label="User ID" value={s.userId} />
                    <DetailRow label="Email" value={s.maskedEmail} />
                    <DetailRow label="Phone" value={s.maskedPhone} />
                </div>

                <div style={st.actions}>
                    <button type="button" style={st.primaryBtn} onClick={onUseRegisteredDob}>
                        This is me — use my registered date of birth
                    </button>
                    <button type="button" style={st.secondaryBtn} onClick={onChangeIdentity}>
                        Not me — change email or phone
                    </button>
                </div>
            </div>
        </div>
    );
};

const DetailRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
    <div style={st.detailRow}>
        <span style={st.detailLabel}>{label}</span>
        <span style={st.detailValue}>{value && value.trim() ? value : '—'}</span>
    </div>
);

const st: Record<string, React.CSSProperties> = {
    backdrop: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1500,
        padding: '1rem',
    },
    card: {
        background: '#fff',
        borderRadius: 16,
        padding: '1.75rem 1.5rem 1.5rem',
        maxWidth: 460,
        width: '100%',
        boxShadow: '0 30px 80px rgba(15, 23, 42, 0.35)',
        position: 'relative',
    },
    closeBtn: {
        position: 'absolute',
        top: 10,
        right: 14,
        background: 'transparent',
        border: 'none',
        fontSize: 26,
        color: '#94a3b8',
        cursor: 'pointer',
        lineHeight: 1,
    },
    iconWrap: {
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
        margin: '0 auto 0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        color: '#dc2626',
        fontWeight: 800,
        fontSize: 28,
    },
    title: {
        fontSize: '1.25rem',
        fontWeight: 700,
        color: '#0f172a',
        textAlign: 'center',
        margin: '0 0 0.4rem',
    },
    subtitle: {
        fontSize: '0.9rem',
        color: '#475569',
        textAlign: 'center',
        lineHeight: 1.5,
        margin: '0 0 1rem',
    },
    detailsBox: {
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '0.75rem 1rem',
        marginBottom: '1.25rem',
    },
    detailsHeading: {
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#64748b',
        margin: '0 0 0.5rem',
    },
    detailRow: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '4px 0',
        fontSize: '0.9rem',
    },
    detailLabel: {
        color: '#64748b',
        fontWeight: 500,
    },
    detailValue: {
        color: '#0f172a',
        fontWeight: 600,
        textAlign: 'right',
        wordBreak: 'break-word',
    },
    actions: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    primaryBtn: {
        background: 'linear-gradient(135deg, #10b981, #059669)',
        color: 'white',
        border: 'none',
        borderRadius: 12,
        padding: '12px 16px',
        fontWeight: 700,
        fontSize: '0.95rem',
        cursor: 'pointer',
        boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)',
    },
    secondaryBtn: {
        background: 'white',
        color: '#0f172a',
        border: '1.5px solid #cbd5e0',
        borderRadius: 12,
        padding: '11px 16px',
        fontWeight: 600,
        fontSize: '0.9rem',
        cursor: 'pointer',
    },
};

export default DuplicateEmailDialog;
