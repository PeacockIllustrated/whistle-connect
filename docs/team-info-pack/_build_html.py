#!/usr/bin/env python3
"""Build fa_overview.html - Whistle Connect FA Product Overview"""
import re, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Load SVG data
with open('_svg_data.py', 'r', encoding='utf-8') as f:
    exec(f.read())

def wlogo(style):
    return f'<svg style="{style}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 125.98 43.32">{SVG_WHITE_INNER}</svg>'

def nlogo(style):
    return f'<svg style="{style}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 125.98 43.32">{SVG_NAVY_INNER}</svg>'

def wicon(style):
    return f'<svg style="{style}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36.96 43.37">{SVG_WHISTLE_WHITE}</svg>'

def hdr(label):
    return f'''  <div class="page-header">
    <div>{nlogo("height:9mm;width:auto;")}</div>
    <span class="section-label">{label}</span>
  </div>
  <div class="header-line"></div>'''

def ftr(n):
    return f'''  <div class="page-footer">
    <span>whistleconnect.co.uk</span>
    <span>{n}</span>
  </div>'''

# ── CSS ──
CSS = '''*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root { --navy:#1b2537; --navy-deep:#0f1720; --navy-mid:#151e2e; --navy-light:#1e2d42; --red:#cd1719; --white:#FFFFFF; --cream:#F8FAFC; --dark:#0F172A; --mid:#475569; --light:#94A3B8; --border:#E2E8F0; }
@page { size: 297mm 210mm; margin: 0; }
body { font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif; display:flex; flex-direction:column; align-items:center; background:#e5e7eb; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.page { width:297mm; height:210mm; position:relative; overflow:hidden; background:var(--white); page-break-after:always; page-break-inside:avoid; }
@media screen { .page { margin-bottom:12px; box-shadow:0 2px 12px rgba(0,0,0,0.12); } }

/* Phone - thin elegant */
.phone { display:inline-block; }
.phone-body { background:#1a1a1a; border-radius:6mm; padding:1.5mm; position:relative; box-shadow:0 2mm 10mm rgba(0,0,0,0.15), 0 0.5mm 3mm rgba(0,0,0,0.08); }
.phone-notch { width:10mm; height:1.2mm; background:#1a1a1a; border-radius:0 0 2mm 2mm; margin:-0.5mm auto 1mm; position:relative; z-index:1; }
.phone-screen { background:#f9fafb; border-radius:4.5mm; overflow:hidden; position:relative; }
.phone-home { width:8mm; height:0.8mm; background:#444; border-radius:1mm; margin:1.2mm auto 0; }
.phone.cover-size .phone-screen { width:45mm; height:90mm; }
.phone.triple .phone-screen { width:36mm; height:72mm; }
.phone.sidebar .phone-screen { width:40mm; height:82mm; }

/* Header/Footer */
.page-header { padding:10mm 22mm 0; display:flex; align-items:center; justify-content:space-between; height:18mm; }
.page-header .section-label { font-size:7.5pt; font-weight:500; color:var(--light); letter-spacing:0.04em; }
.header-line { height:2px; margin:0 22mm; background:linear-gradient(90deg, var(--red), rgba(205,23,25,0)); }
.watermark-num { position:absolute; top:18mm; right:22mm; font-size:54pt; font-weight:900; color:var(--red); opacity:0.08; line-height:1; z-index:0; }
.page-footer { position:absolute; bottom:8mm; left:22mm; right:22mm; border-top:1px solid var(--border); padding-top:3mm; display:flex; justify-content:space-between; align-items:center; font-size:7pt; color:var(--light); }
.content { padding:6mm 22mm 18mm; position:relative; z-index:1; }

/* Type */
.section-title { font-size:28pt; font-weight:800; color:var(--dark); line-height:1.1; margin-bottom:3mm; }
.section-body { font-size:9.5pt; font-weight:400; color:var(--mid); line-height:1.65; max-width:90%; }

/* Tags */
.tags { display:flex; gap:2mm; flex-wrap:wrap; margin-top:4mm; }
.tag { display:inline-block; padding:1.2mm 3mm; font-size:6.5pt; font-weight:600; border-radius:1mm; background:var(--cream); color:var(--mid); border:1px solid var(--border); }

/* Benefits */
.benefits-grid { display:grid; gap:3mm; margin-top:4mm; }
.benefits-grid.cols-2 { grid-template-columns:1fr 1fr; }
.benefits-grid.cols-4 { grid-template-columns:1fr 1fr 1fr 1fr; }
.benefit-card { background:var(--cream); border:1px solid var(--border); border-radius:2mm; padding:3.5mm 4mm; }
.benefit-card h4 { font-size:8.5pt; font-weight:700; color:var(--dark); margin-bottom:1mm; }
.benefit-card p { font-size:7pt; color:var(--mid); line-height:1.45; }

/* Callout */
.callout { background:var(--cream); border-left:3px solid var(--red); border-radius:0 2mm 2mm 0; padding:3.5mm 5mm; font-size:8.5pt; color:var(--mid); font-style:italic; line-height:1.55; margin-top:4mm; }

/* Navy box */
.navy-box { background:var(--navy); border-radius:2mm; padding:4mm 5mm; margin-top:4mm; }
.navy-box h3 { font-size:13pt; font-weight:700; color:var(--white); margin-bottom:1.5mm; }
.navy-box p { font-size:9pt; color:rgba(255,255,255,0.75); line-height:1.55; }

/* Bullet list */
.bullet-list { list-style:none; margin-top:3mm; }
.bullet-list li { position:relative; padding-left:4mm; font-size:8.5pt; color:var(--mid); line-height:1.55; margin-bottom:1.5mm; }
.bullet-list li::before { content:''; position:absolute; left:0; top:1.8mm; width:2mm; height:2mm; border-radius:50%; background:var(--red); }

/* Stat card dark */
.stat-card-dark { background:rgba(255,255,255,0.06); border-radius:2mm; padding:3mm 4mm; margin-top:3mm; }
.stat-card-dark .stat-num { font-size:16pt; font-weight:800; color:var(--white); white-space:nowrap; line-height:1.2; }
.stat-card-dark .stat-desc { font-size:7.5pt; font-weight:400; color:rgba(255,255,255,0.5); line-height:1.35; margin-top:0.5mm; }

/* Workflow */
.workflow { display:flex; align-items:center; gap:2mm; flex-wrap:wrap; }
.pill { display:inline-flex; align-items:center; padding:1.5mm 4mm; border-radius:4mm; font-size:7.5pt; font-weight:600; color:var(--white); }
.pill.gray{background:#64748B} .pill.amber{background:#F59E0B} .pill.purple{background:#7C3AED} .pill.green{background:#10B981} .pill.cyan{background:#06B6D4} .pill.red{background:#EF4444}
.arrow { font-size:10pt; color:var(--light); }

/* Tech card */
.tech-card { background:var(--cream); border:1px solid var(--border); border-radius:2mm; padding:3.5mm 4mm 3.5mm 6mm; position:relative; }
.tech-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; border-radius:2mm 0 0 2mm; }
.tech-card h4 { font-size:9pt; font-weight:700; color:var(--dark); margin-bottom:0.5mm; }
.tech-card p { font-size:7pt; color:var(--mid); line-height:1.4; }

/* CTA stat */
.cta-stat { background:var(--cream); border:1px solid var(--border); border-radius:2mm; padding:4mm 5mm; text-align:center; }
.cta-stat .num { font-size:18pt; font-weight:800; color:var(--red); }
.cta-stat .label { font-size:7.5pt; color:var(--mid); margin-top:0.5mm; }

/* Cover */
.cover { background: repeating-linear-gradient(30deg, transparent, transparent 24px, rgba(255,255,255,0.015) 24px, rgba(255,255,255,0.015) 25px), radial-gradient(ellipse at 65% 45%, rgba(30,45,66,0.6) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(21,30,46,0.5) 0%, transparent 45%), linear-gradient(155deg, #1e2d42 0%, #1b2537 35%, #151e2e 65%, #0f1720 100%); display:flex; }
.cover-accent { position:absolute; bottom:0; left:0; width:45%; height:3px; background:linear-gradient(90deg, rgba(205,23,25,0.5), transparent); }

/* Admin screen */
.admin-screen { background:var(--cream); width:100%; height:100%; display:flex; flex-direction:column; }
.admin-screen .admin-header { background:var(--navy); padding:3mm 2.5mm; color:white; font-size:7pt; font-weight:700; }
.admin-screen .admin-stats { display:grid; grid-template-columns:1fr 1fr; gap:1.5mm; padding:2mm; }
.admin-screen .admin-stat { background:white; border-radius:1mm; padding:1.5mm 2mm; text-align:center; }
.admin-screen .admin-stat .num { font-size:9pt; font-weight:800; color:var(--dark); }
.admin-screen .admin-stat .lbl { font-size:5pt; color:var(--light); font-weight:500; }
.admin-screen .admin-map { margin:1.5mm 2mm; border-radius:1mm; flex:1; display:flex; align-items:center; justify-content:center; position:relative; }
.admin-screen .admin-queue { padding:1.5mm 2mm; }
.admin-screen .admin-queue-item { background:white; border-radius:1mm; padding:1.2mm 2mm; margin-bottom:1mm; display:flex; justify-content:space-between; align-items:center; font-size:5pt; }
.admin-screen .admin-queue-item .name { font-weight:600; color:var(--dark); }
.admin-screen .admin-queue-item .badge { background:#FEF3C7; color:#92400E; padding:0.3mm 1.2mm; border-radius:0.5mm; font-size:4.5pt; font-weight:600; }'''

