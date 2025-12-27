/**
 * FundEavor Advanced Chat Widget
 * Features:
 * - Left/Right conversation layout with avatars
 * - Streaming response (line-by-line)
 * - Professional UI with icons
 * - Message status indicators
 * - Typing animation
 */

angular.module('fundeavor_chat_widget', [])
    .controller('FundEavorChatCtrl', function($scope, $timeout, $http, GlideAjax) {
        
        var vm = this;
        vm.messages = [];
        vm.inputText = '';
        vm.isLoading = false;
        vm.chatHistory = [];
        vm.userId = gs.getUserID();
        vm.userName = gs.getProperty('glide.servlet.uri') ? 'You' : 'User';
        
        // Initialize
        vm.init = function() {
            // Load initial greeting
            vm.addBotMessage("👋 Welcome to FundEavor Chat! How can I help you today?", true);
            
            // Initialize donation-related properties
            vm.showCampaignSelector = false;
            vm.showDonationModal = false;
            vm.isLoadingCampaigns = false;
            vm.availableCampaigns = [];
            vm.selectedCampaign = null;
            vm.donationForm = {};
        };

        // ==================== DONATION FLOW METHODS ====================

        vm.openCampaignSelector = function() {
            vm.isLoadingCampaigns = true;
            var ga = new GlideAjax('fundeavor_agent_v2');
            ga.addParam('sysparm_name', 'getCriticalCampaigns');
            ga.addParam('sysparm_limit', 10);
            
            ga.getXML(function(response) {
                $timeout(function() {
                    vm.isLoadingCampaigns = false;
                    try {
                        var result = JSON.parse(response.responseText);
                        if (result.success) {
                            vm.availableCampaigns = result.campaigns || [];
                            vm.showCampaignSelector = true;
                        } else {
                            alert('Failed to load campaigns');
                        }
                    } catch (e) {
                        alert('Error loading campaigns');
                        gs.logError(e);
                    }
                });
            });
        };

        vm.selectCampaign = function(campaign) {
            vm.selectedCampaign = campaign;
            vm.showCampaignSelector = false;
            vm.openDonationModal(campaign);
        };

        vm.openDonationModal = function(campaign) {
            vm.donationForm = {
                campaign_number: campaign ? campaign.number : '',
                campaign_title: campaign ? campaign.title : '',
                campaign_sys_id: campaign ? campaign.sys_id : '',
                target_amount: campaign ? campaign.target_amount : 0,
                raised_amount: campaign ? campaign.raised_amount : 0,
                deadline: campaign ? campaign.deadline : '',
                amount: '',
                frequency: 'one_time'  // one_time, monthly, quarterly, yearly
            };
            vm.showDonationModal = true;
        };

        vm.closeCampaignSelector = function() {
            vm.showCampaignSelector = false;
            vm.availableCampaigns = [];
        };

        vm.closeDonationModal = function() {
            vm.showDonationModal = false;
            vm.donationForm = {};
            vm.selectedCampaign = null;
        };

        vm.submitDonation = function() {
            if (!vm.donationForm.amount || vm.donationForm.amount <= 0) {
                alert('Please enter a valid amount');
                return;
            }

            if (!vm.donationForm.campaign_number) {
                alert('Please select a campaign');
                return;
            }

            var donationMsg = "I want to donate ₹" + vm.donationForm.amount;
            if (vm.donationForm.campaign_number) {
                donationMsg += " to " + vm.donationForm.campaign_number;
            }

            vm.inputText = donationMsg;
            vm.closeDonationModal();
            vm.sendMessage();
        };

        // ==================== MESSAGE HANDLING ====================

        vm.sendMessage = function() {
            if (!vm.inputText.trim()) return;

            var userMessage = vm.inputText.trim();
            vm.inputText = '';

            // Add user message to UI
            vm.addUserMessage(userMessage);

            // Add to history
            vm.chatHistory.push({
                role: "user",
                content: userMessage
            });

            // Check if this is a donation request
            if (userMessage.match(/donate|donation|contribute|₹|rupee|payment/i)) {
                vm.showDonationUI = true;
            }

            // Call agent
            vm.isLoading = true;
            vm.callAgent(vm.chatHistory);
        };

        // ==================== AGENT CALL ====================

        vm.callAgent = function(history) {
            var ga = new GlideAjax('fundeavor_agent_v2');
            ga.addParam('sysparm_name', 'processMessage');
            ga.addParam('sysparm_conversation', JSON.stringify(history));
            
            ga.getXML(function(response) {
                vm.isLoading = false;
                
                try {
                    var result = JSON.parse(response.responseText);
                    
                    if (result.status === 'success') {
                        // Stream response line-by-line
                        vm.streamResponse(result.output, result.lines || result.output.split('\n'));
                        
                        // Update history
                        vm.chatHistory.push({
                            role: "assistant",
                            content: result.output
                        });

                        // Show token cost (optional)
                        console.log('Tokens: ' + result.tokens_estimated + ' | Cost: $' + result.cost_usd);
                    } else {
                        vm.addBotMessage("❌ Error: " + result.output, false);
                    }
                } catch (e) {
                    vm.addBotMessage("❌ Failed to parse response", false);
                    gs.logError(e);
                }
            });
        };

        // ==================== STREAMING RESPONSE ====================

        vm.streamResponse = function(fullText, lines) {
            var messageId = vm.addBotMessage('', false);  // Empty message first
            var delay = 100;  // Delay between lines

            lines.forEach(function(line, index) {
                $timeout(function() {
                    vm.appendLineToMessage(messageId, line);
                }, delay * index);
            });
        };

        // ==================== MESSAGE MANAGEMENT ====================

        vm.addUserMessage = function(text) {
            var message = {
                id: vm.messages.length,
                role: 'user',
                text: text,
                timestamp: new Date(),
                icon: '👤',
                status: 'sent'
            };
            vm.messages.push(message);
            vm.scrollToBottom();
            return message.id;
        };

        vm.addBotMessage = function(text, isGreeting) {
            var message = {
                id: vm.messages.length,
                role: 'bot',
                text: text,
                timestamp: new Date(),
                icon: '🤖',
                status: isGreeting ? 'delivered' : 'typing',
                lines: []
            };
            vm.messages.push(message);
            vm.scrollToBottom();
            return message.id;
        };

        vm.appendLineToMessage = function(messageId, line) {
            var message = vm.messages[messageId];
            if (message && message.role === 'bot') {
                if (!message.lines) message.lines = [];
                message.lines.push(line);
                message.text = message.lines.join('\n');
                message.status = 'delivered';
                vm.scrollToBottom();
            }
        };

        vm.scrollToBottom = function() {
            $timeout(function() {
                var elem = document.getElementById('chat-messages');
                if (elem) {
                    elem.scrollTop = elem.scrollHeight;
                }
            }, 0);
        };

        // ==================== DONATION METHODS ====================

        vm.openCampaignSelector = function() {
            // Fetch critical campaigns
            vm.isLoadingCampaigns = true;
            var ga = new GlideAjax('fundeavor_agent_v2');
            ga.addParam('sysparm_name', 'getCriticalCampaigns');
            ga.addParam('sysparm_limit', 10);
            
            ga.getXML(function(response) {
                vm.isLoadingCampaigns = false;
                try {
                    var result = JSON.parse(response.responseText);
                    if (result.success) {
                        vm.availableCampaigns = result.campaigns || [];
                        vm.showCampaignSelector = true;
                    } else {
                        alert('Failed to load campaigns');
                    }
                } catch (e) {
                    alert('Error loading campaigns');
                    gs.logError(e);
                }
            });
        };

        vm.selectCampaign = function(campaign) {
            vm.selectedCampaign = campaign;
            vm.showCampaignSelector = false;
            vm.openDonationModal(campaign);
        };

        vm.openDonationModal = function(campaign) {
            vm.donationForm = {
                campaign_number: campaign ? campaign.number : '',
                campaign_title: campaign ? campaign.title : '',
                campaign_sys_id: campaign ? campaign.sys_id : '',
                target_amount: campaign ? campaign.target_amount : 0,
                raised_amount: campaign ? campaign.raised_amount : 0,
                deadline: campaign ? campaign.deadline : '',
                amount: '',
                frequency: 'one_time'  // one_time, monthly, quarterly, yearly
            };
            vm.showDonationModal = true;
        };

        vm.closeCampaignSelector = function() {
            vm.showCampaignSelector = false;
            vm.availableCampaigns = [];
        };

        vm.closeDonationModal = function() {
            vm.showDonationModal = false;
            vm.donationForm = {};
            vm.selectedCampaign = null;
        };

        vm.submitDonation = function() {
            if (!vm.donationForm.amount || vm.donationForm.amount <= 0) {
                alert('Please enter a valid amount');
                return;
            }

            if (!vm.donationForm.campaign_number) {
                alert('Please select a campaign');
                return;
            }

            var donationMsg = "I want to donate ₹" + vm.donationForm.amount;
            if (vm.donationForm.campaign_number) {
                donationMsg += " to " + vm.donationForm.campaign_number;
            }

            vm.inputText = donationMsg;
            vm.closeDonationModal();
            vm.sendMessage();
        };

        vm.processDonationPayment = function(paymentUrl) {
            // Open Stripe checkout in new window
            if (paymentUrl) {
                window.open(paymentUrl, 'Stripe Payment', 'width=800,height=600');
            }
        };

        // Initialize
        vm.init();
    })
    .directive('fundEavorChatWidget', function() {
        return {
            restrict: 'E',
            template: `
                <div class="fundeavor-chat-container">
                    <!-- Header -->
                    <div class="chat-header">
                        <span class="header-icon">💼</span>
                        <span class="header-title">FundEavor Assistant</span>
                        <span class="header-close">×</span>
                    </div>

                    <!-- Messages -->
                    <div class="chat-messages" id="chat-messages">
                        <div ng-repeat="msg in $ctrl.messages" 
                             class="message-wrapper" 
                             ng-class="'message-' + msg.role">
                            
                            <!-- User Message (Right) -->
                            <div ng-if="msg.role === 'user'" class="message user-message">
                                <div class="message-bubble">
                                    <span class="message-text">{{msg.text}}</span>
                                    <span class="message-time">{{msg.timestamp | date:'HH:mm'}}</span>
                                </div>
                                <span class="message-icon">{{msg.icon}}</span>
                            </div>

                            <!-- Bot Message (Left) -->
                            <div ng-if="msg.role === 'bot'" class="message bot-message">
                                <span class="message-icon">{{msg.icon}}</span>
                                <div class="message-bubble">
                                    <!-- Streaming lines -->
                                    <div ng-repeat="line in msg.lines" 
                                         class="message-line"
                                         ng-class="{'message-line-empty': line.trim() === ''}">
                                        {{line}}
                                    </div>
                                    
                                    <!-- Typing indicator -->
                                    <span ng-if="msg.status === 'typing'" class="typing-dots">
                                        <span>.</span><span>.</span><span>.</span>
                                    </span>
                                    
                                    <span class="message-time">{{msg.timestamp | date:'HH:mm'}}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Loading Indicator -->
                        <div ng-if="$ctrl.isLoading" class="loading-indicator">
                            <span class="loading-text">FundEavor is thinking</span>
                            <span class="typing-dots">
                                <span>.</span><span>.</span><span>.</span>
                            </span>
                        </div>
                    </div>

                    <!-- Input -->
                    <div class="chat-input-container">
                        <form ng-submit="$ctrl.sendMessage()">
                            <input type="text" 
                                   ng-model="$ctrl.inputText"
                                   placeholder="Ask about campaigns, donations..."
                                   class="chat-input"
                                   ng-disabled="$ctrl.isLoading">
                            <button type="submit" 
                                    class="send-button"
                                    ng-disabled="!$ctrl.inputText.trim() || $ctrl.isLoading">
                                ➤
                            </button>
                        </form>
                    </div>

                    <!-- Quick Actions -->
                    <div class="quick-actions">
                        <button ng-click="$ctrl.inputText = 'Show recent campaigns'; $ctrl.sendMessage()" 
                                class="quick-btn">📊 Recent</button>
                        <button ng-click="$ctrl.inputText = 'Show my donations'; $ctrl.sendMessage()" 
                                class="quick-btn">💰 My Donations</button>
                        <button ng-click="$ctrl.inputText = 'Critical campaigns'; $ctrl.sendMessage()" 
                                class="quick-btn">🚨 Critical</button>
                        <button ng-click="$ctrl.openCampaignSelector()" 
                                class="quick-btn donate-btn">💳 Donate Now</button>
                    </div>

                    <!-- CAMPAIGN SELECTOR MODAL (NEW) -->
                    <div ng-if="$ctrl.showCampaignSelector" class="modal-overlay">
                        <div class="campaign-selector-modal">
                            <div class="modal-header">
                                <h3>🎯 Select a Campaign to Support</h3>
                                <button ng-click="$ctrl.closeCampaignSelector()" class="close-btn">✕</button>
                            </div>

                            <div class="modal-content">
                                <p class="modal-subtitle">Choose a campaign that needs your support:</p>
                                
                                <div ng-if="$ctrl.isLoadingCampaigns" class="loading-spinner">
                                    <div class="spinner"></div>
                                    <p>Loading campaigns...</p>
                                </div>

                                <div ng-if="!$ctrl.isLoadingCampaigns && $ctrl.availableCampaigns && $ctrl.availableCampaigns.length > 0" class="campaigns-list">
                                    <div ng-repeat="campaign in $ctrl.availableCampaigns" 
                                         ng-click="$ctrl.selectCampaign(campaign)"
                                         class="campaign-card">
                                        <div class="campaign-header">
                                            <h4>{{campaign.title}}</h4>
                                            <span ng-if="campaign.days_left" class="urgency-badge">
                                                ⏰ {{campaign.days_left}} days left
                                            </span>
                                        </div>
                                        
                                        <div class="campaign-progress">
                                            <div class="progress-bar">
                                                <div class="progress-fill" 
                                                     style="width: {{(campaign.raised_amount / campaign.target_amount * 100)}}%">
                                                </div>
                                            </div>
                                            <div class="progress-text">
                                                ₹{{campaign.raised_amount | number}} / ₹{{campaign.target_amount | number}}
                                            </div>
                                        </div>

                                        <div class="campaign-stats">
                                            <span class="stat">
                                                {{campaign.percentage_raised}}% funded
                                            </span>
                                            <span class="stat">
                                                {{campaign.donors_count}} donors
                                            </span>
                                        </div>

                                        <p class="campaign-description">{{campaign.description}}</p>
                                        
                                        <button class="select-campaign-btn" ng-click="$event.stopPropagation()">
                                            💝 Support This Campaign
                                        </button>
                                    </div>
                                </div>

                                <div ng-if="!$ctrl.isLoadingCampaigns && (!$ctrl.availableCampaigns || $ctrl.availableCampaigns.length === 0)" class="no-campaigns">
                                    <p>No campaigns available at this moment.</p>
                                </div>
                            </div>

                            <div class="modal-footer">
                                <button ng-click="$ctrl.closeCampaignSelector()" class="btn-cancel-full">Cancel</button>
                            </div>
                        </div>
                    </div>

                    <!-- DONATION MODAL -->
                    <div ng-if="$ctrl.showDonationModal" class="modal-overlay">
                        <div class="donation-modal">
                            <div class="modal-header">
                                <h3>💳 Donation Details</h3>
                                <button ng-click="$ctrl.closeDonationModal()" class="close-btn">✕</button>
                            </div>

                            <div class="modal-content">
                                <div ng-if="$ctrl.donationForm.campaign_title" class="selected-campaign-info">
                                    <p><strong>Campaign:</strong> {{$ctrl.donationForm.campaign_title}}</p>
                                    <p><strong>Target:</strong> ₹{{$ctrl.donationForm.target_amount | number}}</p>
                                    <p><strong>Raised:</strong> ₹{{$ctrl.donationForm.raised_amount | number}}</p>
                                </div>

                                <form ng-submit="$ctrl.submitDonation()" class="donation-form">
                                    <div class="form-group">
                                        <label>Donation Amount (₹)</label>
                                        <div class="amount-input">
                                            <span class="currency">₹</span>
                                            <input type="number" 
                                                   ng-model="$ctrl.donationForm.amount"
                                                   placeholder="Enter amount"
                                                   min="100"
                                                   required>
                                        </div>
                                        <small>Minimum: ₹100</small>
                                    </div>

                                    <div class="form-group">
                                        <label>Donation Type</label>
                                        <select ng-model="$ctrl.donationForm.frequency" class="form-select">
                                            <option value="one_time">One-time Donation</option>
                                            <option value="monthly">Monthly Recurring</option>
                                            <option value="quarterly">Quarterly Recurring</option>
                                            <option value="yearly">Yearly Recurring</option>
                                        </select>
                                    </div>

                                    <div class="modal-actions">
                                        <button type="button" ng-click="$ctrl.closeDonationModal()" class="btn-cancel">Cancel</button>
                                        <button type="submit" class="btn-donate">💳 Continue to Payment</button>
                                    </div>
                                </form>
                            </div>

                            <div class="modal-footer">
                                <p>💡 Your donation helps us continue the mission. Thank you!</p>
                                <p><small>Payments secured by Stripe. No card details stored.</small></p>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            controller: 'FundEavorChatCtrl',
            controllerAs: '$ctrl',
            scope: {},
            link: function(scope, element, attrs) {
                // Styling injected here
            }
        };
    });

// ==================== STYLES ====================
// Add this to your CSS or create a new stylesheet

var chatWidgetStyles = `
.fundeavor-chat-container {
    display: flex;
    flex-direction: column;
    height: 600px;
    width: 400px;
    border: 1px solid #ddd;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
}

/* Header */
.chat-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 600;
    font-size: 16px;
}

.header-icon {
    font-size: 20px;
}

.header-close {
    margin-left: auto;
    cursor: pointer;
    font-size: 24px;
    opacity: 0.7;
    transition: opacity 0.2s;
}

.header-close:hover {
    opacity: 1;
}

/* Messages Container */
.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #f9f9f9;
}

.chat-messages::-webkit-scrollbar {
    width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
}

.chat-messages::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 10px;
}

