// index.js

const {
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
} = require('./scripts/apis');

const fs = require('fs');
const path = require('path');
const readlineSync = require('readline-sync');
const colors = require('colors');
const clearConsole = require('clear-console');
const figlet = require('figlet');
const { SocksProxyAgent } = require('socks-proxy-agent'); // Corrected import
const axios = require('axios');
const Table = require('cli-table3'); // Import cli-table3

// Paths to data files
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

// Function to perform an action and handle token refresh if a 401 error occurs
async function performActionWithTokenRefresh(account, actionFunction) {
  let { access_token, user_id, init_data, axiosConfig } = account;

  try {
    await actionFunction(account);
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log(`⏳ Token expired or invalid for user ${account.username}. Generating a new token...`.yellow);
      const newTokenData = await getNewToken(init_data, axiosConfig);
      access_token = newTokenData.access_token;
      user_id = newTokenData.user_id;
      account.access_token = access_token;
      account.user_id = user_id;

      // Update the token in 'bearerAuthData.json'
      updateBearerDataInFile(account.id - 1, access_token, account.proxy, user_id);

      await actionFunction(account);
    } else {
      throw error;
    }
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

      console.log(`⚠️  ${username} can't play ${gameName} now. Please try again in ${timeString}.`.red);
    } else {
      console.log(`⚠️  ${username} can't play ${gameName} now. Please try again later.`.red);
    }
  } else {
    console.log(`⚠️  ${username} can't play ${gameName} now. Please try again later.`.red);
  }
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

