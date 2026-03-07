Whistle Connect - Strategy, MVP, and Mobile Architecture
Overview

Whistle Connect is a referee marketplace platform for grassroots football.

The core problem it solves:

Clubs struggle to find referees quickly.
Referees struggle to find matches.

The platform acts as the supply-demand layer connecting clubs and referees.

Think:

Uber for football referees.

Core Market Opportunity

Grassroots football has several systemic problems:

referees dropping out last minute

clubs scrambling to find replacements

referees relying on WhatsApp groups

leagues using outdated systems

payment chaos

Whistle Connect solves this by creating a live referee marketplace.

Major Product Opportunities
1. Referee SOS (Viral Feature)

A large emergency button for clubs.

🚨 NEED A REFEREE NOW

When pressed:

Coach enters:

location

kickoff time

age group

match fee

System broadcasts to referees nearby.

Example push notification:

🚨 URGENT MATCH

U14
Kickoff in 60 minutes
2.1 miles away
£40

Accept now

This solves the biggest grassroots football issue:

last-minute referee dropouts.

2. Instant Referee Broadcast

Coach posts match → referees receive notification.

⚽ Match Available

U14
2.1 miles away
Saturday 10:30
£35

First referee to accept gets the match.

This creates true marketplace behaviour.

3. Live Referee Map

Clubs see nearby referees visually.

⚽ Referees near you

Mark - Level 6 - 1.4 miles
Tom - Level 7 - 3.1 miles
David - Level 5 - 5.8 miles

Each referee shows:

distance

qualification

reliability

availability

4. Reliability Score

Referees receive a trust score.

Reliability: 96%
Matches officiated: 143
Average rating: 4.8

Based on:

attendance

cancellations

coach ratings

completed matches

5. Club Referee Pools

Clubs create trusted referee lists.

Example:

South Shields FC Ref Pool

Preferred refs:
Mark
Ryan
Luke
Josh

Match posting options:

1️⃣ Invite club pool
2️⃣ Broadcast to network
6. Smart Referee Matching

System recommends referees.

U16 match posted

Best matches:
Tom - Level 5 - youth specialist
Mark - Level 6 - nearby

Matching factors:

travel distance

age group experience

reliability

referee availability

7. Instant Payments (Later Phase)

Current grassroots payments are messy.

Typical methods:

cash

bank transfer

sometimes unpaid

Whistle Connect could automate:

✔ match completed
→ referee paid automatically
Referee-First Strategy

The fastest growth strategy:

Target referees first, not leagues.

Why?

Referees are the bottleneck.

No referee = no match.

If referees adopt the platform, clubs must follow.

Referee Match Feed
Available matches near you

U13 - 2 miles - Saturday 10:00 - £35
U16 - 4 miles - Sunday 11:30 - £45
Open Age - 6 miles - Saturday 14:00 - £50

Referees simply claim matches.

Earnings Tracker

Referees love seeing earnings.

This season

Matches officiated: 42
Earnings: £1,470
Average rating: 4.8

This improves retention.

Availability Toggle
Available this weekend
Available midweek
Unavailable
Travel Radius
Max distance: 8 miles
Whistle Connect MVP

The correct MVP is only five features.

1. Referee Profiles

Fields:

name

FA level

travel radius

availability

location

Example:

Tom
Level 6
Travel radius: 10 miles
Available this weekend
2. Match Posting

Coach posts match:

location

kickoff time

age group

match fee

Example:

U14
Saturday 10:30
2.3 miles away
£35
3. Broadcast Notification

Referees nearby receive push notification.

⚽ Match Available

U14
2.1 miles away
Saturday 10:30
£35
4. Accept / Claim Match
ACCEPT MATCH

First referee to accept is assigned.

5. Messaging

Once accepted:

Coach:
Pitch 2 behind the clubhouse

Ref:
Got it 👍
Complete Flow
coach posts match
↓
refs nearby notified
↓
ref claims match
↓
chat opens
↓
game happens
Mobile App Strategy

Best approach for the current stack:

Phase 1

Mobile-first PWA

Phase 2

Wrap with Capacitor

This gives:

App Store

Google Play

same codebase

Making the Web App Feel Native

Native feel comes from UX patterns, not framework choice.

App Shell Layout
Top Bar
--------------------------------

Scrollable Content Area

--------------------------------
Home   Matches   Messages   Profile
Bottom Navigation

Recommended mobile structure:

Home

Matches

Messages

Profile

Touch Targets

Minimum:

44px tap areas

Large buttons.

Example CTA:

POST MATCH

or

ACCEPT MATCH
Native Motion

Use subtle transitions:

slide panels

fade page swaps

bottom sheets

skeleton loaders

Safe Area Support

Handle mobile device edges:

env(safe-area-inset-top)
env(safe-area-inset-bottom)

Prevents UI being blocked by phone gesture bars.

Core App Screens
Home
Availability Toggle

Next Match
Urgent Requests
Season Earnings
Matches

Card feed:

U14
2.1 miles away
£35
Kickoff 10:30

[ ACCEPT MATCH ]
Messages

Messenger-style chat threads.

Profile
Level
Travel Radius
Availability
Preferences
Push Notifications

Critical for engagement.

Examples:

⚽ Match Available
U14
2.3 miles away
£35
💬 New message from coach
🚨 Emergency referee request
Network Effect Flywheel
referees join for matches
↓
clubs post matches
↓
more matches available
↓
more referees join
↓
network grows
Long-Term Vision

Whistle Connect becomes:

National referee marketplace infrastructure.

Clubs → post matches
Referees → claim matches
Platform → manages discovery, communication, payments

Equivalent to:

Uber for referees.