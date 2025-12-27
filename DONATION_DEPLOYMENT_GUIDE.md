# FundEavor Donation Integration - Complete Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Chat Widget (Client)                       │
│  - Donation modal form                                       │
│  - Stream responses line-by-line                             │
│  - Quick action buttons (Recent, My Donations, Donate Now)   │
└──────────────────────┬──────────────────────────────────────┘
                       │ GlideAjax POST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│             fundeavor_agent_v2.js (Script Include)           │
│  - Intent detection: DONATE_TO_CAMPAIGN, INITIATE_DONATION   │
│  - Tool routing: 11 tools (2 new for donations)              │
│  - LLM orchestration: GPT-4o-mini via OpenAI API             │
│  - Token optimization: 150-400 tokens per query              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ├─► Campaign queries ────► GlideRecord
                       │   (campaigns, donations, subscriptions)
                       │
                       └─► donateToCampaign ─────┐
                           (NEW!)                  │
                                                  ▼
                   ┌──────────────────────────────────────────────┐
                   │ x_adsr_fundeavor_stripe_processor             │
                   │  - createPaymentIntent(donation, amount)      │
                   │  - Returns: payment_url, client_secret        │
                   │  - Handles webhooks (success/failure)         │
                   │  - Sends confirmation emails                  │
                   └──────────────────────┬───────────────────────┘
                                         │ Calls Stripe API
                                         ▼
                   ┌──────────────────────────────────────────────┐
                   │        Stripe Payment Gateway                 │
                   │  - Creates payment intent                     │
                   │  - Hosts checkout page                        │
                   │  - Secures payment processing                 │
                   │  - Sends webhooks on success/failure          │
                   └──────────────────────┬───────────────────────┘
                                         │ Webhook: payment.intent.succeeded
                                         ▼
                   ┌──────────────────────────────────────────────┐
                   │ ServiceNow REST Webhook Endpoint              │
                   │  /api/x_adsr_fundeavor/payment/webhook        │
                   │  - Verifies Stripe signature                  │
                   │  - Routes to processor                        │
                   │  - Updates donation record                    │
                   │  - Increments campaign.raised_amount          │
                   │  - Sends thank-you email                      │
                   │  - Logs audit trail                           │
                   └──────────────────────┬───────────────────────┘
                                         │
                            ┌────────────┼────────────┐
                            ▼            ▼            ▼
                        GlideRecord   Email        Audit Log
                        (donation,   (Thank You)   (Transaction
                         campaign)                  Log)
```

---

## Files to Deploy

### 1. **fundeavor_agent_v2.js** (Already Updated)
- **Type:** Script Include
- **Changes:** 
  - Added `DONATE_TO_CAMPAIGN` and `INITIATE_DONATION` intent detection
  - Added `donateToCampaign` and `initiateDonation` tools
  - Methods: `_donateToCampaign()`, `_initiateDonation()`
- **Size:** ~1093 lines
- **Status:** ✅ Ready to deploy

### 2. **fundeavor_chat_widget.js** (Updated)
- **Type:** UI Script + Directive
- **Changes:**
  - Added donation modal form
  - Added `openDonationModal()`, `closeDonationModal()`, `submitDonation()`
  - Added donation payment link handling
  - Updated HTML template with modal + styling
- **Size:** ~900+ lines
- **Status:** ✅ Ready to deploy

### 3. **x_adsr_fundeavor_stripe_processor.js** (New)
- **Type:** Script Include
- **Purpose:** Stripe API integration
- **Key Methods:**
  - `createPaymentIntent()` - Creates Stripe payment intent
  - `handlePaymentSuccess()` - Updates donation record + campaign amount + sends email
  - `handlePaymentFailure()` - Logs failed donation
  - `refundDonation()` - Full refund support
  - `verifyWebhookSignature()` - Webhook signature validation
- **Size:** ~300 lines
- **Status:** ✅ Ready to deploy

### 4. **REST API Endpoint** (New)
- **Type:** Scripted REST API
- **Endpoint:** `/api/x_adsr_fundeavor/payment/webhook`
- **Method:** POST
- **Purpose:** Receives Stripe webhook events
- **Script:** Provided in STRIPE_INTEGRATION_GUIDE.md
- **Status:** ⏳ Needs to be created in ServiceNow

### 5. **System Properties** (New)
- **Type:** System Configuration
- **Properties:**
  - `x_adsr_fundeavor.stripe_secret_key` = `sk_test_...`
  - `x_adsr_fundeavor.stripe_publishable_key` = `pk_test_...`
  - `x_adsr_fundeavor.stripe_webhook_secret` = `whsec_...`
- **Status:** ⏳ Needs to be created

### 6. **Database Tables** (May need creation)
- `x_adsr_fundeavor_donation` (with status, stripe_payment_id fields)
- `x_adsr_fundeavor_donation_session` (for session tracking)
- `x_adsr_fundeavor_transaction_log` (for audit trail)

---

## Deployment Checklist

### Phase 1: Prepare Stripe Account (Pre-Deployment)
- [ ] Create Stripe account at https://stripe.com
- [ ] Verify email
- [ ] Enable India payments (for INR currency)
- [ ] Generate test API keys
  - [ ] Copy `sk_test_*` (secret key)
  - [ ] Copy `pk_test_*` (publishable key)

### Phase 2: Create ServiceNow Infrastructure
- [ ] Create Script Include: `x_adsr_fundeavor_stripe_processor`
- [ ] Create/Verify Script Include: `fundeavor_agent_v2`
- [ ] Create/Verify UI Script: `fundeavor_chat_widget`
- [ ] Create REST API: `/api/x_adsr_fundeavor/payment/webhook`
- [ ] Create System Properties (3 items):
  - [ ] `x_adsr_fundeavor.stripe_secret_key`
  - [ ] `x_adsr_fundeavor.stripe_publishable_key`
  - [ ] `x_adsr_fundeavor.stripe_webhook_secret` (empty for now)
- [ ] Verify Database Tables:
  - [ ] `x_adsr_fundeavor_donation`
  - [ ] `x_adsr_fundeavor_campaign`
  - [ ] `x_adsr_fundeavor_transaction_log`

### Phase 3: Configure Stripe Webhook
- [ ] Get webhook URL from ServiceNow API: `https://{instance}.service-now.com/api/x_adsr_fundeavor/payment/webhook`
- [ ] In Stripe Dashboard → Developers → Webhooks:
  - [ ] Click "Add endpoint"
  - [ ] Enter webhook URL
  - [ ] Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
  - [ ] Create endpoint