# ── Build HTML ──
html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Whistle Connect — FA Product Overview</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
{CSS}
</style>
</head>
<body>

<!-- PAGE 1 - COVER -->
<div class="page cover">
  <div style="width:50%;display:flex;flex-direction:column;justify-content:center;padding-left:28mm;padding-right:8mm;">
    <div>{wlogo("height:28mm;width:auto;filter:drop-shadow(0 0 20mm rgba(255,255,255,0.08));")}</div>
    <div style="width:35mm;height:1.5px;background:rgba(255,255,255,0.15);margin-top:16mm;"></div>
    <div style="font-size:7pt;font-weight:600;letter-spacing:0.3em;color:rgba(255,255,255,0.4);margin-top:5mm;">PRODUCT OVERVIEW</div>
    <div style="font-size:38pt;font-weight:900;color:white;line-height:1.05;letter-spacing:-0.03em;margin-top:5mm;">Book Referees.<br>Match Day Ready.</div>
    <div style="margin-top:5mm;">
      <span style="display:block;font-size:10.5pt;font-weight:400;color:rgba(255,255,255,0.5);line-height:1.8;">Stream referee bookings to every match.</span>
      <span style="display:block;font-size:10.5pt;font-weight:400;color:rgba(255,255,255,0.5);line-height:1.8;">Schedule availability automatically.</span>
      <span style="display:block;font-size:10.5pt;font-weight:400;color:rgba(255,255,255,0.5);line-height:1.8;">Confirm officials in seconds.</span>
      <span style="display:block;font-size:10.5pt;font-weight:400;color:rgba(255,255,255,0.5);line-height:1.8;">All from one dashboard.</span>
    </div>
  </div>
  <div style="width:50%;display:flex;align-items:center;justify-content:center;position:relative;">
    <div style="position:absolute;opacity:0.04;z-index:0;">{wicon("height:65mm;")}</div>
    <div class="phone cover-size" style="position:relative;z-index:1;transform:rotate(-5deg);">
      <div class="phone-body" style="box-shadow:0 8mm 35mm rgba(0,0,0,0.35),0 4mm 15mm rgba(0,0,0,0.3);">
        <div class="phone-screen">
          <div class="phone-notch"></div>
          <div style="background:var(--navy);padding:3mm 2.5mm 2mm;color:white;"><div style="font-size:7pt;font-weight:700;">My Bookings</div></div>
          <div style="display:flex;gap:1mm;padding:1.5mm 2mm;">
            <div style="flex:1;background:white;border-radius:1mm;padding:1.2mm;text-align:center;border-left:1.5px solid #10B981;"><div style="font-size:7pt;font-weight:800;color:#10B981;">3</div><div style="font-size:3.5pt;color:var(--light);">Active</div></div>
            <div style="flex:1;background:white;border-radius:1mm;padding:1.2mm;text-align:center;border-left:1.5px solid #7C3AED;"><div style="font-size:7pt;font-weight:800;color:#7C3AED;">5</div><div style="font-size:3.5pt;color:var(--light);">Offers</div></div>
            <div style="flex:1;background:white;border-radius:1mm;padding:1.2mm;text-align:center;border-left:1.5px solid #06B6D4;"><div style="font-size:7pt;font-weight:800;color:#06B6D4;">12</div><div style="font-size:3.5pt;color:var(--light);">Done</div></div>
          </div>
          <div style="margin:1mm 2mm;background:white;border-radius:1mm;padding:1.5mm 2mm;border-left:2px solid #10B981;"><div style="font-size:5pt;font-weight:600;color:var(--dark);">U12 Lions vs Tigers</div><div style="font-size:3.5pt;color:var(--light);">Sat 29 Mar &bull; 10:00 &bull; Confirmed</div></div>
          <div style="margin:1mm 2mm;background:white;border-radius:1mm;padding:1.5mm 2mm;border-left:2px solid #7C3AED;"><div style="font-size:5pt;font-weight:600;color:var(--dark);">U14 Eagles vs Hawks</div><div style="font-size:3.5pt;color:var(--light);">Sun 30 Mar &bull; 11:00 &bull; Offered</div></div>
          <div style="margin:1mm 2mm;background:white;border-radius:1mm;padding:1.5mm 2mm;border-left:2px solid #F59E0B;"><div style="font-size:5pt;font-weight:600;color:var(--dark);">U10 Foxes vs Wolves</div><div style="font-size:3.5pt;color:var(--light);">Sat 5 Apr &bull; 09:30 &bull; Pending</div></div>
          <div style="margin:1mm 2mm;background:white;border-radius:1mm;padding:1.5mm 2mm;border-left:2px solid #10B981;"><div style="font-size:5pt;font-weight:600;color:var(--dark);">U16 Panthers vs Jaguars</div><div style="font-size:3.5pt;color:var(--light);">Sun 6 Apr &bull; 14:00 &bull; Confirmed</div></div>
          <div style="margin:1mm 2mm;background:white;border-radius:1mm;padding:1.5mm 2mm;border-left:2px solid #F59E0B;"><div style="font-size:5pt;font-weight:600;color:var(--dark);">U12 Sharks vs Dolphins</div><div style="font-size:3.5pt;color:var(--light);">Sat 12 Apr &bull; 10:30 &bull; Pending</div></div>
          <div style="position:absolute;bottom:0;left:0;right:0;height:5mm;background:white;border-top:0.3mm solid #e5e7eb;display:flex;justify-content:space-around;align-items:center;"><div style="width:2mm;height:2mm;border-radius:0.5mm;background:var(--red);"></div><div style="width:2mm;height:2mm;border-radius:0.5mm;background:#cbd5e1;"></div><div style="width:2mm;height:2mm;border-radius:0.5mm;background:#cbd5e1;"></div><div style="width:2mm;height:2mm;border-radius:0.5mm;background:#cbd5e1;"></div></div>
        </div>
        <div class="phone-home"></div>
      </div>
    </div>
  </div>
  <div style="position:absolute;bottom:10mm;left:28mm;right:22mm;display:flex;justify-content:space-between;align-items:flex-end;">
    <div><span style="display:block;font-size:7pt;color:rgba(255,255,255,0.25);line-height:1.5;">Whistle Connect Ltd.</span><span style="display:block;font-size:7pt;color:rgba(255,255,255,0.25);line-height:1.5;">whistleconnect.co.uk &bull; hello@whistleconnect.co.uk</span></div>
    <div>{wicon("height:10mm;opacity:0.2;")}</div>
  </div>
  <div class="cover-accent"></div>
