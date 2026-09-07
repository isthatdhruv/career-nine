"""Python port of the chosen Career-9 mail theme (shell A3) for the catalogue preview.

Blocks are tuples; `render(spec, mode)` returns (html_fragment, text_part). `mode` is
'sample' (placeholders replaced by highlighted sample values) or 'raw' ({{tokens}} left
visible). Markup is the same table+inline-style vocabulary the Java theme will emit.
"""
import html, re, pathlib

S = pathlib.Path(__file__).parent
LOGO_SRC = "data:image/png;base64," + (S / "logo-96q.b64").read_text().strip()
LOGO_CDN = "https://storage-c9.sgp1.cdn.digitaloceanspaces.com/branding/career-9-email-v1.png"

T = dict(primary="#1B5E20", accent="#66BB6A", ink="#1F2A24", muted="#5C6B62", faint="#8A9790",
         border="#DDE3DF", panel="#F3F6F4", ground="#EEF1EF", white="#FFFFFF")
FONT = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
MONO = "Consolas,'Courier New',monospace"
SUPPORT = "support@career-9.net"
SITE = "career-9.com"
SHORT = "api.career-9.com/s/Kx7Pq2M"

# ── placeholder samples ────────────────────────────────────────────────────────
SAMPLES = {
    "first_name": "Aarav", "student_name": "Aarav Sharma", "student_email": "aarav@example.com",
    "student_phone": "98765 43210", "parent_name": "Priya Sharma", "parent_email": "priya@example.com",
    "username": "20260412", "password": "15-05-2010", "dob": "15-05-2010",
    "institute_name": "Delhi Public School, Noida", "school_name": "Career-9", "class_name": "Class 10",
    "assessment_name": "Career Discovery Assessment", "plan_name": "Navigator Pro", "amount": "1,499",
    "invoice_id": "INV-2026-0142", "payment_date": "07 Sep 2026", "transaction_id": "pay_Q7x9Ab",
    "counsellor_name": "Priya Iyer", "counsellor_email": "priya.iyer@career-9.net",
    "session_date": "Thursday, 18 Sep 2026", "session_time": "4:30 – 5:00 PM IST", "session_mode": "Online (Google Meet)",
    "venue": "Room 204, Main Block", "checkin_code": "482913", "when_label": "in 2 hours",
    "old_session_date": "Tuesday, 16 Sep 2026", "old_session_time": "3:00 – 3:30 PM IST",
    "new_session_date": "Thursday, 18 Sep 2026", "new_session_time": "4:30 – 5:00 PM IST",
    "new_counsellor_name": "Rohit Verma", "changes_left": "1", "sessions_left": "1", "reason": "counsellor unavailable",
    "report_type": "Career Report", "report_name": "Career Discovery Assessment report", "released_by": "Priya Iyer",
    "digest_date": "Tuesday, 9 Sep 2026", "session_count": "3", "student_count": "3", "affected_count": "4",
    "lead_name": "Rohan Mehta", "lead_email": "rohan@example.com", "lead_phone": "98765 43210", "lead_type": "Parent",
    "lead_source": "Website", "lead_school": "Delhi Public School, Noida", "lead_city": "Indore",
    "lead_designation": "Parent", "lead_received_at": "07 Sep 2026, 10:14 AM IST", "lead_id": "1042",
    "account_name": "Notifications (Gmail API)", "provider": "GMAIL/API", "template_name": "Login credentials (default)",
    "user_name": "Meera Nair", "admin_name": "Admin", "contact_name": "Suresh Menon", "new_password": "Tq7#kd2p",
    "reset_minutes": "30", "expiry_hours": "48", "report_count": "42", "no_report_count": "3", "days_valid": "30",
    "tier_name": "Navigator Pro", "outcome": "upheld", "dispute_note": "The counsellor confirmed you joined at 4:41 PM.",
    "summary": "Explored interests in design and engineering; agreed to look at NID and IIT-Bombay IDC.",
    "next_steps": "Shortlist three design programmes before the next session.",
    "block_dates": "24 – 26 Sep 2026", "block_reason": "Conference travel",
    "leave_dates": "24 – 26 Sep 2026", "year": "2026",
    "reset_minutes": "60", "duration": "30", "cancelled_by": "the student", "sent_at": "07 Sep 2026, 11:20 AM IST",
    "student_reason": "Wants help choosing a stream after Class 10",
    "opening": "Your counsellor was unable to join your session on Tuesday, 16 Sep at 3:00 PM.",
    "next_step_lead": "Your session has been returned to your plan, so you can book again.",
    "sessions_sentence": "Your 4 upcoming sessions have been reassigned or returned to the students to rebook.",
    "report_guidance": "Read your report before the session so you can bring your questions.",
    "subject": "Career Reports for Class 10 B", "body": "Dear Mr Menon, please find attached the Career Reports for Class 10 B as discussed on the call. Do let us know a convenient time to walk the teachers through them.",
    "checkin_code": "4829", "report_type": "Navigator",
    "body_excerpt": "Dear Mr Menon, please find attached the Career Reports for Class 10 B as discussed on the",
}
# URL placeholders. `short=True` means the address is tokenised and is shortened before it
# leaves the backend, so the visible fallback is the short form.
URLS = {
    "action_link":        ("https://api.career-9.com/s/Kx7Pq2M", True),
    "assessment_link":    ("https://api.career-9.com/s/Kx7Pq2M", True),
    "resume_link":        ("https://api.career-9.com/s/Kx7Pq2M", True),
    "report_link":        ("https://api.career-9.com/s/Kx7Pq2M", True),
    "report_pdf_link":    ("https://api.career-9.com/s/Kx7Pq2M", True),
    "one_pager_link":     ("https://api.career-9.com/s/Kx7Pq2M", True),
    "dashboard_sso_link": ("https://api.career-9.com/s/Kx7Pq2M", True),
    "lms_link":           ("https://api.career-9.com/s/Kx7Pq2M", True),
    "booking_link":       ("https://api.career-9.com/s/Kx7Pq2M", True),
    "reschedule_link":    ("https://api.career-9.com/s/Kx7Pq2M", True),
    "payment_link":       ("https://api.career-9.com/s/Kx7Pq2M", True),
    "reset_link":         ("https://api.career-9.com/s/Kx7Pq2M", True),
    "calendar_link":      ("https://api.career-9.com/s/Kx7Pq2M", True),
    "upgrade_link":       ("https://api.career-9.com/s/Kx7Pq2M", True),
    "join_link":          ("https://meet.google.com/abc-defg-hij", False),
    "dashboard_link":     ("https://dashboard.career-9.com/auth", False),
    "login_link":         ("https://assessment.career-9.com/student-login", False),
    "sessions_link":      ("https://dashboard.career-9.com/counselling/my-sessions", False),
    "counsellor_portal_link": ("https://dashboard.career-9.com/counsellor/sessions", False),
    "admin_counsellors_link": ("https://dashboard.career-9.com/admin/counsellors", False),
    "admin_sessions_link":    ("https://dashboard.career-9.com/admin/counselling/sessions", False),
    "admin_leads_link":       ("https://dashboard.career-9.com/leads", False),
    "school_dashboard_link":  ("https://dashboard.career-9.com/school-dashboard", False),
    "lead_crm_link":          ("https://crm.career-9.com/web#id=1042&model=crm.lead", True),
    "site_link":              ("https://career-9.com", False),
    "referral_link":          ("https://assessment.career-9.com", False),
}
TOKEN = re.compile(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}")