- [ ] Copy webhook secret (starts with `whsec_`)
- [ ] Paste into ServiceNow system property: `x_adsr_fundeavor.stripe_webhook_secret`

### Phase 4: Deploy to Production
- [ ] Test with test keys first (see testing section)
- [ ] Verify all logs look normal
- [ ] Verify emails are being sent
- [ ] Get payment approval from finance team
- [ ] Switch to live Stripe keys:
  - [ ] Update `x_adsr_fundeavor.stripe_secret_key` to `sk_live_*`
  - [ ] Update `x_adsr_fundeavor.stripe_publishable_key` to `pk_live_*`
  - [ ] Update Stripe webhook to live URL
- [ ] Create webhook endpoint for live Stripe account
- [ ] Update system property: `x_adsr_fundeavor.stripe_webhook_secret` (live version)
- [ ] Test with real transaction (small amount)

### Phase 5: Go Live
- [ ] Monitor donation flow for 24 hours
- [ ] Check bank deposits appear in 2-3 business days
- [ ] Set up alerts for failed donations
- [ ] Brief support team on troubleshooting
- [ ] Create user documentation

---

## Deployment Steps (Detailed)

### Step 1: Deploy Script Includes

**In ServiceNow:**
1. Navigate to **System Definition > Script Includes**
2. Create new or update existing:

```
Name: fundeavor_agent_v2
Type: Script Include
Client callable: ✓
Active: ✓
Accessible from: All application scopes
```
Paste: [Content of fundeavor_agent_v2.js](fundeavor_agent_v2.js)

3. Create another:

```
Name: x_adsr_fundeavor_stripe_processor
Type: Script Include
Client callable: ✗ (server-side only)
Active: ✓
Accessible from: All application scopes
```
Paste: [Content of x_adsr_fundeavor_stripe_processor.js](x_adsr_fundeavor_stripe_processor.js)

### Step 2: Deploy UI Script

**In ServiceNow:**
1. Navigate to **System UI > UI Scripts**
2. Create new:

```
Name: fundeavor_chat_widget
Active: ✓
```
Paste: [Content of fundeavor_chat_widget.js](fundeavor_chat_widget.js)

### Step 3: Create REST API Endpoint

**In ServiceNow:**
1. Navigate to **System Web Services > REST APIs**
2. Click **New**

```
Name: FundEavor Payment Webhook
API ID: fundeavor_payment_webhook
Version: 1
Base API URL: /api/x_adsr_fundeavor
```

3. Click **Save**
4. Click **Create REST Resource**

