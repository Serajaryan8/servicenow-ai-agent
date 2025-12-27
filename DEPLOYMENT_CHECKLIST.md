# Donation Integration Checklist - Pre-Deployment & Post-Deployment

## 📋 Phase 1: Pre-Deployment (Preparation)

### A. Get Stripe Account Ready
- [ ] Go to https://stripe.com
- [ ] Create Stripe account
- [ ] Verify email
- [ ] Enable India payments (Settings > Payment methods > India)
- [ ] Generate test API keys (Developers > API Keys)
  - [ ] Copy `sk_test_...` (Secret Key)
  - [ ] Copy `pk_test_...` (Publishable Key)
- [ ] Keep browser tab open for Stripe dashboard

### B. Review Documentation
- [ ] Read INDEX.md (this folder overview)
- [ ] Read DONATION_QUICK_REFERENCE.md (5-10 min)
- [ ] Skim STRIPE_INTEGRATION_GUIDE.md (understand flow)
- [ ] Have TECHNICAL_SPECIFICATION.md ready for reference
- [ ] Print DONATION_QUICK_REFERENCE.md if helpful

### C. Prepare ServiceNow Instance
- [ ] Log in to ServiceNow (admin role)
- [ ] Navigate to System Properties page
- [ ] Navigate to REST APIs page
- [ ] Navigate to Transaction Logs (for monitoring)
- [ ] Verify tables exist:
  - [ ] x_adsr_fundeavor_donation
  - [ ] x_adsr_fundeavor_campaign
  - [ ] x_adsr_fundeavor_transaction_log

### D. Prepare for Code Deployment
- [ ] Download all files from this folder
- [ ] Save to local backup
- [ ] Have text editor ready (Notepad++, VS Code, etc.)
- [ ] Have ServiceNow instance ready for deployment

---

## 🔧 Phase 2: Deploy Code (35 minutes)

### Step 1: Create Script Includes (10 min)

**1a. Deploy x_adsr_fundeavor_stripe_processor.js**
- [ ] In ServiceNow, go to System Definition > Script Includes
- [ ] Click New
- [ ] Name: `x_adsr_fundeavor_stripe_processor`
- [ ] Client callable: ❌ (uncheck)
- [ ] Active: ✅ (check)
- [ ] Copy-paste contents of `x_adsr_fundeavor_stripe_processor.js`
- [ ] Save
- [ ] Test: No syntax errors in browser console

**1b. Update fundeavor_agent_v2.js**
- [ ] In ServiceNow, go to System Definition > Script Includes
- [ ] Find/Open: `fundeavor_agent_v2`
- [ ] Replace entire contents with updated file
- [ ] Save
- [ ] Test: No syntax errors

### Step 2: Deploy UI Script (10 min)

**2a. Create/Update UI Script**
- [ ] In ServiceNow, go to System UI > UI Scripts
- [ ] Create new or open existing: `fundeavor_chat_widget`
- [ ] Replace contents with `fundeavor_chat_widget.js`
- [ ] Save
- [ ] Test: No syntax errors

### Step 3: Create REST API Endpoint (10 min)

**3a. Create REST API**
- [ ] In ServiceNow, go to System Web Services > REST APIs
- [ ] Click New
- [ ] Configure:
  - Name: `FundEavor Payment Webhook`
  - API ID: `fundeavor_payment_webhook`
  - Version: `1`
  - Base API URL: `/api/x_adsr_fundeavor`
- [ ] Save
- [ ] Note endpoint URL: `https://{your-instance}.service-now.com/api/x_adsr_fundeavor/payment/webhook`

**3b. Create REST Resource**
- [ ] Click "Create REST Resource" under the API
- [ ] Name: `Payment Webhook`
- [ ] Resource: `/payment/webhook`
- [ ] Methods: POST only
- [ ] Save

