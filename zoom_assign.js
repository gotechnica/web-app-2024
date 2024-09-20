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
const csv = require('csvtojson'); // using csvtojson to convert from... well, csv to json :/
const fs = require('fs'); // including Node.js file system module
const { exit } = require('process');
const devpostFile = "ai_submissions.csv";
const numRooms = 1; // number of max. breakout rooms per prize category
const lengthOfMeeting = 5; // in minutes, can be changed to whatever length of expo is
let startTime = new Date(2023, 9, 22, 12, 0); // time that expo starts, will start assigning demos from here (month is 0-based)
const physicalLocations = {} // dictionary mapping group name to physical location
const physicalTakenTimes = {}; // maps a prize category to set of its taken times
const virtualTakenTimes = {}; // virtual dict
let timeReference;
const finalCSV = []; // array of arays, will hold final results
let endTime = startTime;
let latestTableRow = 1;
let latestTableCol = 0;

const linkDict = { //dictionary mapping each prize category to gather link
  "Bloomberg: Best Hack Promoting Education or Public Health" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=IBOcPturRx6K1VSL8akC",
  "Capital One: Best Financial Hack" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=yN2qcnSpR7-_3FnrfGEY",
  "Best Education Hack" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=BSmzOgRfSw6aaiRle3HX",
  "Bloomberg Industry Group: Best AI Powered Solution" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=GRZdhnxVTPK5Lu4xVVwJ",
  "T. Rowe Price: Best Use of FinTech" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=IrPGEyT_Q8CmHheZ1QEN",
  "Optiver: Best Hack for Sustainability" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=I9cykNv1QkecnTqvd0D4",
  "Fannie Mae: Climate Change Sentiment Analysis and Impacts on Housing" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=r7yzD6LMSfKznT00-EUH",
  "CACI International: Most “Ever Vigilant” Hack Against Spyware" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=c6F6snDbRFOU9EtuudbC",
  "Best Gamification Hack - Create Your Own Reality" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=UHb47IZnR72t_VaKFK0H",
  "Best Accessibility Solution" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=J9G88MheRua2bdRNEF7t",
  "Best Startup Track Hack" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=GtOloWdhST-5pf0G3n1I",
  "Best Research Track Hack" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=IiY7hI5HQ0e9s7K3yMt8",
  "Best UI/UX Hack" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=9_-SdnUWRBmVbAJZ03IP",
  "Best Beginner Hack (College)" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=jya3rsCWQ2iRdOHUijIo",
  "Best Beginner Hack (Middle & High School)" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=j8ND0kojQtWSO-ReVluV",
  "Best Social Good Hack" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=F3O8WYesQ3aMLgCFevNq",
  "Best Active-Wellness/Health Hack - Herbal Apothecary" : "https://app.gather.town/app/2x7GW9NhurfCG9pf/Technica%202023-2024?spawnToken=a_qHUKY0SqW__K1BjBn_",
}

const mlhPrizes = new Set(["Best Use of Google Cloud", "Best Use of MongoDB Atlas", "Most Creative Use of GitHub", "Best Domain Name from GoDaddy Registry",
                           "Best Use of MATLAB", "Best Use of Hedera", "Best Use of Circle"])

