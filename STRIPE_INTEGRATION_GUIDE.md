# FundEavor Stripe Payment Integration Guide

## Overview

This guide walks you through integrating Stripe payment processing with the FundEavor chat agent, enabling users to donate directly from the chat interface.

**What's Done:**
- ✅ Agent v2 with donation intent detection
- ✅ Stripe payment processor (Script Include)
- ✅ Chat widget with donation modal UI
- ✅ Database structure (tables defined)

**What's Left (4 Steps):**
1. Configure Stripe API keys in ServiceNow
2. Create webhook endpoint to receive Stripe events
3. Set up Stripe webhook in dashboard
4. Test end-to-end donation flow

---

## Step 1: Configure Stripe API Keys

### 1.1 Get Your Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers > API Keys**
3. Copy:
   - **Secret Key** (starts with `sk_test_` or `sk_live_`)
   - **Publishable Key** (starts with `pk_test_` or `pk_live_`)

**For Testing:**
- Use `sk_test_*` and `pk_test_*` keys (Stripe provides test card numbers)
- Test cards: `4242 4242 4242 4242`, `5555 5555 5555 4444`, etc.

### 1.2 Add Keys to ServiceNow

1. In ServiceNow, go to **System Properties > Search**
2. Create new properties (or edit if existing):

```
Property Name: x_adsr_fundeavor.stripe_secret_key
Value: sk_test_... (paste your secret key)
Type: String
Private: ✓ (mark as private)
```

```
Property Name: x_adsr_fundeavor.stripe_publishable_key
Value: pk_test_... (paste your publishable key)
Type: String
Private: ✓
```

```
Property Name: x_adsr_fundeavor.stripe_webhook_secret
Value: whsec_... (we'll get this in Step 3)
Type: String
Private: ✓
```

**Note:** Mark properties as private to hide from regular users.

---

## Step 2: Create Webhook Endpoint in ServiceNow

### 2.1 Create Scripted REST API Endpoint

1. In ServiceNow, go to **System Web Services > REST APIs**
2. Click **New** to create a new API
3. Configure:

```
Name: FundEavor Payment Webhook
API ID: fundeavor_payment_webhook
Version: 1
Base API URL: /api/x_adsr_fundeavor
Namespace: x_adsr_fundeavor
```

### 2.2 Create REST Resource

1. Click **Create REST Resource** under your API
2. Configure:

```
Name: Payment Webhook
Resource: /payment/webhook
HTTP Methods: POST only
```

### 2.3 Add Script (POST Method)

Click the **POST** method and add this script:

```javascript
/**
 * Stripe Webhook Endpoint
 * POST /api/x_adsr_fundeavor/payment/webhook
 * 
 * Receives payment intent webhooks from Stripe
 */

(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    
    try {
        var payload = request.body.dataString;
        var signature = request.getHeader('stripe-signature');

        if (!payload || !signature) {
            response.setStatus(400);
            response.setBody(JSON.stringify({ error: 'Missing payload or signature' }));
            return;
        }

        // Verify webhook signature
        var processor = new x_adsr_fundeavor_stripe_processor();
        
        if (!processor.verifyWebhookSignature(payload, signature)) {
            response.setStatus(401);
            response.setBody(JSON.stringify({ error: 'Invalid signature' }));
            gs.warn('Invalid webhook signature received');
            return;
        }

        // Parse event
        var event = JSON.parse(payload);
        
        gs.info('Received Stripe webhook: ' + event.type);

        // Route event
        switch(event.type) {
            case 'payment_intent.succeeded':
                processor.handlePaymentSuccess(event.data.object);
                response.setStatus(200);
                response.setBody(JSON.stringify({ 
                    success: true, 
                    event: 'payment_intent.succeeded' 
                }));
                break;

            case 'payment_intent.payment_failed':
                processor.handlePaymentFailure(event.data.object);
                response.setStatus(200);
                response.setBody(JSON.stringify({ 
                    success: true, 
                    event: 'payment_intent.payment_failed' 
                }));
                break;

            case 'charge.refunded':
                // Optional: handle refund events
                response.setStatus(200);
                response.setBody(JSON.stringify({ 
                    success: true, 
                    event: 'charge.refunded' 
                }));
                break;

            default:
                // Acknowledge other events without processing
                response.setStatus(200);
                response.setBody(JSON.stringify({ 
                    success: true, 
                    event: event.type,
                    note: 'Event received but not processed'
                }));
        }

    } catch (e) {
        gs.error('Webhook processing error: ' + e.message);
        response.setStatus(500);
        response.setBody(JSON.stringify({ 
            error: 'Server error',
            message: e.message 
        }));
    }

})(request, response);
```

