// index.js (Main Controller - Final Version with Kaiz AI)
const express = require('express');
const secrets = require('./secrets.js');
const stateManager = require('./state_manager.js');
const messengerApi = require('./messenger_api.js');
const toolHandlers = require('./tool_handlers.js');
const axios = require('axios');

const { VERIFY_TOKEN } = secrets;
const app = express();
app.use(express.json());

// --- Main Menu ---
async function showMainMenu(psid) {
    const menuText = `🤖 Multi-Tool Bot 🤖

What would you like to do?

--- AI Models ---
1. Kaiz AI (Vision & Memory) 🆕
2. GPT-4o (Advanced 🚀)
3. Grok
4. Claude 3 Haiku
5. O3 Mini
6. ChatGot.io (Memory)
7. Gemini Pro (Memory)

--- Media Tools ---
8. Facebook Downloader
9. YouTube Downloader
10. TikTok Downloader
11. Pinterest Search
12. Ghibli Image Filter ✨
13. Anime Heaven Downloader
14. Spotify Search 🎵

--- Utility Tools ---
15. Google Search
16. Google Translate
17. AI Text Humanizer ✍️

Just type the number of your choice.`;
    await messengerApi.sendText(psid, menuText);
}

// --- Message Handlers ---
async function handleTextMessage(psid, message) {
    const messageText = message.text?.trim();
    const lowerCaseText = messageText?.toLowerCase();
    
    const userState = stateManager.getUserState(psid);

    if (lowerCaseText === 'menu') {
        stateManager.clearUserState(psid);
        await showMainMenu(psid);
        return;
    }

    if (userState?.state) {
        switch (userState.state) {
            case 'in_chat':
                // Pass an empty imageUrl for text-only follow-ups
                handleInChat(psid, lowerCaseText, messageText, userState.model, userState.roleplay, '');
                return;
            case 'awaiting_gpt4o_roleplay':
                handleGpt4oRoleplay(psid, messageText);
                return;
            case 'awaiting_downloader_fb':
            case 'awaiting_downloader_yt':
            case 'awaiting_downloader_tik':
                const platform = userState.state.split('_')[2];
                toolHandlers.handleDownloadRequest(psid, messageText, platform);
                return;
            case 'awaiting_google_query':
                toolHandlers.handleGoogleSearch(psid, messageText);
                return;
            case 'awaiting_pinterest_query':
                stateManager.setUserState(psid, 'awaiting_pinterest_count', { query: messageText });
                await messengerApi.sendText(psid, "Got it. How many images would you like? (e.g., 5)");
                return;
            case 'awaiting_pinterest_count':
                toolHandlers.handlePinterestSearch(psid, userState.query, messageText);
                return;
            case 'awaiting_translate_text':
                stateManager.setUserState(psid, 'awaiting_translate_lang', { text: messageText });
                await messengerApi.sendText(psid, "Got it. Now, what language should I translate it to? (e.g., 'en' for English)");
                return;
            case 'awaiting_translate_lang':
                toolHandlers.handleTranslateRequest(psid, userState.text, messageText);
                return;
            case 'awaiting_humanizer_text':
                toolHandlers.handleHumanizerRequest(psid, messageText);
                return;
            case 'awaiting_anime_title':
                stateManager.setUserState(psid, 'awaiting_anime_episode', { title: messageText });
                await messengerApi.sendText(psid, "Got it. Now, what episode number would you like?");
                return;
            case 'awaiting_anime_episode':
                toolHandlers.handleAnimeHeavenRequest(psid, userState.title, messageText);
                return;
            case 'awaiting_spotify_query':
                toolHandlers.handleSpotifySearch(psid, messageText);
                return;
        }
    }

    handleMenuSelection(psid, lowerCaseText);
}

async function handleImageAttachment(psid, imageUrl) {
    const userState = stateManager.getUserState(psid);

    if (userState?.state === 'in_chat' && userState.model === 'kaiz') {
        await messengerApi.sendText(psid, "🖼️ Image received! Analyzing with Kaiz AI...");
        // Ask a default question about the image, pass the image URL
        toolHandlers.forwardToAI(psid, "What do you see in this image?", userState.model, '', imageUrl);
    } 
    else if (userState?.state === 'awaiting_ghibli_image') {
        toolHandlers.handleGhibliRequest(psid, imageUrl);
    } else {
        await messengerApi.sendText(psid, "I see you've sent an image, but I'm not sure what to do with it. Please select an option from the menu first.");
    }
}


// --- Logic Handlers for Conversation Flow ---
function handleMenuSelection(psid, choice) {
    // Re-numbered menu options
    switch (choice) {
        // AI Models
        case '1': handleAiSelection(psid, 'kaiz'); break;
        case '2':
            stateManager.setUserState(psid, 'awaiting_gpt4o_roleplay');
            messengerApi.sendText(psid, "🚀 Advanced GPT-4o selected.\nYou can set a custom roleplay for the AI (e.g., 'You are a helpful pirate'). Or, type 'skip' to use the default.");
            break;
        case '3': handleAiSelection(psid, 'grok'); break;
        case '4': handleAiSelection(psid, 'claude'); break;
        case '5': handleAiSelection(psid, 'o3mini'); break;
        case '6': handleAiSelection(psid, 'chatgot'); break;
        case '7': handleAiSelection(psid, 'geminipro'); break;
        
        // Media Tools
        case '8': handleDownloaderSelection(psid, 'fb'); break;
        case '9': handleDownloaderSelection(psid, 'yt'); break;
        case '10': handleDownloaderSelection(psid, 'tik'); break;
        case '11':
            stateManager.setUserState(psid, 'awaiting_pinterest_query');
            messengerApi.sendText(psid, "✅ Pinterest Search selected. What do you want to search for?");
            break;
        case '12':
            stateManager.setUserState(psid, 'awaiting_ghibli_image');
            messengerApi.sendText(psid, "✅ Ghibli Filter selected. Please send an image you want to transform!");
            break;
        case '13':
            stateManager.setUserState(psid, 'awaiting_anime_title');
            messengerApi.sendText(psid, "✅ Anime Heaven selected. What is the title of the anime?");
            break;
        case '14':
            stateManager.setUserState(psid, 'awaiting_spotify_query');
            messengerApi.sendText(psid, "✅ Spotify Search selected. What song or artist?");
            break;

        // Utility Tools
        case '15':
            stateManager.setUserState(psid, 'awaiting_google_query');
            messengerApi.sendText(psid, "✅ Google Search selected. What do you want to search for?");
            break;
        case '16':
            stateManager.setUserState(psid, 'awaiting_translate_text');
            messengerApi.sendText(psid, "✅ Google Translate selected. What text would you like to translate?");
            break;
        case '17':
            stateManager.setUserState(psid, 'awaiting_humanizer_text');
            messengerApi.sendText(psid, "✅ AI Text Humanizer selected. Please send the text to convert.");
            break;
        default:
            showMainMenu(psid);
            break;
    }
}

