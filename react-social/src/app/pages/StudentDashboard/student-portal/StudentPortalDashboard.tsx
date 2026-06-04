import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../modules/auth/core/Auth";
import { ReadStudentByIdData } from "../../StudentRegistration/Student_APIs";
import {
  getDashboardCheckoutOptions,
  createDashboardCheckoutLink,
  DashboardTierOption,
} from "./checkoutApi";
import "./StudentPortalDashboard.css";

type Plan = {
  name: string;
  tagline: string;
  price: string;
  priceNum: number;
  features: string[];
  btnClass: "plan-btn-primary" | "plan-btn-outline";
  popular: boolean;
};

type NavigatorId = "insight" | "stream" | "career";

const PLANS: Plan[] = [
  {
    name: "Basic",
    tagline: "For students starting their career discovery journey.",
    price: "1,499",
    priceNum: 1499,
    features: [
      "6D Career Assessment – Discover your strengths in Personality, Interests, Abilities, Intelligence, Values & Knowledge",
      "AI-Powered 18-Page Career Report – Simple and personalized insights on top career matches and subjects",
    ],
    btnClass: "plan-btn-outline",
    popular: false,
  },
  {
    name: "Essential",
    tagline: "For students seeking quick clarity and personalized direction.",
    price: "3,599",
    priceNum: 3599,
    features: [
      "6D Career Assessment – Uncover your strengths in Personality, Interests, Abilities, Intelligence, Values & Knowledge",
      "AI-Powered 18-Page Career Report – Get personalized career matches, subjects, and actionable insights",
      "1-on-1 Counselling – Expert session to discuss your report and map out clear next steps",
      "Career Path Suggestions – Tailored recommendations for subjects, skills, and career options",
    ],
    btnClass: "plan-btn-primary",
    popular: true,
  },
  {
    name: "Value for Money",
    tagline: "For students who want deep clarity and guided mentorship.",
    price: "6,299",
    priceNum: 6299,
    features: [
      "6D Core Assessment – Discover your Personality, Interests, Abilities, Intelligence, Values & Knowledge",
      "AI-Powered 18-Page Career Report – Get personalized matches, subjects & action insights",
      "3 Progressive 1-on-1 Counselling Sessions – Step-by-step guidance from expert psychologists",
      "Action-Based Mentorship – Ongoing support to turn insights into results",
    ],
    btnClass: "plan-btn-primary",
    popular: false,
  },
];

const CLASSES: Array<{ id: string; label: string; sub: string; icon: string; color: string }> = [
  { id: "6", label: "Class 6th", sub: "Middle School", icon: "fas fa-graduation-cap", color: "#1a6b3c" },
  { id: "7", label: "Class 7th", sub: "Middle School", icon: "fas fa-book-open", color: "#3b82f6" },
  { id: "8", label: "Class 8th", sub: "Middle School", icon: "fas fa-microscope", color: "#8b5cf6" },
  { id: "9", label: "Class 9th", sub: "High School", icon: "fas fa-rocket", color: "#ef4444" },
  { id: "10", label: "Class 10th", sub: "High School", icon: "fas fa-trophy", color: "#f59e0b" },
  { id: "11", label: "Class 11th", sub: "Senior Secondary", icon: "fas fa-bolt", color: "#f5a623" },
  { id: "12", label: "Class 12th", sub: "Senior Secondary", icon: "fas fa-star", color: "#fbbf24" },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How long is each counselling session?",
    a: "Each 1-on-1 counselling session lasts 45-60 minutes. You'll have dedicated time with your Navigator to walk through your assessment results, discuss career options, and get your questions answered in depth.",
  },
  {
    q: "Can my parents join the session?",
    a: "Yes, absolutely. Parents are welcome to join any session — and in fact, the Advanced and Premium plans include a dedicated parent session where your Navigator explains your results and answers family questions.",
  },
  {
    q: "What if I don't like my Navigator?",
    a: "No problem. You can switch to a different Navigator at any time before your first session with no questions asked. Your comfort and confidence with your counsellor matters most to us.",
  },
  {
    q: "How accurate is the career assessment?",
    a: "Our assessment is built on scientifically validated psychometric frameworks and has been refined with data from 5,000+ students. It's reviewed and interpreted by certified psychologists to ensure accuracy and relevance to Indian career contexts.",
  },
  {
    q: "Do you offer refunds if I'm not satisfied?",
    a: "Yes. If you're not satisfied after your first session, we offer a full refund — no questions asked. We're confident in the value our Navigators provide.",
  },
];