</div>

<!-- PAGE 2 - CHALLENGE -->
<div class="page">
{hdr("Product Overview &mdash; The Challenge")}
  <div class="watermark-num">02</div>
  <div class="content" style="display:flex;gap:6mm;padding-top:4mm;">
    <div style="width:45%;">
      <div style="background:var(--navy);border-radius:3mm;padding:10mm 8mm;">
        <div style="font-size:28pt;font-weight:800;color:white;line-height:1.1;">The Challenge</div>
        <div style="font-size:10pt;color:rgba(255,255,255,0.6);margin-top:4mm;line-height:1.55;">Finding referees should be the easiest part of running a club.</div>
        <div class="stat-card-dark"><div class="stat-num">73%</div><div class="stat-desc">of coaches cite finding referees as their #1 operational challenge</div></div>
        <div class="stat-card-dark"><div class="stat-num">5+ hrs</div><div class="stat-desc">per week wasted on phone calls, texts, and WhatsApp messages</div></div>
        <div class="stat-card-dark"><div class="stat-num">30%</div><div class="stat-desc">of grassroots matches affected by late referee cancellations</div></div>
      </div>
    </div>
    <div style="width:55%;">
      <p class="section-body" style="max-width:100%;margin-bottom:3mm;">Grassroots football in the UK depends on volunteer and semi-professional referees to keep matches running. But for coaches and club secretaries, finding and booking those officials is one of the most frustrating parts of the job.</p>
      <ul class="bullet-list">
        <li>Coaches rely on phone calls, WhatsApp, and word of mouth to find referees</li>
        <li>No way to check referee availability or credentials before making contact</li>
        <li>Zero visibility of which referees are free for any given match day</li>
        <li>Last-minute cancellations leave matches without qualified officials</li>
        <li>No standardised booking process across counties</li>
        <li>Hours spent coordinating when you should be coaching</li>
      </ul>
      <div class="navy-box"><h3>The Solution</h3><p>Whistle Connect replaces the friction between your clubhouse and your officials. Upload a match, search referees, send offers &mdash; and walk away. Bookings confirm automatically, messaging is built in, and you can track every match from anywhere.</p></div>
      <div class="callout" style="margin-top:3mm;">One dashboard. Every match. Every referee. Updated in seconds, not hours.</div>
    </div>
  </div>
{ftr(2)}
</div>

