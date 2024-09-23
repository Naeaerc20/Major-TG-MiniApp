// scripts/apis.js

const axios = require('axios');

/**
 * Función para obtener el Bearer Token y el ID de usuario.
 * Realiza una solicitud POST a https://major.bot/api/auth/tg/
 */
async function getBearerToken(init_data) {
  const response = await axios.post('https://major.bot/api/auth/tg/', { init_data });
  const { access_token, user } = response.data;
  return { access_token, user_id: user.id };
}

/**
 * Función para obtener información del usuario.
 * Realiza una solicitud GET a https://major.bot/api/users/$USER_ID/
 */
async function getUserInfo(access_token, user_id) {
  const response = await axios.get(`https://major.bot/api/users/${user_id}/`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  return response.data;
}

/**
 * Función para realizar el Check-In diario.
 * Realiza una solicitud POST a https://major.bot/api/user-visits/visit/
 */
async function performCheckIn(access_token) {
  const response = await axios.post(
    'https://major.bot/api/user-visits/visit/',
    {},
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  return response.data;
}

/**
 * Función para obtener la lista de tareas.
 * Realiza una solicitud GET a https://major.bot/api/tasks/?is_daily=false
 */
async function getTasks(access_token) {
  const response = await axios.get('https://major.bot/api/tasks/?is_daily=false', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  return response.data;
}

/**
 * Función para completar una tarea por ID.
 * Realiza una solicitud POST a https://major.bot/api/tasks/
 * Payload: { task_id: number }
 */
async function completeTask(access_token, task_id) {
  const response = await axios.post(
    'https://major.bot/api/tasks/',
    { task_id },
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  return response.data;
}

/**
 * Función para verificar si el usuario puede jugar Hold The Coin.
 * Realiza una solicitud GET a https://major.bot/api/bonuses/coins/
 */
async function canPlayHoldTheCoin(access_token) {
  const response = await axios.get('https://major.bot/api/bonuses/coins/', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  return response.data.success;
}

/**
 * Función para jugar Hold The Coin.
 * Realiza una solicitud POST a https://major.bot/api/bonuses/coins/
 * Payload: { coins: number }
 */
async function playHoldTheCoin(access_token, coins) {
  const response = await axios.post(
    'https://major.bot/api/bonuses/coins/',
    { coins },
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  return response.data.success;
}

/**
 * Función para verificar si el usuario puede jugar Roulette.
 * Realiza una solicitud GET a https://major.bot/api/roulette/
 */
async function canPlayRoulette(access_token) {
  const response = await axios.get('https://major.bot/api/roulette/', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  return response.data.success;
}

/**
 * Función para jugar Roulette.
 * Realiza una solicitud POST a https://major.bot/api/roulette/
 * Payload: { rating_award: number, result: number }
 */
async function playRoulette(access_token, rating_award, result) {
  const response = await axios.post(
    'https://major.bot/api/roulette/',
    { rating_award, result },
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  return response.data;
}

/**
 * Función para verificar si el usuario puede jugar Swipe Coin.
 * Realiza una solicitud GET a https://major.bot/api/swipe_coin/
 */
async function canPlaySwipeCoin(access_token) {
  const response = await axios.get('https://major.bot/api/swipe_coin/', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  return response.data.success;
}

/**
 * Función para jugar Swipe Coin.
 * Realiza una solicitud POST a https://major.bot/api/swipe_coin/
 * Payload: { coins: number }
 */
async function playSwipeCoin(access_token, coins) {
  const response = await axios.post(
    'https://major.bot/api/swipe_coin/',
    { coins },
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  return response.data.success;
}

/**
 * Función para verificar si el usuario puede jugar al Durov Game.
 * Realiza una solicitud GET a https://major.bot/api/durov/
 */
async function canPlayDurovGame(access_token) {
  const response = await axios.get('https://major.bot/api/durov/', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  return response.data.success; // Si es true, el usuario puede jugar
}

/**
 * Función para jugar al Durov Game.
 * Realiza una solicitud POST a https://major.bot/api/durov/
 * Payload: { choice_1, choice_2, choice_3, choice_4 }
 */
async function playDurovGame(access_token, choices) {
  const response = await axios.post(
    'https://major.bot/api/durov/',
    choices,
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  return response.data; // Retorna los datos de la respuesta
}

// Exportar todas las funciones
module.exports = {
  getBearerToken,
  getUserInfo,
  performCheckIn,
  getTasks,
  completeTask,
  canPlayHoldTheCoin,
  playHoldTheCoin,
  canPlayRoulette,
  playRoulette,
  canPlaySwipeCoin,
  playSwipeCoin,
  canPlayDurovGame,
  playDurovGame,
};
