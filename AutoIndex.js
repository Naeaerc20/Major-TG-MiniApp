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
const { SocksProxyAgent } = require('socks-proxy-agent'); // Corrected import
const axios = require('axios');
const Table = require('cli-table3'); // Import cli-table3

// Path to accounts file
const accountsDataPath = path.join(__dirname, 'accounts.json');
const bearerAuthDataPath = path.join(__dirname, 'bearerAuthData.json');
const proxiesDataPath = path.join(__dirname, 'proxies.txt');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to get a new Bearer Token and User ID
async function getNewToken(init_data, axiosConfig) {
  const authData = await getBearerToken(init_data, axiosConfig);
  const access_token = authData.access_token;
  const user_id = authData.user_id;
  return { access_token, user_id };
}

// Function to perform Check-In
async function performCheckInTask(account) {
  console.log(colors.yellow(`⚙️  Performing Check-In for ${account.username}`));
  await performActionWithTokenRefresh(account, async (account) => {
    const checkInResult = await performCheckIn(account.access_token, account.axiosConfig);
    if (checkInResult.is_allowed && checkInResult.is_increased) {
      console.log(colors.green(`✅ Check-In performed successfully for ${account.username}.`));
    } else {
      console.log(colors.yellow(`⚠️  Check-in has already been made today for ${account.username}.`));
    }
  });
}

// Function to get IP and geolocation of the proxy
async function getProxyInfo(axiosConfig) {
  try {
    const response = await axios.get('https://ipinfo.io/json', axiosConfig);
    return response.data;
  } catch (error) {
    console.log('❌ Failed to retrieve proxy IP and geolocation.'.red);
    return null;
  }
}

