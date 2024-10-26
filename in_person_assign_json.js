const csv = require("csvtojson");
const fs = require("fs");
const { exit } = require("process");
const devpostFile = "testdata.csv";
const numRooms = 2;
const lengthOfMeeting = 5;
let startTime = new Date(2024, 9, 26, 12, 0);
const physicalLocations = {};
const physicalTakenTimes = {};
const virtualTakenTimes = {};
let timeReference;
const finalData = [];
let endTime = startTime;
let counter = 0;
let numSponsors = {
  "Bloomberg Industry Group: LegalLeaks - Detecting data contamination and memorization in Law Datasets": 1,
  "Cheshire Classroom Creation: Best Education Hack": 1,
  "Bloomberg Industry Group: Best AI Powered Solution": 1,
  "Queen of Hearts Game Changer: Best Gamification Hack": 1,
  "WonderBridge Connecting All Users: Best Accessibility Solution": 1,
  "Best Startup Track Hack": 1,
  "Best Research Track Hack": 1,
  "Hearts of Good Award: Best Hack for Social Good": 1,
  "ICF: Best Hack for Real-World Change": 1,
  "Looking Glass Glam: Best UI/UX Hack": 1,
  "Alice's Brave Venture: Best Beginner Hack (College)": 1,
  "Wonderland's First Steps: Best Beginner Hack (Middle & High School)": 1,
  "The Queen's Vitality Tonic: Best Active-Wellness/Health Hack": 1,
};

const linkDict = {
  "Bloomberg: Best Hack Promoting Education or Public Health": "https://example.com/1",
  "Capital One: Best Financial Hack": "https://example.com/2",
  "Cheshire Classroom Creation: Best Education Hack": "https://example.com/3",
  // ...other prize categories
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
    counter += 1;
    physicalLocations[groupName] = `${counter}`;
  }
  return physicalLocations[groupName];
}

csv()
  .fromFile(devpostFile)
  .then(async (csvResult) => {
    csvResult.forEach((item) => {
      if (
        item["Project Title"] !== null &&
        item["Project Status"] !== "Draft" &&
        item["Project Status"] !== "Submitted (Hidden)" &&
        item["Opt-In Prizes"]
      ) {
        let isVirtual = item["Are You Being Judged In Person Or Virtually?"] !== "in-person";
        timeReference = isVirtual ? virtualTakenTimes : physicalTakenTimes;
        let technicaPrizes = 0;
        let submitMlhPrize = false;
        const personalTimes = {};
        const prizes = item["Opt-In Prizes"].split(",");
        for (let i = 0; i < prizes.length; i++) {
          let demoTime;
          let prizeName, sponsName;
          let prizeString = prizes[i].trim();
          if (mlhPrizes.has(prizeString)) {
            technicaPrizes++;
            submitMlhPrize = true;
            continue;
          }
          if (!prizeString.startsWith("Best")) {
            prizeString = prizeString.split(":");
            sponsName = prizeString[0].trim();
            prizeName = prizeString[1].trim();
          } else {
            if (technicaPrizes > 2) continue;
            technicaPrizes++;
            prizeName = prizeString.trim();
            sponsName = "Technica";
          }

          if (!timeReference[prizeName]) {
            timeReference[prizeName] = {};
          }
          demoTime = startTime;
          let timeResult = timeReference[prizeName][demoTime];
          while (
            (typeof timeResult !== "undefined" && timeResult >= numRooms) ||
            personalTimes[demoTime]
          ) {
            demoTime = new Date(demoTime.getTime() + lengthOfMeeting * 60000);
            timeResult = timeReference[prizeName][demoTime];
          }
          if (demoTime > endTime) {
            endTime = new Date(demoTime.getTime() + lengthOfMeeting * 60000);
          }

          timeReference[prizeName][demoTime] = timeResult ? timeResult + 1 : 1;
          personalTimes[demoTime] = 1;
          finalData.push({
            team_name: item["Project Title"],
            start_time: demoTime,
            end_time: new Date(demoTime.getTime() + lengthOfMeeting * 60000),
            prize_category: prizeName,
            sponsor_name: sponsName,
            location: isVirtual ? null : getGroupTable(item["Project Title"]),
          });
        }

        if (submitMlhPrize && !isVirtual) {
          finalData.push({
            team_name: item["Project Title"],
            start_time: "",
            end_time: "",
            prize_category: "MLH Prizes",
            sponsor_name: "MLH",
            location: getGroupTable(item["Project Title"]),
          });
        }
      }
    });

    fs.writeFile("test_data_schedule.json", JSON.stringify(finalData, null, 2), (err) => {
      if (err) throw err;
      console.log(
        `~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\nSchedule Created & Saved Sucessfully! Look at test_data_schedule.json for results :)\n\nYour expo starts at: \n-${startTime} \nand ends at: \n-${endTime}!\n\nBest of Luck :)\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`
      );
    });
  });