// Play Games submenu function (ensure to pass account.axiosConfig)
async function playGamesSubMenu(accounts) {
  const gameOptions = [
    '💰 Hold The Coin',
    '🎲 Roulette',
    '🪙 Swipe Coin',
    '🎮 Durov Game',
    '🔙 Back to Main Menu',
  ];

  let backToMain = false;
  while (!backToMain) {
    console.log('\nSelect a game to play:'.bold);
    gameOptions.forEach((option, index) => {
      console.log(`${(index + 1).toString().blue}. ${option.blue}`);
    });

    const gameChoice = readlineSync.questionInt('\nEnter the number of your choice: '.blue);

    switch (gameChoice) {
      case 1:
        // Play Hold The Coin for all accounts
        for (const account of accounts) {
          console.log(`\n⏳ Playing Hold The Coin for ${account.username}`.yellow);
          await performActionWithTokenRefresh(account, async (account) => {
            try {
              if (await canPlayHoldTheCoin(account.access_token, account.axiosConfig)) {
                console.log('🔄 Waiting 5 seconds before playing Hold The Coin...'.blue);
                await sleep(5000);
                console.log('🎮 Playing Hold The Coin. Wait 1 minute to claim points...'.yellow);
                await sleep(60000);
                const coins = Math.floor(Math.random() * (950 - 400 + 1)) + 400;
                const holdTheCoinResult = await playHoldTheCoin(account.access_token, coins, account.axiosConfig);
                if (holdTheCoinResult) {
                  const updatedUserInfo = await getUserInfo(account.access_token, account.user_id, account.axiosConfig);
                  account.rating = updatedUserInfo.rating;
                  console.log(`✅ Hold The Coin played successfully for ${account.username}. Your points are now ${account.rating}`.green);
                } else {
                  console.log(`❌ Failed to play Hold The Coin for ${account.username}.`.red);
                }
              } else {
                console.log(`⚠️  You cannot play Hold The Coin at this time for ${account.username}.`.red);
              }
            } catch (error) {
              handleGameError('Hold The Coin', error, account.username);
            }
          });
          await sleep(1000); // Add 1-second delay between accounts
        }
        break;

      case 2:
        // Play Roulette for all accounts
        for (const account of accounts) {
          console.log(`\n⏳ Playing Roulette for ${account.username}`.yellow);
          await performActionWithTokenRefresh(account, async (account) => {
            try {
              if (await canPlayRoulette(account.access_token, account.axiosConfig)) {
                console.log('🔄 Waiting 5 seconds before playing Roulette...'.blue);
                await sleep(5000);
                console.log('🎮 Playing Roulette. Wait 10 seconds to claim points...'.yellow);
                await sleep(10000);
                const options = [
                  { rating_award: 500, result: 1 },
                  { rating_award: 1000, result: 2 },
                  { rating_award: 2000, result: 3 },
                  { rating_award: 3000, result: 4 },
                  { rating_award: 5000, result: 5 },
                  { rating_award: 10000, result: 6 },
                ];
                const randomOption = options[Math.floor(Math.random() * options.length)];
                const rouletteResult = await playRoulette(account.access_token, randomOption.rating_award, randomOption.result, account.axiosConfig);
                const updatedUserInfo = await getUserInfo(account.access_token, account.user_id, account.axiosConfig);
                account.rating = updatedUserInfo.rating;
                console.log(`✅ Roulette played successfully for ${account.username}. Your points are now ${account.rating}`.green);
              } else {
                console.log(`⚠️  You cannot play Roulette at this time for ${account.username}.`.red);
              }
            } catch (error) {
              handleGameError('Roulette', error, account.username);
            }
          });
          await sleep(1000); // Add 1-second delay between accounts
        }
        break;

      case 3:
        // Play Swipe Coin for all accounts
        for (const account of accounts) {
          console.log(`\n⏳ Playing Swipe Coin for ${account.username}`.yellow);
          await performActionWithTokenRefresh(account, async (account) => {
            try {
              if (await canPlaySwipeCoin(account.access_token, account.axiosConfig)) {
                console.log('🔄 Waiting 5 seconds before playing Swipe Coin...'.blue);
                await sleep(5000);
                console.log('🎮 Playing Swipe Coin. Wait 1 minute to claim points...'.yellow);
                await sleep(60000);
                const coins = Math.floor(Math.random() * (950 - 400 + 1)) + 400;
                const swipeCoinResult = await playSwipeCoin(account.access_token, coins, account.axiosConfig);
                if (swipeCoinResult) {
                  const updatedUserInfo = await getUserInfo(account.access_token, account.user_id, account.axiosConfig);
                  account.rating = updatedUserInfo.rating;
                  console.log(`✅ Swipe Coin played successfully for ${account.username}. Your points are now ${account.rating}`.green);
                } else {
                  console.log(`❌ Failed to play Swipe Coin for ${account.username}.`.red);
                }
              } else {
                console.log(`⚠️  You cannot play Swipe Coin at this time for ${account.username}.`.red);
              }
            } catch (error) {
              handleGameError('Swipe Coin', error, account.username);
            }
          });
          await sleep(1000); // Add 1-second delay between accounts
        }
        break;

      case 4:
        // Play Durov Game for all accounts
        let durovChoices = null; // To store choices
        let durovFailed = false; // Flag to indicate if previous attempt failed

        for (const account of accounts) {
          console.log(`\n⏳ Playing Durov Game for ${account.username}`.yellow);
          await performActionWithTokenRefresh(account, async (account) => {
            try {
              if (await canPlayDurovGame(account.access_token, account.axiosConfig)) {
                if (!durovChoices || durovFailed) {
                  // Request choices from the user
                  console.log('👉 Please enter your choices for Durov Game.'.blue);
                  durovChoices = {
                    choice_1: readlineSync.questionInt('1️⃣  Enter choice 1: '.blue),
                    choice_2: readlineSync.questionInt('2️⃣  Enter choice 2: '.blue),
                    choice_3: readlineSync.questionInt('3️⃣  Enter choice 3: '.blue),
                    choice_4: readlineSync.questionInt('4️⃣  Enter choice 4: '.blue),
                  };
                  durovFailed = false; // Reset the flag
                }

                console.log('🎮 Playing Durov Game... Wait 5 seconds to claim points'.yellow);
                await sleep(5000);

                const durovResult = await playDurovGame(account.access_token, durovChoices, account.axiosConfig);

                if (durovResult.correct && durovResult.correct.length === 4) {
                  const updatedUserInfo = await getUserInfo(account.access_token, account.user_id, account.axiosConfig);
                  account.rating = updatedUserInfo.rating;
                  console.log(`✅ Durov Game successfully played for ${account.username} - Your points are now ${account.rating}`.green);
                  durovFailed = false; // Reset the flag
                } else {
                  console.log(`❌ Durov Game failed for ${account.username}. Incorrect choices.`.red);
                  durovFailed = true; // Set the flag to request new choices
                }
              } else {
                console.log(`⚠️  You cannot play Durov Game at this time for ${account.username}.`.red);
              }
            } catch (error) {
              handleGameError('Durov Game', error, account.username);
            }
          });
          await sleep(2000); // Wait 2 seconds before moving to the next account
        }
        break;

      case 5:
        // Back to Main Menu
        backToMain = true;
        break;

      default:
        console.log('⛔️ Invalid option. Please enter a valid number.'.red);
        break;
    }
  }
}

