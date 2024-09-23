// AutoIndex.js

const {
  getBearerToken,
  getUserInfo,
  performCheckIn,
  canPlayHoldTheCoin,
  playHoldTheCoin,
  canPlayRoulette,
  playRoulette,
  canPlaySwipeCoin,
  playSwipeCoin,
} = require('./scripts/apis');

const fs = require('fs');
const path = require('path');
const colors = require('colors');
const clearConsole = require('clear-console');
const figlet = require('figlet');

// Ruta al archivo de cuentas
const accountsDataPath = path.join(__dirname, 'accounts.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Función para obtener un nuevo token de portador y ID de usuario
async function getNewToken(init_data) {
  const authData = await getBearerToken(init_data);
  const access_token = authData.access_token;
  const user_id = authData.user_id;
  return { access_token, user_id };
}

// Función para realizar el Check-In
async function performCheckInTask(account) {
  console.log(colors.yellow(`⚙️  Performing Check-In for ${account.username}`));
  await performActionWithTokenRefresh(account, async (account) => {
    const checkInResult = await performCheckIn(account.access_token);
    if (checkInResult.is_allowed && checkInResult.is_increased) {
      console.log(colors.green(`✅ Check-In performed successfully for ${account.username}.`));
    } else {
      console.log(colors.yellow(`⚠️  Check-in has already been made today for ${account.username}.`));
    }
  });
}

// Función para jugar un juego con manejo de errores y verificación de tiempo
async function playGame(account, gameName, canPlayFunction, playFunction) {
  console.log(colors.yellow(`\n⏳ Playing ${gameName} for ${account.username}`));

  await performActionWithTokenRefresh(account, async (account) => {
    try {
      if (await canPlayFunction(account.access_token)) {
        // Mostrar mensajes de espera basados en el juego
        if (gameName === 'Hold The Coin') {
          console.log(colors.blue('🔄 Waiting 5 seconds before playing Hold The Coin...'));
          await sleep(5000);
          console.log(colors.yellow('🎮 Playing Hold The Coin. Wait 1 minute to claim points...'));
          await sleep(60000);
        } else if (gameName === 'Roulette') {
          console.log(colors.blue('🔄 Waiting 5 seconds before playing Roulette...'));
          await sleep(5000);
          console.log(colors.yellow('🎮 Playing Roulette. Wait 10 seconds to claim points...'));
          await sleep(10000);
        } else if (gameName === 'Swipe Coin') {
          console.log(colors.blue('🔄 Waiting 5 seconds before playing Swipe Coin...'));
          await sleep(5000);
          console.log(colors.yellow('🎮 Playing Swipe Coin. Wait 1 minute to claim points...'));
          await sleep(60000);
        }

        // Ahora juega el juego
        let result;
        if (gameName === 'Roulette') {
          // Asegurar que la selección aleatoria se realiza por cuenta
          const options = [
            { rating_award: 500, result: 1 },
            { rating_award: 1000, result: 2 },
            { rating_award: 2000, result: 3 },
            { rating_award: 3000, result: 4 },
            { rating_award: 5000, result: 5 },
            { rating_award: 10000, result: 6 },
          ];
          const randomOptionIndex = Math.floor(Math.random() * options.length);
          const randomOption = options[randomOptionIndex];
          result = await playFunction(account.access_token, randomOption.rating_award, randomOption.result);
        } else {
          // Para Hold The Coin y Swipe Coin
          let coins;
          if (gameName === 'Hold The Coin') {
            coins = Math.floor(Math.random() * (350 - 700 + 1)) + 700; // Entre 350 y 700
          } else if (gameName === 'Swipe Coin') {
            coins = Math.floor(Math.random() * (500 - 250 + 1)) + 250; // Entre 250 y 500
          }
          result = await playFunction(account.access_token, coins);
        }

        if (result) {
          const userInfo = await getUserInfo(account.access_token, account.user_id);
          account.rating = userInfo.rating;
          console.log(colors.green(`✅ ${gameName} played successfully for ${account.username}. Your points are now ${userInfo.rating}`));
        } else {
          console.log(colors.red(`❌ Failed to play ${gameName} for ${account.username}.`));
        }
      } else {
        console.log(colors.red(`⚠️  You cannot play ${gameName} at this time for ${account.username}.`));
        // Obtener información del usuario y mostrar puntos
        const userInfo = await getUserInfo(account.access_token, account.user_id);
        account.rating = userInfo.rating;
        console.log(colors.green(`ℹ️  Current points for ${account.username}: ${account.rating}`));
      }
    } catch (error) {
      if (error.response && error.response.status === 500) {
        console.log(colors.red(`❌ An error occurred while ${account.username} was playing ${gameName}: ${error.response.status} ${error.response.statusText}`));
        // Intentar obtener información del usuario
        try {
          const userInfo = await getUserInfo(account.access_token, account.user_id);
          account.rating = userInfo.rating;
          // Verificar si el juego ya fue jugado
          const canPlay = await canPlayFunction(account.access_token);
          if (!canPlay) {
            console.log(colors.yellow(`⚠️  ${account.username} has already played ${gameName}. Current points: ${account.rating}`));
          } else {
            console.log(colors.yellow(`🔄 Retrying to play ${gameName} for ${account.username}...`));
            await sleep(3000); // Esperar 3 segundos antes de reintentar
            await playGame(account, gameName, canPlayFunction, playFunction); // Intentar jugar nuevamente
          }
        } catch (userInfoError) {
          console.log(colors.red(`❌ Failed to retrieve user info for ${account.username}: ${userInfoError.message}`));
        }
      } else {
        handleGameError(gameName, error, account.username);
      }
    }
  });
}

// Función para realizar una acción y manejar la actualización del token si ocurre un error 401
async function performActionWithTokenRefresh(account, actionFunction) {
  let { access_token, user_id, init_data } = account;
  let retries = 3; // Número de reintentos
  let delay = 5000; // 5 segundos de espera entre reintentos

  while (retries > 0) {
    try {
      await actionFunction(account);
      break; // Salir del bucle si la acción fue exitosa
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log(colors.yellow(`⏳ Token expirado o inválido para el usuario ${account.username}. Generando un nuevo token...\n`));
        const newTokenData = await getNewToken(init_data);
        access_token = newTokenData.access_token;
        user_id = newTokenData.user_id;
        account.access_token = access_token;
        account.user_id = user_id;
      } else if (error.response && (error.response.status === 502 || error.response.status === 500)) {
        console.log(colors.red(`❌ Error ${error.response.status} al realizar la acción para ${account.username}. Reintentando en ${delay / 1000} segundos...`));
        retries--;
        await sleep(delay);
        delay *= 2; // Incrementar el tiempo de espera exponencialmente
      } else {
        // Imprimir detalles adicionales del error
        if (error.response && error.response.data) {
          console.log(colors.red(`❌ Error al realizar la acción para ${account.username}: ${error.response.status} ${error.response.statusText}`));
          console.log(colors.red(`Detalles del error: ${JSON.stringify(error.response.data)}`));
        } else {
          console.log(colors.red(`❌ Error al realizar la acción para ${account.username}: ${error.message}`));
        }
        throw error;
      }
    }
  }

  if (retries === 0) {
    console.log(colors.red(`❌ No se pudo completar la acción para ${account.username} después de varios intentos.`));
  }
}

