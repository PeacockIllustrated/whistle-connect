# Whistle Connect x The FA - intro email handoff pack

Two intro emails for The FA to send to their grassroots database: one to **coaches**, one to **referees**. These are the animated "V1 Expanded" design (the coach was recovered from the Make review scenario; the referee is a matching twin in the same template). Em dashes removed.

The FA sends from their own platform, to their own list. We do not send to FA members directly.

## What's in here

| File | Purpose |
|---|---|
| `coach-intro.html` | Coach email, Outlook-safe animated HTML, ready to import |
| `referee-intro.html` | Referee email, same template, referee message |
| `coach-intro-LASTNIGHT-recovered.html` | The exact original coach (with its em dashes), kept for reference |
| This README | Subjects, copy, plain-text, and handoff notes |

Both emails are also loaded into the Make scenario **"WC - Intro Email Variants (review)"** (id 6149442) as two modules, so a single review run sends the coach and referee together to `support@whistleconnect.co.uk`.

## Before the real send (2 placeholders)

1. **Header partnership line** reads `Your Local FA`. Swap for the actual FA / county FA name (or mail-merge it per region).
2. **Unsubscribe link** is a `#` placeholder. The FA's platform should supply the real unsubscribe + sender address footer (legal requirement).

## How to hand this to The FA

1. Ask their email/comms team whether they want to import the HTML as-is or drop the copy below into their own template.
2. They send it, from their platform, to their opted-in list (they hold the GDPR / PECR lawful basis).
3. Images are already hosted, so nothing needs uploading. The only image is `https://www.whistleconnect.co.uk/assets/logo-email.png`.
4. Test send to one Outlook account first (the design uses subtle CSS animations that gracefully fall back when motion is reduced or unsupported).

## Links

- Coach CTA: `https://www.whistleconnect.co.uk/auth/register?role=coach`
- Referee CTA: `https://www.whistleconnect.co.uk/auth/register?role=referee`

(Add UTM tags such as `?utm_source=thefa&utm_medium=email&utm_campaign=wc-launch` if you want attribution. The FA's platform may add its own.)

---

## Email 1 - Coaches

**Suggested subject:** Stop chasing referees. Start booking them.
**Preheader:** Post a fixture, find a verified ref nearby, and have it confirmed in a few taps.

**Plain-text version:**

```
In partnership with Your Local FA

STOP CHASING REFEREES. START BOOKING THEM.

Your Local FA has partnered with Whistle Connect, a faster and simpler way
to get a qualified, FA-verified referee to your fixture.

- FA-verified refs, vetted and rated
- Refs near you, matched to your fixture
- Pay securely, held until it's played

Dear Coach,

You know the drill: a fixture on Saturday, no official confirmed, and a
string of texts that go nowhere. We've put that right.

Lost your ref last-minute? SOS mode broadcasts your match to every nearby
official instantly, so you are covered in minutes, not hours.

How it works:
1. Post your match, in under a minute
2. Pick a ref, verified and nearby
3. Confirm and pay, securely in-app

Create your free account: https://www.whistleconnect.co.uk/auth/register?role=coach
Free to join, about two minutes.

See you on the pitch,
The Whistle Connect Team

whistleconnect.co.uk  |  support@whistleconnect.co.uk
```

---

## Email 2 - Referees

**Suggested subject:** Stop chasing fees. Start getting paid.
**Preheader:** Set your availability, get offers for nearby matches, and get paid securely after every game.

**Plain-text version:**

```
In partnership with Your Local FA

STOP CHASING FEES. START GETTING PAID.

Your Local FA has partnered with Whistle Connect, a simpler way to fill your
diary with nearby matches and get paid securely for every one.

- Games near you, matched to your area
- On your terms, accept what suits
- Paid securely, into your wallet

Dear Referee,

You know the feeling: a free Saturday, no games in the diary, and fees you
are still waiting on. We've put that right.

Want more games? Switch on your availability and SOS alerts reach you the
moment a nearby coach needs an official, often within minutes.

How it works:
1. Set availability, in under a minute
2. Accept nearby offers, matched to you
3. Get paid securely, after kick-off

Create your free account: https://www.whistleconnect.co.uk/auth/register?role=referee
Free to join, about two minutes.

See you on the pitch,
The Whistle Connect Team

whistleconnect.co.uk  |  support@whistleconnect.co.uk
```
