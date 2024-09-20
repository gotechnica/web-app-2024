/* this script reads data from the devpost csv stored in 'devpostFile',
then goes by project name and assigns each one to a zoom room and
outputs a csv with Project Name, Prize Category, Time, and location
for questions, reach out to Faris at farisalipk@gmail.com*/

/* HOW TO USE
  - Download Devpost Metrics CSV. Hackathon -> Manage Hackathon -> Metrics -> Generate report -> Download report
  - Below, update the file path accordingly
  - Execute node ./zoom_assign.js, and wait for Success Message
  - Go to expo_schedule.csv for results!
*/
/* NOTES
  - The script works with some specific formatting in Devpost. Make sure these are satisfied before downloading csv!
  - Don't sort by opt-in prize category
  - Opt-in prize category should be a list, with each entry being in the following format:
    - "NameOfPrizeCategory - SponsorName"
  - Depending on number of submissions and time parameters, there could be a non-ideal expo length!
  - Make sure your expo timing is what you want, there are details in the success message
*/
const csv = require("csvtojson"); // using csvtojson to convert from... well, csv to json :/
const fs = require("fs"); // including Node.js file system module
const { exit } = require("process");
const devpostFile = "ai_submissions.csv";
const numRooms = 1; // number of max. breakout rooms per prize category
const lengthOfMeeting = 5; // in minutes, can be changed to whatever length of expo is
let startTime = new Date(2023, 9, 22, 12, 0); // time that expo starts, will start assigning demos from here (month is 0-based)
const physicalLocations = {}; // dictionary mapping group name to physical location
const physicalTakenTimes = {}; // maps a prize category to set of its taken times
const virtualTakenTimes = {}; // virtual dict
let timeReference;
const finalCSV = []; // array of arays, will hold final results
let endTime = startTime;
let latestTableRow = 1;
let latestTableCol = 0;
const bufferTime = 30; // buffer between virtual and in-person

const linkDict = {
  //dictionary mapping each prize category to gather link
  "Bloomberg: Best Hack Promoting Education or Public Health":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=IBOcPturRx6K1VSL8akC",
  "Capital One: Best Financial Hack":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=yN2qcnSpR7-_3FnrfGEY",
  "Best Education Hack":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=BSmzOgRfSw6aaiRle3HX",
  "Bloomberg Industry Group: Best AI Powered Solution":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=GRZdhnxVTPK5Lu4xVVwJ",
  "T. Rowe Price: Best Use of FinTech":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=IrPGEyT_Q8CmHheZ1QEN",
  "Optiver: Best Hack for Sustainability":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=I9cykNv1QkecnTqvd0D4",
  "Fannie Mae: Climate Change Sentiment Analysis and Impacts on Housing":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=r7yzD6LMSfKznT00-EUH",
  "CACI International: Most “Ever Vigilant” Hack Against Spyware":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=c6F6snDbRFOU9EtuudbC",
  "Best Gamification Hack - Create Your Own Reality":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=UHb47IZnR72t_VaKFK0H",
  "Best Accessibility Solution":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=J9G88MheRua2bdRNEF7t",
  "Best Startup Track Hack":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=GtOloWdhST-5pf0G3n1I",
  "Best Research Track Hack":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=IiY7hI5HQ0e9s7K3yMt8",
  "Best UI/UX Hack":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=9_-SdnUWRBmVbAJZ03IP",
  "Best Beginner Hack (College)":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=jya3rsCWQ2iRdOHUijIo",
  "Best Beginner Hack (Middle & High School)":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=j8ND0kojQtWSO-ReVluV",
  "Best Social Good Hack":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=F3O8WYesQ3aMLgCFevNq",
  "Best Active-Wellness/Health Hack - Herbal Apothecary":
    "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=a_qHUKY0SqW__K1BjBn_",
};

const mlhPrizes = new Set([
  "Best Use of Google Cloud",
  "Best Use of MongoDB Atlas",
  "Most Creative Use of GitHub",
  "Best Domain Name from GoDaddy Registry",
  "Best Use of MATLAB",
  "Best Use of Hedera",
  "Best Use of Circle",
]);