<!-- PAGE 3 - ROLES -->
<div class="page">
{hdr("Product Overview &mdash; Platform Roles")}
  <div class="watermark-num">03</div>
  <div class="content" style="text-align:center;">
    <div class="section-title" style="text-align:left;">One Platform, Three Roles</div>
    <p class="section-body" style="text-align:left;max-width:100%;margin-bottom:5mm;">Whistle Connect adapts to each user. Coaches manage bookings and search for officials. Referees handle offers, set availability, and track earnings. Administrators verify credentials, monitor activity, and oversee the entire county network &mdash; all from the same platform.</p>
    <div style="display:flex;justify-content:center;gap:10mm;margin-top:2mm;">
      <!-- Coach -->
      <div style="text-align:center;">
        <div class="phone triple"><div class="phone-body"><div class="phone-screen"><div class="phone-notch"></div>
          <div style="background:var(--navy);padding:2.5mm 2mm 1.5mm;color:white;"><div style="font-size:6pt;font-weight:700;">My Bookings</div></div>
          <div style="display:flex;gap:0.8mm;padding:1.2mm 1.5mm;"><div style="flex:1;background:white;border-radius:0.8mm;padding:1mm;text-align:center;"><div style="font-size:6pt;font-weight:800;color:#10B981;">3</div><div style="font-size:3pt;color:var(--light);">Active</div></div><div style="flex:1;background:white;border-radius:0.8mm;padding:1mm;text-align:center;"><div style="font-size:6pt;font-weight:800;color:#7C3AED;">5</div><div style="font-size:3pt;color:var(--light);">Offers</div></div><div style="flex:1;background:white;border-radius:0.8mm;padding:1mm;text-align:center;"><div style="font-size:6pt;font-weight:800;color:#06B6D4;">12</div><div style="font-size:3pt;color:var(--light);">Done</div></div></div>
          <div style="margin:0.8mm 1.5mm;background:white;border-radius:0.8mm;padding:1.2mm 1.5mm;border-left:1.5px solid #10B981;"><div style="font-size:4pt;font-weight:600;color:var(--dark);">U12 Lions vs Tigers</div><div style="font-size:3pt;color:var(--light);">Sat 29 Mar &bull; Confirmed</div></div>
          <div style="margin:0.8mm 1.5mm;background:white;border-radius:0.8mm;padding:1.2mm 1.5mm;border-left:1.5px solid #7C3AED;"><div style="font-size:4pt;font-weight:600;color:var(--dark);">U14 Eagles vs Hawks</div><div style="font-size:3pt;color:var(--light);">Sun 30 Mar &bull; Offered</div></div>
          <div style="margin:0.8mm 1.5mm;background:white;border-radius:0.8mm;padding:1.2mm 1.5mm;border-left:1.5px solid #F59E0B;"><div style="font-size:4pt;font-weight:600;color:var(--dark);">U10 Foxes vs Wolves</div><div style="font-size:3pt;color:var(--light);">Sat 5 Apr &bull; Pending</div></div>
          <div style="margin:0.8mm 1.5mm;background:white;border-radius:0.8mm;padding:1.2mm 1.5mm;border-left:1.5px solid #10B981;"><div style="font-size:4pt;font-weight:600;color:var(--dark);">U16 Panthers vs Jaguars</div><div style="font-size:3pt;color:var(--light);">Sun 6 Apr &bull; Confirmed</div></div>
          <div style="position:absolute;bottom:0;left:0;right:0;height:4mm;background:white;border-top:0.3mm solid #e5e7eb;display:flex;justify-content:space-around;align-items:center;"><div style="width:1.5mm;height:1.5mm;border-radius:0.4mm;background:var(--red);"></div><div style="width:1.5mm;height:1.5mm;border-radius:0.4mm;background:#cbd5e1;"></div><div style="width:1.5mm;height:1.5mm;border-radius:0.4mm;background:#cbd5e1;"></div></div>
        </div><div class="phone-home"></div></div></div>
        <div style="font-size:8pt;font-weight:700;color:var(--dark);margin-top:3mm;">Coach</div>
      </div>
      <!-- Referee -->
      <div style="text-align:center;">
        <div class="phone triple"><div class="phone-body"><div class="phone-screen"><div class="phone-notch"></div>
          <div style="background:var(--red);padding:2.5mm 2mm 1.5mm;color:white;"><div style="font-size:6pt;font-weight:700;">Offer Inbox</div></div>
          <div style="margin:1.2mm 1.5mm;background:white;border-radius:0.8mm;padding:1.5mm;"><div style="font-size:4pt;font-weight:600;color:var(--dark);">U12 Lions vs Tigers</div><div style="font-size:3pt;color:var(--light);margin-top:0.3mm;">Sat 29 Mar &bull; 10:00 &bull; Level 7</div><div style="display:flex;gap:1mm;margin-top:1mm;"><div style="font-size:3pt;padding:0.5mm 1.5mm;background:#10B981;color:white;border-radius:0.5mm;font-weight:600;">Accept</div><div style="font-size:3pt;padding:0.5mm 1.5mm;background:#EF4444;color:white;border-radius:0.5mm;font-weight:600;">Decline</div></div></div>
          <div style="margin:1.2mm 1.5mm;background:white;border-radius:0.8mm;padding:1.5mm;"><div style="font-size:4pt;font-weight:600;color:var(--dark);">U16 Panthers vs Jaguars</div><div style="font-size:3pt;color:var(--light);margin-top:0.3mm;">Sun 6 Apr &bull; 14:00 &bull; Level 6</div><div style="display:flex;gap:1mm;margin-top:1mm;"><div style="font-size:3pt;padding:0.5mm 1.5mm;background:#10B981;color:white;border-radius:0.5mm;font-weight:600;">Accept</div><div style="font-size:3pt;padding:0.5mm 1.5mm;background:#EF4444;color:white;border-radius:0.5mm;font-weight:600;">Decline</div></div></div>
          <div style="margin:1.2mm 1.5mm;background:white;border-radius:0.8mm;padding:1.5mm;"><div style="font-size:4pt;font-weight:600;color:var(--dark);">U10 Foxes vs Wolves</div><div style="font-size:3pt;color:var(--light);margin-top:0.3mm;">Sat 5 Apr &bull; 09:30 &bull; Level 7</div><div style="display:flex;gap:1mm;margin-top:1mm;"><div style="font-size:3pt;padding:0.5mm 1.5mm;background:#10B981;color:white;border-radius:0.5mm;font-weight:600;">Accept</div><div style="font-size:3pt;padding:0.5mm 1.5mm;background:#EF4444;color:white;border-radius:0.5mm;font-weight:600;">Decline</div></div></div>
          <div style="position:absolute;bottom:0;left:0;right:0;height:4mm;background:white;border-top:0.3mm solid #e5e7eb;display:flex;justify-content:space-around;align-items:center;"><div style="width:1.5mm;height:1.5mm;border-radius:0.4mm;background:#cbd5e1;"></div><div style="width:1.5mm;height:1.5mm;border-radius:0.4mm;background:var(--red);"></div><div style="width:1.5mm;height:1.5mm;border-radius:0.4mm;background:#cbd5e1;"></div></div>
        </div><div class="phone-home"></div></div></div>
        <div style="font-size:8pt;font-weight:700;color:var(--dark);margin-top:3mm;">Referee</div>
      </div>
      <!-- Admin -->
      <div style="text-align:center;">
        <div class="phone triple"><div class="phone-body"><div class="phone-screen"><div class="phone-notch"></div>
          <div class="admin-screen">
            <div class="admin-header" style="padding:2.5mm 2mm;"><div style="font-size:6pt;">Admin</div></div>
            <div class="admin-stats" style="gap:1mm;padding:1.5mm;"><div class="admin-stat" style="border-left:1.5px solid #3B82F6;padding:1mm 1.5mm;"><div class="num" style="font-size:7pt;color:#3B82F6;">35</div><div class="lbl" style="font-size:3pt;">Users</div></div><div class="admin-stat" style="border-left:1.5px solid #10B981;padding:1mm 1.5mm;"><div class="num" style="font-size:7pt;color:#10B981;">14</div><div class="lbl" style="font-size:3pt;">Refs</div></div><div class="admin-stat" style="border-left:1.5px solid #F59E0B;padding:1mm 1.5mm;"><div class="num" style="font-size:7pt;color:#F59E0B;">20</div><div class="lbl" style="font-size:3pt;">Coaches</div></div><div class="admin-stat" style="border-left:1.5px solid #7C3AED;padding:1mm 1.5mm;"><div class="num" style="font-size:7pt;color:#7C3AED;">2</div><div class="lbl" style="font-size:3pt;">Pending</div></div></div>
            <div class="admin-map" style="background:linear-gradient(135deg,#d1e8d5 0%,#b8d4be 50%,#dde8df 100%);margin:1mm 1.5mm;"><div style="position:absolute;width:2mm;height:2mm;background:var(--red);border-radius:50%;top:30%;left:40%;opacity:0.7;"></div><div style="position:absolute;width:1.5mm;height:1.5mm;background:#10B981;border-radius:50%;top:50%;left:60%;opacity:0.7;"></div><div style="position:absolute;width:1.8mm;height:1.8mm;background:#06B6D4;border-radius:50%;top:40%;left:30%;opacity:0.7;"></div></div>
            <div class="admin-queue" style="padding:1mm 1.5mm;"><div style="font-size:4pt;font-weight:700;color:var(--dark);margin-bottom:0.8mm;">Verification Queue</div><div class="admin-queue-item" style="font-size:4pt;padding:1mm 1.5mm;"><span class="name">J. Smith</span><span class="badge" style="font-size:3.5pt;">Review</span></div><div class="admin-queue-item" style="font-size:4pt;padding:1mm 1.5mm;"><span class="name">A. Williams</span><span class="badge" style="font-size:3.5pt;">DBS</span></div></div>
          </div>
        </div><div class="phone-home"></div></div></div>
        <div style="font-size:8pt;font-weight:700;color:var(--dark);margin-top:3mm;">Admin</div>
      </div>
    </div>
    <div style="position:absolute;bottom:22mm;left:22mm;right:22mm;text-align:center;">
      <div style="font-size:7.5pt;color:var(--light);font-style:italic;margin-bottom:3mm;">Clean role-specific UI, delivered to coaches, referees and administrators on all devices.</div>
      <div class="tags" style="justify-content:center;"><span class="tag">Role-based access</span><span class="tag">Real-time updates</span><span class="tag">Mobile-first design</span><span class="tag">Push notifications</span></div>
    </div>
  </div>
{ftr(3)}
</div>