function computeAge(dobStr: string): number | null {
  if (!dobStr) return null;
  let d = new Date(dobStr);
  if (isNaN(d.getTime())) {
    const parts = dobStr.split(/[-/]/);
    if (parts.length === 3) {
      d =
        parts[0].length === 4
          ? new Date(+parts[0], +parts[1] - 1, +parts[2])
          : new Date(+parts[2], +parts[1] - 1, +parts[0]);
    }
  }
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

function prettifyGender(g: string): string {
  if (!g) return "";
  const k = g.toLowerCase().charAt(0);
  if (k === "m") return "Male";
  if (k === "f") return "Female";
  if (k === "o") return "Other";
  return g;
}

function prettifyClass(k: string): string {
  if (!k) return "";
  return /^\d+$/.test(k) ? `Class ${k}` : k;
}

const StudentPortalDashboard: React.FC = () => {
  const [params] = useSearchParams();
  const { currentUser } = useAuth();
  const auth = currentUser as { name?: string } | undefined;

  const studentName = useMemo(() => {
    const fromUrl = (params.get("name") || "").trim();
    if (fromUrl) return fromUrl;
    return (auth?.name || "Student").trim();
  }, [params, auth]);

  const initials = useMemo(() => {
    return studentName
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");
  }, [studentName]);

  // Fetched student details — populated from /student/getbyid/{studentId} when the
  // dashboard is opened from Data Download (admin "view as student" flow). When the
  // page is loaded without studentId in the URL, this stays null and pills fall
  // back to URL params only.
  const [fetchedStudent, setFetchedStudent] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const sid = (params.get("studentId") || "").trim();
    if (!sid) return;
    let cancelled = false;
    ReadStudentByIdData(sid)
      .then((res) => {
        if (!cancelled) setFetchedStudent(res?.data ?? null);
      })
      .catch(() => {
        // Silent fail — pills will just fall back to URL params.
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  const metaPills = useMemo(() => {
    const studentId = (params.get("studentId") || "").trim();
    // Prefer fetched values; fall back to URL params if no fetch (or fetch failed).
    const fs = fetchedStudent || {};
    const dob = String(fs.studentDob ?? fs.dob ?? params.get("dob") ?? "").trim();
    const gender = prettifyGender(String(fs.gender ?? params.get("gender") ?? "").trim());
    const klass = prettifyClass(
      String(fs.grade ?? fs.classOrGrade ?? params.get("class") ?? params.get("grade") ?? "").trim()
    );
    const age = computeAge(dob);
    const pills: Array<{ icon: string; text: string }> = [];
    if (studentId) pills.push({ icon: "fa-id-card", text: `ID: ${studentId}` });
    if (age !== null) pills.push({ icon: "fa-birthday-cake", text: `${age} yrs` });
    if (dob) pills.push({ icon: "fa-calendar", text: `DOB: ${dob}` });
    if (gender) pills.push({ icon: "fa-venus-mars", text: gender });
    if (klass) pills.push({ icon: "fa-graduation-cap", text: klass });
    return pills;
  }, [params, fetchedStudent]);

  const [activeNav, setActiveNav] = useState<string>("home");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [activePricing, setActivePricing] = useState<NavigatorId | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{
    name: string;
    price: string;
    priceNum: number;
    navigator: NavigatorId;
    tierId?: number;
  } | null>(null);
  // Real purchasable dashboard tiers for this logged-in student (empty when the
  // student has no campaign context, e.g. school-funded). Drives whether the
  // pricing buttons trigger a real Razorpay checkout vs. show an unavailable note.
  const [dashboardTiers, setDashboardTiers] = useState<DashboardTierOption[]>([]);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDashboardCheckoutOptions()
      .then((res) => {
        if (!cancelled) setDashboardTiers(res.data?.options || []);
      })
      .catch(() => {
        // No options (not a B2C student / no campaign) — buttons fall back to an
        // "online purchase unavailable" message rather than a fake success.
        if (!cancelled) setDashboardTiers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const original = document.title;
    document.title = `Career-9 | ${studentName}'s Dashboard`;
    return () => {
      document.title = original;
    };
  }, [studentName]);

  useEffect(() => {
    const els = document.querySelectorAll(".spd-root .reveal");
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (paymentOpen || successOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [paymentOpen, successOpen]);

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleNavClick(section: string) {
    setActiveNav(section);
    if (section === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      scrollToSection(section);
    }
  }

  function handleSelectClass(id: string) {
    setSelectedClass(id);
    setTimeout(() => scrollToSection("navigators"), 350);
  }

  function togglePricing(nav: NavigatorId) {
    setActivePricing((prev) => (prev === nav ? null : nav));
    setTimeout(() => {
      const panel = document.getElementById(`pricing-${nav}`);
      if (panel) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 300);
  }

  // Pick the real purchasable tier closest in price to the marketing plan the
  // student clicked (the static plans are illustrative; the charge is always a
  // real backend tier). Falls back to the only/first available tier.
  function resolveTierFor(plan: Plan): DashboardTierOption | null {
    if (dashboardTiers.length === 0) return null;
    return dashboardTiers.reduce((best, t) =>
      Math.abs(t.priceInr - plan.priceNum) < Math.abs(best.priceInr - plan.priceNum) ? t : best
    );
  }

  function openPayment(plan: Plan, nav: NavigatorId) {
    setCheckoutError(null);
    const tier = resolveTierFor(plan);
    // When a real tier exists, show its true name/price so the modal matches what
    // will actually be charged; otherwise show the marketing plan as-is.
    setSelectedPlan({
      name: tier ? tier.name : plan.name,
      price: tier ? tier.priceInr.toLocaleString("en-IN") : plan.price,
      priceNum: tier ? tier.priceInr : plan.priceNum,
      navigator: nav,
      tierId: tier?.campaignAssessmentTierId,
    });
    setPaymentOpen(true);
  }

  function processPayment() {
    if (!selectedPlan) return;
    setCheckoutError(null);
    if (!selectedPlan.tierId) {
      setCheckoutError(
        "Online purchase isn't available for your account yet. Please contact support to unlock your dashboard."
      );
      return;
    }
    setCheckoutBusy(true);
    const returnUrl = `${window.location.origin}/student/payment-return`;
    createDashboardCheckoutLink(selectedPlan.tierId, returnUrl)
      .then((res) => {
        const url = res.data?.shortUrl;
        if (url) {
          // Stash the link id so the return page can confirm payment even if
          // Razorpay's redirect query is stripped. The return page then polls
          // until the entitlement activates and routes into the dashboard.
          if (res.data?.razorpayLinkId) {
            try {
              localStorage.setItem("c9_pending_dashboard_checkout", res.data.razorpayLinkId);
            } catch {
              /* ignore storage failures */
            }
          }
          // Hand off to Razorpay's hosted checkout. On return, the webhook will
          // have activated the entitlement and the dashboard gate unlocks.
          window.location.href = url;
        } else {
          setCheckoutBusy(false);
          setCheckoutError("Could not start checkout. Please try again.");
        }
      })
      .catch((err) => {
        setCheckoutBusy(false);
        setCheckoutError(err?.response?.data?.error || "Could not start checkout. Please try again.");
      });
  }

  function showSuccess() {
    setSuccessOpen(true);
    launchConfetti();
  }

  function launchConfetti() {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#1a6b3c", "#2d9a5a", "#f5a623", "#ffc857", "#4ade80", "#3b82f6", "#7b3a2e"];
    type Piece = { x: number; y: number; w: number; h: number; color: string; vx: number; vy: number; rot: number; rotV: number; opacity: number };
    const pieces: Piece[] = [];
    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: 7 + Math.random() * 5,
        h: 4 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 3,
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 8,
        opacity: 1,
      });
    }
    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      pieces.forEach((c) => {
        c.x += c.vx;
        c.y += c.vy;
        c.rot += c.rotV;
        c.vy += 0.04;
        if (frame > 50) c.opacity -= 0.01;
        if (c.opacity > 0 && c.y < canvas.height + 50) {
          alive = true;
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate((c.rot * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, c.opacity);
          ctx.fillStyle = c.color;
          ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
          ctx.restore();
        }
      });
      frame++;
      if (alive) requestAnimationFrame(animate);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    animate();
  }

  return (
    <div className="spd-root">
      <canvas ref={confettiCanvasRef} className="spd-confetti-canvas" />

      <nav className="spd-sidebar">
        <div className="spd-sidebar-logo">C9</div>
        <div className="spd-sidebar-nav">
          {[
            { id: "home", icon: "fas fa-home", tip: "Dashboard" },
            { id: "class-select", icon: "fas fa-graduation-cap", tip: "Select Class" },
            { id: "navigators", icon: "fas fa-compass", tip: "Navigators" },
            { id: "how", icon: "fas fa-route", tip: "How It Works" },
            { id: "report-preview", icon: "fas fa-file-alt", tip: "Sample Report" },
            { id: "faq", icon: "fas fa-question-circle", tip: "FAQs" },
            { id: "support", icon: "fas fa-headset", tip: "Support" },
          ].map((item) => (
            <div
              key={item.id}
              className={`spd-nav-item ${activeNav === item.id ? "active" : ""}`}
              onClick={() => handleNavClick(item.id)}
            >
              <i className={item.icon} />
              <span className="spd-tooltip">{item.tip}</span>
            </div>
          ))}
        </div>
        <div className="spd-sidebar-bottom">
          <div className="spd-nav-item">
            <i className="fas fa-cog" />
            <span className="spd-tooltip">Settings</span>
          </div>
          <div className="spd-sidebar-avatar">{initials}</div>
        </div>
      </nav>

      <main className="spd-main">
        <div className="spd-top-bar">
          <div className="spd-breadcrumb">
            <i className="fas fa-home" style={{ fontSize: 12 }} />
            Dashboard <i className="fas fa-chevron-right" style={{ fontSize: 9 }} />{" "}
            <span>Home</span>
          </div>
          <div className="spd-top-actions">
            <div className="spd-search-box">
              <i className="fas fa-search" />
              <input type="text" placeholder="Search navigators, plans..." />
            </div>
            <div className="spd-notif-btn">
              <i className="fas fa-bell" />
              <div className="spd-notif-dot" />
            </div>
          </div>
        </div>

        {/* Hero */}
        <section className="hero-welcome" id="home">
          <div className="hero-content">
            <div className="hero-badge">
              <i className="fas fa-graduation-cap" /> Welcome to Career-9
            </div>
            <p className="hero-greeting">Hi there!</p>
            <h1 className="hero-title">
              <span>{studentName}</span>,<br />
              Let's start your <span className="spd-highlight">career journey</span>
            </h1>
            {metaPills.length > 0 && (
              <div className="hero-meta">
                {metaPills.map((p, i) => (
                  <span key={i} className="hero-meta-item">
                    <i className={`fas ${p.icon}`} />
                    {p.text}
                  </span>
                ))}
              </div>
            )}
            <p className="hero-subtitle">
              Discover your strengths, align your passions, and map the perfect career path with our
              AI-powered navigators.
            </p>
            <div className="hero-next">
              <div className="hero-next-label">
                <i className="fas fa-bolt" /> Your Next Step
              </div>
              <div className="hero-next-text">
                Select your class below and pick a Navigator to begin your 1-on-1 career counselling
                journey.
              </div>
              <button
                className="cta-btn cta-btn-primary"
                style={{ marginTop: 4 }}
                onClick={() => scrollToSection("class-select")}
              >
                Get Started <i className="fas fa-arrow-right" />
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="assess-card">
              <div className="assess-card-head">
                <div className="assess-icon-wrap">
                  <i className="fas fa-clipboard-list" />
                </div>
                <div>
                  <div className="assess-card-title">Career Assessment</div>
                  <div className="assess-card-sub">Discover your strengths</div>
                </div>
                <div className="assess-badge">
                  <i className="fas fa-sparkles" /> New
                </div>
              </div>
              <div className="assess-progress">
                <div className="assess-progress-head">
                  <span>Sample Preview</span>
                  <span className="assess-pct">68%</span>
                </div>
                <div className="assess-bar">
                  <div className="assess-bar-fill" />
                </div>
              </div>
              <div className="assess-dims">
                {[
                  { label: "Personality", icon: "fas fa-user", bg: "#e8f5ee", color: "#1a6b3c", pct: 85 },
                  { label: "Interests", icon: "fas fa-heart", bg: "#fff3dc", color: "#f5a623", pct: 72 },
                  { label: "Abilities", icon: "fas fa-bolt", bg: "#eff6ff", color: "#3b82f6", pct: 90 },
                  { label: "Intelligence", icon: "fas fa-brain", bg: "#f5f0ff", color: "#8b5cf6", pct: 78 },
                ].map((d) => (
                  <div className="assess-dim" key={d.label}>
                    <div className="dim-ico" style={{ background: d.bg, color: d.color }}>
                      <i className={d.icon} />
                    </div>
                    <div className="dim-info">
                      <div className="dim-label">{d.label}</div>
                      <div className="dim-bar">
                        <div style={{ width: `${d.pct}%`, background: d.color }} />
                      </div>
                    </div>
                    <div className="dim-score">{d.pct}</div>
                  </div>
                ))}
              </div>
              <div className="assess-foot">
                <div className="assess-foot-left">
                  <i className="fas fa-shield-alt" /> Verified by certified psychologists
                </div>
                <div className="assess-foot-right">
                  <i className="fas fa-lock" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Journey Tracker */}
        <section className="journey-tracker reveal">
          <div className="tracker-label">Your career counselling journey</div>
          <div className="tracker-steps">
            {[
              { state: "done", icon: "fas fa-check", label: "Registration" },
              { state: "done", icon: "fas fa-check", label: "Class Selection" },
              { state: "active", icon: "fas fa-user-tie", label: "Choose Navigator" },
              { state: "", icon: "fas fa-credit-card", label: "Payment" },
              { state: "", icon: "fas fa-video", label: "Sessions" },
            ].map((s, i) => (
              <div key={i} className={`tracker-step ${s.state}`}>
                <div className="tracker-dot">
                  <i className={s.icon} />
                </div>
                <div className="tracker-step-label">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Trust */}
        <div className="trust-strip">
          <div className="trust-badge">
            <i className="fas fa-shield-alt" /> Trusted by 5000+ students
          </div>
          <div className="trust-badge">
            <i className="fas fa-award" /> Certified psychologists
          </div>
          <div className="trust-badge">
            <i className="fas fa-lock" /> 100% secure &amp; private
          </div>
          <div className="trust-badge">
            <i className="fas fa-star" /> 4.9/5 parent rating
          </div>
        </div>

        {/* Class Selector */}
        <section className="class-selector reveal" id="class-select">
          <div className="section-header">
            <div>
              <h2 className="section-title">Select Your Class</h2>
              <p className="section-subtitle">Choose your current grade to see relevant navigators</p>
            </div>
          </div>
          <div className="class-grid">
            {CLASSES.map((c) => (
              <div
                key={c.id}
                className={`class-card ${selectedClass === c.id ? "selected" : ""}`}
                onClick={() => handleSelectClass(c.id)}
              >
                <div className="check-badge">
                  <i className="fas fa-check" />
                </div>
                <div className="class-card-icon">
                  <i className={c.icon} style={{ color: c.color }} />
                </div>
                <div className="class-card-label">{c.label}</div>
                <div className="class-card-sub">{c.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Navigators */}
        <section className="navigators-section reveal" id="navigators">
          <div className="section-header">
            <div>
              <h2 className="section-title">Your Career Navigators</h2>
              <p className="section-subtitle">One Journey. Three Milestones. A Future That Fits.</p>
            </div>
          </div>

          <div className="nav-cards-grid">
            {(
              [
                {
                  id: "insight",
                  icon: "fas fa-lightbulb",
                  range: "Class 6th - 8th",
                  title: "Insight Navigator",
                  desc: "Reveal hidden strengths & ignite love for learning. The first step in understanding who your child truly is and what makes them unique.",
                  tags: ["Personality Analysis", "Interest Mapping", "Strength Discovery"],
                },
                {
                  id: "stream",
                  icon: "fas fa-route",
                  range: "Class 9th & 10th",
                  title: "Stream Navigator",
                  desc: "Match talents to the subjects that set them up for success. Make the right stream choice that aligns with strengths and goals.",
                  tags: ["Subject Matching", "Stream Selection", "Aptitude Test"],
                },
                {
                  id: "career",
                  icon: "fas fa-rocket",
                  range: "Class 11th & 12th",
                  title: "Career Navigator",
                  desc: "Pinpoint best-fit careers and the courses that get them there. The definitive guide to career and college decisions.",
                  tags: ["Career Mapping", "College Guidance", "Mentorship"],
                },
              ] as Array<{ id: NavigatorId; icon: string; range: string; title: string; desc: string; tags: string[] }>
            ).map((n) => (
              <div key={n.id} className={`navigator-card ${n.id}`} onClick={() => togglePricing(n.id)}>
                <div className="nav-card-header">
                  <div className="nav-card-icon">
                    <i className={n.icon} />
                  </div>
                  <div className="nav-card-badge">{n.range}</div>
                </div>
                <h3 className="nav-card-title">{n.title}</h3>
                <p className="nav-card-desc">{n.desc}</p>
                <div className="nav-card-features">
                  {n.tags.map((t) => (
                    <span key={t} className="nav-feature-tag">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="nav-card-cta">
                  <button
                    className="cta-btn cta-btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePricing(n.id);
                    }}
                  >
                    View Plans <i className="fas fa-arrow-right" />
                  </button>
                  <div className="nav-card-arrow">
                    <i className="fas fa-chevron-down" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(["insight", "stream", "career"] as NavigatorId[]).map((nav) => (
            <div
              key={nav}
              id={`pricing-${nav}`}
              className={`pricing-panel ${activePricing === nav ? "active" : ""}`}
            >
              <div className="pricing-panel-inner">
                <h3 className="pricing-panel-title">
                  Choose Your {nav.charAt(0).toUpperCase() + nav.slice(1)} Plan
                </h3>
                <p className="pricing-panel-subtitle">
                  {nav === "insight"
                    ? "Pick the plan that fits your discovery journey"
                    : nav === "stream"
                    ? "Find the right plan for your stream selection"
                    : "Invest in your future with the right career guidance"}
                </p>
                <div className="free-plan-banner">
                  <div className="free-plan-info">
                    <h4>
                      Free Plan <span>Current Plan</span>
                    </h4>
                    <div className="free-plan-features">
                      <span>
                        <i className="fas fa-check-double" /> One pager AI report
                      </span>
                      <span>
                        <i className="fas fa-check-double" /> Free Assessment
                      </span>
                    </div>
                  </div>
                </div>
                <div className="pricing-grid">
                  {PLANS.map((plan) => (
                    <div key={plan.name} className={`plan-card ${plan.popular ? "popular" : ""}`}>
                      <div className="plan-name">{plan.name}</div>
                      <div className="plan-tagline">{plan.tagline}</div>
                      <div className="plan-price">
                        <span className="plan-currency">₹</span>
                        <span className="plan-amount">{plan.price}</span>
                      </div>
                      <ul className="plan-features">
                        {plan.features.map((f, i) => (
                          <li key={i}>
                            <i className="fas fa-check-double" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        className={`plan-btn ${plan.btnClass}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openPayment(plan, nav);
                        }}
                      >
                        Choose {plan.name} <i className="fas fa-arrow-right" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* How It Works */}
        <section className="how-section reveal" id="how">
          <div className="section-header">
            <div>
              <h2 className="section-title">How It Works</h2>
              <p className="section-subtitle">Three simple steps to clarity</p>
            </div>
          </div>
          <div className="how-wrap">
            <div className="how-row">
              <div className="how-step">
                <div className="how-step-ico" data-step="1">
                  <i className="fas fa-clipboard-list" />
                </div>
                <h4>Take the Assessment</h4>
                <p>Answer scientifically designed questions about your personality, interests, and abilities.</p>
                <span className="how-time">
                  <i className="far fa-clock" /> 30-40 min
                </span>
              </div>
              <div className="how-connector">
                <svg viewBox="0 0 80 24" preserveAspectRatio="none">
                  <line className="dash" x1="0" y1="12" x2="68" y2="12" />
                  <polygon className="arrow" points="68,5 80,12 68,19" />
                </svg>
              </div>
              <div className="how-step">
                <div className="how-step-ico" data-step="2" style={{ color: "#3b82f6", borderColor: "#bfdbfe" }}>
                  <i className="fas fa-file-alt" />
                </div>
                <h4>Get Your Report</h4>
                <p>Receive a detailed, personalised career report with top matches and a clear roadmap.</p>
                <span className="how-time">
                  <i className="far fa-clock" /> Instant PDF
                </span>
              </div>
              <div className="how-connector">
                <svg viewBox="0 0 80 24" preserveAspectRatio="none">
                  <line className="dash" x1="0" y1="12" x2="68" y2="12" />
                  <polygon className="arrow" points="68,5 80,12 68,19" />
                </svg>
              </div>
              <div className="how-step">
                <div className="how-step-ico" data-step="3" style={{ color: "#f5a623", borderColor: "#fde8b8" }}>
                  <i className="fas fa-user-tie" />
                </div>
                <h4>Meet Your Navigator</h4>
                <p>Connect 1-on-1 with a certified career psychologist who explains your results.</p>
                <span className="how-time">
                  <i className="far fa-clock" /> 60-min session
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Report Preview */}
        <section className="preview-section reveal" id="report-preview">
          <div className="section-header">
            <div>
              <h2 className="section-title">See a Sample Report</h2>
              <p className="section-subtitle">Know exactly what you'll get</p>
            </div>
          </div>
          <div className="preview-wrap">
            <div className="preview-info">
              <div className="preview-badge">
                <i className="fas fa-file-pdf" /> Sample Preview
              </div>
              <h3>
                Your personalised <span>18-page career report</span>
              </h3>
              <p>
                A detailed breakdown of your strengths, top-matched careers, and the exact next steps to
                follow — delivered after your counselling session.
              </p>
              <div className="preview-features">
                <div className="preview-feat">
                  <i className="fas fa-check-circle" /> Personality &amp; strengths analysis
                </div>
                <div className="preview-feat">
                  <i className="fas fa-check-circle" /> Top 10 career matches with fit scores
                </div>
                <div className="preview-feat">
                  <i className="fas fa-check-circle" /> Recommended streams &amp; colleges
                </div>
                <div className="preview-feat">
                  <i className="fas fa-check-circle" /> Action plan for the next 6 months
                </div>
              </div>
              <button className="cta-btn cta-btn-primary" onClick={() => scrollToSection("navigators")}>
                View Full Sample <i className="fas fa-arrow-right" />
              </button>
            </div>
            <div className="preview-visual">
              <div className="preview-doc preview-doc-1">
                <div className="pd-head">
                  <div className="pd-logo">C9</div>
                  <div>
                    <div className="pd-title">Career Report</div>
                    <div className="pd-sub">Page 4 of 18</div>
                  </div>
                </div>
                <div className="pd-line med" />
                <div className="pd-line short" />
                <div className="pd-line" />
                <div className="pd-chart">
                  {[40, 70, 55, 85, 60].map((h, i) => (
                    <div key={i} className="pd-bar" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <div className="preview-doc preview-doc-2">
                <div className="pd-head">
                  <div className="pd-logo">C9</div>
                  <div>
                    <div className="pd-title">Top Career Matches</div>
                    <div className="pd-sub">Page 9 of 18</div>
                  </div>
                </div>
                <div className="pd-line" />
                <div className="pd-line med" />
                <div className="pd-line short" />
                <div className="pd-line med" />
                <div className="pd-line short" />
                <div className="pd-line" />
              </div>
              <div className="preview-lock-overlay">
                <div className="preview-lock-pill">
                  <i className="fas fa-lock" /> Unlock after session
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="faq-section reveal" id="faq">
          <div
            className="section-header"
            style={{ justifyContent: "center", textAlign: "center", flexDirection: "column", alignItems: "center" }}
          >
            <div>
              <h2 className="section-title">Frequently Asked Questions</h2>
              <p className="section-subtitle">Everything you need to know before you start</p>
            </div>
          </div>
          <div className="faq-list">
            {FAQS.map((f, i) => (
              <div key={i} className={`faq-item ${openFaq === i ? "open" : ""}`}>
                <button className="faq-q" onClick={() => setOpenFaq((cur) => (cur === i ? null : i))}>
                  {f.q}
                  <span className="faq-q-icon">
                    <i className="fas fa-plus" />
                  </span>
                </button>
                <div className="faq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured In */}
        <section className="featured-section reveal">
          <div className="featured-label">Trusted &amp; featured by</div>
          <div className="featured-logos">
            <div className="featured-logo">
              <i className="fas fa-newspaper" /> The Hindu
            </div>
            <div className="featured-logo">
              <i className="fas fa-broadcast-tower" /> YourStory
            </div>
            <div className="featured-logo">
              <i className="fas fa-graduation-cap" /> EdTech Review
            </div>
            <div className="featured-logo">
              <i className="fas fa-certificate" /> ISO Certified
            </div>
            <div className="featured-logo">
              <i className="fas fa-shield-alt" /> ICF Accredited
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="footer-cta reveal">
          <h2>
            Ready to discover your <span>true potential</span>?
          </h2>
          <p>
            Join thousands of students who have found their perfect career path with Career-9's
            AI-powered guidance.
          </p>
          <button
            className="cta-btn cta-btn-primary"
            style={{ margin: "0 auto" }}
            onClick={() => scrollToSection("navigators")}
          >
            Start Your Journey <i className="fas fa-arrow-right" />
          </button>
        </section>

        {/* Help */}
        <section className="help-card reveal" id="support">
          <div className="help-card-head">
            <i className="fas fa-headset" />
            <h3>Need Help?</h3>
          </div>
          <p>Our team is here 7 days a week to guide you through your career journey.</p>
          <div className="help-actions">
            <button type="button" className="help-btn">
              <i className="fas fa-comments" /> Chat with Support
              <i className="fas fa-chevron-right" />
            </button>
            <button type="button" className="help-btn">
              <i className="fas fa-phone" /> Talk to an Advisor
              <i className="fas fa-chevron-right" />
            </button>
            <button type="button" className="help-btn">
              <i className="fas fa-book" /> Browse FAQs
              <i className="fas fa-chevron-right" />
            </button>
          </div>
        </section>
      </main>

      {/* Payment Popup */}
      <div
        className={`popup-overlay ${paymentOpen ? "active" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPaymentOpen(false);
        }}
      >
        <div className="popup-card">
          <div className="popup-close" onClick={() => setPaymentOpen(false)}>
            <i className="fas fa-times" />
          </div>
          <div className="popup-icon">
            <i className="fas fa-credit-card" />
          </div>
          <h3 className="popup-title">
            You've chosen the <span className="popup-plan-name">{selectedPlan?.name || "Essential"}</span> Plan
          </h3>
          <p className="popup-desc">
            Get personalized career assessment, AI-powered report, and expert guidance to discover your
            ideal career path.
          </p>
          <div className="popup-price-display">₹ {selectedPlan?.price || "3,599"}</div>
          {checkoutError && (
            <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{checkoutError}</div>
          )}
          <button className="popup-pay-btn" onClick={processPayment} disabled={checkoutBusy}>
            <i className="fas fa-lock" />{" "}
            {checkoutBusy ? "Starting checkout…" : "Proceed to Payment"}
          </button>
          <div className="popup-secure">
            <i className="fas fa-shield-alt" /> Secured by Razorpay · 100% Safe Payment
          </div>
        </div>
      </div>

      {/* Success Popup */}
      <div
        className={`popup-overlay ${successOpen ? "active" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSuccessOpen(false);
        }}
      >
        <div className="popup-card">
          <div className="popup-close" onClick={() => setSuccessOpen(false)}>
            <i className="fas fa-times" />
          </div>
          <div className="popup-icon success-icon">
            <i className="fas fa-check" style={{ fontSize: 30 }} />
          </div>
          <h3 className="popup-title" style={{ color: "var(--primary)" }}>
            Payment Successful!
          </h3>
          <p className="popup-desc">
            A confirmation email with your assessment details has been sent to your registered email
            address.
          </p>
          <div className="success-steps">
            <div className="step-label">What happens next?</div>
            <div className="step-item">
              <i className="fas fa-check-circle" /> Assessment link sent to your email
            </div>
            <div className="step-item">
              <i className="fas fa-check-circle" /> Complete the 6D Career Assessment
            </div>
            <div className="step-item">
              <i className="fas fa-check-circle" /> Receive your 18-page AI report
            </div>
          </div>
          <button className="popup-pay-btn" onClick={() => setSuccessOpen(false)}>
            <i className="fas fa-home" /> Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentPortalDashboard;