def _mark(v):
    return f'<mark style="background:#fff3bf;color:#5a4a00;border-radius:3px;padding:0 3px">{html.escape(v)}</mark>'

def sub_html(text, mode):
    """Fill {{tokens}} in authored block text. Authored text is trusted HTML (inline <b>, entities)."""
    if mode == "raw":
        return text
    def r(m):
        k = m.group(1)
        if k in URLS:
            return _mark(display_url(k))
        return _mark(SAMPLES.get(k, "⟨" + k + "⟩"))
    return TOKEN.sub(r, text)

def sub_text(text):
    """Plain-text substitution (sample values, no markup)."""
    def r(m):
        k = m.group(1)
        if k in URLS:
            return display_url(k)
        return SAMPLES.get(k, "<" + k + ">")
    t = TOKEN.sub(r, text)
    t = re.sub(r"<[^>]+>", "", t)
    return html.unescape(t)

def display_url(key):
    href, short = URLS[key]
    return SHORT if short else re.sub(r"^https?://", "", href)

def href_url(key, mode):
    if mode == "raw":
        return "{{" + key + "}}"
    return URLS[key][0]

# ── blocks ─────────────────────────────────────────────────────────────────────
def b_title(t, m):
    return f'<h1 style="margin:0 0 14px;font-family:{FONT};font-size:20px;line-height:1.3;font-weight:700;color:{T["ink"]};">{sub_html(t,m)}</h1>'