<!-- PAGE 4 - BOOKING FLOW -->
<div class="page">
{hdr("Product Overview &mdash; Booking Workflow")}
  <div class="watermark-num">04</div>
  <div class="content">
    <div class="section-title">Book. Offer. Confirm.</div>
    <p class="section-body" style="margin-bottom:4mm;">Create a booking with match details, search for available referees by location and rating, then send offers directly. Referees accept with pricing, and your match is confirmed &mdash; all within the app.</p>
    <div style="margin-bottom:3mm;"><div style="font-size:8pt;font-weight:700;color:var(--dark);margin-bottom:2mm;text-transform:uppercase;letter-spacing:0.05em;">Booking Workflow</div><div class="workflow"><span class="pill gray">Draft</span><span class="arrow">&rarr;</span><span class="pill amber">Pending</span><span class="arrow">&rarr;</span><span class="pill purple">Offered</span><span class="arrow">&rarr;</span><span class="pill green">Confirmed</span><span class="arrow">&rarr;</span><span class="pill cyan">Completed</span></div><div style="margin-left:32mm;margin-top:1mm;"><span class="arrow" style="font-size:8pt;">&#8627;</span><span class="pill red" style="font-size:6.5pt;padding:1mm 3mm;">Cancelled</span></div></div>
    <div style="margin-bottom:4mm;"><div style="font-size:8pt;font-weight:700;color:var(--dark);margin-bottom:2mm;text-transform:uppercase;letter-spacing:0.05em;">Offer Workflow</div><div class="workflow"><span class="pill gray">Sent</span><span class="arrow">&rarr;</span><span class="pill amber">Accepted &amp; Priced</span><span class="arrow">&rarr;</span><span class="pill green">Accepted</span></div><div style="margin-left:8mm;margin-top:1mm;"><span class="arrow" style="font-size:8pt;">&#8627;</span><span class="pill red" style="font-size:6.5pt;padding:1mm 3mm;">Declined</span></div></div>
    <div class="callout">Supports individual match bookings and central venue / tournament bookings. Budget, age group, format, and required referee level are all captured at creation.</div>
    <div class="benefits-grid cols-2" style="margin-top:4mm;max-width:80%;"><div class="benefit-card"><h4>Smart Matching</h4><p>Automatically surfaces referees who match your match requirements, location, and budget criteria.</p></div><div class="benefit-card"><h4>Budget Control</h4><p>Set match fees upfront. Referees propose pricing, coaches approve before confirmation.</p></div><div class="benefit-card"><h4>Auto-Notifications</h4><p>Push alerts at every stage &mdash; new offer, price submitted, booking confirmed, match day reminders.</p></div><div class="benefit-card"><h4>Full Audit Trail</h4><p>Complete history of every booking action, offer, and communication for compliance review.</p></div></div>
  </div>
{ftr(4)}
</div>