```
Name: Payment Webhook
Resource: /payment/webhook
HTTP Method: POST only
```

5. Click **POST** and add script from STRIPE_INTEGRATION_GUIDE.md

### Step 4: Add System Properties

**In ServiceNow:**
1. Navigate to **System Properties**
2. Create 3 new properties:

```
Property: x_adsr_fundeavor.stripe_secret_key
Value: sk_test_[YOUR_KEY]
Private: ✓

Property: x_adsr_fundeavor.stripe_publishable_key  
Value: pk_test_[YOUR_KEY]
Private: ✓

Property: x_adsr_fundeavor.stripe_webhook_secret
Value: [LEAVE EMPTY FOR NOW]
Private: ✓
```

### Step 5: Test Donation Flow

1. **Open Chat Widget:**
   - Navigate to your ServiceNow portal
   - Open FundEavor Chat Widget

2. **Click "💳 Donate Now" Button**
   - Fill form:
     - Campaign: `CAM001`
     - Amount: `100`
     - Type: One-time
   - Click "Proceed to Payment"

3. **Complete Stripe Payment:**
   - Use test card: `4242 4242 4242 4242`
   - Expiry: `12/25`
   - CVC: `123`
   - Name: `Test User`
   - Click "Pay"

4. **Verify in ServiceNow:**
   - Check **x_adsr_fundeavor_donation** table
   - Donation should have `status = completed`
   - `stripe_payment_id` should be populated
   - Check **x_adsr_fundeavor_campaign** - `raised_amount` should be updated
   - Check email inbox for confirmation

5. **Check Logs:**
   - ServiceNow: **System Logs > All** for any errors
   - Stripe: **Developers > Webhooks** for webhook delivery status
   - Transaction log: **x_adsr_fundeavor_transaction_log** should have entries

---

## Testing Scenarios

### Scenario 1: Successful One-Time Donation

```
User: "I want to donate ₹500 to CAM001"
↓
Agent: [Detects DONATE_TO_CAMPAIGN intent]
↓
Creates donation record (status: pending_payment)
↓
Calls Stripe processor
↓
Returns: Payment link with payment intent
↓
User clicks link → Stripe checkout page
↓
User enters test card (4242 4242 4242 4242)
↓
Stripe: payment_intent.succeeded webhook fires
↓
ServiceNow: Updates donation status to completed
↓
ServiceNow: Updates campaign raised_amount
↓
ServiceNow: Sends confirmation email
✓ PASS
```

### Scenario 2: Payment Failure

```
User: [Same donation flow]
↓
User enters declined card (4000000000000002)
↓
Stripe: payment_intent.payment_failed webhook fires
↓
ServiceNow: Updates donation status to failed
↓
ServiceNow: Logs failure reason
✓ PASS
```

### Scenario 3: Refund Request

```
Admin: Initiates refund from donation record
↓
Stripe processor: Calls Stripe refund API
↓
Donation status: refunded
↓
Campaign raised_amount: decremented
✓ PASS
```

### Scenario 4: Generic Donation (No Campaign)

```
User: "I want to make a donation"
↓
Agent: [Detects INITIATE_DONATION intent]
↓
Shows donation modal without campaign pre-fill
↓
User enters amount: ₹1000
↓
Creates session, initiates payment
✓ PASS
```

---

## Monitoring & Maintenance

### Daily Checks
- [ ] **ServiceNow Logs:** Check for errors in System Logs
- [ ] **Stripe Dashboard:** Check for webhook failures
- [ ] **Failed Donations:** Follow up with users who got declined

### Weekly Checks
- [ ] **Transaction Totals:** Verify donations in transaction log match Stripe
- [ ] **Campaign Amounts:** Verify raised_amount is accurate
- [ ] **Email Delivery:** Check bounce rates on donation confirmations

### Monthly Checks
- [ ] **Reconciliation:** Match ServiceNow donations to Stripe charges
- [ ] **Refunds:** Review any refunds issued
- [ ] **Performance:** Check payment failure rate (target <2%)
- [ ] **Compliance:** Verify audit logs are complete

### Setup Alerts (ServiceNow)
Create Business Rule alerts for:
1. `x_adsr_fundeavor_donation.status = 'failed'` → Email admin
2. Webhook delivery failures → Email dev team
3. High failure rate (>5% in 1 hour) → Email team

---

## Customization Examples

### Add Recurring Donations

In **fundeavor_agent_v2.js**, update `_donateToCampaign()`:

