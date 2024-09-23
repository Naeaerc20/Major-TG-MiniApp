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

// Paths to data files
const accountsDataPath = path.join(__dirname, 'accounts.json');
const bearerAuthDataPath = path.join(__dirname, 'bearerAuthData.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to get a new Bearer Token and User ID
async function getNewToken(init_data) {
  const authData = await getBearerToken(init_data);
  const access_token = authData.access_token;
  const user_id = authData.user_id;
  return { access_token, user_id };
}

// Function to perform an action and handle token refresh if a 401 error occurs
async function performActionWithTokenRefresh(account, actionFunction) {
  let { access_token, user_id, init_data } = account;

  try {
    await actionFunction(account);
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log(colors.yellow(`⏳ Token expired or invalid for user ${account.username}. Generating a new token...`));
      const newTokenData = await getNewToken(init_data);
      access_token = newTokenData.access_token;
      user_id = newTokenData.user_id;
      account.access_token = access_token;
      account.user_id = user_id;

      // Update the token in 'bearerAuthData.json'
      updateTokenInFile(account.id - 1, access_token);

      await actionFunction(account);
    } else {
      throw error;
    }
  }
}

// Function to update token in 'bearerAuthData.json'
function updateTokenInFile(index, newToken) {
  const tokens = JSON.parse(fs.readFileSync(bearerAuthDataPath, 'utf8'));
  tokens[index] = newToken;
  fs.writeFileSync(bearerAuthDataPath, JSON.stringify(tokens, null, 2));
}