/* Message Wrapper */
.message-wrapper {
    display: flex;
    margin-bottom: 8px;
}

.message-wrapper.message-user {
    justify-content: flex-end;
}

.message-wrapper.message-bot {
    justify-content: flex-start;
}

/* Message Bubble */
.message {
    display: flex;
    gap: 8px;
    max-width: 80%;
    align-items: flex-end;
}

.message-bot {
    align-items: flex-end;
}

.message-bubble {
    background: white;
    border-radius: 12px;
    padding: 12px 16px;
    word-break: break-word;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.message-user .message-bubble {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 18px 4px 18px 18px;
}

.message-bot .message-bubble {
    background: #f0f0f0;
    color: #333;
    border-radius: 4px 18px 18px 18px;
}

/* Message Text */
.message-text {
    display: block;
    font-size: 14px;
    line-height: 1.4;
}

.message-line {
    font-size: 13px;
    line-height: 1.5;
    color: #333;
}

.message-line-empty {
    height: 8px;
}

.message-icon {
    font-size: 20px;
    flex-shrink: 0;
}

/* Time */
.message-time {
    font-size: 11px;
    color: #999;
    margin-top: 4px;
}

/* Typing Animation */
.typing-dots {
    display: inline-flex;
    gap: 2px;
}

.typing-dots span {
    display: inline-block;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #667eea;
    animation: typing 1.4s infinite;
}

.typing-dots span:nth-child(2) {
    animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
    animation-delay: 0.4s;
}

@keyframes typing {
    0%, 60%, 100% {
        opacity: 0.3;
        transform: translateY(0);
    }
    30% {
        opacity: 1;
        transform: translateY(-10px);
    }
}

/* Loading Indicator */
.loading-indicator {
    display: flex;
    gap: 8px;
    align-items: center;
    color: #667eea;
    padding: 12px;
    font-size: 13px;
}

.loading-text {
    font-weight: 500;
}

/* Input Container */
.chat-input-container {
    border-top: 1px solid #eee;
    padding: 12px;
    background: white;
}

.chat-input-container form {
    display: flex;
    gap: 8px;
}

.chat-input {
    flex: 1;
    border: 1px solid #ddd;
    border-radius: 24px;
    padding: 10px 16px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
}

.chat-input:focus {
    border-color: #667eea;
}

.chat-input:disabled {
    background: #f5f5f5;
    color: #999;
}

.send-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s;
}