// Manejo de errores en juegos
function handleGameError(gameName, error, username) {
  if (error.response && error.response.data && error.response.data.detail) {
    const detail = error.response.data.detail;
    const blockedUntil = detail.blocked_until;
    const currentTime = Date.now() / 1000;
    const timeRemaining = blockedUntil - currentTime;

    if (timeRemaining > 0) {
      const totalSeconds = Math.floor(timeRemaining);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      let timeString = '';
      if (hours > 0) {
        timeString += `${hours} hour${hours !== 1 ? 's' : ''}, `;
      }
      if (minutes > 0 || hours > 0) {
        timeString += `${minutes} minute${minutes !== 1 ? 's' : ''}, `;
      }
      timeString += `${seconds} second${seconds !== 1 ? 's' : ''}`;

      console.log(colors.yellow(`⚠️  ${username} can't play ${gameName} now. Please try again in ${timeString}.`));
    } else {
      console.log(colors.yellow(`⚠️  ${username} can't play ${gameName} now. Please try again later.`));
    }
  } else {
    console.log(colors.red(`❌ An error occurred while ${username} was playing ${gameName}: ${error.message}`));
  }
}

// Función para iniciar el flujo automático para todas las cuentas
async function startAutomaticFlow(accounts) {
  let cycleNumber = 1;
  while (true) {
    console.log(colors.magenta(`\n🔄 Starting Cycle ${cycleNumber} for all accounts`));

    // Realizar Check-In al inicio del primer ciclo o cada 3 ciclos
    if (cycleNumber === 1 || cycleNumber % 3 === 1) {
      for (const account of accounts) {
        await performCheckInTask(account);
        await sleep(3000); // Aumentar demora a 3 segundos entre cuentas
      }
    }

    // Esperar antes de comenzar los juegos
    console.log(colors.blue(`⏳ Wait 30 seconds to play games for all accounts...\n`));
    await sleep(30000);

    // Jugar juegos para cada cuenta
    const games = [
      { name: 'Hold The Coin', canPlay: canPlayHoldTheCoin, play: playHoldTheCoin },
      { name: 'Roulette', canPlay: canPlayRoulette, play: playRoulette },
      { name: 'Swipe Coin', canPlay: canPlaySwipeCoin, play: playSwipeCoin },
    ];

    for (const game of games) {
      for (const account of accounts) {
        await playGame(account, game.name, game.canPlay, game.play);
        await sleep(3000); // Aumentar demora a 3 segundos entre cuentas
      }
      console.log(colors.blue(`⏳ Wait 30 seconds before next game for all accounts...\n`));
      await sleep(30000);
    }

    console.log(colors.green(`✅ Cycle ${cycleNumber} completed for all accounts.`));

    // Esperar 9 horas antes de iniciar el siguiente ciclo
    console.log(colors.yellow(`⏳ Waiting 9 hours before next cycle for all accounts...\n`));
    await sleep(9 * 60 * 60 * 1000); // 9 horas en milisegundos
    cycleNumber++;
  }
}

