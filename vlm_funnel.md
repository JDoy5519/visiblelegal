# VLM Funnel Rebuild Roadmap (2025)
_Optimised Homepage + IVA Funnel + Tracking Rebuild_  
**Version:** 1.0  
**Scope:** Homepage, IVA Claim Funnel, Tracking, Overdraft (Phase 2)

---

## 1. Project Overview

Visible Legal Marketing (VLM) requires a modern, premium and high-converting claims funnel.  
This roadmap covers:

- Rebuilding the IVA claim journey (UX + fields)  
- Fixing Meta CAPI + browser tracking  
- Improving homepage layout + trust flow  
- Aligning entire site under a single brand system  
- Removing unused claim types  
- Preparing the framework for the upcoming **Overdraft Claim** journey

All work will keep the project **static (HTML/CSS/JS)** and retain the existing **Make → Airtable** backend flow.

---

## 2. Core Objectives

### Primary (Immediate)
- Fix IVA funnel tracking (LPV + Lead + CAPI dedupe)  
- Replace existing IVA form with the **new 4-step version**  
- Improve consistency + trust across homepage & IVA pages  
- Remove Car Finance + Business Energy as service types  
- Keep only: **IVA Claims** and **Overdraft Claims** (Overdraft = Phase 2)

### Secondary (Next Phase)
- Add Overdraft Claim journey using the new funnel pattern  
- Add homepage CTA for Overdraft once live  
- Improve cross-page component consistency  

---

## 3. Required Output

By the end of this roadmap, the site will have:

- A premium, law-firm-grade design  
- A short, conversion-optimised IVA claim checker  
- Fully repaired tracking (browser + server + dedupe)  
- Consistent branding across homepage + IVA page  
- A stable framework ready to support the Overdraft journey

---

# 4. Homepage Rebuild Plan

## 4.1 Remove Unused Services
Remove references to:
- Business Energy  
- Car Finance  

Remaining services:
- IVA Claims  
- Overdraft Claims (disabled until Phase 2)

Update homepage “Our Services” section to show only these two.

---

## 4.2 Hero Section Improvements
- Keep layout but refine copy  
- Use clean illustration  
- CTA buttons:  
  - **Check IVA Claim**  
  - **Overdraft Claim (Coming Soon modal)**  
- Ensure spacing matches new design system

---

## 4.3 Services Section (Simplified)
Replace three small cards with **two premium service cards**:

- IVA Claims → clickable  
- Overdraft Claims → disabled, opens “Coming Soon” modal

Both cards should follow the “premium law firm” aesthetic.

---

## 4.4 Why Choose VLM Section
Keep four cards but refine text:

- FCA-regulated  
- UK solicitor partners  
- Transparent process  
- No win, no fee  

Ensure icons use Lucide style for consistency.

---

## 4.5 Claims Process Section
- Keep 4-step flow  
- Improve spacing, icon size, and hover/scroll animations  
- Ensure mobile and desktop views are consistent

---

## 4.6 Homepage Register-Interest Form
Keep existing form framework.

Required changes:
- Dropdown options → **IVA** and **Overdraft**  
- Overdraft always triggers Coming Soon modal  
- Turnstile remains before submit  
- Ensure UTM stamping continues to work

---

# 5. IVA Funnel Rebuild (Highest Priority)

## 5.1 Replace Existing Form With New 4-Step Flow

### Step 1 — Contact & DOB
- Full name  
- Email  
- Mobile  
- Date of birth  
- Current address  
- “Lived at this address when IVA started?”  
  - If No → Previous address

### Step 2 — IVA Details
- IVA provider (dropdown + Other)  
- IVA type: Single / Joint → partner name if joint  
- IVA outcome: Completed / Failed  
- Residential status at IVA start (Owner / Renter / Other)  
- IVA start date (month + year)

### Step 3 — Financial Circumstances
- Other debt solutions used  
- Struggled to maintain IVA payments? (Y/N)  
- “Two ways to move forward” selection  
  - Fast-track  
  - DSAR-first

### Step 4 — Consent
- Consent wording  
- Required checkboxes  
- Turnstile  
- “Submit claim check” button

---

## 5.2 Remove Unused Fields & Logic
Remove all of:

- Disposable income calculations  
- Budget questions  
- Dependants  
- Assets  
- Eligibility rules  
- Old scoring logic  
- Old step logic  
- Duplicate validation functions  
- All unused CTA handlers

This ensures a minimal, high-converting flow.

---

## 5.3 Tracking Fix (Critical)

### A. Landing Page View (LPV)
Fire LPV when:
- Step 1 renders  
- OR Step 2 begins  

Event:
`fbq('track', 'ViewContent', { content_name: 'iva_form_start' });`

### B. FormStart
Fire on:
- First input focus  
- Beginning of Step 1  

### C. Lead Event (Correct + Deduped)
Fire ONLY when:
- Thank-you modal opens  
- Generate event_id  
- Send via browser AND CAPI with same ID  
- Hash email + phone before sending to CAPI  

### D. Dedupe
Ensure both events (browser + CAPI) use identical `event_id`.

### E. UTM Mapping
Ensure hidden fields:
- Populate on page load  
- Pass through Make webhook  
- Save in Airtable `Raw Intake`

---

## 5.4 Post-Submit FCA Question
Inside the Thank-You modal:

**Question:**  
“Why did you choose to use a claims management company today?”

Options:
- I didn’t feel confident doing it myself  
- I didn’t have time  
- I didn’t understand the IVA process  
- I’ve tried before and got nowhere  
- Other (text)

Submit via a separate Make webhook or as a secondary event.

---

# 6. Overdraft Funnel (Phase 2)

## 6.1 Build a 3-Step Flow
- Contact  
- Overdraft & bank details  
- Circumstances & consent  

## 6.2 Connect to Airtable
Tag as:
`claim_type = overdraft`

## 6.3 Add Homepage CTA
Replace Coming Soon button with a live link once completed.

---

# 7. Shared Branding System

Use the existing Deep Trust Blue design system across all pages:

- Navy + Blue accent palette  
- Rounded cards (18–20px)  
- Soft shadows  
- Tilde Bold for headings  
- Open Sans for body text  
- 24–32px vertical spacing  
- Smooth transitions  
- Minimalist, modern legal aesthetic

Ensure homepage + IVA pages use the same:

- Buttons  
- Input fields  
- Headings  
- Containers  
- Modals  
- Footer layout

---

# 8. Deployment Steps

## Phase 1 — IVA Fix
- Implement new 4-step IVA form  
- Remove old logic  
- Fix tracking  
- Validate Turnstile  
- Test Make/Airtable  
- Test dedupe  
- Publish  

## Phase 2 — Homepage Polish
- Update hero section  
- Replace service cards  
- Remove BEC + Car Finance  
- Add Overdraft placeholder  
- Improve spacing + typography  
- Publish  

## Phase 3 — Ads Relaunch
- Validate LPV  
- Validate FormStart  
- Validate Lead  
- Confirm CAPI dedupe  
- Create custom conversion  
- Run ads at £10/day for 48h  
- Monitor CTR, CPC, LPV, Lead  

## Phase 4 — Overdraft Funnel
- Build new overdraft page  
- Connect backend  
- Test tracking  
- Add CTA to homepage  
- Publish  

---

# 9. Success Criteria

- LPV > 90% of link clicks  
- FormStart event consistent  
- Lead event fires on every submission  
- CAPI dedupe “Matched” > 80%  
- CPL reduces toward £25–£40  
- Fully responsive + premium UX  
- IVA + Overdraft share identical branding  
- Backend records clean & complete  

---

**End of Roadmap**