**3c. Add Script to POST Method**
- [ ] Click the POST method
- [ ] Copy script from STRIPE_INTEGRATION_GUIDE.md (Step 2 section)
- [ ] Paste into Script box
- [ ] Save

### Step 4: Create System Properties (5 min)

**4a. Add Stripe Secret Key**
- [ ] In ServiceNow, go to System Properties
- [ ] Click New
- [ ] Property: `x_adsr_fundeavor.stripe_secret_key`
- [ ] Value: `sk_test_...` (paste your Stripe secret key)
- [ ] Type: String
- [ ] Private: ✅ (check)
- [ ] Save

**4b. Add Stripe Publishable Key**
- [ ] Click New
- [ ] Property: `x_adsr_fundeavor.stripe_publishable_key`
- [ ] Value: `pk_test_...` (paste your Stripe publishable key)
- [ ] Type: String
- [ ] Private: ✅ (check)
- [ ] Save

**4c. Add Stripe Webhook Secret**
- [ ] Click New
- [ ] Property: `x_adsr_fundeavor.stripe_webhook_secret`
- [ ] Value: `[leave empty for now]`
- [ ] Type: String
- [ ] Private: ✅ (check)
- [ ] Save

---

## 📱 Phase 3: Configure Stripe Webhook (10 minutes)

### Step 1: Configure Webhook in Stripe

**1a. Open Stripe Dashboard**
- [ ] Go to https://dashboard.stripe.com
- [ ] Click Developers (left menu)
- [ ] Click Webhooks

**1b. Add Endpoint**
- [ ] Click "Add an endpoint"
- [ ] URL: `https://{your-instance}.service-now.com/api/x_adsr_fundeavor/payment/webhook`
  - Replace `{your-instance}` with your actual instance name
  - Example: `https://dev12345.service-now.com/api/x_adsr_fundeavor/payment/webhook`
- [ ] Events: Click "Select events"
  - [ ] ✅ `payment_intent.succeeded`
  - [ ] ✅ `payment_intent.payment_failed`
  - [ ] (Optional) `charge.refunded`
- [ ] Click "Add endpoint"

