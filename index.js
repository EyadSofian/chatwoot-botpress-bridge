const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ============================================
// الإعدادات
// ============================================
const CHATWOOT_BASE_URL = 'https://chat.engosoft.com';
const CHATWOOT_ACCOUNT_ID = '2';
const CHATWOOT_API_TOKEN = 'd8BzFgjKZAwUD46ZHkcPXzkT';

const BOTPRESS_WEBHOOK_URL = 'https://webhook.botpress.cloud/ae668903-86f4-434f-b549-8bee2d73faf5';
const BOTPRESS_PAT = 'bp_pat_lUBqWK1NU14ESVpsfGyYvSKf370cj31XSNzA';

// تخزين conversation mapping و tracking للـ status
const conversationMap = new Map();
const conversationStatusHistory = new Map(); // ✅ جديد

// ============================================
// 1. Webhook من Chatwoot → يبعت لـ Botpress
// ============================================
app.post('/chatwoot/webhook', async (req, res) => {
    try {
        const payload = req.body;
        
        console.log('📥 Chatwoot webhook:', payload.message_type, payload.content?.substring(0, 50));
        
        // تجاهل الرسائل الصادرة
        if (payload.message_type !== 'incoming') {
            console.log('⏭️ Skipping outgoing message');
            return res.status(200).json({ status: 'skipped' });
        }
        
        // تجاهل الرسائل الفاضية
        if (!payload.content || !payload.conversation?.id) {
            console.log('⏭️ Skipping empty message');
            return res.status(200).json({ status: 'skipped' });
        }
        
        const chatwootConvId = String(payload.conversation.id);
        const convStatus = payload.conversation?.status;
        
        // ✅ تجاهل لو المحادثة open (Agent شغال)
        if (convStatus === 'open') {
            console.log('⏭️ Skipping - conversation is open (agent handling)');
            // حفظ إن المحادثة كانت open
            conversationStatusHistory.set(chatwootConvId, 'open');
            return res.status(200).json({ status: 'skipped - agent handling' });
        }
        
        const chatwootUserId = String(payload.sender?.id || 'unknown');
        const messageId = String(payload.id || Date.now());
        
        // ✅ تحقق: هل المحادثة كانت open قبل كده ودلوقتي رجعت pending؟
        const wasOpen = conversationStatusHistory.get(chatwootConvId) === 'open';
        const isNowPending = convStatus === 'pending';
        const shouldResetContext = wasOpen && isNowPending;
        
        if (shouldResetContext) {
            console.log('🔄 Conversation returned to pending after agent - will reset context');
            // امسح الـ history عشان المرة الجاية
            conversationStatusHistory.delete(chatwootConvId);
        }
        
        // حفظ الـ mapping
        conversationMap.set(chatwootConvId, {
            chatwootConvId,
            chatwootUserId,
            senderName: payload.sender?.name || ''
        });
        
        console.log('📤 Sending to Botpress:', payload.content);
        
        // إرسال لـ Botpress Messaging API
        const response = await axios.post(
            BOTPRESS_WEBHOOK_URL,
            {
                userId: `chatwoot-user-${chatwootUserId}`,
                messageId: `msg-${messageId}`,
                conversationId: `chatwoot-conv-${chatwootConvId}`,
                type: 'text',
                text: payload.content,
                payload: {
                    type: 'text',
                    text: payload.content,
                    chatwootConversationId: chatwootConvId,
                    chatwootUserId: chatwootUserId,
                    senderName: payload.sender?.name || '',
                    conversationStatus: convStatus,
                    // ✅ Flag جديد: هل المحادثة رجعت pending بعد ما كانت open؟
                    shouldResetContext: shouldResetContext
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${BOTPRESS_PAT}`
                }
            }
        );
        
        console.log('✅ Sent to Botpress');
        res.status(200).json({ status: 'sent' });
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 2. Webhook من Botpress → يبعت لـ Chatwoot
// ============================================
app.post('/botpress/webhook', async (req, res) => {
    try {
        const payload = req.body;
        
        console.log('📥 Botpress response:', JSON.stringify(payload).substring(0, 100));
        
        const conversationId = payload.conversationId || payload.botpressConversationId;
        const text = payload.payload?.text || payload.text;
        
        if (!conversationId || !text) {
            console.log('⏭️ Skipping - no conversationId or text');
            return res.status(200).json({ status: 'skipped' });
        }
        
        // استخراج الـ Chatwoot conversation ID
        const chatwootConvId = conversationId.replace('chatwoot-conv-', '');
        
        console.log('📤 Sending to Chatwoot conv:', chatwootConvId);
        
        // إرسال لـ Chatwoot
        const response = await axios.post(
            `${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${chatwootConvId}/messages`,
            {
                content: text,
                message_type: 'outgoing',
                private: false
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'api_access_token': CHATWOOT_API_TOKEN
                }
            }
        );
        
        console.log('✅ Sent to Chatwoot, Message ID:', response.data.id);
        res.status(200).json({ status: 'sent' });
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Health check
// ============================================
app.get('/', (req, res) => {
    res.json({ 
        status: 'running',
        endpoints: {
            chatwoot: '/chatwoot/webhook',
            botpress: '/botpress/webhook'
        }
    });
});

// ============================================
// Start server
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Bridge server running on port ${PORT}`);
});