.send-button:hover:not(:disabled) {
    opacity: 0.9;
}

.send-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* Quick Actions */
.quick-actions {
    border-top: 1px solid #eee;
    padding: 12px;
    background: white;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.quick-btn {
    flex: 1;
    min-width: 80px;
    padding: 8px 12px;
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 16px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.quick-btn:hover {
    background: #e0e0e0;
    border-color: #667eea;
}

/* Responsive */
@media (max-width: 600px) {
    .fundeavor-chat-container {
        height: 500px;
        width: 100%;
    }

    .message {
        max-width: 90%;
    }
}

/* ==================== CAMPAIGN SELECTOR & DONATION MODAL STYLES ==================== */

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.campaign-selector-modal,
.donation-modal {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #e0e0e0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    flex-shrink: 0;
}

.modal-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
}

.close-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    transition: all 0.3s;
    padding: 0;
}

.close-btn:hover {
    background: rgba(255, 255, 255, 0.4);
}

.modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
}

.modal-subtitle {
    color: #666;
    font-size: 14px;
    margin-bottom: 16px;
}

.campaigns-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.campaign-card {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 14px;
    cursor: pointer;
    transition: all 0.3s;
    background: #f9f9f9;
}

.campaign-card:hover {
    border-color: #667eea;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    transform: translateY(-2px);
}