**1c. Copy Webhook Secret**
- [ ] After endpoint created, click on it
- [ ] Scroll to "Signing secret"
- [ ] Copy the secret (starts with `whsec_`)
- [ ] Keep it safe (you'll need it in next step)

### Step 2: Save Webhook Secret in ServiceNow

**2a. Update System Property**
- [ ] In ServiceNow, go to System Properties
- [ ] Find: `x_adsr_fundeavor.stripe_webhook_secret`
- [ ] Click Edit
- [ ] Value: Paste the secret you just copied
- [ ] Save

**2b. Verify Connection**
- [ ] Back in Stripe, click "Send a test event"
- [ ] Select `payment_intent.succeeded`
- [ ] Check "Attempt Delivery"
- [ ] Should see green checkmark (successful delivery)

---

## ✅ Phase 4: Test Donation Flow (15 minutes)

### Step 1: Open Chat Widget

- [ ] In ServiceNow, open a portal or dashboard
- [ ] Load the FundEavor chat widget
- [ ] Should see: "Welcome to FundEavor Chat!"
- [ ] See buttons: "Recent", "My Donations", "Critical"
- [ ] See button: "💳 Donate Now"

### Step 2: Test Donation Button

- [ ] Click "💳 Donate Now"
- [ ] Should see modal form with:
  - [ ] Campaign field (text input)
  - [ ] Amount field (₹ symbol visible)
  - [ ] Donation Type dropdown (one-time, monthly, etc.)
  - [ ] Buttons: Cancel, Proceed to Payment
- [ ] Leave campaign empty (optional)
- [ ] Enter amount: `100`
- [ ] Select type: `One-time Donation`
- [ ] Click "Proceed to Payment"

### Step 3: Complete Test Payment

- [ ] Should see message in chat with payment link
- [ ] Click the payment link (opens Stripe checkout)
- [ ] Should see Stripe hosted payment page
- [ ] Enter test card: `4242 4242 4242 4242`
- [ ] Expiry: Any future date (e.g., `12/25`)
- [ ] CVC: Any 3 digits (e.g., `123`)
- [ ] Name: `Test User`
- [ ] Click "Pay" button

### Step 4: Verify Success in ServiceNow

**4a. Check Donation Record**
- [ ] Go to x_adsr_fundeavor_donation table
- [ ] Find your test donation (should be first in list)
- [ ] Verify fields:
  - [ ] Status: `completed`
  - [ ] Amount: `100`
  - [ ] Stripe_payment_id: (should be populated)
  - [ ] Paid_date: (should be set)

**4b. Check Campaign Amount**
- [ ] Go to x_adsr_fundeavor_campaign table
- [ ] Find campaign (if you selected one)
- [ ] Verify: `raised_amount` increased by ₹100

**4c. Check Transaction Log**
- [ ] Go to x_adsr_fundeavor_transaction_log table
- [ ] Should see 2 entries:
  - [ ] `payment_intent_created` (when form submitted)
  - [ ] `payment_success` (when webhook fired)

**4d. Check Donation Email**
- [ ] Check email inbox (your account)
- [ ] Should see email from `noreply@fundeavor.org`
- [ ] Subject: "🎉 Thank you for your donation!"
- [ ] Contains:
  - [ ] Donation ID
  - [ ] Campaign name
  - [ ] Amount (₹100)
  - [ ] Thank you message

### Step 5: Check Logs

- [ ] In ServiceNow, go to System Logs > All
- [ ] Filter for recent entries
- [ ] Should see:
  - [ ] "Payment intent created: pi_..."
  - [ ] "Payment successful for donation: ..."
  - [ ] No error messages
- [ ] If errors, troubleshoot (see STRIPE_INTEGRATION_GUIDE.md)

---

## 📊 Phase 5: Validate Everything (5 minutes)

### Validation Checklist

**Code Deployed**
- [ ] x_adsr_fundeavor_stripe_processor.js created
- [ ] fundeavor_agent_v2.js updated
- [ ] fundeavor_chat_widget.js deployed
- [ ] No syntax errors in any file

**REST API Created**
- [ ] Endpoint exists: `/api/x_adsr_fundeavor/payment/webhook`
- [ ] Method: POST only
- [ ] Script added
- [ ] URL accessible

**Stripe Configured**
- [ ] Test keys added to ServiceNow properties
- [ ] Webhook created in Stripe dashboard
- [ ] Webhook secret saved in ServiceNow
- [ ] Webhook delivery successful (test event)

**Payment Flow Works**
- [ ] Chat widget loads without errors
- [ ] "Donate Now" button visible
- [ ] Modal form appears
- [ ] Test payment completes
- [ ] Donation record created with status=completed
- [ ] Email confirmation sent
- [ ] Transaction logged

**No Errors**
- [ ] ServiceNow system logs show no errors
- [ ] Browser console shows no errors
- [ ] Stripe webhook shows successful delivery

---

## 🎯 Phase 6: Go Live (After Testing)

### When You're Ready

- [ ] Completed all tests successfully
- [ ] Got approval from management
- [ ] Briefed support team
- [ ] Created backup of donation tables
- [ ] Documented any customizations

### Switch to Live Keys

- [ ] Get live Stripe keys from Stripe dashboard
  - [ ] `sk_live_...` (Secret Key)
  - [ ] `pk_live_...` (Publishable Key)
- [ ] In ServiceNow, update system properties:
  - [ ] Update `x_adsr_fundeavor.stripe_secret_key` with live key
  - [ ] Update `x_adsr_fundeavor.stripe_publishable_key` with live key
- [ ] Create live webhook in Stripe dashboard
- [ ] Update `x_adsr_fundeavor.stripe_webhook_secret` with live secret

### Announcements

- [ ] Send email to users about new donation feature
- [ ] Post in chat bot welcome message
- [ ] Add to release notes
- [ ] Brief support team on common questions

---

## 📈 Phase 7: Monitor (First 24 Hours)

### Hourly Checks

- [ ] Check ServiceNow logs for errors (every hour)
- [ ] Check Stripe dashboard for webhook failures
- [ ] Monitor payment success rate (target >98%)
- [ ] Check email deliveries

### Daily Check (After First 24h)

- [ ] Review all donations created (x_adsr_fundeavor_donation table)
- [ ] Verify all email confirmations sent
- [ ] Check transaction log for completeness
- [ ] Verify campaign amounts updated correctly
- [ ] Review any failed donations

### Weekly Check (After First Week)

- [ ] Reconcile ServiceNow donations with Stripe charges
- [ ] Analyze donation patterns
- [ ] Review system performance
- [ ] Check for any recurring issues
- [ ] Document learnings

---

## 🚨 Troubleshooting

### If Webhook Not Firing

1. [ ] Go to Stripe Dashboard > Webhooks
2. [ ] Find your endpoint
3. [ ] Check "Events" section for failed deliveries
4. [ ] Click failed event to see error
5. [ ] Common issues:
   - URL incorrect
   - Firewall blocking
   - ServiceNow not reachable
6. [ ] Send test event again after fixing

### If Donation Not Updating

1. [ ] Check donation record exists (x_adsr_fundeavor_donation table)
2. [ ] Check status: should be "pending_payment" before webhook
3. [ ] Check ServiceNow logs for errors
4. [ ] Verify script syntax in REST API
5. [ ] Manually trigger webhook via Stripe dashboard

### If Email Not Sent

1. [ ] Check SMTP configured in ServiceNow
2. [ ] Check email address in donation record
3. [ ] Check GlideEmail permissions
4. [ ] Review any email logs
5. [ ] Test email notification separately

### If Stripe Keys Not Found

1. [ ] Go to System Properties
2. [ ] Verify exact property names:
   - `x_adsr_fundeavor.stripe_secret_key`
   - `x_adsr_fundeavor.stripe_publishable_key`
   - `x_adsr_fundeavor.stripe_webhook_secret`
3. [ ] Verify values are not empty
4. [ ] Check spelling (case-sensitive)

---

## 📝 Phase 8: Documentation

### Keep Records

- [ ] Document any customizations made
- [ ] Record Stripe webhook URL (in case needed later)
- [ ] Keep copy of live API keys (in password manager, not in code)
- [ ] Document any issues encountered + solutions
- [ ] Log all system property changes

### Support Handoff

- [ ] Brief support team on:
  - How donation flow works
  - How to check donation records
  - Common troubleshooting steps
  - Who to escalate to (dev team)
- [ ] Provide them with DONATION_QUICK_REFERENCE.md
- [ ] Create FAQ document for users

---

## ✨ Success Criteria

You're ready to celebrate when:

✅ Code deployed without errors  
✅ REST endpoint created and accessible  
✅ Stripe webhook configured and delivering  
✅ Test donation completed successfully  
✅ Donation record created with correct status  
✅ Campaign amount updated  
✅ Email confirmation sent  
✅ Transaction logged  
✅ No errors in ServiceNow logs  
✅ Stripe reports successful payment  
✅ First 24 hours monitored with no issues  
✅ Team briefed and ready to support  

---

## 🎉 You Did It!

Congratulations on deploying the donation feature! 🚀

**What's Next:**
- Monitor closely for first week
- Collect user feedback
- Plan Phase 2 enhancements (recurring donations, donor portal)
- Celebrate the impact of enabling in-app donations!

---

**Questions?** See the relevant guide:
- Setup: STRIPE_INTEGRATION_GUIDE.md
- Deployment: DONATION_DEPLOYMENT_GUIDE.md
- Reference: TECHNICAL_SPECIFICATION.md
- Quick Help: DONATION_QUICK_REFERENCE.md