// Function to complete tasks with interactions (ensure to pass account.axiosConfig)
async function completeTasksWithInteractions(accounts) {
  // To store tasks that require code, grouped by task_id
  let codeTasksById = {};

  // Get tasks from all accounts
  for (const account of accounts) {
    await performActionWithTokenRefresh(account, async (account) => {
      try {
        const dailyTasks = await getTasks(account.access_token, true, account.axiosConfig);
        const regularTasks = await getTasks(account.access_token, false, account.axiosConfig);
        const tasks = [...dailyTasks, ...regularTasks];

        for (const task of tasks) {
          if (!task.is_completed && task.type === 'code') {
            // If we haven't registered this task yet, add it
            if (!codeTasksById[task.id]) {
              codeTasksById[task.id] = {
                task: task,
                accounts: [],
              };
            }
            // Add the account to the list of accounts that have this task
            codeTasksById[task.id].accounts.push(account);
          }
        }
      } catch (error) {
        console.log(`❌ Error fetching tasks for ${account.username}: ${error.message}`.red);
      }
    });
  }

  // Check if there are code tasks to complete
  const taskIds = Object.keys(codeTasksById);
  if (taskIds.length === 0) {
    console.log('No code tasks to complete.'.yellow);
    return;
  }

  // Process each code task
  for (const taskId of taskIds) {
    const { task, accounts: taskAccounts } = codeTasksById[taskId];
    console.log(`\nTask "${task.title}" (ID: ${task.id}) requires a code to complete.`.blue);
    let codeInput = readlineSync.question(`👉 Please enter the code for task "${task.title}" (ID: ${task.id}): `.blue);

    // Attempt to complete the task for each account that has it
    for (const account of taskAccounts) {
      console.log(`\nCompleting Task ${task.id} for ${account.username}`.yellow);

      await performActionWithTokenRefresh(account, async (account) => {
        try {
          const payload = {
            task_id: task.id,
            payload: {
              code: codeInput,
            },
          };

          await sleep(800); // Wait 0.8 seconds before completing

          const result = await completeTaskWithPayload(account.access_token, payload, account.axiosConfig);
          if (result.is_completed) {
            console.log(`✅ Task ${task.id} - ${task.title} Completed for ${account.username}.`.green);
          } else {
            console.log(`❌ Task ${task.id} - ${task.title} not completed for ${account.username}.`.red);
          }
        } catch (error) {
          if (error.response && error.response.status === 400) {
            console.log(`❌ Error completing Task ${task.id} for ${account.username}: ${error.response.data.detail}`.red);
          } else {
            console.log(`❌ Error completing Task ${task.id} for ${account.username}: ${error.message}`.red);
          }
        }
      });
    }
  }
}