```javascript
if (input.frequency && input.frequency !== 'one_time') {
    // Create subscription instead of one-time
    var subscription = new GlideRecord('x_adsr_fundeavor_subscription');
    subscription.donor = input.donor_id;
    subscription.campaign = input.campaign_id;
    subscription.amount = input.amount;
    subscription.frequency = input.frequency;  // monthly, quarterly, yearly
    subscription.status = 'pending_first_payment';
    var subId = subscription.insert();
    
    // Use subscription ID instead of donation ID
    var stripeResult = processor.createPaymentIntent(subId, input.amount, {
        subscription_id: subId,
        frequency: input.frequency
    });
}
```

### Add Donor Recognition Page

Create public view of top donors:

```javascript
_getTopDonors: function(limit) {
    limit = limit || 10;
    var result = [];
    
    var query = new GlideQuery('x_adsr_fundeavor_donation');
    query.filter('status', '=', 'completed');
    query.orderByDescending('amount');
    query.limit(limit);
    
    var records = query.select();
    records.forEach(function(donation) {
        var donor = new GlideRecord('sys_user');
        donor.get(donation.sys_created_by);
        
        result.push({
            donor_name: donor.getValue('first_name') + ' ' + donor.getValue('last_name'),
            amount: donation.amount,
            date: donation.paid_date,
            campaign: donation.campaign.getDisplayValue()
        });
    });
    
    return result;
}
```

### Add Tax Receipt Generation

```javascript
_generateTaxReceipt: function(donation) {
    var report = new GlideReport();
    report.setTable('x_adsr_fundeavor_donation');
    report.setFilter('sys_id', donation.sys_id);
    report.setFormat('PDF');
    report.setTitle('Tax Receipt - Donation ID: ' + donation.number);
    
    var pdfData = report.build();
    
    // Email PDF to donor
    var email = new GlideEmail();
    email.setSubject('Tax Receipt for Your Donation - ₹' + donation.amount);
    email.setBody('Please find attached your tax receipt...');
    email.addAttachment(pdfData, 'tax_receipt_' + donation.number + '.pdf');
    email.addRecipient(donation.sys_created_by);
    email.send();
}
```

---

## Performance Optimization

### Caching Donations
```javascript
// Cache donor's donation history for 1 hour
var cacheKey = 'donations_' + gs.getUserID();
var cache = gs.getSessionStore().get(cacheKey);
if (!cache) {
    cache = getDonations(gs.getUserID());
    gs.getSessionStore().set(cacheKey, cache, 3600);
}
```

### Batch Webhook Processing
If high volume, process webhooks asynchronously:
```javascript
// Instead of immediate processing
processor.handlePaymentSuccess(paymentIntent);

// Use async worker
// gs.getSession().setUser('webhook_processor');
// gs.executeNow('x_adsr_fundeavor_webhook_processor', {paymentIntent: paymentIntent});
```

### Query Optimization
```javascript
// Slow: Get all donations then filter
var donations = new GlideRecord('x_adsr_fundeavor_donation');
donations.query();

// Fast: Filter at database level
var donations = new GlideRecord('x_adsr_fundeavor_donation');
donations.addQuery('sys_created_by', gs.getUserID());
donations.addQuery('status', 'completed');
donations.orderByDescending('paid_date');
donations.query();
```

---

## Troubleshooting Reference

| Problem | Cause | Solution |
|---------|-------|----------|
| "Stripe key not found" | System property missing | Check property names are exact: `x_adsr_fundeavor.stripe_secret_key` |
| Webhook not receiving events | URL incorrect or firewalled | Verify URL in Stripe dashboard matches your instance |
| Payment created but donation not updated | Webhook signature mismatch | Check webhook secret in system property matches Stripe |
| Invalid signature error | Wrong secret or payload modified | Ensure webhook secret is copied exactly from Stripe |
| Email not sent | SMTP not configured | Check ServiceNow email settings in System Configuration |
| Campaign amount not updating | Script error in processor | Check ServiceNow logs for GlideRecord errors |

---

## Migration from Pilot to Production

**Week 1: Test with Sample Data**
- Deploy to test instance
- Run 10 test transactions
- Verify all logs and emails
- Get business approval

**Week 2: Limited Production Rollout**
- Deploy to production with test keys
- Allow 50 users to test
- Monitor failure rate
- Gather feedback

**Week 3: Full Rollout**
- Switch to live Stripe keys
- Enable for all users
- Send user announcement
- Monitor for issues

**Ongoing: Maintenance**
- Daily monitoring of logs
- Weekly reconciliation
- Monthly performance review
- Quarterly security audit

---

**Version:** 1.0  
**Last Updated:** 2025  
**Status:** Production Ready