function handleGpt4oRoleplay(psid, text) {
    const roleplay = text.toLowerCase() === 'skip' ? '' : text;
    stateManager.setUserState(psid, 'in_chat', { model: 'gpt4o_advanced', roleplay: roleplay });
    let confirmation = "✅ You are now chatting with Advanced GPT-4o.";
    if (roleplay) {
        confirmation += `\n*Roleplay set:* "${roleplay}"`;
    }
    confirmation += `\n\nAsk me anything! This AI remembers your conversation.\n(Type 'switch' or 'exit' at any time.)`;
    messengerApi.sendText(psid, confirmation);
}

function handleAiSelection(psid, model) {
    let modelName, welcomeMessage;
    
    if (model === 'grok') modelName = 'Grok';
    if (model === 'claude') modelName = 'Claude 3 Haiku';
    if (model === 'o3mini') modelName = 'O3 Mini';
    if (model === 'chatgot') modelName = 'ChatGot.io (w/ Memory)';
    if (model === 'geminipro') modelName = 'Gemini Pro (w/ Memory)';
    if (model === 'kaiz') modelName = 'Kaiz AI (Vision & Memory)';

    if (model === 'kaiz') {
        welcomeMessage = `✅ You are now chatting with ${modelName}. Ask me anything, or send an image!\n\n(Type 'switch' or 'exit' at any time.)`;
    } else {
        welcomeMessage = `✅ You are now chatting with ${modelName}. Ask me anything!\n\n(Type 'switch' or 'exit' at any time.)`;
    }
    
    stateManager.setUserState(psid, 'in_chat', { model });
    messengerApi.sendText(psid, welcomeMessage);
}

function handleDownloaderSelection(psid, platform) {
    let state, platformName;
    if (platform === 'fb') { state = 'awaiting_downloader_fb'; platformName = 'Facebook'; }
    if (platform === 'yt') { state = 'awaiting_downloader_yt'; platformName = 'YouTube'; }
    if (platform === 'tik') { state = 'awaiting_downloader_tik'; platformName = 'TikTok'; }
    stateManager.setUserState(psid, state);
    messengerApi.sendText(psid, `✅ ${platformName} Downloader selected. Please send me the full video URL.`);
}

function handleInChat(psid, lowerCaseText, originalText, model, roleplay, imageUrl = '') {
    if (lowerCaseText === 'switch') {
        stateManager.clearUserState(psid);
        messengerApi.sendText(psid, "🔄 Switching tasks...");
        showMainMenu(psid);
    } else if (lowerCaseText === 'exit') {
        stateManager.clearUserState(psid);
        messengerApi.sendText(psid, "✅ You have exited the chat session. Type 'menu' to start again.");
    } else {
        toolHandlers.forwardToAI(psid, originalText, model, roleplay, imageUrl);
    }
}

// --- Server and Webhook Setup ---
app.get('/', (req, res) => res.status(200).send('✅ Multi-Tool Bot is online and healthy.'));

app.get('/webhook', (req, res) => {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log("Webhook verified successfully!");
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

app.post('/webhook', (req, res) => {
    if (req.body.object === 'page') {
        req.body.entry.forEach(entry => {
            const event = entry.messaging[0];
            if (event?.sender?.id && event.message) {
                if (event.message.text) {
                    handleTextMessage(event.sender.id, event.message);
                } else if (event.message.attachments?.[0]?.type === 'image') {
                    const imageUrl = event.message.attachments[0].payload.url;
                    handleImageAttachment(event.sender.id, imageUrl);
                }
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`✅ Multi-Tool test bot is listening on port ${PORT}.`));

// --- API KEEPALIVE FUNCTION ---
async function keepApiKeyActive() {
    try {
        const apiKey = "732ce71f-4761-474d-adf2-5cd2d315ad18";
        const pingUrl = `https://kaiz-apis.gleeze.com/api/humanizer?q=Hello&apikey=${apiKey}`;
        console.log("Pinging Humanizer API to keep key active...");
        const response = await axios.get(pingUrl);
        if (response.data && (response.data.response || response.data.result)) {
            console.log("✅ Humanizer API ping successful.");
        } else {
            console.warn("⚠️ Humanizer API ping returned an unexpected response, but was likely successful:", response.data);
        }
    } catch (error) {
        console.error("❌ Humanizer API ping failed:", error.message);
    }
}

const threeDaysInMs = 259200000;
server.on('listening', () => {
    keepApiKeyActive();
    setInterval(keepApiKeyActive, threeDaysInMs);
});