<!-- PAGE 5 - SMART SEARCH -->
<div class="page">
{hdr("Product Overview &mdash; Smart Search")}
  <div class="watermark-num">05</div>
  <div class="content" style="display:flex;gap:8mm;">
    <div style="width:55%;"><div class="section-title">Find Referees Fast,<br>Even Last Minute</div><p class="section-body" style="margin-bottom:3mm;">The smart search algorithm matches your fixture with the best available referees based on county, distance, availability, and rating. For emergencies, SOS mode broadcasts your match to every nearby official instantly.</p>
      <ul class="bullet-list"><li>Smart matching by county, availability, travel radius, and rating</li><li>SOS Emergency mode broadcasts to all nearby available referees</li><li>First responder gets auto-assigned &mdash; no coordination needed</li><li>Referee profiles show reliability scores and match history</li><li>Travel radius and FA verification filtering</li><li>County-wide coverage across 60+ UK regions</li></ul>
      <div class="callout" style="margin-top:4mm;">Your SOS goes live at 9am. By 9:02, three local referees have seen it. By 9:05, one has accepted and your match is covered. You set it once. Whistle Connect does the rest.</div>
      <div class="tags" style="margin-top:4mm;"><span class="tag">Smart matching</span><span class="tag">SOS Emergency</span><span class="tag">County filtering</span></div>
    </div>
    <div style="width:45%;display:flex;align-items:center;justify-content:center;">
      <div class="phone sidebar"><div class="phone-body"><div class="phone-screen"><div class="phone-notch"></div>
        <div style="background:var(--navy);padding:3mm 2.5mm 2mm;color:white;"><div style="font-size:7pt;font-weight:700;">Find Referees</div></div>
        <div style="margin:2mm;background:white;border-radius:1mm;padding:1.5mm 2mm;border:0.3mm solid #e2e8f0;"><div style="font-size:4.5pt;color:var(--light);">Search by name or postcode...</div></div>
        <div style="margin:1mm 2mm;background:white;border-radius:1mm;padding:1.5mm 2mm;display:flex;align-items:center;gap:1.5mm;"><div style="width:5mm;height:5mm;border-radius:50%;background:#3B82F6;flex-shrink:0;"></div><div style="flex:1;"><div style="font-size:5pt;font-weight:600;color:var(--dark);">James Wilson</div><div style="font-size:3.5pt;color:var(--light);">Level 7 &bull; 3.2 mi &bull; 4.8 &#9733;</div></div><div style="font-size:3.5pt;padding:0.8mm 2mm;background:var(--red);color:white;border-radius:0.8mm;font-weight:600;">Send Offer</div></div>
        <div style="margin:1mm 2mm;background:white;border-radius:1mm;padding:1.5mm 2mm;display:flex;align-items:center;gap:1.5mm;"><div style="width:5mm;height:5mm;border-radius:50%;background:#10B981;flex-shrink:0;"></div><div style="flex:1;"><div style="font-size:5pt;font-weight:600;color:var(--dark);">Sarah Thompson</div><div style="font-size:3.5pt;color:var(--light);">Level 6 &bull; 5.1 mi &bull; 4.9 &#9733;</div></div><div style="font-size:3.5pt;padding:0.8mm 2mm;background:var(--red);color:white;border-radius:0.8mm;font-weight:600;">Send Offer</div></div>
        <div style="margin:1mm 2mm;background:white;border-radius:1mm;padding:1.5mm 2mm;display:flex;align-items:center;gap:1.5mm;"><div style="width:5mm;height:5mm;border-radius:50%;background:#F59E0B;flex-shrink:0;"></div><div style="flex:1;"><div style="font-size:5pt;font-weight:600;color:var(--dark);">Mark Davies</div><div style="font-size:3.5pt;color:var(--light);">Level 7 &bull; 6.8 mi &bull; 4.6 &#9733;</div></div><div style="font-size:3.5pt;padding:0.8mm 2mm;background:var(--red);color:white;border-radius:0.8mm;font-weight:600;">Send Offer</div></div>
        <div style="margin:1mm 2mm;background:white;border-radius:1mm;padding:1.5mm 2mm;display:flex;align-items:center;gap:1.5mm;"><div style="width:5mm;height:5mm;border-radius:50%;background:#7C3AED;flex-shrink:0;"></div><div style="flex:1;"><div style="font-size:5pt;font-weight:600;color:var(--dark);">Lucy Brown</div><div style="font-size:3.5pt;color:var(--light);">Level 5 &bull; 8.4 mi &bull; 4.7 &#9733;</div></div><div style="font-size:3.5pt;padding:0.8mm 2mm;background:var(--red);color:white;border-radius:0.8mm;font-weight:600;">Send Offer</div></div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:5mm;background:white;border-top:0.3mm solid #e5e7eb;display:flex;justify-content:space-around;align-items:center;"><div style="width:2mm;height:2mm;border-radius:0.5mm;background:#cbd5e1;"></div><div style="width:2mm;height:2mm;border-radius:0.5mm;background:var(--red);"></div><div style="width:2mm;height:2mm;border-radius:0.5mm;background:#cbd5e1;"></div><div style="width:2mm;height:2mm;border-radius:0.5mm;background:#cbd5e1;"></div></div>
      </div><div class="phone-home"></div></div></div>
    </div>
  </div>
{ftr(5)}
</div>

<!-- PAGE 6 - REFEREE EXPERIENCE -->
<div class="page">
{hdr("Product Overview &mdash; Referee Experience")}
  <div class="watermark-num">06</div>
  <div class="content" style="display:flex;gap:8mm;">
    <div style="width:55%;"><div class="section-title">Empowering Every Referee</div><p class="section-body" style="margin-bottom:3mm;">Referees get their own tailored experience. Set weekly availability, respond to offers, track season earnings, and build a reputation that coaches can trust. Every completed match adds to a public reliability score.</p>
      <div class="benefits-grid cols-2" style="margin-top:3mm;"><div class="benefit-card"><h4>Set Availability</h4><p>Weekly recurring and date-specific overrides.</p></div><div class="benefit-card"><h4>Track Earnings</h4><p>Season dashboard with monthly breakdown charts.</p></div><div class="benefit-card"><h4>Build Reputation</h4><p>Ratings and reliability scores visible to all coaches.</p></div><div class="benefit-card"><h4>Stay Informed</h4><p>Push notifications for new offers and booking updates.</p></div></div>
      <div class="callout" style="margin-top:4mm;">Season earnings dashboard &mdash; track completed matches and income at a glance.</div>
    </div>
    <div style="width:45%;display:flex;align-items:center;justify-content:center;">
      <div class="phone sidebar"><div class="phone-body"><div class="phone-screen"><div class="phone-notch"></div>
        <div style="background:var(--red);padding:3mm 2.5mm 2mm;color:white;"><div style="font-size:7pt;font-weight:700;">Season Dashboard</div></div>
        <div style="text-align:center;padding:4mm 0 2mm;"><div style="font-size:16pt;font-weight:900;color:var(--dark);letter-spacing:-0.02em;">&pound;1,135</div><div style="font-size:4.5pt;color:var(--light);margin-top:0.5mm;">Season Earnings</div></div>
        <div style="display:flex;align-items:flex-end;gap:2mm;height:18mm;padding:0 4mm;justify-content:center;"><div style="width:4mm;height:8mm;background:var(--red);border-radius:0.5mm 0.5mm 0 0;opacity:0.7;"></div><div style="width:4mm;height:12mm;background:var(--red);border-radius:0.5mm 0.5mm 0 0;opacity:0.8;"></div><div style="width:4mm;height:15mm;background:var(--red);border-radius:0.5mm 0.5mm 0 0;opacity:0.85;"></div><div style="width:4mm;height:10mm;background:var(--red);border-radius:0.5mm 0.5mm 0 0;opacity:0.9;"></div><div style="width:4mm;height:18mm;background:var(--red);border-radius:0.5mm 0.5mm 0 0;"></div></div>
        <div style="display:flex;padding:1mm 4mm;justify-content:space-between;"><div style="font-size:3pt;color:var(--light);">Nov</div><div style="font-size:3pt;color:var(--light);">Dec</div><div style="font-size:3pt;color:var(--light);">Jan</div><div style="font-size:3pt;color:var(--light);">Feb</div><div style="font-size:3pt;color:var(--light);">Mar</div></div>
        <div style="display:flex;gap:1mm;padding:2mm 2.5mm;"><div style="flex:1;background:white;border-radius:1mm;padding:1.5mm;text-align:center;"><div style="font-size:8pt;font-weight:800;color:var(--dark);">23</div><div style="font-size:3.5pt;color:var(--light);">Matches</div></div><div style="flex:1;background:white;border-radius:1mm;padding:1.5mm;text-align:center;"><div style="font-size:8pt;font-weight:800;color:var(--dark);">4.6</div><div style="font-size:3.5pt;color:var(--light);">Rating</div></div><div style="flex:1;background:white;border-radius:1mm;padding:1.5mm;text-align:center;"><div style="font-size:8pt;font-weight:800;color:var(--dark);">98%</div><div style="font-size:3.5pt;color:var(--light);">Reliable</div></div></div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:5mm;background:white;border-top:0.3mm solid #e5e7eb;display:flex;justify-content:space-around;align-items:center;"><div style="width:2mm;height:2mm;border-radius:0.5mm;background:#cbd5e1;"></div><div style="width:2mm;height:2mm;border-radius:0.5mm;background:#cbd5e1;"></div><div style="width:2mm;height:2mm;border-radius:0.5mm;background:var(--red);"></div><div style="width:2mm;height:2mm;border-radius:0.5mm;background:#cbd5e1;"></div></div>
      </div><div class="phone-home"></div></div></div>
    </div>
  </div>
{ftr(6)}
</div>

