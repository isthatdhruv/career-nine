import { useState } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { MdContentCopy, MdQrCode, MdPayment, MdEmail, MdWhatsapp } from "react-icons/md";
import { QRCodeCanvas } from "qrcode.react";
import { generatePaymentLink, sendPaymentLinkEmail, sendPaymentLinkWhatsApp } from "../../PaymentTracking/API/Payment_APIs";

interface PaymentLinkModalProps {
  show: boolean;
  onHide: () => void;
  mappingId: number;
  assessmentName: string;
}

interface GeneratedLink {
  transactionId: number;
  paymentLinkUrl: string;
  shortUrl: string;
  amount: number;
}

const PaymentLinkModal = ({
  show,
  onHide,
  mappingId,
  assessmentName,
}: PaymentLinkModalProps) => {
  const [amount, setAmount] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<GeneratedLink[]>([]);
  const [copySuccess, setCopySuccess] = useState<string>("");
  const [showQrFor, setShowQrFor] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [sendEmail, setSendEmail] = useState("");
  const [sendPhone, setSendPhone] = useState("");
  const [sendName, setSendName] = useState("");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string>("");

  const handleGenerate = async () => {
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const res = await generatePaymentLink(mappingId, amountNum);
      const link: GeneratedLink = {
        transactionId: res.data.transactionId,
        paymentLinkUrl: res.data.paymentLinkUrl,
        shortUrl: res.data.shortUrl,
        amount: amountNum,
      };
      setGeneratedLinks((prev) => [link, ...prev]);
      setAmount("");
    } catch (err: any) {
      setError(
        err.response?.data || err.message || "Failed to generate payment link"
      );
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopySuccess(url);
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleClose = () => {
    setGeneratedLinks([]);
    setAmount("");
    setError("");
    setShowQrFor(null);
    onHide();
  };

  const handleSendEmail = async (link: GeneratedLink) => {
    if (!sendEmail) return;
    setSending(true);
    try {
      await sendPaymentLinkEmail(link.transactionId, sendEmail, sendName || undefined);
      setSendSuccess("email");
      setTimeout(() => setSendSuccess(""), 3000);
      setSendEmail("");
      setSendName("");
    } catch (err: any) {
      setError(err.response?.data || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const handleSendWhatsApp = async (link: GeneratedLink) => {
    if (!sendPhone) return;
    setSending(true);
    try {
      const res = await sendPaymentLinkWhatsApp(link.transactionId, sendPhone, sendName || undefined);
      window.open(res.data.whatsappUrl, "_blank");
      setSendSuccess("whatsapp");
      setTimeout(() => setSendSuccess(""), 3000);
      setSendPhone("");
      setSendName("");
    } catch (err: any) {
      setError(err.response?.data || "Failed to generate WhatsApp link");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Modal show={show} onHide={handleClose} size="lg" centered>
        <Modal.Header
          closeButton
          style={{
            background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
            borderBottom: "none",
            padding: "24px 32px",
          }}
        >
          <div>
            <Modal.Title
              style={{ color: "#fff", fontWeight: 700, fontSize: "1.15rem" }}
            >
              <MdPayment
                size={20}
                style={{ marginRight: 10, verticalAlign: "middle" }}
              />
              Generate Payment Link
            </Modal.Title>
            <div
              style={{ color: "#c7d2fe", fontSize: "0.85rem", marginTop: 4 }}
            >
              {assessmentName}
            </div>
          </div>
        </Modal.Header>

        <Modal.Body style={{ padding: "28px 32px", background: "#f8fafc" }}>
          {/* Amount Input */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "24px",
              border: "1px solid #e2e8f0",
              marginBottom: 24,
            }}
          >
            <Form.Label
              style={{
                fontWeight: 600,
                fontSize: "0.85rem",
                color: "#475569",
                marginBottom: 8,
              }}
            >
              Amount (INR)
            </Form.Label>
            <div style={{ display: "flex", gap: 12 }}>
              <Form.Control
                type="number"
                placeholder="Enter amount in rupees"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #e2e8f0",
                  fontSize: "0.95rem",
                }}
                min="1"
              />
              <Button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  background: generating
                    ? "#94a3b8"
                    : "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 24px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  whiteSpace: "nowrap",
                  boxShadow: generating
                    ? "none"
                    : "0 4px 14px rgba(67, 97, 238, 0.3)",
                }}
              >
                {generating ? (
                  <>
                    <Spinner
                      animation="border"
                      size="sm"
                      style={{ marginRight: 8 }}
                    />
                    Generating...
                  </>
                ) : (
                  "Generate Link"
                )}
              </Button>
            </div>
            {error && (
              <div
                style={{
                  color: "#ef4444",
                  fontSize: "0.82rem",
                  marginTop: 8,
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Generated Links */}
          {generatedLinks.length > 0 && (
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: "24px",
                border: "1px solid #e2e8f0",
              }}
            >
              <h6
                style={{
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "#1e293b",
                  marginBottom: 16,
                }}
              >
                Generated Links ({generatedLinks.length})
              </h6>

              {generatedLinks.map((link, idx) => (
                <div
                  key={link.transactionId}
                  style={{
                    background: idx % 2 === 0 ? "#f8fafc" : "#fff",
                    borderRadius: 10,
                    padding: "16px",
                    border: "1px solid #e2e8f0",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "1.1rem",
                        color: "#059669",
                      }}
                    >
                      INR {link.amount}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => copyLink(link.shortUrl)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 14px",
                          borderRadius: 8,
                          border:
                            copySuccess === link.shortUrl
                              ? "1.5px solid #059669"
                              : "1.5px solid #e2e8f0",
                          background:
                            copySuccess === link.shortUrl ? "#dcfce7" : "#fff",
                          color:
                            copySuccess === link.shortUrl
                              ? "#059669"
                              : "#475569",
                          fontWeight: 600,
                          fontSize: "0.78rem",
                          cursor: "pointer",
                        }}
                      >
                        <MdContentCopy size={14} />
                        {copySuccess === link.shortUrl ? "Copied!" : "Copy Link"}
                      </button>
                      <button
                        onClick={() =>
                          setShowQrFor(
                            showQrFor === link.shortUrl ? null : link.shortUrl
                          )
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1.5px solid #e2e8f0",
                          background:
                            showQrFor === link.shortUrl ? "#eef2ff" : "#fff",
                          color: "#475569",
                          cursor: "pointer",
                        }}
                      >
                        <MdQrCode size={14} />
                        QR
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "#94a3b8",
                      wordBreak: "break-all",
                    }}
                  >
                    {link.shortUrl}
                  </div>

                  {showQrFor === link.shortUrl && (
                    <div
                      style={{
                        textAlign: "center",
                        marginTop: 16,
                        padding: 16,
                        background: "#fff",
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <QRCodeCanvas
                        value={link.shortUrl}
                        size={200}
                        level="H"
                        includeMargin
                      />
                    </div>
                  )}

                  {/* Send via Email / WhatsApp */}
                  <div style={{ marginTop: 12, padding: "12px 0", borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: 8 }}>
                      Send to Student
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <Form.Control
                        type="text"
                        placeholder="Student name"
                        value={sendName}
                        onChange={(e) => setSendName(e.target.value)}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.82rem", flex: 1 }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Form.Control
                        type="email"
                        placeholder="Email address"
                        value={sendEmail}
                        onChange={(e) => setSendEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendEmail(link)}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.82rem", flex: 1 }}
                      />
                      <button
                        onClick={() => handleSendEmail(link)}
                        disabled={sending || !sendEmail}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "6px 12px", borderRadius: 8,
                          border: sendSuccess === "email" ? "1.5px solid #059669" : "1.5px solid #e2e8f0",
                          background: sendSuccess === "email" ? "#dcfce7" : "#fff",
                          color: sendSuccess === "email" ? "#059669" : "#475569",
                          fontWeight: 600, fontSize: "0.75rem", cursor: "pointer",
                        }}
                      >
                        <MdEmail size={14} />
                        {sendSuccess === "email" ? "Sent!" : "Email"}
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <Form.Control
                        type="tel"
                        placeholder="Phone (e.g. 9876543210)"
                        value={sendPhone}
                        onChange={(e) => setSendPhone(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendWhatsApp(link)}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.82rem", flex: 1 }}
                      />
                      <button
                        onClick={() => handleSendWhatsApp(link)}
                        disabled={sending || !sendPhone}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "6px 12px", borderRadius: 8,
                          border: sendSuccess === "whatsapp" ? "1.5px solid #25D366" : "1.5px solid #e2e8f0",
                          background: sendSuccess === "whatsapp" ? "#dcfce7" : "#fff",
                          color: sendSuccess === "whatsapp" ? "#25D366" : "#475569",
                          fontWeight: 600, fontSize: "0.75rem", cursor: "pointer",
                        }}
                      >
                        <MdWhatsapp size={14} />
                        {sendSuccess === "whatsapp" ? "Opened!" : "WhatsApp"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer
          style={{
            padding: "16px 32px",
            borderTop: "1px solid #e2e8f0",
            background: "#fff",
          }}
        >
          <Button
            variant="secondary"
            onClick={handleClose}
            style={{
              borderRadius: 10,
              padding: "8px 24px",
              fontWeight: 600,
              background: "#f1f5f9",
              border: "1.5px solid #e2e8f0",
              color: "#475569",
            }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default PaymentLinkModal;