.campaign-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.campaign-header h4 {
    margin: 0;
    font-size: 15px;
    color: #333;
    flex: 1;
}

.urgency-badge {
    background: #ff6b6b;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    white-space: nowrap;
}

.campaign-progress {
    margin-bottom: 12px;
}

.progress-bar {
    width: 100%;
    height: 8px;
    background: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 6px;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    transition: width 0.3s;
}

.progress-text {
    font-size: 12px;
    color: #666;
}

.campaign-stats {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #999;
    margin-bottom: 10px;
}

.campaign-description {
    font-size: 13px;
    color: #666;
    margin: 10px 0;
    line-height: 1.4;
}

.select-campaign-btn {
    width: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
}

.select-campaign-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.loading-spinner {
    text-align: center;
    padding: 40px 20px;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.no-campaigns {
    text-align: center;
    padding: 40px 20px;
    color: #999;
}

.selected-campaign-info {
    background: #f0f4ff;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 13px;
}

.selected-campaign-info p {
    margin: 6px 0;
    color: #333;
}

.donation-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.form-group {
    display: flex;
    flex-direction: column;
}

.form-group label {
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 6px;
    color: #333;
}

.form-group input,
.form-group select {
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
}

.form-group input:focus,
.form-group select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.amount-input {
    display: flex;
    align-items: center;
    gap: 8px;
}

.currency {
    font-size: 18px;
    font-weight: 600;
    color: #667eea;
}

.amount-input input {
    flex: 1;
}

.form-group small {
    display: block;
    margin-top: 4px;
    color: #999;
    font-size: 12px;
}

.modal-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
}