<!-- PAGE 7 - FA VERIFICATION -->
<div class="page">
{hdr("Product Overview &mdash; Verification")}
  <div class="watermark-num">07</div>
  <div class="content" style="text-align:center;">
    <div class="section-title" style="text-align:left;">FA Verified. Always Compliant.</div>
    <p class="section-body" style="text-align:left;max-width:100%;margin-bottom:5mm;">Every referee on Whistle Connect is verified through the County FA. Our admin verification queue ensures that FA numbers, DBS certificates, and safeguarding qualifications are checked and monitored &mdash; giving coaches confidence that every official is qualified.</p>
    <div style="display:flex;justify-content:center;margin-bottom:6mm;"><div style="background:#10B981;border-radius:4mm;padding:8mm 14mm;display:inline-flex;align-items:center;gap:5mm;box-shadow:0 3mm 12mm rgba(16,185,129,0.25);"><svg width="32mm" height="32mm" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M50 5 L85 20 L85 50 C85 72 68 90 50 95 C32 90 15 72 15 50 L15 20 Z" fill="rgba(255,255,255,0.2)" stroke="white" stroke-width="2.5"/><path d="M35 50 L45 60 L65 40" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg><div style="text-align:left;"><div style="font-size:20pt;font-weight:900;color:white;letter-spacing:0.05em;">FA VERIFIED</div><div style="font-size:8pt;color:rgba(255,255,255,0.8);margin-top:1mm;">Qualified &bull; Cleared &bull; Compliant</div></div></div></div>
    <div style="font-size:7.5pt;color:var(--light);font-style:italic;margin-bottom:4mm;">Verification stages &mdash; submit to admin queue, verified profile and match-ready status</div>
    <div class="benefits-grid cols-4" style="max-width:90%;margin:0 auto;"><div class="benefit-card"><h4>FA Number Check</h4><p>Every referee submits their official FA registration number during sign-up, verified by admin before activation.</p></div><div class="benefit-card"><h4>DBS Tracking</h4><p>Enhanced DBS clearance status is recorded and monitored, with expiry alerts for administrators.</p></div><div class="benefit-card"><h4>Safeguarding</h4><p>Safeguarding course completion is tracked as part of the verification process for youth football officiating.</p></div><div class="benefit-card"><h4>Admin Queue</h4><p>Dedicated admin verification queue. Pending Responses and Reviews are streamlined.</p></div></div>
  </div>
{ftr(7)}
</div>

<!-- PAGE 8 - ADMIN -->
<div class="page">
{hdr("Product Overview &mdash; Admin Dashboard")}
  <div class="watermark-num">08</div>
  <div class="content" style="display:flex;gap:8mm;">
    <div style="width:55%;"><div class="section-title">Complete Oversight<br>&amp; Control</div><p class="section-body" style="margin-bottom:3mm;">County FA administrators get a dedicated dashboard with full visibility of every user, booking, and referee in their region. Analytics, geospatial mapping, and a verification queue make county-level management seamless.</p>
      <ul class="bullet-list"><li>Real-time stats: total users, referees, coaches, and bookings</li><li>Interactive Mapbox GL map with referee and booking pin locations</li><li>FA verification queue with two-stage workflow</li><li>Coach management with booking counts and activity levels</li><li>Monthly trend tracking and growth analytics</li><li>System-wide notification broadcasting</li></ul>
      <div class="callout" style="margin-top:3mm;">The geospatial Mapbox map shows every active referee and upcoming booking on a live, interactive map. Administrators can identify coverage gaps and ensure every part of the county has adequate official coverage.</div>
      <div class="tags" style="margin-top:3mm;"><span class="tag">Analytics dashboard</span><span class="tag">Geospatial map</span><span class="tag">Referee verification</span><span class="tag">Booking oversight</span></div>
    </div>
    <div style="width:45%;display:flex;align-items:center;justify-content:center;">
      <div class="phone sidebar"><div class="phone-body"><div class="phone-screen"><div class="phone-notch"></div>
        <div class="admin-screen">
          <div class="admin-header" style="padding:4mm 3mm;"><div style="font-size:8pt;">County Overview</div><div style="font-size:5pt;color:rgba(255,255,255,0.6);margin-top:0.5mm;">March 2026</div></div>
          <div class="admin-stats"><div class="admin-stat" style="border-left:2px solid #10B981;"><div class="num" style="color:#10B981;">342</div><div class="lbl">Referees</div></div><div class="admin-stat" style="border-left:2px solid #06B6D4;"><div class="num" style="color:#06B6D4;">156</div><div class="lbl">Bookings</div></div><div class="admin-stat" style="border-left:2px solid #F59E0B;"><div class="num" style="color:#F59E0B;">89</div><div class="lbl">Coaches</div></div><div class="admin-stat" style="border-left:2px solid var(--red);"><div class="num" style="color:var(--red);">12</div><div class="lbl">Pending</div></div></div>
          <div class="admin-map" style="background:linear-gradient(135deg,#d1e8d5 0%,#b8d4be 50%,#dde8df 100%);"><div style="position:absolute;width:3mm;height:3mm;background:var(--red);border-radius:50%;top:30%;left:40%;opacity:0.7;"></div><div style="position:absolute;width:2mm;height:2mm;background:#10B981;border-radius:50%;top:50%;left:60%;opacity:0.7;"></div><div style="position:absolute;width:2.5mm;height:2.5mm;background:#06B6D4;border-radius:50%;top:40%;left:30%;opacity:0.7;"></div><div style="position:absolute;width:2mm;height:2mm;background:#F59E0B;border-radius:50%;top:65%;left:50%;opacity:0.7;"></div></div>
          <div class="admin-queue" style="padding:2mm 2.5mm;"><div style="font-size:5pt;font-weight:700;color:var(--dark);margin-bottom:1mm;">Verification Queue</div><div class="admin-queue-item"><span class="name">J. Smith</span><span class="badge">Review</span></div><div class="admin-queue-item"><span class="name">A. Williams</span><span class="badge">DBS</span></div><div class="admin-queue-item"><span class="name">R. Taylor</span><span class="badge">FA ID</span></div></div>
        </div>
      </div><div class="phone-home"></div></div></div>
    </div>
  </div>
  <div class="benefits-grid cols-4" style="position:absolute;bottom:20mm;left:22mm;right:22mm;"><div class="benefit-card"><h4>Real-Time Analytics</h4><p>Live metrics on referees, bookings, and match coverage across your county.</p></div><div class="benefit-card"><h4>Geospatial Map</h4><p>Mapbox-powered visualisation of referee locations and coverage areas.</p></div><div class="benefit-card"><h4>Coach Management</h4><p>Monitor clubs, coaches, and booking patterns for operational insights.</p></div><div class="benefit-card"><h4>FA Verification Queue</h4><p>Streamlined approval workflow for new referee applications and renewals.</p></div></div>
{ftr(8)}
</div>