def b_p(t, m):
    return f'<p style="margin:0 0 14px;font-family:{FONT};font-size:15px;line-height:1.6;color:{T["ink"]};">{sub_html(t,m)}</p>'
def b_small(t, m):
    return f'<p style="margin:0 0 14px;font-family:{FONT};font-size:13px;line-height:1.6;color:{T["muted"]};">{sub_html(t,m)}</p>'
def b_details(rows, m):
    tr = "".join(
        f'<tr><td style="padding:6px 12px 6px 0;width:120px;font-family:{FONT};font-size:14px;color:{T["muted"]};vertical-align:top;">{sub_html(l,m)}</td>'
        f'<td style="padding:6px 0;font-family:{FONT};font-size:14px;font-weight:700;color:{T["ink"]};vertical-align:top;">{sub_html(v,m)}</td></tr>'
        for l, v in rows)
    return (f'<div style="background:{T["panel"]};border:1px solid {T["border"]};border-radius:4px;padding:10px 16px;margin:4px 0 18px;">'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{tr}</table></div>')
def b_credentials(rows, caption, m):
    tr = "".join(
        f'<tr><td style="padding:5px 12px 5px 0;width:120px;font-family:{FONT};font-size:14px;color:{T["muted"]};vertical-align:top;">{sub_html(l,m)}</td>'
        f'<td style="padding:5px 0;font-family:{MONO};font-size:15px;font-weight:700;color:{T["ink"]};vertical-align:top;">{sub_html(v,m)}</td></tr>'
        for l, v in rows)
    cap = f'<div style="font-family:{FONT};font-size:12px;line-height:1.5;color:{T["muted"]};padding-top:8px;">{sub_html(caption,m)}</div>' if caption else ""
    return (f'<div style="background:{T["panel"]};border:1px solid {T["border"]};border-radius:4px;padding:12px 16px;margin:4px 0 18px;">'
            f'<div style="font-family:{FONT};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:{T["faint"]};padding-bottom:6px;">Your login details</div>'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{tr}</table>{cap}</div>')
def b_code(code, caption, m):
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr>'
            f'<td align="center" style="background:{T["panel"]};border:1px dashed {T["border"]};border-radius:4px;padding:20px 16px;">'
            f'<div style="font-family:{FONT};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:{T["faint"]};">{sub_html(caption,m)}</div>'
            f'<div style="font-family:{MONO};font-size:36px;line-height:1.2;font-weight:700;letter-spacing:10px;color:{T["primary"]};padding:10px 0 2px 10px;">{sub_html(code,m)}</div>'
            f'</td></tr></table>')
def b_button(url_key, label, m):
    return (f'<a href="{html.escape(href_url(url_key,m))}" style="display:inline-block;background:{T["primary"]};color:#FFFFFF;font-family:{FONT};'
            f'font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:4px;">{html.escape(label)}</a>')
def b_action(url_key, label, m):
    disp = "{{" + url_key + "}}" if m == "raw" else display_url(url_key)
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr><td>{b_button(url_key,label,m)}</td></tr>'
            f'<tr><td style="padding-top:10px;font-family:{FONT};font-size:12px;line-height:1.5;color:{T["faint"]};">Or open: '
            f'<a href="{html.escape(href_url(url_key,m))}" style="color:{T["primary"]};text-decoration:underline;">{html.escape(disp)}</a></td></tr></table>')
def b_outline(url_key, label, m):
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:-6px 0 18px;"><tr><td>'
            f'<a href="{html.escape(href_url(url_key,m))}" style="display:inline-block;border:1px solid {T["primary"]};color:{T["primary"]};font-family:{FONT};'
            f'font-size:13px;font-weight:700;text-decoration:none;padding:10px 24px;border-radius:4px;">{html.escape(label)}</a></td></tr></table>')
def b_notice(t, m):
    return (f'<div style="border-left:3px solid {T["accent"]};background:{T["panel"]};padding:10px 14px;margin:0 0 18px;'
            f'font-family:{FONT};font-size:14px;line-height:1.55;color:{T["ink"]};">{sub_html(t,m)}</div>')