function getGroupTable(groupName) {
  if (!physicalLocations[groupName]) {
    if (latestTableRow === 5 && latestTableCol === 10) {
      console.log(
        "Number of in-person teams exceed table space, doubling up has occured"
      );
      latestTableRow = 1;
      latestTableCol = 0;
    }

    let maxTables = (function () {
      switch (latestTableRow) {
        case 1:
          return 2;
        case 2:
        case 5:
          return 7;
        case 3:
        case 4:
          return 8;
        case 6:
          return 10;
        default:
          return 3;
      }
    })();

    if (latestTableRow === 15 && latestTableCol === maxTables) {
      latestTableRow = 5;
      latestTableCol = 10;
    } else if (latestTableCol === maxTables) {
      latestTableRow++;
      latestTableCol = 1;
    } else {
      latestTableCol++;
    }
    physicalLocations[groupName] = `${latestTableRow}.${latestTableCol}`;
  }
  return physicalLocations[groupName];
}

csv()
  .fromFile(devpostFile)
  .then(async (csvResult) => {
    // First, group teams by prize category
    const prizeCategoryTeams = {};

    csvResult.forEach((item) => {
      if (
        item["Project Title"] &&
        item["Project Status"] !== "Draft" &&
        item["Opt-In Prizes"]
      ) {
        const isVirtual = item["Attendance"] !== "In-person";
        const prizes = item["Opt-In Prizes"]
          .split(",")
          .map((prize) => prize.trim());

        prizes.forEach((prizeCategory) => {
          if (mlhPrizes.has(prizeCategory)) return; // Skip MLH prizes
          if (!prizeCategoryTeams[prizeCategory])
            prizeCategoryTeams[prizeCategory] = { virtual: [], inPerson: [] };

          // Group by virtual and in-person
          if (isVirtual) {
            prizeCategoryTeams[prizeCategory].virtual.push(item);
          } else {
            prizeCategoryTeams[prizeCategory].inPerson.push(item);
          }
        });
      }
    });

    // Now, assign times for each prize category, prioritizing virtual teams first
    for (const [prizeCategory, teams] of Object.entries(prizeCategoryTeams)) {
      if (!virtualTakenTimes[prizeCategory])
        virtualTakenTimes[prizeCategory] = {};
      if (!physicalTakenTimes[prizeCategory])
        physicalTakenTimes[prizeCategory] = {};

      let currentVirtualTime = startTime;
      let currentInPersonTime = startTime;

      const timeReference = {
        virtual: virtualTakenTimes[prizeCategory],
        inPerson: physicalTakenTimes[prizeCategory],
      };

      const assignTime = (team, isVirtual) => {
        const takenTimes = isVirtual
          ? timeReference.virtual
          : timeReference.inPerson;
        let currentTime = isVirtual ? currentVirtualTime : currentInPersonTime;
        const personalTimes = {}; // Track this team's assigned times

        // Find an available time slot for the team
        let demoTime = currentTime;
        let timeResult = takenTimes[demoTime];

        while (
          (typeof timeResult !== "undefined" && timeResult >= numRooms) ||
          personalTimes[demoTime]
        ) {
          demoTime = new Date(demoTime.getTime() + lengthOfMeeting * 60000);
          timeResult = takenTimes[demoTime];
        }

        // Mark the time as taken
        takenTimes[demoTime] = timeResult ? timeResult + 1 : 1;
        personalTimes[demoTime] = true;

        // Update the current time for the next team
        if (isVirtual) {
          currentVirtualTime = new Date(
            demoTime.getTime() + lengthOfMeeting * 60000
          );
        } else {
          currentInPersonTime = new Date(
            demoTime.getTime() + lengthOfMeeting * 60000
          );
        }

        // Add the assigned time to the final CSV
        finalCSV.push([
          team["Project Title"],
          demoTime,
          new Date(demoTime.getTime() + lengthOfMeeting * 60000),
          prizeCategory,
          isVirtual
            ? linkDict[prizeCategory]
            : getGroupTable(team["Project Title"]), // Replace with actual location logic
        ]);

        // Update the latest end time
        endTime = new Date(demoTime.getTime() + lengthOfMeeting * 60000);
      };

      // Schedule virtual teams first
      if (teams.virtual.length > 0) {
        teams.virtual.forEach((team) => assignTime(team, true));

        // Apply buffer between virtual and in-person judging only if there are virtual teams
        currentInPersonTime = new Date(
          currentVirtualTime.getTime() + bufferTime * 60000
        );
      }
      // Schedule in-person teams next
      teams.inPerson.forEach((team) => assignTime(team, false));
    }

    // Create CSV output
    let output = "team_name,start_time,end_time,prize_category,location\n";
    finalCSV.forEach((row) => {
      output += `${row.join(",")}\n`;
    });

    fs.writeFile("expo_schedule.csv", output, (err) => {
      if (err) throw err;
      console.log(
        `Schedule Created & Saved! Look at expo_schedule.csv for results.`
      );
    });
  });
