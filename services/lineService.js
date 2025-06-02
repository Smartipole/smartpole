const axios = require('axios');
const config = require('../config/config'); // Assuming this file is in 'services' directory

/**
 * Service class for interacting with the LINE Messaging API.
 * Handles sending various types of messages to users and fetching user profiles.
 */
class LineService {
  constructor() {
    this.baseURL = 'https://api.line.me/v2/bot';
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}`
    };

    if (!config.LINE_CHANNEL_ACCESS_TOKEN || config.LINE_CHANNEL_ACCESS_TOKEN === "YOUR_LINE_CHANNEL_ACCESS_TOKEN_HERE") {
      console.error('❌ FATAL: LINE_CHANNEL_ACCESS_TOKEN is not configured. Please check your .env file.');
    }
  }

  /**
   * Sends a reply message to a user using a reply token.
   * @param {string} replyToken - The reply token received from LINE webhook.
   * @param {string|object|array} messages - A single message object, an array of message objects, or a string for a simple text message.
   * @returns {Promise<boolean>} True if the message was sent successfully, false otherwise.
   */
  async replyToUser(replyToken, messages) {
    if (!replyToken) {
      console.error('❌ ReplyToUser: Missing replyToken.');
      return false;
    }
    if (!messages || (Array.isArray(messages) && messages.length === 0)) {
      console.error('❌ ReplyToUser: No messages provided.');
      return false;
    }

    let messageArray;
    if (typeof messages === 'string') {
      messageArray = [{ type: 'text', text: messages }];
    } else if (!Array.isArray(messages)) {
      messageArray = [messages];
    } else {
      messageArray = messages;
    }

    const url = `${this.baseURL}/message/reply`;
    const payload = {
      replyToken: replyToken,
      messages: messageArray
    };

    return this.sendLineRequest(url, payload, 'Reply');
  }

  /**
   * Sends a push message to a specified user.
   * @param {string} userId - The LINE User ID of the recipient.
   * @param {string|object|array} messages - A single message object, an array of message objects, or a string for a simple text message.
   * @returns {Promise<boolean>} True if the message was sent successfully, false otherwise.
   */
  async pushMessage(userId, messages) {
    if (!userId) {
      console.error('❌ PushMessage: Missing userId.');
      return false;
    }
     if (!messages || (Array.isArray(messages) && messages.length === 0)) {
      console.error('❌ PushMessage: No messages provided.');
      return false;
    }

    let messageArray;
    if (typeof messages === 'string') {
      messageArray = [{ type: 'text', text: messages }];
    } else if (!Array.isArray(messages)) {
      messageArray = [messages];
    } else {
      messageArray = messages;
    }

    const url = `${this.baseURL}/message/push`;
    const payload = {
      to: userId,
      messages: messageArray
    };

    return this.sendLineRequest(url, payload, 'Push');
  }

  /**
   * Retrieves a user's LINE profile information.
   * @param {string} userId - The LINE User ID.
   * @returns {Promise<object|null>} The user's profile object if successful, otherwise null.
   * Profile object includes: userId, displayName, pictureUrl, statusMessage.
   */
  async getLineUserProfile(userId) {
    if (!userId) {
      console.error('❌ GetLineUserProfile: Missing userId.');
      return null;
    }
    if (!config.LINE_CHANNEL_ACCESS_TOKEN || config.LINE_CHANNEL_ACCESS_TOKEN === "YOUR_LINE_CHANNEL_ACCESS_TOKEN_HERE") {
      console.error('❌ GetLineUserProfile Error: LINE_CHANNEL_ACCESS_TOKEN is not configured.');
      return null;
    }

    const url = `${this.baseURL}/profile/${userId}`;
    try {
      // console.log(`ℹ️ Fetching LINE profile for user: ${userId}`);
      const response = await axios.get(url, { headers: this.headers });
      if (response.status === 200 && response.data) {
        // console.log(`✅ Successfully fetched LINE profile for ${userId}:`, response.data.displayName);
        return response.data; // Returns { userId, displayName, pictureUrl?, statusMessage? }
      } else {
        console.warn(`⚠️ GetLineUserProfile Warning (HTTP ${response.status}) for ${userId}:`, response.data);
        return null;
      }
    } catch (error) {
      console.error(`❌ GetLineUserProfile Request Failed for ${userId}:`, error.message);
      if (error.response) {
        console.error('LINE API Error Details (Profile Fetch):', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  /**
   * Generic function to send a request to the LINE API.
   * @param {string} url - The API endpoint URL.
   * @param {object} payload - The payload for the request.
   * @param {string} requestType - A string describing the type of request (for logging purposes).
   * @returns {Promise<boolean>} True if the request was successful (HTTP 200), false otherwise.
   */
  async sendLineRequest(url, payload, requestType) {
    if (!config.LINE_CHANNEL_ACCESS_TOKEN || config.LINE_CHANNEL_ACCESS_TOKEN === "YOUR_LINE_CHANNEL_ACCESS_TOKEN_HERE") {
      console.error(`❌ LINE API ${requestType} Error: LINE_CHANNEL_ACCESS_TOKEN is not configured.`);
      return false;
    }
    try {
      // console.log(`📤 Sending LINE ${requestType} to ${url} with payload:`, JSON.stringify(payload, null, 2));
      const response = await axios.post(url, payload, { headers: this.headers });
      
      if (response.status === 200) {
        // console.log(`✅ LINE API ${requestType} Success (HTTP 200)`);
        return true;
      } else {
        console.warn(`⚠️ LINE API ${requestType} Warning (HTTP ${response.status}):`, response.data);
        return false;
      }
    } catch (error) {
      console.error(`❌ LINE API ${requestType} Request Failed:`, error.message);
      if (error.response) {
        console.error('LINE API Error Details:', JSON.stringify(error.response.data, null, 2));
        console.error('LINE API Error Status:', error.response.status);
        // console.error('LINE API Error Headers:', JSON.stringify(error.response.headers, null, 2));
      } else if (error.request) {
        console.error('LINE API No Response:', error.request);
      }
      return false;
    }
  }
}

module.exports = new LineService();