### 2.4 Note Your Webhook URL

After creating the API, your webhook URL will be:

```
https://{your-instance}.service-now.com/api/x_adsr_fundeavor/payment/webhook
```

Example:
```
https://dev12345.service-now.com/api/x_adsr_fundeavor/payment/webhook
```

---

## Step 3: Configure Stripe Webhook

### 3.1 Add Webhook Endpoint to Stripe

1. In Stripe Dashboard, go to **Developers > Webhooks**
2. Click **Add an endpoint**
3. Configure:

```
Endpoint URL: https://{your-instance}.service-now.com/api/x_adsr_fundeavor/payment/webhook

Events to send:
  ✓ payment_intent.succeeded
  ✓ payment_intent.payment_failed
  ✓ charge.refunded (optional)
```

4. Click **Add endpoint**

### 3.2 Copy Webhook Secret

1. After creating endpoint, click it to view details
2. Scroll to **Signing secret**
3. Copy the secret (starts with `whsec_`)
4. Paste into ServiceNow system property:

```
Property: x_adsr_fundeavor.stripe_webhook_secret
Value: whsec_... (paste here)
```

---

## Step 4: Test End-to-End Donation Flow

### 4.1 Test with Chat Widget

1. Open FundEavor chat widget in ServiceNow portal
2. Click **"💳 Donate Now"** button
3. Fill form:
   - Campaign: `CAM001` (or your test campaign number)
   - Amount: `100` (₹100)
   - Type: One-time
4. Click **"Proceed to Payment"**

### 4.2 Simulate Chat Request

Alternatively, type in chat:
```
I want to donate ₹500 to CAM001
```

Agent should respond:
```
✅ Donation Ready for Payment

Campaign: [Campaign Title]
Amount: ₹500
Donation ID: abc123def456

🔐 Secure Stripe Payment Link:
https://checkout.stripe.com/pay/pi_1234567890...

Click the link to complete payment.
```

### 4.3 Complete Payment on Stripe

1. Click the payment link
2. Use test card: `4242 4242 4242 4242`
3. Expiry: Any future date (e.g., `12/25`)
4. CVC: Any 3 digits (e.g., `123`)
5. Click **Pay**

### 4.4 Verify in ServiceNow

Check these tables to confirm:

**Donation Record:**
- Navigate to **x_adsr_fundeavor_donation**
- Find your donation (should have status = `completed`)
- Verify stripe_payment_id is populated

**Campaign Updated:**
- Open **x_adsr_fundeavor_campaign** record
- Check `raised_amount` was incremented

**Transaction Log:**
- Check **x_adsr_fundeavor_transaction_log** for audit trail
- Should show: payment_intent_created → payment_success

**Email Sent:**
- Check donor's email for confirmation message
- Subject: "🎉 Thank you for your donation!"

---

## Database Tables Setup

If not already created, create these tables:

### x_adsr_fundeavor_donation
```sql
CREATE TABLE x_adsr_fundeavor_donation (
    sys_id VARCHAR(32) PRIMARY KEY,
    number VARCHAR(20) UNIQUE,
    donor_id VARCHAR(32) REFERENCES sys_user(sys_id),
    campaign VARCHAR(32) REFERENCES x_adsr_fundeavor_campaign(sys_id),
    amount DECIMAL(10,2),
    status VARCHAR(20),  -- draft, pending_payment, completed, failed, refunded
    donation_date DATETIME,
    paid_date DATETIME,
    refund_date DATETIME,
    stripe_payment_id VARCHAR(100),
    stripe_refund_id VARCHAR(100),
    failure_reason TEXT,
    sys_created_by VARCHAR(32),
    sys_created_on DATETIME,
    sys_updated_by VARCHAR(32),
    sys_updated_on DATETIME
);
```

### x_adsr_fundeavor_donation_session
```sql
CREATE TABLE x_adsr_fundeavor_donation_session (
    sys_id VARCHAR(32) PRIMARY KEY,
    donor_id VARCHAR(32) REFERENCES sys_user(sys_id),
    donor_email VARCHAR(100),
    session_status VARCHAR(20),  -- initiated, completed, abandoned
    created_on DATETIME,
    expires_on DATETIME
);
```