def b_list(items, m):
    rows = "".join(
        f'<tr><td style="width:18px;vertical-align:top;padding:3px 0;font-family:{FONT};font-size:14px;color:{T["accent"]};">&#9679;</td>'
        f'<td style="padding:3px 0;font-family:{FONT};font-size:14px;line-height:1.55;color:{T["ink"]};">{sub_html(i,m)}</td></tr>' for i in items)
    return f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">{rows}</table>'
def b_steps(items, m):
    rows = ""
    for n, (h, t) in enumerate(items, 1):
        rows += (f'<tr><td style="width:30px;vertical-align:top;padding:4px 10px 4px 0;font-family:{FONT};font-size:13px;font-weight:700;color:{T["primary"]};">{n}.</td>'
                 f'<td style="padding:4px 0;font-family:{FONT};font-size:14px;line-height:1.5;color:{T["ink"]};"><b>{sub_html(h,m)}</b><br>'
                 f'<span style="color:{T["muted"]};">{sub_html(t,m)}</span></td></tr>')
    return f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">{rows}</table>'
def b_table(header, rows, m):
    th = "".join(f'<th align="left" style="padding:7px 10px;font-family:{FONT};font-size:12px;font-weight:700;color:{T["muted"]};background:{T["panel"]};border-bottom:1px solid {T["border"]};">{sub_html(h,m)}</th>' for h in header)
    trs = "".join("<tr>" + "".join(f'<td style="padding:7px 10px;font-family:{FONT};font-size:13.5px;color:{T["ink"]};border-bottom:1px solid {T["border"]};vertical-align:top;">{sub_html(c,m)}</td>' for c in r) + "</tr>" for r in rows)
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {T["border"]};border-radius:4px;margin:4px 0 18px;">'
            f'<tr>{th}</tr>{trs}</table>')
def b_linkline(links, prefix, m):
    parts = " &middot; ".join(
        f'<a href="{html.escape(href_url(k,m))}" style="color:{T["primary"]};font-weight:700;text-decoration:underline;">{html.escape(l)}</a>' for k, l in links)
    pre = (sub_html(prefix, m) + " ") if prefix else ""
    return f'<p style="margin:-6px 0 16px;font-family:{FONT};font-size:13px;line-height:1.6;color:{T["muted"]};">{pre}{parts}</p>'
def b_signature(m):
    return f'<p style="margin:22px 0 0;font-family:{FONT};font-size:15px;line-height:1.6;color:{T["ink"]};">Regards,<br><b>Career-9 Team</b></p>'
def b_internal(t, m):
    return (f'<p style="margin:-4px 0 14px;font-family:{FONT};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:{T["faint"]};">'
            f'Internal &middot; {sub_html(t,m)}</p>')

BLOCKS = {
    "title": lambda a, m: b_title(a[0], m),
    "p": lambda a, m: b_p(a[0], m),
    "small": lambda a, m: b_small(a[0], m),
    "details": lambda a, m: b_details(a[0], m),
    "credentials": lambda a, m: b_credentials(a[0], a[1] if len(a) > 1 else "", m),
    "code": lambda a, m: b_code(a[0], a[1], m),
    "action": lambda a, m: b_action(a[0], a[1], m),
    "outline": lambda a, m: b_outline(a[0], a[1], m),
    "notice": lambda a, m: b_notice(a[0], m),
    "list": lambda a, m: b_list(a[0], m),
    "steps": lambda a, m: b_steps(a[0], m),
    "table": lambda a, m: b_table(a[0], a[1], m),
    "linkline": lambda a, m: b_linkline(a[0], a[1] if len(a) > 1 else "", m),
    "signature": lambda a, m: b_signature(m),
    "internal": lambda a, m: b_internal(a[0], m),
}

