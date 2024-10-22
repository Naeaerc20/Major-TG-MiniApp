// scripts/apis.js

const axios = require('axios');

/**
 * Function to get the Bearer Token and User ID.
 * Makes a POST request to https://major.bot/api/auth/tg/
 */
async function getBearerToken(init_data, axiosConfig = {}) {
  const response = await axios.post('https://major.bot/api/auth/tg/', { init_data }, axiosConfig);
  const { access_token, user } = response.data;
  return { access_token, user_id: user.id };
}

/**
 * Function to get user information.
 * Makes a GET request to https://major.bot/api/users/$USER_ID/
 */
async function getUserInfo(access_token, user_id, axiosConfig = {}) {
  const response = await axios.get(`https://major.bot/api/users/${user_id}/`, {
    headers: { Authorization: `Bearer ${access_token}` },
    ...axiosConfig,
  });
  return response.data;
}

/**
 * Function to perform the daily Check-In.
 * Makes a POST request to https://major.bot/api/user-visits/visit/
 */
async function performCheckIn(access_token, axiosConfig = {}) {
  const response = await axios.post(
    'https://major.bot/api/user-visits/visit/',
    {},
    { headers: { Authorization: `Bearer ${access_token}` }, ...axiosConfig }
  );
  return response.data;
}

/**
 * Function to get the list of tasks.
 * Makes a GET request to https://major.bot/api/tasks/?is_daily=<is_daily>
 */
async function getTasks(access_token, is_daily = false, axiosConfig = {}) {
  const response = await axios.get(`https://major.bot/api/tasks/?is_daily=${is_daily}`, {
    headers: { Authorization: `Bearer ${access_token}` },
    ...axiosConfig,
  });
  return response.data;
}

/**
 * Function to complete a task by ID.
 * Makes a POST request to https://major.bot/api/tasks/
 * Payload: { task_id: number }
 */
async function completeTask(access_token, task_id, axiosConfig = {}) {
  const response = await axios.post(
    'https://major.bot/api/tasks/',
    { task_id },
    { headers: { Authorization: `Bearer ${access_token}` }, ...axiosConfig }
  );
  return response.data;
}

/**
 * Function to complete a task by ID with additional payload.
 * Makes a POST request to https://major.bot/api/tasks/
 * Payload: { task_id: number, ...payload }
 */
async function completeTaskWithPayload(access_token, payload, axiosConfig = {}) {
  const response = await axios.post(
    'https://major.bot/api/tasks/',
    payload,
    { headers: { Authorization: `Bearer ${access_token}` }, ...axiosConfig }
  );
  return response.data;
}

/**
 * Function to check if the user can play Hold The Coin.
 * Makes a GET request to https://major.bot/api/bonuses/coins/
 */
async function canPlayHoldTheCoin(access_token, axiosConfig = {}) {
  const response = await axios.get('https://major.bot/api/bonuses/coins/', {
    headers: { Authorization: `Bearer ${access_token}` },
    ...axiosConfig,
  });
  return response.data.success;
}

/**
 * Function to play Hold The Coin.
 * Makes a POST request to https://major.bot/api/bonuses/coins/
 * Payload: { coins: number }
 */
async function playHoldTheCoin(access_token, coins, axiosConfig = {}) {
  const response = await axios.post(
    'https://major.bot/api/bonuses/coins/',
    { coins },
    { headers: { Authorization: `Bearer ${access_token}` }, ...axiosConfig }
  );
  return response.data.success;
}

/**
 * Function to check if the user can play Roulette.
 * Makes a GET request to https://major.bot/api/roulette/
 */
async function canPlayRoulette(access_token, axiosConfig = {}) {
  const response = await axios.get('https://major.bot/api/roulette/', {
    headers: { Authorization: `Bearer ${access_token}` },
    ...axiosConfig,
  });
  return response.data.success;
}

/**
 * Function to play Roulette.
 * Makes a POST request to https://major.bot/api/roulette/
 * Payload: { rating_award: number, result: number }
 */
async function playRoulette(access_token, rating_award, result, axiosConfig = {}) {
  const response = await axios.post(
    'https://major.bot/api/roulette/',
    { rating_award, result },
    { headers: { Authorization: `Bearer ${access_token}` }, ...axiosConfig }
  );
  return response.data;
}

/**
 * Function to check if the user can play Swipe Coin.
 * Makes a GET request to https://major.bot/api/swipe_coin/
 */
async function canPlaySwipeCoin(access_token, axiosConfig = {}) {
  const response = await axios.get('https://major.bot/api/swipe_coin/', {
    headers: { Authorization: `Bearer ${access_token}` },
    ...axiosConfig,
  });
  return response.data.success;
}

/**
 * Function to play Swipe Coin.
 * Makes a POST request to https://major.bot/api/swipe_coin/
 * Payload: { coins: number }
 */
async function playSwipeCoin(access_token, coins, axiosConfig = {}) {
  const response = await axios.post(
    'https://major.bot/api/swipe_coin/',
    { coins },
    { headers: { Authorization: `Bearer ${access_token}` }, ...axiosConfig }
  );
  return response.data.success;
}

/**
 * Function to check if the user can play Durov Game.
 * Makes a GET request to https://major.bot/api/durov/
 */
async function canPlayDurovGame(access_token, axiosConfig = {}) {
  const response = await axios.get('https://major.bot/api/durov/', {
    headers: { Authorization: `Bearer ${access_token}` },
    ...axiosConfig,
  });
  return response.data.success; // If true, the user can play
}

/**
 * Function to play Durov Game.
 * Makes a POST request to https://major.bot/api/durov/
 * Payload: { choice_1, choice_2, choice_3, choice_4 }
 */
async function playDurovGame(access_token, choices, axiosConfig = {}) {
  const response = await axios.post(
    'https://major.bot/api/durov/',
    choices,
    { headers: { Authorization: `Bearer ${access_token}` }, ...axiosConfig }
  );
  return response.data; // Returns response data
}

// Export all functions
module.exports = {
  getBearerToken,
  getUserInfo,
  performCheckIn,
  getTasks,
  completeTask,
  completeTaskWithPayload,
  canPlayHoldTheCoin,
  playHoldTheCoin,
  canPlayRoulette,
  playRoulette,
  canPlaySwipeCoin,
  playSwipeCoin,
  canPlayDurovGame,
  playDurovGame,
};