// Function to play a game with error handling and time checking
async function playGame(account, gameName, canPlayFunction, playFunction) {
  console.log(colors.yellow(`\n⏳ Playing ${gameName} for ${account.username}`));

  await performActionWithTokenRefresh(account, async (account) => {
    try {
      if (await canPlayFunction(account.access_token, account.axiosConfig)) {
        // Show wait messages based on the game
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

        // Now play the game
        let result;
        if (gameName === 'Roulette') {
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
          result = await playFunction(account.access_token, randomOption.rating_award, randomOption.result, account.axiosConfig);
        } else {
          let coins;
          if (gameName === 'Hold The Coin') {
            coins = Math.floor(Math.random() * (350 - 700 + 1)) + 700; // Between 700 and 350
          } else if (gameName === 'Swipe Coin') {
            coins = Math.floor(Math.random() * (500 - 250 + 1)) + 250; // Between 250 and 500
          }
          result = await playFunction(account.access_token, coins, account.axiosConfig);
        }

        if (result) {
          const userInfo = await getUserInfo(account.access_token, account.user_id, account.axiosConfig);
          account.rating = userInfo.rating;
          console.log(colors.green(`✅ ${gameName} played successfully for ${account.username}. Your points are now ${userInfo.rating}`));
        } else {
          console.log(colors.red(`❌ Failed to play ${gameName} for ${account.username}.`));
        }
      } else {
        console.log(colors.red(`⚠️  You cannot play ${gameName} at this time for ${account.username}.`));
        // Get user info and display points
        const userInfo = await getUserInfo(account.access_token, account.user_id, account.axiosConfig);
        account.rating = userInfo.rating;
        console.log(colors.green(`ℹ️  Current points for ${account.username}: ${account.rating}`));
      }
    } catch (error) {
      if (error.response && error.response.status === 500) {
        console.log(colors.red(`❌ An error occurred while ${account.username} was playing ${gameName}: ${error.response.status} ${error.response.statusText}`));
        // Try to get user info
        try {
          const userInfo = await getUserInfo(account.access_token, account.user_id, account.axiosConfig);
          account.rating = userInfo.rating;
          // Check if the game was already played
          const canPlay = await canPlayFunction(account.access_token, account.axiosConfig);
          if (!canPlay) {
            console.log(colors.yellow(`⚠️  ${account.username} has already played ${gameName}. Current points: ${account.rating}`));
          } else {
            console.log(colors.yellow(`🔄 Retrying to play ${gameName} for ${account.username}...`));
            await sleep(3000); // Wait 3 seconds before retrying
            await playGame(account, gameName, canPlayFunction, playFunction); // Try playing again
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

// Function to perform an action and handle token refresh if a 401 error occurs
async function performActionWithTokenRefresh(account, actionFunction) {
  let { access_token, user_id, init_data, axiosConfig } = account;
  let retries = 3; // Number of retries
  let delay = 5000; // 5 seconds delay between retries

  while (retries > 0) {
    try {
      await actionFunction(account);
      break; // Exit loop if action was successful
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log(colors.yellow(`⏳ Token expired or invalid for user ${account.username}. Generating a new token...\n`));
        const newTokenData = await getNewToken(init_data, axiosConfig);
        access_token = newTokenData.access_token;
        user_id = newTokenData.user_id;
        account.access_token = access_token;
        account.user_id = user_id;

        // Update bearer data in 'bearerAuthData.json'
        updateBearerDataInFile(account.id - 1, access_token, account.proxy, user_id);
      } else if (error.response && (error.response.status === 502 || error.response.status === 500)) {
        console.log(colors.red(`❌ Error ${error.response.status} performing action for ${account.username}. Retrying in ${delay / 1000} seconds...`));
        retries--;
        await sleep(delay);
        delay *= 2; // Exponentially increase delay
      } else {
        // Print additional error details
        if (error.response && error.response.data) {
          console.log(colors.red(`❌ Error performing action for ${account.username}: ${error.response.status} ${error.response.statusText}`));
          console.log(colors.red(`Error details: ${JSON.stringify(error.response.data)}`));
        } else {
          console.log(colors.red(`❌ Error performing action for ${account.username}: ${error.message}`));
        }
        throw error;
      }
    }
  }

  if (retries === 0) {
    console.log(colors.red(`❌ Could not complete action for ${account.username} after multiple attempts.`));
  }
}

// Function to handle game errors
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

// Function to update bearer data in 'bearerAuthData.json'
function updateBearerDataInFile(index, newToken, proxy, user_id) {
  let bearerData = [];
  if (fs.existsSync(bearerAuthDataPath)) {
    bearerData = JSON.parse(fs.readFileSync(bearerAuthDataPath, 'utf8'));
  }

  bearerData[index] = {
    id: index + 1,
    access_token: newToken,
    proxy: proxy,
    user_id: user_id,
  };
  fs.writeFileSync(bearerAuthDataPath, JSON.stringify(bearerData, null, 2));
}

// Function to start the automatic flow for all accounts
async function startAutomaticFlow(accounts) {
  let cycleNumber = 1;
  while (true) {
    console.log(colors.magenta(`\n🔄 Starting Cycle ${cycleNumber} for all accounts`));

    // Perform Check-In at the start of the first cycle or every 3 cycles
    if (cycleNumber === 1 || cycleNumber % 3 === 1) {
      for (const account of accounts) {
        await performCheckInTask(account);
        await sleep(3000); // Increase delay to 3 seconds between accounts
      }
    }

    // Wait before starting games
    console.log(colors.blue(`⏳ Wait 30 seconds to play games for all accounts...\n`));
    await sleep(30000);

    // Play games for each account
    const games = [
      { name: 'Hold The Coin', canPlay: canPlayHoldTheCoin, play: playHoldTheCoin },
      { name: 'Roulette', canPlay: canPlayRoulette, play: playRoulette },
      { name: 'Swipe Coin', canPlay: canPlaySwipeCoin, play: playSwipeCoin },
    ];

    for (const game of games) {
      for (const account of accounts) {
        await playGame(account, game.name, game.canPlay, game.play);
        await sleep(3000); // Increase delay to 3 seconds between accounts
      }
      console.log(colors.blue(`⏳ Wait 30 seconds before next game for all accounts...\n`));
      await sleep(30000);
    }

    console.log(colors.green(`✅ Cycle ${cycleNumber} completed for all accounts.`));

    // Wait 9 hours before starting the next cycle
    console.log(colors.yellow(`⏳ Waiting 9 hours before next cycle for all accounts...\n`));
    await sleep(9 * 60 * 60 * 1000); // 9 hours in milliseconds
    cycleNumber++;
  }
}

// Start the automatic flow for all accounts
(async () => {
  clearConsole();

  // Generate and display the banner
  const banner = figlet.textSync('MAJOR BOT');
  console.log(colors.green(banner));

  // Display welcome message after the banner
  console.log(colors.yellow('👋 Hello! Welcome to the Major Client Bot'));
  console.log('👑 Created by Naeaex - x.com/naeaex_dev - github.com/Naeaerc20'.yellow);
  console.log(colors.yellow('⏳ We\'re fetching your data\n'));

  try {
    // Read accounts.json
    const accountsInitData = JSON.parse(fs.readFileSync(accountsDataPath, 'utf8')); // Array of init_data strings

    // Read proxies.txt
    const proxies = fs.readFileSync(proxiesDataPath, 'utf8').split('\n').filter(Boolean);

    // Read bearerAuthData.json if exists
    let bearerData = [];
    if (fs.existsSync(bearerAuthDataPath)) {
      bearerData = JSON.parse(fs.readFileSync(bearerAuthDataPath, 'utf8'));
    }

    const accounts = [];

    // Initialize accounts with a delay of 0.5 seconds per account
    for (let i = 0; i < accountsInitData.length; i++) {
      const init_data = accountsInitData[i];
      const proxy = proxies[i] || null; // Use proxy from list or null if not available

      try {
        await sleep(500); // Wait 0.5 seconds before processing the next account

        // Create proxy agent if proxy is available
        let axiosConfig = {};
        if (proxy) {
          const proxyAgent = new SocksProxyAgent(proxy);
          axiosConfig = {
            httpAgent: proxyAgent,
            httpsAgent: proxyAgent,
          };
        }

        // Get proxy IP and geolocation before any request
        const proxyInfo = await getProxyInfo(axiosConfig);
        let ip = 'N/A';
        let country = 'N/A';
        if (proxyInfo) {
          ip = proxyInfo.ip || 'N/A';
          country = proxyInfo.country || 'N/A';
        }

        let access_token, user_id;

        // Check if bearerData has access_token for this account
        if (bearerData[i] && bearerData[i].access_token && bearerData[i].proxy === proxy) {
          access_token = bearerData[i].access_token;
          user_id = bearerData[i].user_id;
        } else {
          const tokenData = await getNewToken(init_data, axiosConfig);
          access_token = tokenData.access_token;
          user_id = tokenData.user_id;

          // Save access_token, proxy, and user_id to bearerAuthData.json
          updateBearerDataInFile(i, access_token, proxy, user_id);
        }

        const userInfo = await getUserInfo(access_token, user_id, axiosConfig);
        accounts.push({
          id: i + 1,
          init_data,
          access_token,
          user_id,
          username: userInfo.username || 'N/A',
          rating: userInfo.rating || 0,
          proxy,
          ip,
          country,
          axiosConfig,
        });

      } catch (error) {
        console.error(`Failed to initialize account ${i + 1} with init_data:`, init_data, 'Error:', error);
      }
    }

    if (accounts.length === 0) {
      console.log(colors.red('No accounts initialized. Exiting...'));
      return;
    }

    // After initializing all accounts, display their data in a table
    const table = new Table({
      head: ['ID', 'USERNAME', 'POINTS', 'IP', 'LOCATION'],
      colWidths: [5, 20, 10, 18, 15],
      style: { head: ['cyan'] },
    });

    accounts.forEach((account) => {
      table.push([
        account.id,
        account.username,
        account.rating,
        account.ip,
        account.country,
      ]);
    });

    console.log(table.toString());

    // Start automatic execution for all accounts
    await startAutomaticFlow(accounts);

  } catch (error) {
    console.error('An error occurred in the main application:', error);
  }
})();