# ── shell A3 ───────────────────────────────────────────────────────────────────
def shell(preheader, body, m, logo=LOGO_SRC):
    pre = (f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{sub_html(preheader,m)}'
           f'&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>')
    footer = (f'Career-9 &middot; Ensuring Career Success<br>'
              f'Questions? Write to <a href="mailto:{SUPPORT}" style="color:{T["primary"]};text-decoration:underline;">{SUPPORT}</a><br>'
              f'&copy; 2026 Career-9. All rights reserved. &middot; <a href="https://{SITE}" style="color:{T["primary"]};text-decoration:none;">{SITE}</a>')
    return (pre
        + f'<div style="background:{T["ground"]};padding:32px 12px;">'
        + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
        + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">'
        + f'<tr><td style="background:{T["primary"]};height:8px;font-size:0;line-height:0;border-radius:6px 6px 0 0;">&nbsp;</td></tr>'
        + f'<tr><td style="background:{T["white"]};border:1px solid {T["border"]};border-top:none;padding:16px 28px;">'
        + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
        + f'<td style="vertical-align:middle;"><img src="{logo}" width="127" height="48" alt="Career-9" style="display:block;border:0;"></td>'
        + f'<td align="right" style="vertical-align:middle;font-family:{FONT};font-size:12px;color:{T["faint"]};">Help: '
        + f'<a href="mailto:{SUPPORT}" style="color:{T["faint"]};text-decoration:none;">{SUPPORT}</a></td>'
        + '</tr></table></td></tr>'
        + f'<tr><td style="background:{T["white"]};border:1px solid {T["border"]};border-top:1px solid {T["border"]};border-radius:0 0 6px 6px;padding:28px 28px 24px;">{body}</td></tr>'
        + f'<tr><td style="padding:16px 4px 0;font-family:{FONT};font-size:12px;line-height:1.7;color:{T["faint"]};">{footer}</td></tr>'
        + '</table></td></tr></table></div>')

PV_RESET = "<style>:host{display:block;background:#EEF1EF;color:#1F2A24;font:14px/1.5 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;overflow-wrap:anywhere}img{max-width:100%}table{max-width:100%}</style>"

def render_html(spec, mode="sample"):
    body = "".join(BLOCKS[b[0]](b[1:], mode) for b in spec["blocks"])
    return PV_RESET + shell(spec["pre"], body, mode)

# ── plain-text part ────────────────────────────────────────────────────────────
def render_text(spec):
    out = []
    for b in spec["blocks"]:
        k, a = b[0], b[1:]
        if k == "title": out += [sub_text(a[0]).upper(), ""]
        elif k in ("p", "small", "notice"): out += [sub_text(a[0]), ""]
        elif k == "internal": out += ["[Internal] " + sub_text(a[0]), ""]
        elif k in ("details",): out += [f"  {sub_text(l)}: {sub_text(v)}" for l, v in a[0]] + [""]
        elif k == "credentials": out += ["Your login details"] + [f"  {sub_text(l)}: {sub_text(v)}" for l, v in a[0]] + ([sub_text(a[1])] if len(a) > 1 and a[1] else []) + [""]
        elif k == "code": out += [f"{sub_text(a[1])}: {sub_text(a[0])}", ""]
        elif k in ("action", "outline"): out += [f"{a[1]}: {display_url(a[0])}", ""]
        elif k == "linkline": out += ([sub_text(a[1])] if len(a) > 1 and a[1] else []) + [f"  {l}: {display_url(k2)}" for k2, l in a[0]] + [""]
        elif k == "list": out += ["  - " + sub_text(i) for i in a[0]] + [""]
        elif k == "steps": out += [f"  {n}. {sub_text(h)} — {sub_text(t)}" for n, (h, t) in enumerate(a[0], 1)] + [""]
        elif k == "table": out += ["  " + " | ".join(sub_text(c) for c in r) for r in [a[0]] + a[1]] + [""]
        elif k == "signature": out += ["Regards,", "Career-9 Team", ""]
    out += ["--", "Career-9 · Ensuring Career Success", f"Questions? Write to {SUPPORT}", f"© 2026 Career-9. All rights reserved. · {SITE}"]
    return "\n".join(out)

def check_rules(spec):
    """Rule checks the catalogue reports per mail (the same ones the build test will run)."""
    problems = []
    kinds = [b[0] for b in spec["blocks"]]
    if kinds.count("action") > 1: problems.append(f"{kinds.count('action')} primary buttons (rule 5 allows one)")
    if kinds.count("outline") > 1: problems.append("more than one secondary button")
    if not spec.get("pre"): problems.append("no preheader")
    if len(sub_text(spec.get("pre", ""))) > 90: problems.append("preheader over 90 characters")
    if len(sub_text(spec["subject"])) > 60: problems.append("subject over 60 characters")
    if "!" in spec["subject"]: problems.append("exclamation mark in subject")
    joined = " ".join(str(x) for b in spec["blocks"] for x in b[1:])
    if re.search(r"https?://", joined): problems.append("raw URL in body text")
    if re.search(r"reply to this (e-?mail|address)|do not reply|don.t reply", joined, re.I): problems.append("body talks about replying (rule 8)")
    return problems