// Iniciar el flujo automático para todas las cuentas
(async () => {
  clearConsole();

  // Generar y mostrar el banner
  const banner = figlet.textSync('MAJOR BOT');
  console.log(colors.green(banner));

  // Mostrar mensaje de bienvenida después del banner
  console.log(colors.yellow('👋 Hello! Welcome to the Major Client Bot'));
  console.log('👑 Created by Naeaex - x.com/naeaex_dev - github.com/Naeaerc20'.yellow)
  console.log(colors.yellow('⏳ We\'re fetching your data\n'));

  try {
    // Leer accounts.json
    const accountsInitData = JSON.parse(fs.readFileSync(accountsDataPath, 'utf8')); // Arreglo de cadenas init_data

    const accounts = [];

    // Inicializar cuentas con una demora de 3 segundos por cuenta
    for (let i = 0; i < accountsInitData.length; i++) {
      const init_data = accountsInitData[i];
      try {
        await sleep(500); // Esperar 0.5 segundos antes de procesar la siguiente cuenta

        const { access_token, user_id } = await getNewToken(init_data);
        const userInfo = await getUserInfo(access_token, user_id);
        accounts.push({
          id: i + 1,
          init_data,
          access_token,
          user_id,
          username: userInfo.username,
          rating: userInfo.rating,
        });

        // No imprimimos la información aquí
      } catch (error) {
        console.error(`Failed to initialize account ${i + 1} with init_data:`, init_data, 'Error:', error);
      }
    }

    if (accounts.length === 0) {
      console.log(colors.red('No accounts initialized. Exiting...'));
      return;
    }

    // Después de inicializar todas las cuentas, imprimimos su información
    accounts.forEach(account => {
      console.log(colors.green(`✨ | ${account.id} | NEW TOKEN GENERATED | ${account.username} - ${account.rating}`));
    });

    // Añadir línea en blanco
    console.log();

    // Iniciar ejecución automática para todas las cuentas
    await startAutomaticFlow(accounts);

  } catch (error) {
    console.error('An error occurred in the main application:', error);
  }
})();