// Main execution
(async () => {
  clearConsole();

  // Generate and display the banner
  const banner = figlet.textSync('MAJOR BOT');
  console.log(banner.green);

  // Display welcome message after the banner
  console.log('👋 Hello! Welcome to the Major Client Bot'.yellow);
  console.log('👑 Created by Naeaex - x.com/naeaex_dev - github.com/Naeaerc20'.yellow);
  console.log('⏳ We\'re fetching your data... Please wait\n'.yellow);

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
      console.log('No accounts initialized. Exiting...'.red);
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

    // Display action menu
    const menuOptions = [
      '📝 Make Check In',
      '🎮 Play Games',
      '📝 Complete Tasks',
      '📝 Complete Tasks with Interactions',
      '❌ Exit',
    ];

    let exit = false;
    while (!exit) {
      console.log('\nSelect an action:'.bold);
      menuOptions.forEach((option, index) => {
        console.log(`${(index + 1).toString().blue}. ${option.blue}`);
      });

      const choice = readlineSync.questionInt('\nEnter the number of your choice: '.blue);

      switch (choice) {
        case 1:
          // Make Check In for all accounts
          for (const account of accounts) {
            console.log(`\n🔄 Performing Check-In for ${account.username}`.yellow);
            await performActionWithTokenRefresh(account, async (account) => {
              try {
                const checkInResult = await performCheckIn(account.access_token, account.axiosConfig);
                if (checkInResult.is_allowed && checkInResult.is_increased) {
                  console.log(`✅ Check-In performed successfully for ${account.username}.`.green);
                } else {
                  console.log(`⚠️  Check-in has already been made today for ${account.username}, please try again tomorrow.`.red);
                }
              } catch (error) {
                console.log(`❌ Error performing Check-In for ${account.username}: ${error.message}`.red);
              }
            });
            await sleep(1000); // Add 1-second delay between accounts
          }
          break;

        case 2:
          // Play Games submenu
          await playGamesSubMenu(accounts);
          break;

        case 3:
          // Complete Tasks for all accounts
          for (const account of accounts) {
            console.log(`\nCompleting Tasks for ${account.username}`.yellow);
            await performActionWithTokenRefresh(account, async (account) => {
              try {
                const dailyTasks = await getTasks(account.access_token, true, account.axiosConfig);
                const regularTasks = await getTasks(account.access_token, false, account.axiosConfig);
                const tasks = [...dailyTasks, ...regularTasks];

                for (const task of tasks) {
                  if (!task.is_completed) {
                    if (task.type !== 'code') {
                      console.log(`🔄 Completing Task ${task.id} - ${task.title} for ${account.username}...`.blue);
                      await sleep(3000); // Wait 3 seconds before completing
                      try {
                        const result = await completeTask(account.access_token, task.id, account.axiosConfig);
                        if (result.is_completed) {
                          console.log(`✅ Task ${task.id} - ${task.title} Completed for ${account.username}.`.green);
                        }
                      } catch (error) {
                        if (error.response && error.response.status === 400) {
                          console.log(`⚠️  The task ${task.id} - ${task.title} can't be completed for ${account.username}, please complete it manually`.red);
                        } else {
                          console.log(`❌ Error completing Task ${task.id} for ${account.username}: ${error.message}`.red);
                        }
                      }
                    } else {
                      console.log(`⚠️  Task ${task.id} - ${task.title} requires manual input. Please use 'Complete Tasks with Interactions' option.`.yellow);
                    }
                  } else {
                    console.log(`🔄 Task ${task.id} - ${task.title} is already completed for ${account.username}.`.yellow);
                  }
                }

                // Get updated user info after completing tasks
                const updatedUserInfo = await getUserInfo(account.access_token, account.user_id, account.axiosConfig);
                account.rating = updatedUserInfo.rating;
                console.log(`✅ Your points are now: ${account.rating}`.green);

              } catch (error) {
                console.log(`❌ Error completing tasks for ${account.username}: ${error.message}`.red);
              }
            });
            await sleep(1000); // Add 1-second delay between accounts
          }
          break;

        case 4:
          // Complete Tasks with Interactions
          await completeTasksWithInteractions(accounts);
          break;

        case 5:
          exit = true;
          console.log('👋 Exiting the application...'.yellow);
          break;

        default:
          console.log('⛔️ Invalid option. Please enter a valid number.'.red);
          break;
      }
    }
  } catch (error) {
    console.error('An error occurred in the main application:', error);
  }
})();