// Function to handle game errors and extract blocked_until time
function handleGameError(gameName, error, username, blockedUntilTimes) {
  if (error.response && error.response.data && error.response.data.detail) {
    const detail = error.response.data.detail;
    const blockedUntil = detail.blocked_until;
    const currentTime = Math.floor(Date.now() / 1000);
    const timeRemaining = blockedUntil - currentTime;

    if (timeRemaining > 0) {
      // Store the blocked_until time
      blockedUntilTimes.push(blockedUntil);

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

// Function to play a game with error handling and time checking
async function playGame(account, gameName, canPlayFunction, playFunction, blockedUntilTimes) {
  await performActionWithTokenRefresh(account, async (account) => {
    try {
      const canPlayResponse = await canPlayFunction(account.access_token);
      if (canPlayResponse.can_play) {
        console.log(colors.cyan(`🎮 Playing ${gameName} for ${account.username}...`));
        const waitTime = gameName === 'Roulette' ? 10000 : 60000; // 10 seconds for Roulette, 60 seconds for other games
        await sleep(waitTime);
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
          const randomOption = options[Math.floor(Math.random() * options.length)];
          result = await playFunction(account.access_token, randomOption.rating_award, randomOption.result);
        } else {
          const coins = Math.floor(Math.random() * (950 - 400 + 1)) + 400; // Random number for coin-based games
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
        // Store the blocked_until time
        if (canPlayResponse.blocked_until) {
          blockedUntilTimes.push(canPlayResponse.blocked_until);
        }
        console.log(colors.yellow(`⚠️  Cannot play ${gameName} at this time for ${account.username}.`));
      }
    } catch (error) {
      handleGameError(gameName, error, account.username, blockedUntilTimes);
    }
  });
}

// Function to perform the Check-In
async function performCheckInTask(account) {
  console.log(colors.yellow(`⚙️  Performing Check-In for ${account.username}`));
  await performActionWithTokenRefresh(account, async (account) => {
    try {
      const checkInResult = await performCheckIn(account.access_token);
      if (checkInResult.is_allowed && checkInResult.is_increased) {
        console.log(colors.green(`✅ Check-In performed successfully for ${account.username}.`));
      } else {
        console.log(colors.yellow(`⚠️  Check-in has already been made today for ${account.username}.`));
      }
    } catch (error) {
      console.log(colors.red(`❌ An error occurred during Check-In for ${account.username}: ${error.message}`));
    }
  });
}

// Function to start the automatic flow for all accounts
async function startAutomaticFlow(accounts) {
  let checkInTimestamp = 0; // Initialize to 0 to ensure Check-In in the first cycle

  while (true) {
    console.log(colors.magenta(`🔄 Starting a new cycle for all accounts`));

    // Check if it's time to perform the Check-In (every 24 hours)
    const currentTime = Date.now();
    if (currentTime - checkInTimestamp >= 24 * 60 * 60 * 1000) {
      for (const account of accounts) {
        await performCheckInTask(account);
        await sleep(1000); // Add 1-second delay between accounts
      }
      checkInTimestamp = currentTime; // Reset the Check-In timestamp
    }

    // Wait before starting the games
    console.log(colors.blue(`⏳ Wait 30 seconds to play games for all accounts...\n`));
    await sleep(30000);

    // Play games for each account
    const games = [
      { name: 'Hold The Coin', canPlay: canPlayHoldTheCoin, play: playHoldTheCoin },
      { name: 'Roulette', canPlay: canPlayRoulette, play: playRoulette },
      { name: 'Swipe Coin', canPlay: canPlaySwipeCoin, play: playSwipeCoin },
    ];

    // Arrays to collect blocked_until times
    const allBlockedUntilTimes = [];

    for (const game of games) {
      const blockedUntilTimes = []; // To store blocked_until times for this game
      for (const account of accounts) {
        await playGame(account, game.name, game.canPlay, game.play, blockedUntilTimes);
        await sleep(1000); // Add 1-second delay between accounts
      }
      allBlockedUntilTimes.push(...blockedUntilTimes);
      console.log(colors.blue(`⏳ Wait 30 seconds before next game for all accounts...\n`));
      await sleep(30000);
    }

    // Calculate the next cycle time
    let nextCycleTime = null;

    if (allBlockedUntilTimes.length > 0) {
      const maxBlockedUntil = Math.max(...allBlockedUntilTimes);
      // Add 2 hours (7200 seconds) to the max blocked_until time
      nextCycleTime = (maxBlockedUntil + 2 * 60 * 60) * 1000; // Convert to milliseconds
    } else {
      // If no blocked_until times, wait a default of 3 hours
      nextCycleTime = Date.now() + 3 * 60 * 60 * 1000;
    }

    const waitTime = nextCycleTime - Date.now();

    // Ensure we wait at least 1 minute to prevent negative or too short waits
    const minWaitTime = 1 * 60 * 1000; // 1 minute in milliseconds
    const finalWaitTime = Math.max(waitTime, minWaitTime);

    // Convert wait time to hours, minutes, seconds for display
    const totalSeconds = Math.floor(finalWaitTime / 1000);
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

    console.log(colors.green(`✅ Cycle completed for all accounts.`));
    console.log(colors.yellow(`⏳ Waiting ${timeString} before next cycle for all accounts...\n`));

    await sleep(finalWaitTime);
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
  console.log('👑 Created by Naeaex - x.com/naeaex_dev - github.com/Naeaerc20'.yellow)
  console.log(colors.yellow('⏳ We\'re fetching your data... Please wait\n'));

  try {
    // Read accounts.json
    const accountsInitData = JSON.parse(fs.readFileSync(accountsDataPath, 'utf8')); // Array of init_data strings

    const accounts = [];
    const tokens = []; // To store the tokens, to be saved in bearerAuthData.json

    // Initialize accounts with a delay of 2 seconds per account
    for (let i = 0; i < accountsInitData.length; i++) {
      const init_data = accountsInitData[i];
      try {
        await sleep(2000); // Wait 2 seconds before processing the next account

        const { access_token, user_id } = await getNewToken(init_data);
        tokens.push(access_token); // Save the token to tokens array

        const userInfo = await getUserInfo(access_token, user_id);
        accounts.push({
          id: i + 1,
          init_data,
          access_token,
          user_id,
          username: userInfo.username,
          rating: userInfo.rating,
        });

        // Print account info
        console.log(colors.green(`✨ | ${i + 1} | NEW TOKEN GENERATED | ${userInfo.username} - ${userInfo.rating}`));
      } catch (error) {
        console.error(`Failed to initialize account ${i + 1} with init_data:`, init_data, 'Error:', error);
      }
    }

    // Save the tokens to 'bearerAuthData.json'
    fs.writeFileSync(bearerAuthDataPath, JSON.stringify(tokens, null, 2));

    if (accounts.length === 0) {
      console.log(colors.red('No accounts initialized. Exiting...'));
      return;
    }

    // Add a blank line
    console.log();

    // Start automatic execution for all accounts
    await startAutomaticFlow(accounts);

  } catch (error) {
    console.error('An error occurred in the main application:', error);
  }
})();