function getGroupTable(groupName) {
  if (!physicalLocations[groupName]) {
    if(latestTableRow === 5 && latestTableCol === 10) {
      console.log("Number of in-person teams exceed table space, doubling up has occured")
      latestTableRow = 1;
      latestTableCol = 0;
    }

    let maxTables = function() {
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
    }();

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

// using csvtojson, convert to json and make it ez pz to work with
csv()
  .fromFile(devpostFile) // change this path to the devpost csv (not sorted by opt-in prize)
  .then(async (csvResult) => {
    csvResult.forEach( // iterate over all teams
      (item) => { // each item is a project name
        if (item['Project Title'] !== null && item['Project Status'] !== 'Draft' && item['Project Status'] !== 'Submitted (Hidden)' && item['Opt-In Prizes']) { // idk why drafts show up in this csv, but ignoring them is good
          let isVirtual = item['Attendance'] !== 'In-person'; // is this team presenting virtually or not?

          if (isVirtual) {
            timeReference = virtualTakenTimes;
          }
          else{
            timeReference = physicalTakenTimes;
          }
          let technicaPrizes = 0;
          let submitMlhPrize = false; // checks if team has submitted an mlh prize
          const personalTimes = {}; // stores timeslots this team is booked for, so as to not overlap demos
          const prizes = item['Opt-In Prizes'].split(','); // separate all opt-in prizes
          for (let i = 0; i < prizes.length; i++) { // iterate over all prize categories for this team (comma separated)
            let demoTime; // resultant time to give for this specific team
            let prizeName, sponsName; //current prize name and sponsor names
            // extract sponsor name from category ( this is for a format where the prize category is denoted as: "CategoryName - SponsorName" )
            
            // if submitted to mlh prize, don't assign anything
            let prizeString = prizes[i].trim();
            if (mlhPrizes.has(prizeString)) {
              technicaPrizes++;
              submitMlhPrize = true;
              continue;
            }
            console.log("hi")
            if (!prizeString.startsWith("Best")) { //non technica prize + mlhPrizes
              // [prizeName, sponsName] = prizeString; // eslint doesn't like this, but I don't care :))
              prizeString = prizeString.split(':')
              sponsName = prizeString[0].trim();
              prizeName = prizeString[1].trim();
              if (!linkDict[prizes[i].trim()]) {
                console.error("Oh no! I didn't find a location for \"" + prizes[i].trim() + "\"! check linkDict.");
                exit();
              }
            } else { //technica prize
              if (technicaPrizes > 2) {
                continue;
              } else {
                technicaPrizes++;
                prizeName = prizeString.trim();
                sponsName = 'Technica'; // since technica prizes don't say 'Technica'
              }
            }

            if (!timeReference[prizeName]) { // prize category hasn't been seen yet, initialize JSON object
              timeReference[prizeName] = {}; // nested json object, initialize new property for this sponsor
            }
            // now prize category is set, time to find a valid time
            demoTime = startTime; // start at the earliest possible time, then let's go through until we find a good fit!
            let timeResult = timeReference[prizeName][demoTime];
            // if the current sponsor already has at capacity for this time slot, OR the current team already has a demo for this time slot
            while ((typeof timeResult !== 'undefined' && timeResult >= numRooms) || personalTimes[demoTime]) { // if either of these mappings exist, the time won't work
              demoTime = new Date(demoTime.getTime() + lengthOfMeeting * 60000); // try next slot of meetings, increment by length of meeting
              timeResult = timeReference[prizeName][demoTime];
            }
            if (demoTime > endTime) { //keep track of latest demo time
              endTime = new Date(demoTime.getTime() + lengthOfMeeting * 60000);
            }
            let projectTitle = [item['Project Title']];
            if (projectTitle.toString().includes(',')) { //replace any comments in project title, can mess up csv
              projectTitle = projectTitle.toString().replace(",", "")
            }
            //in the case of breakout rooms, check if a demo is already present and if so, increment it. otherwise, assign to 1
            timeReference[prizeName][demoTime] = (timeResult) ? timeResult + 1 : 1; // update the dictionary entry, add a mapping for this time slot
            personalTimes[demoTime] = 1; // store that we now have a demo for this time slot
            finalCSV.push([projectTitle, demoTime, new Date(demoTime.getTime() + lengthOfMeeting * 60000), prizeName, sponsName, (isVirtual ? linkDict[prizes[i].trim()] : getGroupTable(projectTitle))]);
          }

          if (submitMlhPrize && !isVirtual) {
            let projectTitle = [item['Project Title']];
            finalCSV.push([projectTitle, "", "", "MLH Prizes", "MLH", getGroupTable(projectTitle)]);
          }
        }
      },
    );

    console.log(physicalTakenTimes)
    console.log(virtualTakenTimes)
    console.log(physicalLocations)

    let output = 'team_name,start_time,end_time,prize_category,sponsor_name,location\n'; // define headings
    finalCSV.forEach((row) => { // creating csv format from array of arrays
      output += `${row.join(',')}\n`;
    });
    // https://www.w3schools.com/nodejs/nodejs_filesystem.asp
    fs.writeFile('expo_schedule.csv', output, (err) => {
      if (err) throw err;
      console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\nSchedule Created & Saved Sucessfully! look at expo_schedule.csv for results :)\n\nYour expo starts at: \n-${startTime} \nand ends at: \n-${endTime}!\n\nBest of Luck :)\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
    });
  });