### x_adsr_fundeavor_transaction_log
```sql
CREATE TABLE x_adsr_fundeavor_transaction_log (
    sys_id VARCHAR(32) PRIMARY KEY,
    type VARCHAR(50),  -- payment_intent_created, success, failure, refund
    reference_id VARCHAR(32),
    stripe_id VARCHAR(100),
    amount DECIMAL(10,2),
    status VARCHAR(20),
    details TEXT,
    sys_created_on DATETIME
);
```

---

## Troubleshooting

### Problem: Webhook not receiving events

**Solution:**
1. Check Stripe Dashboard > Webhooks for failed deliveries
2. Verify webhook URL is accessible from internet
3. Check ServiceNow instance allows inbound REST calls
4. Verify signature secret is correct in system properties

### Problem: Stripe keys not found

**Solution:**
1. Verify system properties are created with exact names:
   - `x_adsr_fundeavor.stripe_secret_key`
   - `x_adsr_fundeavor.stripe_publishable_key`
   - `x_adsr_fundeavor.stripe_webhook_secret`
2. Check properties are not private/restricted
3. Check user has access to read system properties

### Problem: Payment successful but donation not updated

**Solution:**
1. Check transaction logs: **x_adsr_fundeavor_transaction_log**
2. Verify webhook was received (check logs)
3. Verify donation record exists with correct sys_id
4. Check ServiceNow user permissions for GlideRecord updates

### Problem: Test mode stuck

**Solution:**
1. Delete test donation records
2. Use fresh test cards from Stripe docs
3. Check Stripe webhook endpoint returns HTTP 200

---

## Security Checklist

- [ ] Stripe keys stored as private system properties
- [ ] Webhook secret verified on every event
- [ ] REST API endpoint restricted to HTTPS only
- [ ] ACL rules restrict donation viewing to own donations
- [ ] Transaction log accessible only to admins
- [ ] Email notifications use official domain
- [ ] PCI compliance: Never store card numbers in ServiceNow
- [ ] Audit trail enabled for donation records

---

## Production Deployment

When ready for production:

1. **Switch to Live Keys:**
   - Replace `sk_test_*` with `sk_live_*`
   - Replace `pk_test_*` with `pk_live_*`
   - Update webhook secret

2. **Enable HTTPS:**
   - Ensure webhook URL uses HTTPS
   - Certificate must be valid (self-signed won't work)

3. **Test with Real Transactions:**
   - Use real credit card (but small amount)
   - Verify email notifications are sent
   - Check bank statement for charges

4. **Monitor:**
   - Set up alerts for failed donations
   - Monitor transaction logs daily
   - Check Stripe dashboard for disputes

5. **Backup:**
   - Export donation records regularly
   - Keep audit logs for 7 years (legal requirement)

---

## API Reference

### Agent Tool: `donateToCampaign`

**Input:**
```javascript
{
    campaign_number: "CAM001",
    amount: 500,  // in rupees
    frequency: "one_time"  // or "monthly", "quarterly", "yearly"
}
```

**Output:**
```javascript
{
    success: true,
    donation_id: "abc123def456",
    campaign_title: "Flood Relief Fund",
    amount: 500,
    payment_url: "https://checkout.stripe.com/pay/pi_1234567890...",
    message: "✅ Donation Ready for Payment..."
}
```

### Stripe Processor: `createPaymentIntent`

**Input:**
```javascript
var result = processor.createPaymentIntent(
    "donation_sys_id",  // reference ID
    500,                 // amount in rupees
    {
        campaign_id: "campaign_sys_id",
        donor_id: "user_sys_id",
        frequency: "one_time"
    }
);
```

**Output:**
```javascript
{
    success: true,
    client_secret: "pi_abc123_secret_xyz",
    payment_intent_id: "pi_1234567890",
    checkout_url: "https://checkout.stripe.com/pay/...",
    amount: 500,
    currency: "INR",
    status: "requires_payment"
}
```

---

## Cost Estimate

**Stripe Pricing (India):**
- Per transaction: 2% + ₹3
- Monthly fee: None
- Example: ₹500 donation costs ₹13 in fees

**Example Economics (for 100 donors, ₹500 avg):**
```
Total donations: 100 × ₹500 = ₹50,000
Stripe fees: ₹50,000 × 2% + ₹300 = ₹1,300
Net to campaign: ₹48,700 (97.4%)
```

---

## Support

For issues:
1. Check ServiceNow logs: **System Logs > All**
2. Check Stripe logs: Stripe Dashboard > Logs
3. Test webhook: Stripe Dashboard > Webhooks > {endpoint} > Send test event
4. Verify GlideRecord permissions for x_adsr_fundeavor_donation table

---

**Last Updated:** 2025
**Version:** 1.0