.btn-cancel,
.btn-cancel-full,
.btn-donate {
    padding: 12px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
}

.btn-cancel {
    flex: 1;
    background: #f0f0f0;
    color: #333;
}

.btn-cancel:hover {
    background: #e0e0e0;
}

.btn-cancel-full {
    width: 100%;
    background: #f0f0f0;
    color: #333;
}

.btn-cancel-full:hover {
    background: #e0e0e0;
}

.btn-donate {
    flex: 1;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.btn-donate:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.modal-footer {
    padding: 16px 20px;
    border-top: 1px solid #e0e0e0;
    background: #f8f9fa;
    text-align: center;
    flex-shrink: 0;
}

.modal-footer p {
    margin: 6px 0;
    font-size: 12px;
    color: #666;
}

.donate-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    font-weight: 600;
}

.donate-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* Dark Mode Support */
@media (prefers-color-scheme: dark) {
    .fundeavor-chat-container {
        background: #1e1e1e;
        color: #fff;
    }

    .chat-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .chat-messages {
        background: #2a2a2a;
    }

    .message-bubble {
        background: #333;
        color: #fff;
    }

    .message-bot .message-bubble {
        background: #333;
        color: #e0e0e0;
    }

    .chat-input {
        background: #333;
        color: #fff;
        border-color: #444;
    }

    .quick-btn {
        background: #333;
        color: #fff;
        border-color: #444;
    }

    .quick-btn:hover {
        background: #444;
    }
}
`;

// Inject styles
if (document.head) {
    var styleTag = document.createElement('style');
    styleTag.textContent = chatWidgetStyles;
    document.head.appendChild(styleTag);
}
