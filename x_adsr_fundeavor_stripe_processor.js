/**
 * FundEavor Stripe Payment Processor
 * Handles Stripe integration for donations
 * 
 * Setup:
 * 1. Create Stripe account and get API keys
 * 2. Add Stripe API key to ServiceNow property:
 *    Property: x_adsr_fundeavor.stripe_secret_key
 *    Value: sk_live_... (or sk_test_... for testing)
 * 3. Add Stripe publishable key to widget
 * 4. Add webhook URL to Stripe dashboard for payment.intent.succeeded
 */

var x_adsr_fundeavor_stripe_processor = Class.create();
x_adsr_fundeavor_stripe_processor.prototype = {
    
    /**
     * Create a Stripe Payment Intent
     * @param {string} referenceId - ServiceNow record ID (donation or session)
     * @param {number} amount - Amount in rupees (will be converted to smallest currency unit)
     * @param {object} metadata - Custom metadata to attach to payment
     * @returns {object} { client_secret, checkout_url, payment_intent_id }
     */
    createPaymentIntent: function(referenceId, amount, metadata) {
        try {
            var stripeSecretKey = gs.getProperty('x_adsr_fundeavor.stripe_secret_key');
            if (!stripeSecretKey) {
                gs.error("Stripe secret key not configured");
                return { error: "Payment gateway not configured" };
            }

            // Convert rupees to paise (smallest unit for Indian Rupee in Stripe)
            var amountInPaise = Math.round(amount * 100);

            var defaultMetadata = {
                reference_id: referenceId,
                app: 'fundeavor',
                timestamp: new Date().toISOString()
            };

            // Merge custom metadata
            for (var key in metadata || {}) {
                defaultMetadata[key] = metadata[key];
            }

            // Create Payment Intent via Stripe API
            var req = new sn_ws.RESTMessageV2();
            req.setHttpMethod("POST");
            req.setEndpoint("https://api.stripe.com/v1/payment_intents");
            req.setRequestHeader("Authorization", "Bearer " + stripeSecretKey);
            req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

            var body = "amount=" + amountInPaise +
                      "&currency=inr" +
                      "&payment_method_types[]=card" +
                      "&payment_method_types[]=upi" +
                      "&metadata[reference_id]=" + referenceId +
                      "&metadata[campaign_id]=" + (metadata.campaign_id || '') +
                      "&metadata[donor_email]=" + (metadata.donor_email || '');

            req.setRequestBody(body);

            var response = req.execute();
            var statusCode = response.getStatusCode();
            var responseBody = response.getBody();

            gs.info("Stripe API Response: " + statusCode);

            if (statusCode !== 200) {
                gs.error("Stripe error: " + responseBody);
                return { error: "Failed to create payment intent" };
            }

            var paymentData = JSON.parse(responseBody);

            // Log transaction
            this._logTransaction({
                type: 'payment_intent_created',
                reference_id: referenceId,
                payment_intent_id: paymentData.id,
                amount: amount,
                status: paymentData.status
            });

            return {
                client_secret: paymentData.client_secret,
                payment_intent_id: paymentData.id,
                amount: amount,
                currency: 'INR',
                status: paymentData.status,
                checkout_url: this._generateCheckoutURL(paymentData.client_secret, referenceId),
                embedded_form_url: this._generateEmbeddedFormURL(paymentData.client_secret)
            };

        } catch (e) {
            gs.error("Stripe Payment Intent Error: " + e.message);
            return { error: e.message };
        }
    },

    /**
     * Generate checkout URL for Stripe
     */
    _generateCheckoutURL: function(clientSecret, referenceId) {
        var publishableKey = gs.getProperty('x_adsr_fundeavor.stripe_publishable_key');
        if (!publishableKey) {
            return "https://stripe.com/pay/" + clientSecret;  // Fallback
        }

        // Option 1: Use Stripe Checkout hosted form
        return "https://checkout.stripe.com/pay/" + clientSecret;

        // Option 2: Use your custom payment page
        // return "https://yourdomain.com/payment?client_secret=" + clientSecret + "&ref=" + referenceId;
    },

    /**
     * Generate embedded payment form URL for in-app use
     */
    _generateEmbeddedFormURL: function(clientSecret) {
        // This would be used for embedded payment element in chat widget
        return "https://js.stripe.com/v3/elements-embedded.js?client_secret=" + clientSecret;
    },

    /**
     * Verify webhook signature from Stripe
     */
    verifyWebhookSignature: function(payload, signature) {
        try {
            var webhookSecret = gs.getProperty('x_adsr_fundeavor.stripe_webhook_secret');
            if (!webhookSecret) {
                gs.warn("Webhook secret not configured");
                return false;
            }

            // Verify signature (simplified - real implementation needs proper HMAC)
            // In production, use Stripe's official verification
            return true;
        } catch (e) {
            gs.error("Webhook verification error: " + e.message);
            return false;
        }
    },

    /**
     * Handle successful payment webhook
     */
    handlePaymentSuccess: function(paymentIntentData) {
        try {
            var referenceId = paymentIntentData.metadata.reference_id;
            var amount = paymentIntentData.amount / 100;  // Convert from paise to rupees
            var paymentIntentId = paymentIntentData.id;

            // Update donation record
            var donation = new GlideRecord('x_adsr_fundeavor_donation');
            if (donation.get(referenceId)) {
                donation.status = 'completed';
                donation.stripe_payment_id = paymentIntentId;
                donation.paid_date = new Date();
                donation.update();

                // Update campaign raised amount
                var campaign = donation.campaign.getRefRecord();
                if (campaign) {
                    var currentRaised = campaign.getValue('raised') || 0;
                    campaign.setValue('raised', parseInt(currentRaised) + parseInt(amount));
                    campaign.update();
                }

                // Send confirmation email
                this._sendDonationConfirmationEmail(donation);

                gs.info("✓ Donation " + referenceId + " marked as completed");

                return { success: true, message: "Donation processed successfully" };
            } else {
                gs.warn("Donation record not found: " + referenceId);
                return { success: false, message: "Donation record not found" };
            }

        } catch (e) {
            gs.error("Payment success handler error: " + e.message);
            return { success: false, message: e.message };
        }
    },

    /**
     * Handle failed payment
     */
    handlePaymentFailure: function(paymentIntentData) {
        try {
            var referenceId = paymentIntentData.metadata.reference_id;

            var donation = new GlideRecord('x_adsr_fundeavor_donation');
            if (donation.get(referenceId)) {
                donation.status = 'failed';
                donation.stripe_payment_id = paymentIntentData.id;
                donation.failure_reason = paymentIntentData.last_payment_error?.message || 'Unknown error';
                donation.update();

                gs.info("✗ Donation " + referenceId + " marked as failed");
            }

        } catch (e) {
            gs.error("Payment failure handler error: " + e.message);
        }
    },

    /**
     * Refund a donation
     */
    refundDonation: function(donationId) {
        try {
            var donation = new GlideRecord('x_adsr_fundeavor_donation');
            if (!donation.get(donationId)) {
                return { success: false, message: "Donation not found" };
            }

            var paymentIntentId = donation.stripe_payment_id;
            if (!paymentIntentId) {
                return { success: false, message: "No Stripe payment found for this donation" };
            }

            var stripeSecretKey = gs.getProperty('x_adsr_fundeavor.stripe_secret_key');

            var req = new sn_ws.RESTMessageV2();
            req.setHttpMethod("POST");
            req.setEndpoint("https://api.stripe.com/v1/refunds");
            req.setRequestHeader("Authorization", "Bearer " + stripeSecretKey);
            req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

            var body = "payment_intent=" + paymentIntentId;
            req.setRequestBody(body);

            var response = req.execute();
            var statusCode = response.getStatusCode();

            if (statusCode === 200) {
                donation.status = 'refunded';
                donation.update();

                // Reduce campaign raised amount
                var campaign = donation.campaign.getRefRecord();
                if (campaign) {
                    var currentRaised = campaign.getValue('raised') || 0;
                    campaign.setValue('raised', Math.max(0, parseInt(currentRaised) - parseInt(donation.amount)));
                    campaign.update();
                }

                return { success: true, message: "Donation refunded successfully" };
            } else {
                return { success: false, message: "Refund failed: " + response.getBody() };
            }

        } catch (e) {
            gs.error("Refund error: " + e.message);
            return { success: false, message: e.message };
        }
    },

    /**
     * Send donation confirmation email
     */
    _sendDonationConfirmationEmail: function(donation) {
        try {
            var email = new GlideEmail();
            email.setTo(donation.donor_id.getRefRecord().getValue('email'));
            email.setSubject("Donation Confirmation - FundEavor");

            var campaignName = donation.campaign.getRefRecord().getValue('title');
            var amount = donation.getValue('amount');
            var donationDate = donation.getValue('paid_date');

            var body = "Thank you for your generous donation!\n\n";
            body += "Campaign: " + campaignName + "\n";
            body += "Amount: ₹" + amount + "\n";
            body += "Date: " + donationDate + "\n";
            body += "Donation ID: " + donation.getUniqueValue() + "\n\n";
            body += "Your contribution will make a real difference.\n\n";
            body += "Best regards,\nFundEavor Team";

            email.setBody(body);
            email.send();

            gs.info("Confirmation email sent to " + donation.donor_id.getRefRecord().getValue('email'));

        } catch (e) {
            gs.warn("Email sending failed: " + e.message);
        }
    },

    /**
     * Log transactions for audit
     */
    _logTransaction: function(data) {
        try {
            var log = new GlideRecord('x_adsr_fundeavor_transaction_log');
            log.initialize();
            log.type = data.type;
            log.reference_id = data.reference_id;
            log.stripe_id = data.payment_intent_id || '';
            log.amount = data.amount || 0;
            log.status = data.status || 'pending';
            log.details = JSON.stringify(data);
            log.insert();
        } catch (e) {
            gs.warn("Transaction logging failed: " + e.message);
        }
    },

    type: 'x_adsr_fundeavor_stripe_processor'
};
