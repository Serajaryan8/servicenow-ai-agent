/**
 * FundEavor Agent - Enhanced Version (v2)
 * Features:
 * - Campaign queries: recent, highest budget, critical
 * - Donation queries: my donations, last donation, all donations, upcoming recurrence
 * - Field-based dynamic queries
 * - Streaming response support (line-by-line)
 * - RAG + Token optimization
 */

var fundeavor_agent_v2 = Class.create();
fundeavor_agent_v2.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {

    // ==================== INITIALIZATION ====================

    initialize: function() {
        this.cache = {};
        this.tokenCounter = 0;
        this.costCounter = 0;
        gs.info("FundEavor Agent v2 initialized with advanced queries");
    },

    // ==================== MAIN ENTRY POINT ====================

    processMessage: function(conversationHistory) {
        try {
            var history = (typeof conversationHistory === 'string')
                ? JSON.parse(conversationHistory)
                : conversationHistory;

            if (!history || !Array.isArray(history) || history.length === 0) {
                return this._formatResponse("No history provided.", [], "error");
            }

            var lastUserMsg = history[history.length - 1].content || "";
            var intent = this._detectIntent(lastUserMsg);
            gs.info("FundEavor: Intent = " + intent.type + ", Tier = " + intent.tier);

            var relevantTools = this._getRelevantTools(intent.type);

            var aiResponseMsg = this._callOpenAIWithTools(
                "gpt-4o-mini",
                history,
                relevantTools,
                intent
            );

            history.push(aiResponseMsg);

            // Execute tools if LLM requests them
            if (aiResponseMsg.tool_calls && aiResponseMsg.tool_calls.length > 0) {
                for (var i = 0; i < aiResponseMsg.tool_calls.length; i++) {
                    var toolCall = aiResponseMsg.tool_calls[i];
                    var functionName = toolCall.function.name;
                    var functionArgs = JSON.parse(toolCall.function.arguments);

                    var toolOutput = this._executeToolOptimized(functionName, functionArgs, intent);

                    history.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: toolOutput
                    });
                }

                var finalResponseMsg = this._callOpenAIWithTools(
                    "gpt-4o-mini",
                    history,
                    relevantTools,
                    intent
                );
                history.push(finalResponseMsg);

                return this._formatResponse(finalResponseMsg.content, history, "success");
            } else {
                return this._formatResponse(aiResponseMsg.content, history, "success");
            }

        } catch (e) {
            gs.error("FundEavor Agent Error: " + e.message);
            return this._formatResponse("Error: " + e.message, history || [], "error");
        }
    },

    // ==================== INTENT DETECTION (ENHANCED) ====================

    _detectIntent: function(userQuery) {
        var query = userQuery.toLowerCase();

        // DONATION QUERIES (Check first for priority)
        if (query.match(/donate|donation|contribute|support|help.*campaign|give.*money|pay/i)) {
            if (query.match(/campaign|to\s+\w+/i)) {
                return { type: "DONATE_TO_CAMPAIGN", tier: "SUMMARY", cost: 150, requires_payment: true };
            } else {
                return { type: "INITIATE_DONATION", tier: "SUMMARY", cost: 150, requires_payment: true };
            }
        } else if (query.match(/my.*donation|donation.*history|all.*donate|what.*donate/i)) {
            return { type: "MY_DONATIONS", tier: "DETAILED", cost: 500 };
        } else if (query.match(/last.*donation|recent.*donation|when.*donate/i)) {
            return { type: "LAST_DONATION", tier: "SUMMARY", cost: 300 };
        } else if (query.match(/subscription|recurring|subscription.*donation|upcoming.*donation/i)) {
            return { type: "RECURRING_DONATIONS", tier: "DETAILED", cost: 400 };
        }

        // CAMPAIGN QUERIES
        else if (query.match(/recent|latest|newest.*campaign|show.*campaign/i)) {
            return { type: "RECENT_CAMPAIGNS", tier: "SUMMARY", cost: 250 };
        } else if (query.match(/highest.*budget|top.*budget|most.*funding|biggest.*campaign/i)) {
            return { type: "HIGHEST_BUDGET_CAMPAIGNS", tier: "DETAILED", cost: 400 };
        } else if (query.match(/critical|urgent|high.*priority|severe/i)) {
            return { type: "CRITICAL_CAMPAIGNS", tier: "DETAILED", cost: 400 };
        }

        // FIELD-BASED QUERY
        else if (query.match(/where|how.*many|what.*field|show.*data|find.*where/i)) {
            return { type: "FIELD_BASED_QUERY", tier: "DETAILED", cost: 600 };
        }

        // CAMPAIGN DETAILS
        else if (query.match(/status|details|about.*campaign|campaign.*information/i)) {
            return { type: "QUERY_CAMPAIGN", tier: "DETAILED", cost: 400 };
        }

        // SEARCH
        else if (query.match(/search|find|look.*for/i)) {
            return { type: "SEARCH", tier: "SUMMARY", cost: 300 };
        }

        // CREATE CAMPAIGN
        else if (query.match(/create|launch|new.*campaign|start.*campaign/i)) {
            return { type: "CREATE_CAMPAIGN", tier: "FULL", cost: 800 };
        }

        // DEFAULT
        else {
            return { type: "GENERAL", tier: "SUMMARY", cost: 500 };
        }
    },

    // ==================== TOOL SELECTION (ENHANCED) ====================

    _getRelevantTools: function(intentType) {
        var allTools = this.tools;

        switch (intentType) {
            case "INITIATE_DONATION":
                return this._filterTools(allTools, ["initiateDonation"]);

            case "DONATE_TO_CAMPAIGN":
                return this._filterTools(allTools, ["getRecentCampaigns", "donateToCampaign"]);

            case "RECENT_CAMPAIGNS":
                return this._filterTools(allTools, ["listRecentCampaigns"]);

            case "HIGHEST_BUDGET_CAMPAIGNS":
                return this._filterTools(allTools, ["getHighestBudgetCampaigns"]);

            case "CRITICAL_CAMPAIGNS":
                return this._filterTools(allTools, ["getCriticalCampaigns"]);

            case "MY_DONATIONS":
                return this._filterTools(allTools, ["getMyDonations"]);

            case "LAST_DONATION":
                return this._filterTools(allTools, ["getLastDonation"]);

            case "RECURRING_DONATIONS":
                return this._filterTools(allTools, ["getRecurringDonations"]);

            case "FIELD_BASED_QUERY":
                return this._filterTools(allTools, ["fieldBasedQuery"]);

            case "QUERY_CAMPAIGN":
                return this._filterTools(allTools, ["queryCampaign"]);

            case "CREATE_CAMPAIGN":
                return this._filterTools(allTools, ["createCampaign", "publishCampaign"]);

            case "SEARCH":
                return this._filterTools(allTools, ["search"]);

            default:
                return this._filterTools(allTools, ["listRecentCampaigns", "search"]);
        }
    },

    _filterTools: function(allTools, toolNames) {
        return allTools.filter(function(tool) {
            return toolNames.indexOf(tool.function.name) !== -1;
        });
    },

    // ==================== OPTIMIZED TOOL EXECUTION ====================

    _executeToolOptimized: function(toolName, input, intent) {
        try {
            switch (toolName) {
                case "initiateDonation":
                    return this._initiateDonation(input);

                case "donateToCampaign":
                    return this._donateToCampaign(input);

                case "listRecentCampaigns":
                    return this._listRecentCampaignsOptimized(intent.tier);

                case "getHighestBudgetCampaigns":
                    return this._getHighestBudgetCampaigns(intent.tier);

                case "getCriticalCampaigns":
                    return this._getCriticalCampaigns(intent.tier);

                case "getMyDonations":
                    return this._getMyDonations(intent.tier);

                case "getLastDonation":
                    return this._getLastDonation(intent.tier);

                case "getRecurringDonations":
                    return this._getRecurringDonations(intent.tier);

                case "fieldBasedQuery":
                    return this._fieldBasedQuery(input);

                case "queryCampaign":
                    return this._queryCampaignOptimized(input, intent.tier);

                case "createCampaign":
                    return this._createCampaign(input);

                case "publishCampaign":
                    return this._publishCampaign(input);

                case "search":
                    return this._searchOptimized(input.query);

                default:
                    return "Unknown tool: " + toolName;
            }
        } catch (e) {
            gs.error("Tool execution error: " + e.message);
            return "Error executing " + toolName + ": " + e.message;
        }
    },

    // ==================== DONATION TOOLS ====================

    /**
     * Initiate a donation - show donation options and create Stripe checkout
     */
    _initiateDonation: function(input) {
        var userId = gs.getUserID();
        var userEmail = gs.getUser().getEmail();

        // Create a donation session in ServiceNow
        var donationSession = new GlideRecord('x_adsr_fundeavor_donation_session');
        donationSession.initialize();
        donationSession.donor_id = userId;
        donationSession.donor_email = userEmail;
        donationSession.session_status = 'initiated';
        donationSession.created_on = new Date();
        var sessionId = donationSession.insert();

        // Generate Stripe client secret
        var stripeProcessor = new x_adsr_fundeavor_stripe_processor();
        var clientSecret = stripeProcessor.createPaymentIntent(sessionId, 0);  // 0 = user to specify amount

        var response = "💰 Ready to Make a Donation\n\n";
        response += "Your donation session has been created.\n";
        response += "How much would you like to donate?\n";
        response += "Tell me the amount (e.g., 'donate 5000' or 'give 1000 rupees')\n\n";
        response += "Or choose a campaign first and I'll help you donate to it!\n";
        response += "Session ID: " + sessionId;

        return response;
    },

    /**
     * Donate to a specific campaign - initiate Stripe payment
     */
    _donateToCampaign: function(input) {
        var campaignNumber = input.campaign_number || input.campaign || "";
        var amount = input.amount || 0;

        if (!campaignNumber) {
            return "❌ Please specify which campaign you want to donate to.";
        }

        if (amount <= 0) {
            return "❌ Please specify a donation amount (e.g., 'donate 5000 to CAM001').";
        }

        // Fetch campaign
        var gr = new GlideRecord('x_adsr_fundeavor_campaign');
        gr.addQuery('number', campaignNumber);
        gr.query();

        if (!gr.next()) {
            return "❌ Campaign not found: " + campaignNumber;
        }

        var campaignTitle = gr.getValue('title');
        var userId = gs.getUserID();
        var userEmail = gs.getUser().getEmail();

        // Create donation record (pending payment)
        var donation = new GlideRecord('x_adsr_fundeavor_donation');
        donation.initialize();
        donation.donor_id = userId;
        donation.campaign = gr.getUniqueValue();
        donation.amount = amount;
        donation.status = 'pending_payment';
        donation.donation_date = new Date();
        var donationId = donation.insert();

        // Create Stripe payment intent
        var stripeProcessor = new x_adsr_fundeavor_stripe_processor();
        var paymentData = stripeProcessor.createPaymentIntent(donationId, amount, {
            campaign_id: gr.getUniqueValue(),
            campaign_number: campaignNumber,
            campaign_title: campaignTitle,
            donor_email: userEmail
        });

        var response = "✅ Donation Ready for Payment\n\n";
        response += "Campaign: " + campaignTitle + "\n";
        response += "Amount: ₹" + amount + "\n";
        response += "Donation ID: " + donationId + "\n\n";
        response += "🔐 Secure Stripe Payment Link:\n";
        response += paymentData.checkout_url + "\n\n";
        response += "Your donation will appear in your history once payment is confirmed.";

        return response;
    },

    // ==================== CAMPAIGN TOOLS ====================

    _listRecentCampaignsOptimized: function(tier) {
        var cacheKey = "campaigns_recent_" + tier;
        if (this.cache[cacheKey] && this.cache[cacheKey].expiry > new Date().getTime()) {
            return this.cache[cacheKey].data;
        }

        var gr = new GlideRecord('x_adsr_fundeavor_campaign');
        gr.addQuery('status', 'Published');
        gr.orderByDesc('sys_created_on');
        gr.setLimit(5);
        gr.query();

        var results = [];
        while (gr.next()) {
            var chunk = {
                number: gr.getValue('number'),
                title: gr.getValue('title'),
                target: gr.getValue('target'),
                raised: gr.getValue('raised') || 0,
                category: gr.getValue('category')
            };

            if (tier === "DETAILED" || tier === "FULL") {
                chunk.description = gr.getValue('short_description');
                chunk.status = gr.getValue('status');
            }

            results.push(chunk);
        }

        var formatted = this._formatCampaignsLineByLine(results, "recent");

        this.cache[cacheKey] = {
            data: formatted,
            expiry: new Date().getTime() + (7 * 24 * 60 * 60 * 1000)
        };

        return formatted;
    },

    _getHighestBudgetCampaigns: function(tier) {
        var cacheKey = "campaigns_highest_budget";
        if (this.cache[cacheKey] && this.cache[cacheKey].expiry > new Date().getTime()) {
            return this.cache[cacheKey].data;
        }

        var gr = new GlideRecord('x_adsr_fundeavor_campaign');
        gr.addQuery('status', 'Published');
        gr.orderByDesc('target');
        gr.setLimit(5);
        gr.query();

        var results = [];
        while (gr.next()) {
            var chunk = {
                number: gr.getValue('number'),
                title: gr.getValue('title'),
                target: gr.getValue('target'),
                raised: gr.getValue('raised') || 0,
                percentage_raised: Math.round(((gr.getValue('raised') || 0) / (gr.getValue('target') || 1)) * 100)
            };

            results.push(chunk);
        }

        var formatted = this._formatCampaignsLineByLine(results, "highest_budget");

        this.cache[cacheKey] = {
            data: formatted,
            expiry: new Date().getTime() + (24 * 60 * 60 * 1000)
        };

        return formatted;
    },

    _getCriticalCampaigns: function(tier) {
        var cacheKey = "campaigns_critical";
        if (this.cache[cacheKey] && this.cache[cacheKey].expiry > new Date().getTime()) {
            return this.cache[cacheKey].data;
        }

        var gr = new GlideRecord('x_adsr_fundeavor_campaign');
        gr.addQuery('status', 'Published');
        gr.addQuery('category', 'IN', ['Disaster Relief', 'Emergency', 'Medical and Health', 'Natural Disaster']);
        gr.orderByDesc('sys_created_on');
        gr.setLimit(5);
        gr.query();

        var results = [];
        while (gr.next()) {
            var chunk = {
                number: gr.getValue('number'),
                title: gr.getValue('title'),
                category: gr.getValue('category'),
                target: gr.getValue('target'),
                urgency: "HIGH",
                created_date: gr.getValue('sys_created_on')
            };

            results.push(chunk);
        }

        var formatted = this._formatCampaignsLineByLine(results, "critical");

        this.cache[cacheKey] = {
            data: formatted,
            expiry: new Date().getTime() + (1 * 60 * 60 * 1000)  // 1 hour
        };

        return formatted;
    },

    _formatCampaignsLineByLine: function(campaigns, type) {
        if (campaigns.length === 0) {
            return "No campaigns found.";
        }

        var lines = [];

        if (type === "recent") {
            lines.push("Recent Published Campaigns:");
            campaigns.forEach(function(c) {
                lines.push("• " + c.number + ": " + c.title);
                lines.push("  Target: ₹" + c.target);
                lines.push("  Raised: ₹" + c.raised);
                lines.push("  Category: " + c.category);
                lines.push("");
            });
        } else if (type === "highest_budget") {
            lines.push("Campaigns by Highest Budget:");
            campaigns.forEach(function(c) {
                lines.push("• " + c.number + ": " + c.title);
                lines.push("  Budget: ₹" + c.target);
                lines.push("  Raised: ₹" + c.raised + " (" + c.percentage_raised + "%)");
                lines.push("");
            });
        } else if (type === "critical") {
            lines.push("Critical/Urgent Campaigns:");
            campaigns.forEach(function(c) {
                lines.push("🚨 " + c.number + ": " + c.title);
                lines.push("  Category: " + c.category + " [URGENT]");
                lines.push("  Target: ₹" + c.target);
                lines.push("  Created: " + c.created_date);
                lines.push("");
            });
        }

        return lines.join("\n");
    },

    // ==================== DONATION TOOLS ====================

    _getMyDonations: function(tier) {
        var userId = gs.getUserID();
        var cacheKey = "donations_user_" + userId;

        if (this.cache[cacheKey] && this.cache[cacheKey].expiry > new Date().getTime()) {
            return this.cache[cacheKey].data;
        }

        var gr = new GlideRecord('x_adsr_fundeavor_donation');
        gr.addQuery('donor_id', userId);
        gr.orderByDesc('donation_date');
        gr.setLimit(10);
        gr.query();

        var donations = [];
        var totalDonated = 0;
        while (gr.next()) {
            var amount = gr.getValue('amount') || 0;
            totalDonated += parseInt(amount);

            var donation = {
                number: gr.getValue('number'),
                campaign: gr.getValue('campaign.title'),
                amount: amount,
                date: gr.getValue('donation_date'),
                status: gr.getValue('status')
            };
            donations.push(donation);
        }

        var formatted = this._formatDonationsLineByLine(donations, totalDonated);

        this.cache[cacheKey] = {
            data: formatted,
            expiry: new Date().getTime() + (1 * 60 * 60 * 1000)  // 1 hour
        };

        return formatted;
    },

    _getLastDonation: function(tier) {
        var userId = gs.getUserID();
        var cacheKey = "donation_last_" + userId;

        if (this.cache[cacheKey] && this.cache[cacheKey].expiry > new Date().getTime()) {
            return this.cache[cacheKey].data;
        }

        var gr = new GlideRecord('x_adsr_fundeavor_donation');
        gr.addQuery('donor_id', userId);
        gr.orderByDesc('donation_date');
        gr.setLimit(1);
        gr.query();

        var formatted = "No donations found.";

        if (gr.next()) {
            formatted = "Your Last Donation:\n";
            formatted += "Campaign: " + gr.getValue('campaign.title') + "\n";
            formatted += "Amount: ₹" + gr.getValue('amount') + "\n";
            formatted += "Date: " + gr.getValue('donation_date') + "\n";
            formatted += "Status: " + gr.getValue('status');
        }

        this.cache[cacheKey] = {
            data: formatted,
            expiry: new Date().getTime() + (1 * 60 * 60 * 1000)
        };

        return formatted;
    },

    _getRecurringDonations: function(tier) {
        var userId = gs.getUserID();
        var cacheKey = "donations_recurring_" + userId;

        if (this.cache[cacheKey] && this.cache[cacheKey].expiry > new Date().getTime()) {
            return this.cache[cacheKey].data;
        }

        var gr = new GlideRecord('x_adsr_fundeavor_subscription');
        gr.addQuery('donor_id', userId);
        gr.addQuery('status', 'Active');
        gr.query();

        var subscriptions = [];
        var nextPaymentDate = null;

        while (gr.next()) {
            var lastPayment = gr.getValue('last_payment_date');
            var frequency = gr.getValue('frequency');  // monthly, quarterly, yearly
            var nextPayment = this._calculateNextPayment(lastPayment, frequency);

            var subscription = {
                number: gr.getValue('number'),
                campaign: gr.getValue('campaign.title'),
                amount_per_period: gr.getValue('amount'),
                frequency: frequency,
                status: gr.getValue('status'),
                next_payment: nextPayment,
                total_donated: gr.getValue('total_donated')
            };
            subscriptions.push(subscription);
        }

        var formatted = this._formatSubscriptionsLineByLine(subscriptions);

        this.cache[cacheKey] = {
            data: formatted,
            expiry: new Date().getTime() + (12 * 60 * 60 * 1000)  // 12 hours
        };

        return formatted;
    },

    _calculateNextPayment: function(lastPaymentDate, frequency) {
        var date = new Date(lastPaymentDate);
        if (frequency === 'monthly') date.setMonth(date.getMonth() + 1);
        else if (frequency === 'quarterly') date.setMonth(date.getMonth() + 3);
        else if (frequency === 'yearly') date.setFullYear(date.getFullYear() + 1);
        return date.toISOString().split('T')[0];
    },

    _formatDonationsLineByLine: function(donations, totalDonated) {
        var lines = [];
        lines.push("Your Donation History:");
        lines.push("Total Donated: ₹" + totalDonated);
        lines.push("");

        if (donations.length === 0) {
            lines.push("No donations found.");
            return lines.join("\n");
        }

        donations.forEach(function(d) {
            lines.push("• Campaign: " + d.campaign);
            lines.push("  Amount: ₹" + d.amount);
            lines.push("  Date: " + d.date);
            lines.push("  Status: " + d.status);
            lines.push("");
        });

        return lines.join("\n");
    },

    _formatSubscriptionsLineByLine: function(subscriptions) {
        var lines = [];
        lines.push("Your Active Subscriptions:");
        lines.push("");

        if (subscriptions.length === 0) {
            lines.push("No active subscriptions.");
            return lines.join("\n");
        }

        subscriptions.forEach(function(s) {
            lines.push("• Campaign: " + s.campaign);
            lines.push("  Amount: ₹" + s.amount_per_period + " per " + s.frequency);
            lines.push("  Next Payment: " + s.next_payment);
            lines.push("  Total Donated: ₹" + s.total_donated);
            lines.push("  Status: " + s.status);
            lines.push("");
        });

        return lines.join("\n");
    },

    // ==================== FIELD-BASED DYNAMIC QUERY ====================

    /**
     * Execute dynamic query based on user request
     * Examples:
     * - "Show campaigns where category is Disaster Relief"
     * - "How many donations above 1000?"
     * - "Find campaigns with target more than 50000"
     */
    _fieldBasedQuery: function(input) {
        var query = input.query || "";
        
        // Parse query to extract table, field, condition, value
        var parsed = this._parseFieldQuery(query);

        if (!parsed) {
            return "I could not understand your query. Try: 'Show campaigns where status is Published'";
        }

        var gr = new GlideRecord(parsed.table);

        // Add conditions
        if (parsed.conditions && parsed.conditions.length > 0) {
            parsed.conditions.forEach(function(cond) {
                if (cond.operator === 'equals') {
                    gr.addQuery(cond.field, cond.value);
                } else if (cond.operator === 'contains') {
                    gr.addQuery(cond.field, 'LIKE', cond.value);
                } else if (cond.operator === 'greater') {
                    gr.addQuery(cond.field, '>', cond.value);
                } else if (cond.operator === 'less') {
                    gr.addQuery(cond.field, '<', cond.value);
                }
            });
        }

        gr.setLimit(10);
        gr.query();

        var results = [];
        while (gr.next()) {
            var record = {};
            parsed.fields.forEach(function(field) {
                record[field] = gr.getValue(field);
            });
            results.push(record);
        }

        return this._formatFieldQueryResults(results, parsed);
    },

    _parseFieldQuery: function(query) {
        var queryLower = query.toLowerCase();

        // Detect table
        var table = null;
        if (queryLower.includes('campaign')) table = 'x_adsr_fundeavor_campaign';
        else if (queryLower.includes('donation')) table = 'x_adsr_fundeavor_donation';
        else if (queryLower.includes('subscription')) table = 'x_adsr_fundeavor_subscription';

        if (!table) return null;

        // Default fields to return
        var fields = ['number', 'sys_created_on'];
        if (table === 'x_adsr_fundeavor_campaign') fields = ['number', 'title', 'target', 'status'];
        else if (table === 'x_adsr_fundeavor_donation') fields = ['number', 'amount', 'donation_date'];

        // Parse conditions (simple parser)
        var conditions = [];
        
        if (queryLower.includes('where')) {
            // Extract where clause
            var whereIndex = queryLower.indexOf('where');
            var whereClause = query.substring(whereIndex + 5);

            // Simple parsing: "field is value" or "field = value"
            if (whereClause.match(/(\w+)\s+(is|=)\s+([\w\s]+)/i)) {
                var matches = whereClause.match(/(\w+)\s+(is|=)\s+([\w\s]+)/i);
                conditions.push({
                    field: matches[1].trim(),
                    operator: 'equals',
                    value: matches[3].trim()
                });
            }
            // "field > value", "field < value"
            else if (whereClause.match(/(\w+)\s*(>|<|>=|<=)\s*(\d+)/)) {
                var mathMatches = whereClause.match(/(\w+)\s*(>|<|>=|<=)\s*(\d+)/);
                var op = mathMatches[2] === '>' ? 'greater' : 'less';
                conditions.push({
                    field: mathMatches[1].trim(),
                    operator: op,
                    value: mathMatches[3].trim()
                });
            }
        }

        return {
            table: table,
            fields: fields,
            conditions: conditions
        };
    },

    _formatFieldQueryResults: function(results, parsed) {
        var lines = [];
        lines.push("Query Results (" + results.length + " records):");
        lines.push("");

        if (results.length === 0) {
            lines.push("No records found matching your criteria.");
            return lines.join("\n");
        }

        results.forEach(function(record) {
            for (var key in record) {
                if (record.hasOwnProperty(key)) {
                    lines.push("• " + key + ": " + record[key]);
                }
            }
            lines.push("");
        });

        return lines.join("\n");
    },

    _queryCampaignOptimized: function(input, tier) {
        var number = input.number || "";
        if (!number) {
            return "Please provide a campaign number.";
        }

        var gr = new GlideRecord('x_adsr_fundeavor_campaign');
        gr.addQuery('number', number);
        gr.query();

        if (!gr.next()) {
            return "Campaign not found: " + number;
        }

        var lines = [];
        lines.push("Campaign Details: " + number);
        lines.push("");
        lines.push("Title: " + gr.getValue('title'));
        lines.push("Status: " + gr.getValue('status'));
        lines.push("Category: " + gr.getValue('category'));
        lines.push("Target: ₹" + gr.getValue('target'));
        lines.push("Raised: ₹" + (gr.getValue('raised') || 0));
        
        if (tier === "DETAILED" || tier === "FULL") {
            lines.push("");
            lines.push("Description: " + gr.getValue('short_description'));
            lines.push("Start Date: " + gr.getValue('start_date'));
            lines.push("End Date: " + gr.getValue('end_date'));
        }

        return lines.join("\n");
    },

    _createCampaign: function(input) {
        var gr = new GlideRecord('x_adsr_fundeavor_campaign');
        gr.initialize();
        gr.title = input.title || "Untitled";
        gr.short_description = input.short_description;
        gr.description = input.description || '';
        gr.target = input.target_amount || 0;
        gr.category = input.category || 'Disaster Relief';
        gr.start_date = input.start_date;
        gr.end_date = input.end_date;
        gr.insert();

        return "✓ Campaign created: " + gr.number + " (" + gr.title + ")";
    },

    _publishCampaign: function(input) {
        var gr = new GlideRecord('x_adsr_fundeavor_campaign');
        gr.addQuery('number', input.number);
        gr.query();

        if (gr.next()) {
            gr.setValue('status', 'Published');
            gr.update();
            return "✓ Campaign " + input.number + " published";
        }
        return "✗ Campaign not found";
    },

    _searchOptimized: function(searchQuery) {
        var gr = new GlideRecord('x_adsr_fundeavor_campaign');
        gr.addQuery('title', 'LIKE', searchQuery)
         .addOrCondition('short_description', 'LIKE', searchQuery);
        gr.addQuery('status', 'Published');
        gr.setLimit(5);
        gr.query();

        var results = [];
        while (gr.next()) {
            results.push({
                number: gr.getValue('number'),
                title: gr.getValue('title'),
                relevance: this._calculateRelevance(searchQuery, gr.getValue('title'))
            });
        }

        results.sort(function(a, b) { return b.relevance - a.relevance; });

        var lines = [];
        if (results.length === 0) {
            lines.push("No campaigns found for '" + searchQuery + "'");
        } else {
            lines.push("Search Results for '" + searchQuery + "':");
            lines.push("");
            results.forEach(function(r) {
                lines.push("• " + r.number + ": " + r.title);
            });
        }

        return lines.join("\n");
    },

    _calculateRelevance: function(query, title) {
        var score = 0;
        var queryLower = query.toLowerCase();
        var titleLower = title.toLowerCase();

        if (titleLower.indexOf(queryLower) !== -1) score += 10;
        if (titleLower.split(' ').filter(function(w) {
            return queryLower.indexOf(w) !== -1;
        }).length > 0) score += 5;

        return score;
    },

    // ==================== OPENAI API CALL ====================

    _callOpenAIWithTools: function(model, messages, tools, intent) {
        try {
            var apiKey = gs.getProperty('x_adsr_fundeavor.Chat GPT Key');
            if (!apiKey) {
                return { content: "API key not configured." };
            }

            var optimizedHistory = messages.slice(-5);

            var req = new sn_ws.RESTMessageV2();
            req.setHttpMethod("POST");
            req.setEndpoint("https://api.openai.com/v1/chat/completions");
            req.setRequestHeader("Content-Type", "application/json");
            req.setRequestHeader("Authorization", "Bearer " + apiKey);

            var systemPrompt = "You are FundEavor voice assistant. " +
                              "Help with campaigns, donations, and fundraising. " +
                              "Be concise. Use tools available.";

            var body = {
                model: model,
                messages: [{ role: "system", content: systemPrompt }].concat(optimizedHistory),
                tools: tools,
                tool_choice: "auto",
                max_tokens: 500
            };

            req.setRequestBody(JSON.stringify(body));
            req.setHttpTimeout(20000);

            var res = req.execute();
            var status = res.getStatusCode();
            var responseBody = res.getBody();

            if (status !== 200) {
                gs.error("OpenAI error: " + status);
                return { content: "Error from OpenAI" };
            }

            var data = JSON.parse(responseBody);
            if (data.choices && data.choices.length > 0) {
                return data.choices[0].message;
            }

            return { content: "No response" };

        } catch (ex) {
            gs.error("OpenAI call failed: " + ex.message);
            return { content: "Error: " + ex.message };
        }
    },

    // ==================== RESPONSE FORMATTING ====================

    _formatResponse: function(outputText, history, status) {
        try {
            var cleanText = outputText
                .replace(/[*_`#]/g, '')
                .replace(/\s{2,}/g, ' ')
                .trim();

            return {
                output: cleanText,
                history: history,
                status: status || "success",
                tokens_estimated: this.tokenCounter,
                cost_usd: (this.tokenCounter * 0.00002).toFixed(4),
                lines: cleanText.split('\n')  // ✅ For streaming response
            };
        } catch (e) {
            return { output: outputText, history: history, status: "error" };
        }
    },

    // ==================== TOOL DEFINITIONS ====================

    tools: [
        {
            type: "function",
            function: {
                name: "initiateDonation",
                description: "Start a donation process with flexible amount",
                parameters: { type: "object", properties: {}, required: [] }
            }
        },
        {
            type: "function",
            function: {
                name: "donateToCampaign",
                description: "Donate to a specific campaign with amount and create Stripe payment",
                parameters: {
                    type: "object",
                    properties: {
                        campaign_number: { type: "string", description: "Campaign ID (e.g., CAM001)" },
                        amount: { type: "number", description: "Donation amount in rupees" }
                    },
                    required: ["campaign_number", "amount"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "listRecentCampaigns",
                description: "Show 5 most recent published campaigns",
                parameters: { type: "object", properties: {}, required: [] }
            }
        },
        {
            type: "function",
            function: {
                name: "getHighestBudgetCampaigns",
                description: "Show campaigns with highest budget targets",
                parameters: { type: "object", properties: {}, required: [] }
            }
        },
        {
            type: "function",
            function: {
                name: "getCriticalCampaigns",
                description: "Show urgent/critical campaigns (disasters, emergencies)",
                parameters: { type: "object", properties: {}, required: [] }
            }
        },
        {
            type: "function",
            function: {
                name: "getMyDonations",
                description: "Show all my donations and total donated amount",
                parameters: { type: "object", properties: {}, required: [] }
            }
        },
        {
            type: "function",
            function: {
                name: "getLastDonation",
                description: "Show my last/most recent donation",
                parameters: { type: "object", properties: {}, required: [] }
            }
        },
        {
            type: "function",
            function: {
                name: "getRecurringDonations",
                description: "Show my active subscriptions and upcoming payments",
                parameters: { type: "object", properties: {}, required: [] }
            }
        },
        {
            type: "function",
            function: {
                name: "fieldBasedQuery",
                description: "Execute custom queries on campaigns or donations based on specific fields",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "Query like 'Show campaigns where category is Disaster Relief'" }
                    },
                    required: ["query"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "queryCampaign",
                description: "Get detailed information about a specific campaign",
                parameters: {
                    type: "object",
                    properties: {
                        number: { type: "string", description: "Campaign number" }
                    },
                    required: ["number"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "createCampaign",
                description: "Create a new fundraising campaign",
                parameters: {
                    type: "object",
                    properties: {
                        title: { type: "string" },
                        short_description: { type: "string" },
                        target_amount: { type: "number" },
                        category: { type: "string" }
                    },
                    required: ["title", "short_description"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "publishCampaign",
                description: "Publish a draft campaign",
                parameters: {
                    type: "object",
                    properties: {
                        number: { type: "string" }
                    },
                    required: ["number"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "search",
                description: "Search for campaigns by keyword",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string" }
                    },
                    required: ["query"]
                }
            }
        }
    ],

    // ==================== PUBLIC API METHOD - GET CRITICAL CAMPAIGNS ====================
    // Called by donation modal to show list of campaigns needing support

    getCriticalCampaigns: function() {
        var limit = this.getParameter('sysparm_limit') || 10;
        var result = [];
        
        try {
            var gr = new GlideRecord('x_adsr_fundeavor_campaign');
            gr.addQuery('status', '=', 'active');
            gr.orderByAscending('deadline');  // Closest deadline first
            gr.query();
            
            var count = 0;
            while (gr.next() && count < limit) {
                var raised = parseFloat(gr.raised_amount.getValue()) || 0;
                var target = parseFloat(gr.target_amount.getValue()) || 0;
                var percentage = target > 0 ? Math.round((raised / target) * 100) : 0;
                
                // Calculate days left
                var deadline = gr.deadline.getValue();
                var daysLeft = deadline ? Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
                
                var campaign = {
                    sys_id: gr.sys_id.getValue(),
                    number: gr.number.getValue(),
                    title: gr.title.getValue(),
                    description: gr.description.getValue() ? gr.description.getValue().substring(0, 100) : '',
                    target_amount: target,
                    raised_amount: raised,
                    percentage_raised: percentage,
                    deadline: deadline,
                    days_left: Math.max(0, daysLeft),
                    donors_count: gr.donors_count.getValue() || 0,
                    urgency: daysLeft <= 7 ? 'critical' : (daysLeft <= 30 ? 'high' : 'normal')
                };
                
                result.push(campaign);
                count++;
            }
        } catch (e) {
            gs.error('Error fetching critical campaigns: ' + e.message);
        }
        
        return JSON.stringify({
            success: true,
            campaigns: result,
            count: result.length
        });
    },

    type: 'fundeavor_agent_v2'
});