<!-- PAGE 9 - TECHNOLOGY -->
<div class="page">
{hdr("Product Overview &mdash; Technology")}
  <div class="watermark-num">09</div>
  <div class="content">
    <div class="section-title">Built for Scale &amp; Security</div>
    <p class="section-body" style="margin-bottom:5mm;">Whistle Connect is built on a modern, battle-tested stack designed for reliability, performance, and security from day one. Every layer &mdash; from authentication to real-time messaging &mdash; is production-grade.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3mm;margin-bottom:5mm;"><div class="tech-card" style="border-left:3px solid #1b2537;"><h4>Next.js 16</h4><p>React 19 framework with App Router, server actions, and edge ready.</p></div><div class="tech-card" style="border-left:3px solid #10B981;"><h4>Supabase</h4><p>PostgreSQL database with real-time subscriptions, auth, and storage.</p></div><div class="tech-card" style="border-left:3px solid #0F172A;"><h4>Supabase Auth</h4><p>Authentication built with password-based session management and RLS.</p></div><div class="tech-card" style="border-left:3px solid #06B6D4;"><h4>Mapbox GL</h4><p>Interactive maps with referee locations, rendering live, and coverage dashboards.</p></div><div class="tech-card" style="border-left:3px solid var(--red);"><h4>Web Push API</h4><p>VAPID-based push notifications for booking updates and offers.</p></div><div class="tech-card" style="border-left:3px solid #334155;"><h4>Vercel</h4><p>Serverless CDN with edge functions, preview deploys, and global delivery.</p></div></div>
    <div style="font-size:9pt;font-weight:700;color:var(--dark);margin-bottom:2mm;">Security &amp; Architecture</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3mm;"><div class="benefit-card"><h4>Row-Level Security</h4><p>Database-level access control so users can only access their own data.</p></div><div class="benefit-card"><h4>Role-Based Access</h4><p>Coach, Referee, and Admin with scoped permissions.</p></div><div class="benefit-card"><h4>Encrypted Auth</h4><p>Secure sessions, automatic JWT validation, cookie-based.</p></div><div class="benefit-card"><h4>Data Isolation</h4><p>Tenant-scoped data with county-level segregation.</p></div><div class="benefit-card"><h4>Progressive Web App</h4><p>Installable, offline-capable, responsive on all devices.</p></div><div class="benefit-card"><h4>Real-Time Sync</h4><p>Live updates via Supabase Realtime subscriptions.</p></div></div>
    <div class="callout" style="margin-top:4mm;">Streamlined architecture &mdash; full-stack TypeScript with server actions, real-time subscriptions, and zero-config deployments.</div>
  </div>
{ftr(9)}
</div>

<!-- PAGE 10 - CTA -->
<div class="page">
{hdr("Product Overview &mdash; Get Started")}
  <div class="watermark-num">10</div>
  <div class="content" style="display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:10mm;">
    <div class="section-title" style="text-align:center;">Ready to See It in Action?</div>
    <p class="section-body" style="text-align:center;max-width:70%;margin:3mm auto 6mm;">Book a live demo with the Whistle Connect team. We'll walk you through the dashboard, show you how booking works, and set up a test match in under five minutes.</p>
    <div style="display:flex;gap:5mm;margin-bottom:6mm;"><div class="cta-stat" style="width:55mm;"><div class="num">60+</div><div class="label">UK Counties</div></div><div class="cta-stat" style="width:55mm;"><div class="num">14</div><div class="label">Age Groups Configured</div></div><div class="cta-stat" style="width:55mm;"><div class="num">24/7</div><div class="label">Real-Time Booking</div></div></div>
    <div class="callout" style="max-width:70%;text-align:center;margin-bottom:6mm;">Your brand on every match. Managed by Whistle Connect.</div>
    <div style="background:var(--navy);border-radius:3mm;padding:8mm 12mm;max-width:75%;width:100%;text-align:center;">
      <div style="font-size:18pt;font-weight:800;color:white;margin-bottom:2mm;">Ready to See It in Action?</div>
      <div style="font-size:9.5pt;color:rgba(255,255,255,0.7);line-height:1.6;margin-bottom:4mm;">Book a live demo with the Whistle Connect team. We'll walk you through the dashboard, show you how scheduling works, and set up a screen in under five minutes.</div>
      <div style="display:flex;justify-content:center;gap:8mm;flex-wrap:wrap;"><div style="text-align:center;"><div style="font-size:7pt;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:1mm;">Email</div><div style="font-size:10pt;font-weight:600;color:white;">hello@whistleconnect.co.uk</div></div><div style="text-align:center;"><div style="font-size:7pt;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:1mm;">Website</div><div style="font-size:10pt;font-weight:600;color:white;">whistleconnect.co.uk</div></div></div>
      <div style="margin-top:4mm;display:flex;justify-content:center;">{wlogo("height:12mm;opacity:0.3;")}</div>
    </div>
  </div>
{ftr(10)}
</div>

</body>
</html>'''

with open('fa_overview.html', 'w', encoding='utf-8') as f:
    f.write(html)

# Verify
for bad in ['#44418a', '#2a285e']:
    assert bad not in html, f"Found {bad}!"
assert 'base64' not in html, "Found base64!"
pages = html.count('class="page')
print(f"OK: {len(html)} chars, {pages} pages, no bad colors, no base64")
